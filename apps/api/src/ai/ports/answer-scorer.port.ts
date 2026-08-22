export type RubricCriterionInput = {
  id: string;
  criterion: string;
  description?: string | null;
  weight: number;
};

export type ScoringContext = {
  questionBody: string;
  studentAnswer: string;
  rubric: { maxScore: number; criteria: RubricCriterionInput[] };
};

export type CriterionScore = { criterionId: string; score: number; comment: string };

export type ScoringResult = {
  suggestedScore: number; // normalized 1-100
  justification: string;
  criteriaBreakdown: CriterionScore[];
};

/**
 * Port for rubric-based semantic scoring of a student's free-text answer.
 * Output is always advisory — final grade approval is a human (instructor) action.
 */
export interface AnswerScorerPort {
  score(context: ScoringContext): Promise<ScoringResult>;
}
