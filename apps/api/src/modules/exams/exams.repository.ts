import { eq, and, desc, isNull } from "drizzle-orm";
import type { Database } from "../../shared/db/client";
import {
  exams,
  examQuestions,
  examAssignments,
  examAttempts,
  examAllowedEmails,
  studentAnswers,
  questions,
  questionOptions,
  aiEvaluations,
  finalGrades,
  users,
  type AssignmentStatus,
} from "../../shared/db/schema";
import { newId } from "../../shared/lib/id";
import { normalizeEmail } from "../../shared/lib/normalize-email";

export const examsRepository = {
  async create(db: Database, data: { title: string; createdBy: string; durationMinutes: number | null }) {
    const id = newId("exam");
    await db.insert(exams).values({
      id,
      title: data.title,
      createdBy: data.createdBy,
      durationMinutes: data.durationMinutes,
      status: "draft",
      createdAt: new Date(),
    });
    return id;
  },

  async findById(db: Database, id: string) {
    const [row] = await db.select().from(exams).where(eq(exams.id, id)).limit(1);
    return row ?? null;
  },

  list(db: Database) {
    return db.select().from(exams).orderBy(desc(exams.createdAt));
  },

  async addQuestions(db: Database, examId: string, items: { questionId: string; points: number }[]) {
    await db.insert(examQuestions).values(
      items.map((item, index) => ({
        id: newId("examq"),
        examId,
        questionId: item.questionId,
        orderIndex: index,
        points: item.points,
      })),
    );
  },

  questionsFor(db: Database, examId: string) {
    return db
      .select({
        id: examQuestions.id,
        questionId: examQuestions.questionId,
        orderIndex: examQuestions.orderIndex,
        points: examQuestions.points,
        type: questions.type,
        body: questions.body,
      })
      .from(examQuestions)
      .innerJoin(questions, eq(questions.id, examQuestions.questionId))
      .where(eq(examQuestions.examId, examId))
      .orderBy(examQuestions.orderIndex);
  },

  async publish(db: Database, examId: string) {
    await db.update(exams).set({ status: "published" }).where(eq(exams.id, examId));
  },

  async addAllowedEmails(db: Database, examId: string, emails: string[]) {
    if (emails.length === 0) return;
    await db
      .insert(examAllowedEmails)
      .values(emails.map((email) => ({ id: newId("examallow"), examId, email: normalizeEmail(email) })))
      .onConflictDoNothing();
  },

  listAllowedEmails(db: Database, examId: string) {
    return db.select({ email: examAllowedEmails.email }).from(examAllowedEmails).where(eq(examAllowedEmails.examId, examId));
  },

  /** Boş liste = herkese açık (mevcut varsayılan davranış). Liste doluysa sadece
   * o e-postalar erişebilir. */
  async isStudentAllowed(db: Database, examId: string, studentEmail: string) {
    const allowed = await db
      .select({ email: examAllowedEmails.email })
      .from(examAllowedEmails)
      .where(eq(examAllowedEmails.examId, examId));
    if (allowed.length === 0) return true;
    const normalized = normalizeEmail(studentEmail);
    return allowed.some((row) => row.email === normalized);
  },

  /** Öğrenci elle seçilmiyor artık — yayınlanmış her sınav, giren her öğrenciye
   * açık. onConflictDoNothing kasıtlı: aynı öğrenci için tekrar çağrılırsa
   * (ör. startAttempt'teki "kayıt anında ata" yolu ile çift tıklama/yarış
   * durumu) unique(examId, studentId) kısıtı hata fırlatmasın. */
  async assignStudents(db: Database, examId: string, studentIds: string[]) {
    await db
      .insert(examAssignments)
      .values(
        studentIds.map((studentId) => ({
          id: newId("assign"),
          examId,
          studentId,
          status: "assigned" as const,
          assignedAt: new Date(),
        })),
      )
      .onConflictDoNothing();
  },

  /** Yayınlanmış tüm sınavlar — bir öğrencinin henüz hiç görmediği (assignment
   * kaydı olmayan) sınavları da listesine eklemek için kullanılıyor. */
  listPublished(db: Database) {
    return db
      .select({ id: exams.id, title: exams.title, durationMinutes: exams.durationMinutes })
      .from(exams)
      .where(eq(exams.status, "published"));
  },

  assignmentsForStudent(db: Database, studentId: string) {
    return db
      .select({
        id: examAssignments.id,
        examId: examAssignments.examId,
        status: examAssignments.status,
        title: exams.title,
        durationMinutes: exams.durationMinutes,
        totalScore: examAttempts.totalScore,
        submittedAt: examAttempts.submittedAt,
      })
      .from(examAssignments)
      .innerJoin(exams, eq(exams.id, examAssignments.examId))
      .leftJoin(examAttempts, eq(examAttempts.examAssignmentId, examAssignments.id))
      .where(eq(examAssignments.studentId, studentId));
  },

  async findAssignment(db: Database, examId: string, studentId: string) {
    const [row] = await db
      .select()
      .from(examAssignments)
      .where(and(eq(examAssignments.examId, examId), eq(examAssignments.studentId, studentId)))
      .limit(1);
    return row ?? null;
  },

  async findAssignmentById(db: Database, id: string) {
    const [row] = await db.select().from(examAssignments).where(eq(examAssignments.id, id)).limit(1);
    return row ?? null;
  },

  async setAssignmentStatus(db: Database, id: string, status: AssignmentStatus) {
    await db.update(examAssignments).set({ status }).where(eq(examAssignments.id, id));
  },

  async createAttempt(db: Database, examAssignmentId: string) {
    const id = newId("attempt");
    await db.insert(examAttempts).values({ id, examAssignmentId, startedAt: new Date() });
    return id;
  },

  async findAttemptById(db: Database, id: string) {
    const [row] = await db.select().from(examAttempts).where(eq(examAttempts.id, id)).limit(1);
    return row ?? null;
  },

  async findAttemptByAssignment(db: Database, examAssignmentId: string) {
    const [row] = await db
      .select()
      .from(examAttempts)
      .where(eq(examAttempts.examAssignmentId, examAssignmentId))
      .limit(1);
    return row ?? null;
  },

  async upsertAnswer(
    db: Database,
    data: { attemptId: string; questionId: string; selectedOptionId?: string | null; answerText?: string | null },
  ) {
    await db
      .insert(studentAnswers)
      .values({
        id: newId("answer"),
        attemptId: data.attemptId,
        questionId: data.questionId,
        selectedOptionId: data.selectedOptionId ?? null,
        answerText: data.answerText ?? null,
        answeredAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [studentAnswers.attemptId, studentAnswers.questionId],
        set: {
          selectedOptionId: data.selectedOptionId ?? null,
          answerText: data.answerText ?? null,
          answeredAt: new Date(),
        },
      });
  },

  answersForAttempt(db: Database, attemptId: string) {
    return db.select().from(studentAnswers).where(eq(studentAnswers.attemptId, attemptId));
  },

  async findAnswerById(db: Database, id: string) {
    const [row] = await db.select().from(studentAnswers).where(eq(studentAnswers.id, id)).limit(1);
    return row ?? null;
  },

  /** Bir soruya verilmiş ama hiç AI değerlendirmesi oluşmamış cevaplar —
   * rubriksiz onaylanan bir açık uçlu soruya sonradan rubrik eklendiğinde
   * geriye dönük puanlama (regradeAnswersForQuestion) için kullanılıyor. */
  ungradedAnswersForQuestion(db: Database, questionId: string) {
    return db
      .select({ id: studentAnswers.id, answerText: studentAnswers.answerText })
      .from(studentAnswers)
      .leftJoin(aiEvaluations, eq(aiEvaluations.studentAnswerId, studentAnswers.id))
      .where(and(eq(studentAnswers.questionId, questionId), isNull(aiEvaluations.id)));
  },

  async markSubmitted(db: Database, attemptId: string, partialTotalScore: number) {
    await db
      .update(examAttempts)
      .set({ submittedAt: new Date(), totalScore: partialTotalScore })
      .where(eq(examAttempts.id, attemptId));
  },

  async updateAttemptTotal(db: Database, attemptId: string, totalScore: number) {
    await db.update(examAttempts).set({ totalScore }).where(eq(examAttempts.id, attemptId));
  },

  correctOptionFor(db: Database, questionId: string) {
    return db
      .select()
      .from(questionOptions)
      .where(and(eq(questionOptions.questionId, questionId), eq(questionOptions.isCorrect, true)));
  },

  // Student-facing: excludes isCorrect so the answer key never reaches the client.
  optionsForQuestion(db: Database, questionId: string) {
    return db
      .select({ id: questionOptions.id, label: questionOptions.label, body: questionOptions.body })
      .from(questionOptions)
      .where(eq(questionOptions.questionId, questionId))
      .orderBy(questionOptions.orderIndex);
  },

  // Eğitmenin sonuçlar ekranı — bu sınava atanmış/giren her öğrenci ayrı satır,
  // isme göre sıralı ("öğrencilerin puanını isim ve soyismine göre girsin").
  resultsForExam(db: Database, examId: string) {
    return db
      .select({
        assignmentId: examAssignments.id,
        studentId: examAssignments.studentId,
        studentName: users.name,
        studentEmail: users.email,
        status: examAssignments.status,
        totalScore: examAttempts.totalScore,
        submittedAt: examAttempts.submittedAt,
      })
      .from(examAssignments)
      .innerJoin(users, eq(users.id, examAssignments.studentId))
      .leftJoin(examAttempts, eq(examAttempts.examAssignmentId, examAssignments.id))
      .where(eq(examAssignments.examId, examId))
      .orderBy(users.name);
  },

  // Eğitmenin bir öğrencinin cevaplarını + AI değerlendirmelerini görebildiği
  // detay ekranı — soru sırasına göre (examQuestions.orderIndex).
  async answersForStudentInExam(db: Database, examId: string, studentId: string) {
    const [assignment] = await db
      .select({ id: examAssignments.id })
      .from(examAssignments)
      .where(and(eq(examAssignments.examId, examId), eq(examAssignments.studentId, studentId)))
      .limit(1);
    if (!assignment) return [];

    const [attempt] = await db
      .select({ id: examAttempts.id })
      .from(examAttempts)
      .where(eq(examAttempts.examAssignmentId, assignment.id))
      .limit(1);
    if (!attempt) return [];

    const rows = await db
      .select({
        examQuestionId: examQuestions.id,
        orderIndex: examQuestions.orderIndex,
        points: examQuestions.points,
        questionId: questions.id,
        questionBody: questions.body,
        questionType: questions.type,
        selectedOptionId: studentAnswers.selectedOptionId,
        answerText: studentAnswers.answerText,
        aiSuggestedScore: aiEvaluations.suggestedScore,
        aiJustification: aiEvaluations.justification,
        aiCriteriaBreakdown: aiEvaluations.criteriaBreakdown,
        finalScore: finalGrades.score,
      })
      .from(examQuestions)
      .innerJoin(questions, eq(questions.id, examQuestions.questionId))
      .leftJoin(
        studentAnswers,
        and(eq(studentAnswers.attemptId, attempt.id), eq(studentAnswers.questionId, examQuestions.questionId)),
      )
      .leftJoin(aiEvaluations, eq(aiEvaluations.studentAnswerId, studentAnswers.id))
      .leftJoin(finalGrades, eq(finalGrades.studentAnswerId, studentAnswers.id))
      .where(eq(examQuestions.examId, examId))
      .orderBy(examQuestions.orderIndex);

    // Çoktan seçmeli sorularda doğru şıkkı + tüm şıkları da ekliyoruz ki
    // eğitmen öğrencinin neyi işaretlediğini doğru cevapla karşılaştırabilsin.
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        options:
          row.questionType === "multiple_choice"
            ? await db
                .select({
                  id: questionOptions.id,
                  label: questionOptions.label,
                  body: questionOptions.body,
                  isCorrect: questionOptions.isCorrect,
                })
                .from(questionOptions)
                .where(eq(questionOptions.questionId, row.questionId))
                .orderBy(questionOptions.orderIndex)
            : undefined,
      })),
    );
  },
};
