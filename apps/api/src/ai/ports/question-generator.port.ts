export type QuestionGenerationContext = {
  learningOutcome: { title: string; description?: string | null };
  sourceChunks: { id: string; content: string }[];
  counts: { multipleChoice: number; openEnded: number };
};

export type GeneratedOption = { label: string; body: string; isCorrect: boolean };

export type GeneratedQuestion = {
  type: "multiple_choice" | "open_ended";
  body: string;
  sourceChunkIds: string[];
  options?: GeneratedOption[];
};

/**
 * Port for grounded (RAG) question generation. Any implementation MUST only use
 * `context.sourceChunks` as factual grounding and MUST return the ids of the
 * chunks it actually drew from per question (traceability against hallucination).
 */
export interface QuestionGeneratorPort {
  generate(context: QuestionGenerationContext): Promise<GeneratedQuestion[]>;
}
