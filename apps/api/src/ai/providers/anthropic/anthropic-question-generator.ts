import type { Bindings } from "../../../config/env";
import type {
  QuestionGeneratorPort,
  QuestionGenerationContext,
  GeneratedQuestion,
} from "../../ports/question-generator.port";
import { QUESTION_GENERATION_SYSTEM_PROMPT } from "../../prompts/question-generation.prompt";
import { callAnthropicTool, type AnthropicTool } from "./anthropic-client";

const RETURN_QUESTIONS_TOOL: AnthropicTool = {
  name: "return_questions",
  description: "Return the generated exam questions, grounded strictly in the provided source excerpts.",
  input_schema: {
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
  },
};

export class AnthropicQuestionGenerator implements QuestionGeneratorPort {
  constructor(private env: Bindings) {}

  async generate(context: QuestionGenerationContext): Promise<GeneratedQuestion[]> {
    const result = await callAnthropicTool<{ questions: GeneratedQuestion[] }>(this.env, {
      system: QUESTION_GENERATION_SYSTEM_PROMPT,
      userMessage: buildUserMessage(context),
      tool: RETURN_QUESTIONS_TOOL,
    });

    return result.questions;
  }
}

function buildUserMessage(context: QuestionGenerationContext): string {
  const excerpts = context.sourceChunks
    .map((chunk) => `[[chunk:${chunk.id}]]\n${chunk.content}`)
    .join("\n\n");

  return [
    `Kazanım: ${context.learningOutcome.title}`,
    context.learningOutcome.description ? `Açıklama: ${context.learningOutcome.description}` : "",
    `İstenen soru sayısı: ${context.counts.multipleChoice} çoktan seçmeli, ${context.counts.openEnded} açık uçlu.`,
    "Kaynak metin parçaları:",
    excerpts,
  ]
    .filter(Boolean)
    .join("\n\n");
}
