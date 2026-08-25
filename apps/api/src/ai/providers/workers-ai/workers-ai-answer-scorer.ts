import type { Bindings } from "../../../config/env";
import { ANSWER_SCORING_JSON_SCHEMA, type AnswerScorerPort, type ScoringContext, type ScoringResult } from "../../ports/answer-scorer.port";
import { RUBRIC_SCORING_SYSTEM_PROMPT, buildRubricScoringUserMessage } from "../../prompts/rubric-scoring.prompt";
import { callWorkersAiJson } from "./workers-ai-client";

export class WorkersAiAnswerScorer implements AnswerScorerPort {
  constructor(private env: Bindings) {}

  async score(context: ScoringContext): Promise<ScoringResult> {
    return callWorkersAiJson<ScoringResult>(this.env, {
      system: RUBRIC_SCORING_SYSTEM_PROMPT,
      userMessage: buildRubricScoringUserMessage(context),
      jsonSchema: ANSWER_SCORING_JSON_SCHEMA,
    });
  }
}
