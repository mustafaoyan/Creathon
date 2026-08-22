import type { Bindings } from "../config/env";
import type { QuestionGeneratorPort } from "./ports/question-generator.port";
import type { AnswerScorerPort } from "./ports/answer-scorer.port";
import type { EmbeddingsPort } from "./ports/embeddings.port";
import { AnthropicQuestionGenerator } from "./providers/anthropic/anthropic-question-generator";
import { AnthropicAnswerScorer } from "./providers/anthropic/anthropic-answer-scorer";
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
    default:
      throw new Error(`unsupported_ai_provider: ${provider}`);
  }
}
