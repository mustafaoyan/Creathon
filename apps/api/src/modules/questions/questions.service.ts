import type { Bindings } from "../../config/env";
import { createDb } from "../../shared/db/client";
import { createAiServices } from "../../ai/ai.factory";
import { retrieveRelevantChunks } from "../../rag/retriever";
import { VectorizeClient } from "../../rag/vectorize-client";
import { contentRepository } from "../content/content.repository";
import { questionsRepository } from "./questions.repository";
import { HttpError } from "../../shared/middleware/error-handler";
import type { QuestionStatus } from "../../shared/db/schema";

export const questionsService = {
  async generate(
    env: Bindings,
    params: {
      documentId: string;
      learningOutcomeId: string;
      rubricId: string | null;
      requestedBy: string;
      multipleChoiceCount: number;
      openEndedCount: number;
    },
  ) {
    const db = createDb(env.DB);
    const outcome = await contentRepository.findLearningOutcomeById(db, params.learningOutcomeId);
    if (!outcome) throw new HttpError(404, "learning_outcome_not_found");

    const jobId = await questionsRepository.createGenerationJob(db, {
      documentId: params.documentId,
      learningOutcomeId: params.learningOutcomeId,
      requestedBy: params.requestedBy,
      questionCount: params.multipleChoiceCount + params.openEndedCount,
    });

    try {
      const ai = createAiServices(env);
      const vectorize = new VectorizeClient(env);
      const chunks = await retrieveRelevantChunks({
        db,
        embeddings: ai.embeddings,
        vectorize,
        queryText: `${outcome.title} ${outcome.description ?? ""}`.trim(),
      });

      if (chunks.length === 0) throw new Error("no_grounded_chunks_found_for_outcome");

      const generated = await ai.questionGenerator.generate({
        learningOutcome: { title: outcome.title, description: outcome.description },
        sourceChunks: chunks,
        counts: { multipleChoice: params.multipleChoiceCount, openEnded: params.openEndedCount },
      });

      await questionsRepository.insertGeneratedQuestions(db, {
        documentId: params.documentId,
        learningOutcomeId: params.learningOutcomeId,
        rubricId: params.rubricId,
        generationJobId: jobId,
        generated,
      });

      await questionsRepository.completeGenerationJob(db, jobId);
      return jobId;
    } catch (error) {
      await questionsRepository.failGenerationJob(db, jobId, (error as Error).message);
      throw error;
    }
  },

  list(env: Bindings, status?: QuestionStatus) {
    return questionsRepository.listByStatus(createDb(env.DB), status);
  },

  async update(env: Bindings, id: string, body: string) {
    const db = createDb(env.DB);
    const question = await questionsRepository.findById(db, id);
    if (!question) throw new HttpError(404, "question_not_found");
    if (question.status === "approved") throw new HttpError(409, "cannot_edit_approved_question");
    await questionsRepository.updateContent(db, id, { body });
  },

  async review(env: Bindings, id: string, decision: "approved" | "rejected", reviewedBy: string) {
    const db = createDb(env.DB);
    const question = await questionsRepository.findById(db, id);
    if (!question) throw new HttpError(404, "question_not_found");
    await questionsRepository.review(db, id, { status: decision, reviewedBy });
  },
};
