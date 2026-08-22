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

  async publish(env: Bindings, examId: string) {
    await examsRepository.publish(createDb(env.DB), examId);
  },

  async assignStudents(env: Bindings, examId: string, studentIds: string[]) {
    await examsRepository.assignStudents(createDb(env.DB), examId, studentIds);
  },

  listForStudent(env: Bindings, studentId: string) {
    return examsRepository.assignmentsForStudent(createDb(env.DB), studentId);
  },

  async startAttempt(env: Bindings, examId: string, studentId: string) {
    const db = createDb(env.DB);
    const assignment = await examsRepository.findAssignment(db, examId, studentId);
    if (!assignment) throw new HttpError(403, "not_assigned_to_exam");

    let attempt = await examsRepository.findAttemptByAssignment(db, assignment.id);
    if (!attempt) {
      const attemptId = await examsRepository.createAttempt(db, assignment.id);
      await examsRepository.setAssignmentStatus(db, assignment.id, "in_progress");
      attempt = await examsRepository.findAttemptByAssignment(db, assignment.id);
    }

    const examQuestions = await examsRepository.questionsFor(db, examId);
    return { attempt, questions: examQuestions };
  },

  async answer(
    env: Bindings,
    attemptId: string,
    data: { questionId: string; selectedOptionId?: string; answerText?: string },
  ) {
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

    const examQuestionRows = await examsRepository.questionsFor(db, examId);
    const answers = await examsRepository.answersForAttempt(db, attemptId);
    const ai = createAiServices(env);

    let mcqSubtotal = 0;

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

      const question = await questionsRepository.findById(db, examQuestion.questionId);
      if (!question?.rubricId || !answer.answerText) continue;

      const rubric = await rubricsRepository.findById(db, question.rubricId);
      if (!rubric) continue;
      const criteria = await rubricsRepository.criteriaFor(db, question.rubricId);

      const evaluation = await ai.answerScorer.score({
        questionBody: question.body,
        studentAnswer: answer.answerText,
        rubric: {
          maxScore: rubric.maxScore,
          criteria: criteria.map((c) => ({
            id: c.id,
            criterion: c.criterion,
            description: c.description,
            weight: c.weight,
          })),
        },
      });

      await db.insert(aiEvaluations).values({
        id: newId("aieval"),
        studentAnswerId: answer.id,
        rubricId: rubric.id,
        suggestedScore: evaluation.suggestedScore,
        justification: evaluation.justification,
        criteriaBreakdown: JSON.stringify(evaluation.criteriaBreakdown),
        aiProvider: ai.providerLabel,
        createdAt: new Date(),
      });
    }

    await examsRepository.markSubmitted(db, attemptId, mcqSubtotal);
    await examsRepository.setAssignmentStatus(db, attempt.examAssignmentId, "submitted");

    return { mcqSubtotal };
  },
};
