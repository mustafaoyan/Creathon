export const QUESTION_TYPES = ["multiple_choice", "open_ended"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_STATUSES = ["ai_draft", "pending_review", "approved", "rejected"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export type QuestionOptionDto = { id: string; label: string; body: string; isCorrect?: boolean };

export type QuestionDto = {
  id: string;
  type: QuestionType;
  body: string;
  status: QuestionStatus;
  aiGenerated: boolean;
  options?: QuestionOptionDto[];
};
