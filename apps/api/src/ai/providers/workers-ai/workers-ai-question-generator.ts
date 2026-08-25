import type { Bindings } from "../../../config/env";
import type {
  QuestionGeneratorPort,
  QuestionGenerationContext,
  GeneratedQuestion,
} from "../../ports/question-generator.port";
import { QUESTION_GENERATION_JSON_SCHEMA } from "../../ports/question-generator.port";
import {
  QUESTION_GENERATION_SYSTEM_PROMPT,
  buildQuestionGenerationUserMessage,
} from "../../prompts/question-generation.prompt";
import { callWorkersAiJson } from "./workers-ai-client";

export class WorkersAiQuestionGenerator implements QuestionGeneratorPort {
  constructor(private env: Bindings) {}

  async generate(context: QuestionGenerationContext): Promise<GeneratedQuestion[]> {
    const result = await callWorkersAiJson<{ questions: GeneratedQuestion[] }>(this.env, {
      system: QUESTION_GENERATION_SYSTEM_PROMPT,
      userMessage: buildQuestionGenerationUserMessage(context),
      jsonSchema: QUESTION_GENERATION_JSON_SCHEMA,
    });

    return result.questions;
  }
}
