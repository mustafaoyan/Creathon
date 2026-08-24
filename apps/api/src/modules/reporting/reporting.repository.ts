import { sql, eq, desc } from "drizzle-orm";
import type { Database } from "../../shared/db/client";
import {
  examAssignments,
  questions,
  aiEvaluations,
  finalGrades,
  learningOutcomes,
  studentAnswers,
  examAttempts,
  questionOptions,
  auditLogs,
  users,
} from "../../shared/db/schema";

export const reportingRepository = {
  async examCompletionStats(db: Database) {
    const [row] = await db
      .select({
        totalAssignments: sql<number>`count(*)`,
        submitted: sql<number>`sum(case when ${examAssignments.status} in ('submitted','graded') then 1 else 0 end)`,
        graded: sql<number>`sum(case when ${examAssignments.status} = 'graded' then 1 else 0 end)`,
      })
      .from(examAssignments);
    return row;
  },

  async aiQuestionAcceptanceRate(db: Database) {
    const [row] = await db
      .select({
        totalAiGenerated: sql<number>`count(*)`,
        approved: sql<number>`sum(case when ${questions.status} = 'approved' then 1 else 0 end)`,
        rejected: sql<number>`sum(case when ${questions.status} = 'rejected' then 1 else 0 end)`,
      })
      .from(questions)
      .where(eq(questions.aiGenerated, true));
    return row;
  },

  async aiScoringDeviation(db: Database) {
    const [row] = await db
      .select({
        sampleSize: sql<number>`count(*)`,
        avgAbsDeviation: sql<number>`avg(abs(${finalGrades.score} - ${aiEvaluations.suggestedScore}))`,
      })
      .from(finalGrades)
      .innerJoin(aiEvaluations, eq(aiEvaluations.id, finalGrades.aiEvaluationId));
    return row;
  },

  /** Raw per-answer rows for one student; aggregated into per-outcome mastery in the service layer. */
  studentOutcomeRows(db: Database, studentId: string) {
    return db
      .select({
        outcomeId: learningOutcomes.id,
        outcomeTitle: learningOutcomes.title,
        questionType: questions.type,
        isCorrect: questionOptions.isCorrect,
        finalScore: finalGrades.score,
      })
      .from(studentAnswers)
      .innerJoin(questions, eq(questions.id, studentAnswers.questionId))
      .innerJoin(learningOutcomes, eq(learningOutcomes.id, questions.learningOutcomeId))
      .innerJoin(examAttempts, eq(examAttempts.id, studentAnswers.attemptId))
      .innerJoin(examAssignments, eq(examAssignments.id, examAttempts.examAssignmentId))
      .leftJoin(finalGrades, eq(finalGrades.studentAnswerId, studentAnswers.id))
      .leftJoin(questionOptions, eq(questionOptions.id, studentAnswers.selectedOptionId))
      .where(eq(examAssignments.studentId, studentId));
  },

  /** Login/logout trail for the admin's audit view — newest first. */
  recentAuditLogs(db: Database, limit: number) {
    return db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        actorName: users.name,
        actorEmail: users.email,
        actorRole: users.role,
      })
      .from(auditLogs)
      .innerJoin(users, eq(users.id, auditLogs.actorId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  },
};
