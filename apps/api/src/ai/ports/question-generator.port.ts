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

/** Şema her sağlayıcıda aynı (Anthropic'in tool `input_schema`'sı, Workers AI'nin
 * `response_format.json_schema`'sı) — burada tek yerde tanımlı, iki adaptör de
 * bunu içe aktarıyor. */
export const QUESTION_GENERATION_JSON_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["multiple_choice", "open_ended"] },
          body: { type: "string" },
          sourceChunkIds: { type: "array", items: { type: "string" } },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                body: { type: "string" },
                isCorrect: { type: "boolean" },
              },
              required: ["label", "body", "isCorrect"],
            },
          },
        },
        required: ["type", "body", "sourceChunkIds"],
      },
    },
  },
  required: ["questions"],
} as const;
