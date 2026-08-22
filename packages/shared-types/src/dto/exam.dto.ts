export const EXAM_STATUSES = ["draft", "published", "closed"] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];

export type ExamQuestionDto = { id: string; questionId: string; body: string; type: string; points: number };

export type ExamAssignmentDto = { id: string; examId: string; title: string; status: string };
