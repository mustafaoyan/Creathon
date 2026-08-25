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
  /** Hızlı yol: sadece iş kaydını oluşturup kuyruğa atar, hemen döner. Asıl
   * RAG + AI çağrısı (birkaç saniye sürebilir) `processGenerationJob` içinde,
   * kuyruk consumer'ında çalışır — istek sayfa kapansa/değişse de tamamlanır. */
  async enqueueGeneration(
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

    const jobId = await questionsRepository.createGenerationJob(db, params);
    await env.QUESTION_GEN_QUEUE.send({ jobId });
    return jobId;
  },

  async getGenerationJob(env: Bindings, jobId: string) {
    const db = createDb(env.DB);
    const job = await questionsRepository.findGenerationJobById(db, jobId);
    if (!job) throw new HttpError(404, "generation_job_not_found");
    const questionsGenerated = job.status === "completed" ? await questionsRepository.countByGenerationJob(db, jobId) : 0;
    return { ...job, questionsGenerated };
  },

  /** Sayfayı yeniden açan içerik uzmanının en son işini gösterebilmesi için —
   * "önceki işlem nereye gitti" sorusunun cevabı: hiçbir yere, kuyrukta devam
   * ediyor/bitti, burada tekrar bulunabiliyor. */
  async getLatestGenerationJobFor(env: Bindings, requestedBy: string) {
    const db = createDb(env.DB);
    const job = await questionsRepository.findLatestGenerationJobByRequester(db, requestedBy);
    if (!job) return null;
    const questionsGenerated = job.status === "completed" ? await questionsRepository.countByGenerationJob(db, job.id) : 0;
    return { ...job, questionsGenerated };
  },

  /** Kuyruk consumer'ından çağrılır — gerçek RAG + AI çağrısı burada. */
  async processGenerationJob(env: Bindings, jobId: string) {
    const db = createDb(env.DB);
    const job = await questionsRepository.findGenerationJobById(db, jobId);
    if (!job) return; // iş silinmiş olabilir, sessizce çık

    await questionsRepository.markGenerationJobProcessing(db, jobId);

    try {
      const outcome = await contentRepository.findLearningOutcomeById(db, job.learningOutcomeId);
      if (!outcome) throw new Error("learning_outcome_not_found");

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
        counts: { multipleChoice: job.multipleChoiceCount, openEnded: job.openEndedCount },
      });

      await questionsRepository.insertGeneratedQuestions(db, {
        documentId: job.documentId,
        learningOutcomeId: job.learningOutcomeId,
        rubricId: job.rubricId,
        generationJobId: jobId,
        generated,
      });

      await questionsRepository.completeGenerationJob(db, jobId);
    } catch (error) {
      await questionsRepository.failGenerationJob(db, jobId, (error as Error).message);
      throw error;
    }
  },

  async list(env: Bindings, status?: QuestionStatus) {
    const db = createDb(env.DB);
    const rows = await questionsRepository.listByStatus(db, status);

    return Promise.all(
      rows.map(async (question) => ({
        ...question,
        options:
          question.type === "multiple_choice" ? await questionsRepository.optionsForQuestion(db, question.id) : undefined,
      })),
    );
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
