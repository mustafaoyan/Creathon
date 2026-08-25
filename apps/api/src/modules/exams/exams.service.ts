import type { Bindings } from "../../config/env";
import { createDb } from "../../shared/db/client";
import { createAiServices } from "../../ai/ai.factory";
import { examsRepository } from "./exams.repository";
import { rubricsRepository } from "../rubrics/rubrics.repository";
import { questionsRepository } from "../questions/questions.repository";
import { HttpError } from "../../shared/middleware/error-handler";
import { newId } from "../../shared/lib/id";
import { aiEvaluations } from "../../shared/db/schema";

export const examsService = {
  async create(
    env: Bindings,
    data: {
      title: string;
      createdBy: string;
      durationMinutes?: number;
      questionIds: { questionId: string; points: number }[];
    },
  ) {
    const db = createDb(env.DB);
    const examId = await examsRepository.create(db, {
      title: data.title,
      createdBy: data.createdBy,
      durationMinutes: data.durationMinutes ?? null,
    });

    if (data.questionIds.length > 0) {
      await examsRepository.addQuestions(db, examId, data.questionIds);
    }

    return examId;
  },

  list(env: Bindings) {
    return examsRepository.list(createDb(env.DB));
  },

  async publish(env: Bindings, examId: string) {
    await examsRepository.publish(createDb(env.DB), examId);
  },

  async assignStudents(env: Bindings, examId: string, studentIds: string[]) {
    await examsRepository.assignStudents(createDb(env.DB), examId, studentIds);
  },

  /** Öğrenci elle seçilip atanmıyor artık — yayınlanmış her sınav, giren her
   * öğrenciye görünür. Gerçek assignment kaydı olanlar (durumu/puanı takip
   * edilenler) + henüz hiç görülmemiş yayınlanmış sınavlar (sanal "assigned"
   * satırı) birleştiriliyor; gerçek kayıt startAttempt'te ilk girişte oluşuyor. */
  async listForStudent(env: Bindings, studentId: string) {
    const db = createDb(env.DB);
    const [assigned, published] = await Promise.all([
      examsRepository.assignmentsForStudent(db, studentId),
      examsRepository.listPublished(db),
    ]);

    const assignedExamIds = new Set(assigned.map((a) => a.examId));
    const notYetSeen = published
      .filter((exam) => !assignedExamIds.has(exam.id))
      .map((exam) => ({
        id: `virtual_${exam.id}`,
        examId: exam.id,
        status: "assigned" as const,
        title: exam.title,
        durationMinutes: exam.durationMinutes,
        totalScore: null,
        submittedAt: null,
      }));

    return [...assigned, ...notYetSeen];
  },

  async startAttempt(env: Bindings, examId: string, studentId: string) {
    const db = createDb(env.DB);
    let assignment = await examsRepository.findAssignment(db, examId, studentId);
    if (!assignment) {
      // Öğrenci daha önce bu sınava hiç bakmamış — yayınlanmışsa şimdi
      // (ilk girişte, lazy) kendisine atanıyor. Yayınlanmamış/silinmiş bir
      // sınava kimse giremez.
      const exam = await examsRepository.findById(db, examId);
      if (!exam || exam.status !== "published") throw new HttpError(403, "exam_not_available");
      await examsRepository.assignStudents(db, examId, [studentId]);
      assignment = await examsRepository.findAssignment(db, examId, studentId);
      if (!assignment) throw new HttpError(500, "assignment_creation_failed");
    }

    let attempt = await examsRepository.findAttemptByAssignment(db, assignment.id);
    // Bir kez "Sınavı Bitir" denince bir daha geri girilemez — istemci taraflı
    // buton gizleme tek başına yeterli değil (eski/cache'li liste, doğrudan
    // API çağrısı vb. ile atlanabilir), asıl kesinti burada.
    if (attempt?.submittedAt) throw new HttpError(409, "exam_already_submitted");

    if (!attempt) {
      const attemptId = await examsRepository.createAttempt(db, assignment.id);
      await examsRepository.setAssignmentStatus(db, assignment.id, "in_progress");
      attempt = await examsRepository.findAttemptByAssignment(db, assignment.id);
    }

    const exam = await examsRepository.findById(db, examId);
    const examQuestions = await examsRepository.questionsFor(db, examId);
    const questions = await Promise.all(
      examQuestions.map(async (question) => ({
        ...question,
        options:
          question.type === "multiple_choice"
            ? await examsRepository.optionsForQuestion(db, question.questionId)
            : undefined,
      })),
    );
    return { attempt, questions, durationMinutes: exam?.durationMinutes ?? null };
  },

  /** Süre dolduktan sonra yeni cevap kabul edilmez — istemci taraflı geri
   * sayım tek başına yeterli değil (biri devtools'tan cevap gönderebilir),
   * bu yüzden gerçek kesinti burada, sunucu tarafında yapılıyor. */
  async assertAttemptNotExpired(env: Bindings, attemptId: string) {
    const db = createDb(env.DB);
    const attempt = await examsRepository.findAttemptById(db, attemptId);
    if (!attempt) throw new HttpError(404, "attempt_not_found");

    const assignment = await examsRepository.findAssignmentById(db, attempt.examAssignmentId);
    if (!assignment) throw new HttpError(404, "assignment_not_found");

    const exam = await examsRepository.findById(db, assignment.examId);
    if (exam?.durationMinutes != null && attempt.startedAt) {
      const deadline = attempt.startedAt.getTime() + exam.durationMinutes * 60_000;
      if (Date.now() > deadline) throw new HttpError(403, "time_expired");
    }
  },

  async answer(
    env: Bindings,
    attemptId: string,
    data: { questionId: string; selectedOptionId?: string; answerText?: string },
  ) {
    await examsService.assertAttemptNotExpired(env, attemptId);
    await examsRepository.upsertAnswer(createDb(env.DB), { attemptId, ...data });
  },

  /**
   * MCQ answers are objectively auto-graded here. Open-ended answers get an AI
   * suggestion parked in `ai_evaluations` — the instructor still has to finalize
   * them via the grading module (human-in-the-loop) before they count.
   */
  async submit(env: Bindings, examId: string, attemptId: string) {
    const db = createDb(env.DB);
    const attempt = await examsRepository.findAttemptById(db, attemptId);
    if (!attempt) throw new HttpError(404, "attempt_not_found");
    if (attempt.submittedAt) throw new HttpError(409, "exam_already_submitted");

    const examQuestionRows = await examsRepository.questionsFor(db, examId);
    const answers = await examsRepository.answersForAttempt(db, attemptId);
    const ai = createAiServices(env);

    let mcqSubtotal = 0;
    const ungradableOpenEnded: string[] = [];

    for (const examQuestion of examQuestionRows) {
      const answer = answers.find((a) => a.questionId === examQuestion.questionId);
      if (!answer) continue;

      if (examQuestion.type === "multiple_choice") {
        const correctOptions = await examsRepository.correctOptionFor(db, examQuestion.questionId);
        if (correctOptions.some((option) => option.id === answer.selectedOptionId)) {
          mcqSubtotal += examQuestion.points;
        }
        continue;
      }

      if (!answer.answerText) continue;

      const question = await questionsRepository.findById(db, examQuestion.questionId);
      // Rubriksiz onaylanmış bir açık uçlu soru burada sessizce atlanırsa
      // öğrencinin cevabı hiçbir zaman değerlendirilemez hale geliyordu
      // (Puanlama Onayı panelinde asla görünmüyordu) — artık iş kaydına
      // düşüyor ki eğitmen/içerik uzmanı bunu görüp rubrik ekleyebilsin.
      if (!question?.rubricId) {
        ungradableOpenEnded.push(examQuestion.questionId);
        continue;
      }

      // Bir sorunun AI puanlaması başarısız olursa (geçici model/ağ hatası)
      // tüm gönderim çökmesin — öğrenci "buton çalışmıyor" hissiyle kalmasın.
      // Bu soru ungradableOpenEnded'e düşer, regrade endpoint'iyle sonradan
      // tekrar denenebilir (question.rubricId zaten var, sadece AI çağrısı
      // başarısız oldu).
      try {
        await scoreOpenEndedAnswer(db, ai, { questionId: question.id, answerId: answer.id, answerText: answer.answerText });
      } catch {
        ungradableOpenEnded.push(examQuestion.questionId);
      }
    }

    await examsRepository.markSubmitted(db, attemptId, mcqSubtotal);
    await examsRepository.setAssignmentStatus(db, attempt.examAssignmentId, "submitted");

    return { mcqSubtotal, ungradableOpenEnded };
  },

  /** Bir soruya sonradan rubrik eklendiğinde (ör. onaylanırken unutulmuş),
   * o soruya daha önce verilmiş ama hiç değerlendirilmemiş cevapları
   * geriye dönük puanlar — aksi halde o cevaplar kalıcı olarak "havada" kalır. */
  async regradeAnswersForQuestion(env: Bindings, questionId: string) {
    const db = createDb(env.DB);
    const question = await questionsRepository.findById(db, questionId);
    if (!question?.rubricId) throw new HttpError(422, "question_has_no_rubric");

    const ai = createAiServices(env);
    const pending = await examsRepository.ungradedAnswersForQuestion(db, questionId);

    let regraded = 0;
    let failed = 0;
    for (const answer of pending) {
      if (!answer.answerText) continue;
      // submit()'teki aynı gerekçe: bir cevabın puanlaması başarısız olursa
      // (ör. geçici AI hatası) diğer cevapların puanlanması engellenmesin,
      // tüm istek 500 ile çökmesin.
      try {
        await scoreOpenEndedAnswer(db, ai, { questionId, answerId: answer.id, answerText: answer.answerText });
        regraded++;
      } catch {
        failed++;
      }
    }

    return { regraded, failed };
  },
};

async function scoreOpenEndedAnswer(
  db: ReturnType<typeof createDb>,
  ai: ReturnType<typeof createAiServices>,
  params: { questionId: string; answerId: string; answerText: string },
) {
  const question = await questionsRepository.findById(db, params.questionId);
  if (!question?.rubricId) return;

  const rubric = await rubricsRepository.findById(db, question.rubricId);
  if (!rubric) return;
  const criteria = await rubricsRepository.criteriaFor(db, question.rubricId);

  const evaluation = await ai.answerScorer.score({
    questionBody: question.body,
    studentAnswer: params.answerText,
    rubric: {
      maxScore: rubric.maxScore,
      criteria: criteria.map((c) => ({ id: c.id, criterion: c.criterion, description: c.description, weight: c.weight })),
    },
  });

  await db.insert(aiEvaluations).values({
    id: newId("aieval"),
    studentAnswerId: params.answerId,
    rubricId: rubric.id,
    suggestedScore: evaluation.suggestedScore,
    justification: evaluation.justification,
    criteriaBreakdown: JSON.stringify(evaluation.criteriaBreakdown),
    aiProvider: ai.providerLabel,
    createdAt: new Date(),
  });
}
