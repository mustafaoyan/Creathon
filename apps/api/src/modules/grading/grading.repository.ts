import { eq, and, isNull } from "drizzle-orm";
import type { Database } from "../../shared/db/client";
import { aiEvaluations, finalGrades, studentAnswers, questions } from "../../shared/db/schema";
import { newId } from "../../shared/lib/id";

export const gradingRepository = {
  /** AI evaluations still awaiting an instructor's final decision. */
  pendingReviews(db: Database) {
    return db
      .select({
        evaluationId: aiEvaluations.id,
        studentAnswerId: aiEvaluations.studentAnswerId,
        suggestedScore: aiEvaluations.suggestedScore,
        justification: aiEvaluations.justification,
        criteriaBreakdown: aiEvaluations.criteriaBreakdown,
        answerText: studentAnswers.answerText,
        questionBody: questions.body,
        attemptId: studentAnswers.attemptId,
      })
      .from(aiEvaluations)
      .innerJoin(studentAnswers, eq(studentAnswers.id, aiEvaluations.studentAnswerId))
      .innerJoin(questions, eq(questions.id, studentAnswers.questionId))
      .leftJoin(finalGrades, eq(finalGrades.studentAnswerId, aiEvaluations.studentAnswerId))
      .where(isNull(finalGrades.id));
  },

  async findEvaluationByAnswer(db: Database, studentAnswerId: string) {
    const [row] = await db
      .select()
      .from(aiEvaluations)
      .where(eq(aiEvaluations.studentAnswerId, studentAnswerId))
      .limit(1);
    return row ?? null;
  },

  async finalGradeFor(db: Database, studentAnswerId: string) {
    const [row] = await db.select().from(finalGrades).where(eq(finalGrades.studentAnswerId, studentAnswerId)).limit(1);
    return row ?? null;
  },

  async finalize(
    db: Database,
    data: {
      studentAnswerId: string;
      aiEvaluationId: string | null;
      score: number;
      gradedBy: string;
      overrideReason: string | null;
    },
  ) {
    await db
      .insert(finalGrades)
      .values({ id: newId("grade"), gradedAt: new Date(), ...data })
      .onConflictDoUpdate({
        target: finalGrades.studentAnswerId,
        set: {
          score: data.score,
          overrideReason: data.overrideReason,
          gradedBy: data.gradedBy,
          gradedAt: new Date(),
        },
      });
  },

  /** Open-ended answers in this attempt that don't have a final grade yet. */
  async remainingOpenEndedCount(db: Database, attemptId: string) {
    const rows = await db
      .select({ id: studentAnswers.id })
      .from(studentAnswers)
      .innerJoin(questions, eq(questions.id, studentAnswers.questionId))
      .leftJoin(finalGrades, eq(finalGrades.studentAnswerId, studentAnswers.id))
      .where(
        and(eq(studentAnswers.attemptId, attemptId), eq(questions.type, "open_ended"), isNull(finalGrades.id)),
      );
    return rows.length;
  },
};
