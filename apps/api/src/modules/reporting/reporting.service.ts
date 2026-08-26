import type { Bindings } from "../../config/env";
import { createDb } from "../../shared/db/client";
import { reportingRepository } from "./reporting.repository";

type OutcomeRow = {
  outcomeId: string;
  outcomeTitle: string;
  outcomeCreatedAt: Date;
  questionType: string;
  isCorrect: boolean | null;
  finalScore: number | null;
  examId: string;
  examTitle: string;
  studentId: string;
};

/** Ungraded answers are excluded — they'd silently skew the average toward "weak" (ve exam/öğrenci
 * sayısına da katkı yapmasın, aynı "sadece değerlendirilmiş yanıtlar" kuralı geçerli). */
function aggregateByOutcome(rows: OutcomeRow[]) {
  const byOutcome = new Map<
    string,
    { title: string; createdAt: Date; scores: number[]; exams: Map<string, string>; students: Set<string> }
  >();

  for (const row of rows) {
    const score = row.questionType === "multiple_choice" ? (row.isCorrect ? 100 : 0) : (row.finalScore ?? null);
    if (score === null) continue;

    const bucket = byOutcome.get(row.outcomeId) ?? {
      title: row.outcomeTitle,
      createdAt: row.outcomeCreatedAt,
      scores: [],
      exams: new Map<string, string>(),
      students: new Set<string>(),
    };
    bucket.scores.push(score);
    bucket.exams.set(row.examId, row.examTitle);
    bucket.students.add(row.studentId);
    byOutcome.set(row.outcomeId, bucket);
  }

  return Array.from(byOutcome.entries()).map(([outcomeId, bucket]) => ({
    outcomeId,
    title: bucket.title,
    createdAt: bucket.createdAt,
    averageScore: bucket.scores.reduce((sum, score) => sum + score, 0) / bucket.scores.length,
    sampleSize: bucket.scores.length,
    studentCount: bucket.students.size,
    exams: Array.from(bucket.exams, ([id, title]) => ({ id, title })),
  }));
}

export const reportingService = {
  async dashboard(env: Bindings) {
    const db = createDb(env.DB);
    const [completion, aiAcceptance, aiDeviation] = await Promise.all([
      reportingRepository.examCompletionStats(db),
      reportingRepository.aiQuestionAcceptanceRate(db),
      reportingRepository.aiScoringDeviation(db),
    ]);

    return {
      examCompletion: completion,
      aiQuestionAcceptance: aiAcceptance,
      aiScoringDeviation: aiDeviation,
    };
  },

  /** Per-learning-outcome average mastery (0-100) for one student — the
   * "hangi konuda zayıf/güçlü" report. */
  async studentOutcomeBreakdown(env: Bindings, studentId: string) {
    const rows = await reportingRepository.studentOutcomeRows(createDb(env.DB), studentId);
    return aggregateByOutcome(rows);
  },

  /** Same breakdown across the whole class — the admin's "öğrenme çıktıları" view. */
  async classOutcomeBreakdown(env: Bindings) {
    const rows = await reportingRepository.classOutcomeRows(createDb(env.DB));
    return aggregateByOutcome(rows).sort((a, b) => a.averageScore - b.averageScore);
  },

  auditLog(env: Bindings, limit = 50) {
    return reportingRepository.recentAuditLogs(createDb(env.DB), limit);
  },
};
