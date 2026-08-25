import type { Bindings } from "../config/env";
import type { QuestionGeneratorPort } from "./ports/question-generator.port";
import type { AnswerScorerPort } from "./ports/answer-scorer.port";
import type { EmbeddingsPort } from "./ports/embeddings.port";
import { AnthropicQuestionGenerator } from "./providers/anthropic/anthropic-question-generator";
import { AnthropicAnswerScorer } from "./providers/anthropic/anthropic-answer-scorer";
import { WorkersAiQuestionGenerator } from "./providers/workers-ai/workers-ai-question-generator";
import { WorkersAiAnswerScorer } from "./providers/workers-ai/workers-ai-answer-scorer";
import { WorkersAiEmbeddings } from "./providers/workers-ai-embeddings";

export type AiServices = {
  questionGenerator: QuestionGeneratorPort;
  answerScorer: AnswerScorerPort;
  embeddings: EmbeddingsPort;
  providerLabel: string;
};

/**
 * Single composition point for the AI layer. Swapping the generation/scoring model
 * (e.g. to OpenAI) means adding a `providers/openai/*` adapter implementing the same
 * ports and adding a branch here — nothing outside this file needs to change.
 */
export function createAiServices(env: Bindings): AiServices {
  const provider = env.AI_PROVIDER || "anthropic";

  switch (provider) {
    case "anthropic":
      return {
        questionGenerator: new AnthropicQuestionGenerator(env),
        answerScorer: new AnthropicAnswerScorer(env),
        embeddings: new WorkersAiEmbeddings(env),
        providerLabel: "anthropic:claude-sonnet-5",
      };
    // Anthropic hesabında kredi olmadan da çalışır — Cloudflare'in kendi Workers AI
    // modelleri (günde 10.000 Neuron ücretsiz kota) üzerinden soru üretimi/puanlama.
    case "workers-ai":
      return {
        questionGenerator: new WorkersAiQuestionGenerator(env),
        answerScorer: new WorkersAiAnswerScorer(env),
        embeddings: new WorkersAiEmbeddings(env),
        providerLabel: "workers-ai:llama-3.3-70b-instruct",
      };
    default:
      throw new Error(`unsupported_ai_provider: ${provider}`);
  }
}
