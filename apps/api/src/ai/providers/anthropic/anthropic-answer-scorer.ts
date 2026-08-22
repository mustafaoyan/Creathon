import type { Bindings } from "../../../config/env";
import type { AnswerScorerPort, ScoringContext, ScoringResult } from "../../ports/answer-scorer.port";
import { RUBRIC_SCORING_SYSTEM_PROMPT } from "../../prompts/rubric-scoring.prompt";
import { callAnthropicTool, type AnthropicTool } from "./anthropic-client";

const RETURN_EVALUATION_TOOL: AnthropicTool = {
  name: "return_evaluation",
  description: "Return the rubric-based evaluation of the student's answer.",
  input_schema: {
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
  },
};

export class AnthropicAnswerScorer implements AnswerScorerPort {
  constructor(private env: Bindings) {}

  async score(context: ScoringContext): Promise<ScoringResult> {
    return callAnthropicTool<ScoringResult>(this.env, {
      system: RUBRIC_SCORING_SYSTEM_PROMPT,
      userMessage: buildUserMessage(context),
      tool: RETURN_EVALUATION_TOOL,
    });
  }
}

function buildUserMessage(context: ScoringContext): string {
  const criteria = context.rubric.criteria
    .map((c) => `- [${c.id}] ${c.criterion} (ağırlık: ${c.weight})${c.description ? `: ${c.description}` : ""}`)
    .join("\n");

  return [
    `Soru: ${context.questionBody}`,
    `Öğrenci yanıtı: ${context.studentAnswer}`,
    `Rubrik (maksimum puan: ${context.rubric.maxScore}):`,
    criteria,
  ].join("\n\n");
}
