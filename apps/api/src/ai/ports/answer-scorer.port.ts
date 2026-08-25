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

/** Şema her sağlayıcıda aynı — bkz. question-generator.port.ts'teki aynı notun eşleniği. */
export const ANSWER_SCORING_JSON_SCHEMA = {
  type: "object",
  properties: {
    suggestedScore: { type: "number", minimum: 1, maximum: 100 },
    justification: { type: "string" },
    criteriaBreakdown: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterionId: { type: "string" },
          score: { type: "number", minimum: 0, maximum: 100 },
          comment: { type: "string" },
        },
        required: ["criterionId", "score", "comment"],
      },
    },
  },
  required: ["suggestedScore", "justification", "criteriaBreakdown"],
} as const;
