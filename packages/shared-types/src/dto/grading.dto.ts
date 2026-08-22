export type CriterionScoreDto = { criterionId: string; score: number; comment: string };

export type PendingReviewDto = {
  studentAnswerId: string;
  questionBody: string;
  answerText: string;
  suggestedScore: number;
  justification: string;
  criteriaBreakdown?: CriterionScoreDto[];
};
