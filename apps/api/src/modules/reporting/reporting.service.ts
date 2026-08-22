import type { Bindings } from "../../config/env";
import { createDb } from "../../shared/db/client";
import { reportingRepository } from "./reporting.repository";

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
   * "hangi konuda zayıf/güçlü" report. Ungraded answers are excluded. */
  async studentOutcomeBreakdown(env: Bindings, studentId: string) {
    const rows = await reportingRepository.studentOutcomeRows(createDb(env.DB), studentId);
    const byOutcome = new Map<string, { title: string; scores: number[] }>();

    for (const row of rows) {
      const score =
        row.questionType === "multiple_choice" ? (row.isCorrect ? 100 : 0) : (row.finalScore ?? null);
      if (score === null) continue; // not graded yet — excluded from the average

      const bucket = byOutcome.get(row.outcomeId) ?? { title: row.outcomeTitle, scores: [] };
      bucket.scores.push(score);
      byOutcome.set(row.outcomeId, bucket);
    }

    return Array.from(byOutcome.entries()).map(([outcomeId, { title, scores }]) => ({
      outcomeId,
      title,
      averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      sampleSize: scores.length,
    }));
  },
};
