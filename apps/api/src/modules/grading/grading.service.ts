import type { Bindings } from "../../config/env";
import { createDb, type Database } from "../../shared/db/client";
import { gradingRepository } from "./grading.repository";
import { examsRepository } from "../exams/exams.repository";
import { questionsRepository } from "../questions/questions.repository";
import { rubricsRepository } from "../rubrics/rubrics.repository";
import { HttpError } from "../../shared/middleware/error-handler";

export const gradingService = {
  pendingReviews(env: Bindings) {
    return gradingRepository.pendingReviews(createDb(env.DB));
  },

  async finalizeGrade(
    env: Bindings,
    params: { studentAnswerId: string; score: number; gradedBy: string; overrideReason?: string },
  ) {
    const db = createDb(env.DB);
    const evaluation = await gradingRepository.findEvaluationByAnswer(db, params.studentAnswerId);
    if (!evaluation) throw new HttpError(404, "ai_evaluation_not_found");

    await gradingRepository.finalize(db, {
      studentAnswerId: params.studentAnswerId,
      aiEvaluationId: evaluation.id,
      score: params.score,
      gradedBy: params.gradedBy,
      overrideReason: params.overrideReason ?? null,
    });

    const answer = await examsRepository.findAnswerById(db, params.studentAnswerId);
    if (answer) await recomputeAttemptIfComplete(db, answer.attemptId);
  },
};

/** Once every open-ended answer in an attempt has an instructor-approved grade,
 * recompute the attempt's final total (MCQ auto-score + weighted rubric scores)
 * and flip the assignment to `graded`. */
async function recomputeAttemptIfComplete(db: Database, attemptId: string) {
  const remaining = await gradingRepository.remainingOpenEndedCount(db, attemptId);
  if (remaining > 0) return;

  const attempt = await examsRepository.findAttemptById(db, attemptId);
  if (!attempt) return;
  const assignment = await examsRepository.findAssignmentById(db, attempt.examAssignmentId);
  if (!assignment) return;

  const examQuestionRows = await examsRepository.questionsFor(db, assignment.examId);
  const answers = await examsRepository.answersForAttempt(db, attemptId);

  let total = 0;
  for (const examQuestion of examQuestionRows) {
    const answer = answers.find((a) => a.questionId === examQuestion.questionId);
    if (!answer) continue;

    if (examQuestion.type === "multiple_choice") {
      const correctOptions = await examsRepository.correctOptionFor(db, examQuestion.questionId);
      if (correctOptions.some((option) => option.id === answer.selectedOptionId)) {
        total += examQuestion.points;
      }
      continue;
    }

    const grade = await gradingRepository.finalGradeFor(db, answer.id);
    const question = await questionsRepository.findById(db, examQuestion.questionId);
    if (!grade || !question?.rubricId) continue;

    const rubric = await rubricsRepository.findById(db, question.rubricId);
    if (!rubric) continue;

    total += (grade.score / rubric.maxScore) * examQuestion.points;
  }

  await examsRepository.updateAttemptTotal(db, attemptId, total);
  await examsRepository.setAssignmentStatus(db, assignment.id, "graded");
}
