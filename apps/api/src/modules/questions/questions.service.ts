import type { Bindings } from "../../config/env";
import { createDb } from "../../shared/db/client";
import { createAiServices } from "../../ai/ai.factory";
import { retrieveRelevantChunks } from "../../rag/retriever";
import { VectorizeClient } from "../../rag/vectorize-client";
import { contentRepository } from "../content/content.repository";
import { questionsRepository } from "./questions.repository";
import { HttpError } from "../../shared/middleware/error-handler";
import type { QuestionStatus } from "../../shared/db/schema";

// Tek AI çağrısında çok fazla soru istemek (ör. 30) gerçek bir stuck-job
// nedeniydi — model/kuyruk çalışma süresi limitlerini aşıp iş hiç bitmeden
// (ne completed ne failed) sonsuza kadar "processing" kalıyordu.
const MAX_QUESTIONS_PER_JOB = 10;
// Bu süreden uzun "processing"/"queued" kalan bir iş, muhtemelen consumer'ın
// zaman/CPU limitine çarpıp try/catch'e hiç girmeden öldüğü anlamına gelir —
// otomatik olarak "failed" işaretlenip kullanıcıya sonsuz döngü gösterilmez.
const STALE_JOB_MS = 3 * 60 * 1000;

/** "processing"da sonsuza kalmış bir işi (consumer zaman/CPU limitine çarpıp
 * hiç tamamlanmadıysa) otomatik "failed"a çevirir — okuma anında (lazy),
 * ayrı bir cron gerektirmeden. */
async function reconcileIfStale(db: ReturnType<typeof createDb>, job: NonNullable<Awaited<ReturnType<typeof questionsRepository.findGenerationJobById>>>) {
  const isActive = job.status === "queued" || job.status === "processing";
  const isStale = Date.now() - job.createdAt.getTime() > STALE_JOB_MS;
  if (!isActive || !isStale) return job;

  await questionsRepository.failGenerationJob(db, job.id, "zaman_asimi_iptal_edildi");
  return (await questionsRepository.findGenerationJobById(db, job.id)) ?? job;
}

export const questionsService = {
  /** Hızlı yol: sadece iş kaydını oluşturup kuyruğa atar, hemen döner. Asıl
   * RAG + AI çağrısı (birkaç saniye sürebilir) `processGenerationJob` içinde,
   * kuyruk consumer'ında çalışır — istek sayfa kapansa/değişse de tamamlanır. */
  async enqueueGeneration(
    env: Bindings,
    params: {
      title: string | null;
      documentId: string;
      learningOutcomeId: string;
      rubricId: string | null;
      requestedBy: string;
      multipleChoiceCount: number;
      openEndedCount: number;
    },
  ) {
    if (params.multipleChoiceCount + params.openEndedCount > MAX_QUESTIONS_PER_JOB) {
      throw new HttpError(422, `too_many_questions_requested_max_${MAX_QUESTIONS_PER_JOB}`);
    }

    const db = createDb(env.DB);
    const outcome = await contentRepository.findLearningOutcomeById(db, params.learningOutcomeId);
    if (!outcome) throw new HttpError(404, "learning_outcome_not_found");

    const jobId = await questionsRepository.createGenerationJob(db, params);
    await env.QUESTION_GEN_QUEUE.send({ jobId });
    return jobId;
  },

  async getGenerationJob(env: Bindings, jobId: string) {
    const db = createDb(env.DB);
    let job = await questionsRepository.findGenerationJobById(db, jobId);
    if (!job) throw new HttpError(404, "generation_job_not_found");
    job = await reconcileIfStale(db, job);
    const questionsGenerated = job.status === "completed" ? await questionsRepository.countByGenerationJob(db, jobId) : 0;
    return { ...job, questionsGenerated };
  },

  /** Sayfayı yeniden açan içerik uzmanının en son işini gösterebilmesi için —
   * "önceki işlem nereye gitti" sorusunun cevabı: hiçbir yere, kuyrukta devam
   * ediyor/bitti, burada tekrar bulunabiliyor. */
  async getLatestGenerationJobFor(env: Bindings, requestedBy: string) {
    const db = createDb(env.DB);
    let job = await questionsRepository.findLatestGenerationJobByRequester(db, requestedBy);
    if (!job) return null;
    job = await reconcileIfStale(db, job);
    const questionsGenerated = job.status === "completed" ? await questionsRepository.countByGenerationJob(db, job.id) : 0;
    return { ...job, questionsGenerated };
  },

  /** Kullanıcının "İşlemi İptal Et" butonu — kuyruktaki mesajı fiilen geri
   * çekemiyoruz (Cloudflare Queues bunu desteklemiyor), ama işi hemen "failed"
   * işaretleyip kullanıcıyı serbest bırakıyoruz. Consumer daha sonra bitirse
   * bile completeGenerationJob artık "failed" durumunu ezmiyor (bkz. repository). */
  async cancelGenerationJob(env: Bindings, jobId: string, requestedBy: string) {
    const db = createDb(env.DB);
    const job = await questionsRepository.findGenerationJobById(db, jobId);
    if (!job) throw new HttpError(404, "generation_job_not_found");
    if (job.requestedBy !== requestedBy) throw new HttpError(403, "not_your_job");
    if (job.status !== "queued" && job.status !== "processing") return;

    await questionsRepository.failGenerationJob(db, jobId, "kullanici_tarafindan_iptal_edildi");
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

      // AI çağrısı sürerken kullanıcı iptal ettiyse (ya da zaman aşımı işaretlediyse),
      // üretilen soruları havuza hiç ekleme — "iptal ettim ama sorular yine de
      // Onay Paneli'nde çıktı" gibi bir sürpriz olmasın.
      const current = await questionsRepository.findGenerationJobById(db, jobId);
      if (current?.status !== "processing") return;

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

  listGenerationBatches(env: Bindings) {
    const db = createDb(env.DB);
    return questionsRepository.listCompletedJobsWithApprovedQuestions(db);
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

  async update(env: Bindings, id: string, data: { body?: string; rubricId?: string | null }) {
    const db = createDb(env.DB);
    const question = await questionsRepository.findById(db, id);
    if (!question) throw new HttpError(404, "question_not_found");
    if (question.status === "approved" && data.body) throw new HttpError(409, "cannot_edit_approved_question");
    await questionsRepository.updateContent(db, id, data);
  },

  /** Açık uçlu bir soru rubriksiz onaylanırsa, öğrenci cevabı hiçbir zaman AI
   * değerlendirmesine düşmez ve Puanlama Onayı panelinde sessizce hiç görünmez
   * — bu tam olarak yaşanan bir üretim hatasıydı, artık onay anında engelleniyor. */
  async review(env: Bindings, id: string, decision: "approved" | "rejected", reviewedBy: string) {
    const db = createDb(env.DB);
    const question = await questionsRepository.findById(db, id);
    if (!question) throw new HttpError(404, "question_not_found");
    if (decision === "approved" && question.type === "open_ended" && !question.rubricId) {
      throw new HttpError(422, "open_ended_question_requires_rubric");
    }
    await questionsRepository.review(db, id, { status: decision, reviewedBy });
  },
};
