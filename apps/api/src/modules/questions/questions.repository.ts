import { eq, desc, and, inArray } from "drizzle-orm";
import type { Database } from "../../shared/db/client";
import { questions, questionOptions, aiGenerationJobs, type QuestionStatus } from "../../shared/db/schema";
import { newId } from "../../shared/lib/id";
import type { GeneratedQuestion } from "../../ai/ports/question-generator.port";

export const questionsRepository = {
  async createGenerationJob(
    db: Database,
    data: {
      title: string | null;
      documentId: string;
      learningOutcomeId: string;
      rubricId: string | null;
      requestedBy: string;
      multipleChoiceCount: number;
      openEndedCount: number;
    },
  ) {
    const id = newId("genjob");
    await db.insert(aiGenerationJobs).values({
      id,
      title: data.title,
      documentId: data.documentId,
      learningOutcomeId: data.learningOutcomeId,
      rubricId: data.rubricId,
      requestedBy: data.requestedBy,
      questionCount: data.multipleChoiceCount + data.openEndedCount,
      multipleChoiceCount: data.multipleChoiceCount,
      openEndedCount: data.openEndedCount,
      status: "queued",
      createdAt: new Date(),
    });
    return id;
  },

  /** Sınav oluşturma ekranındaki soru havuzu, onaylanmış soruları hangi
   * üretim "partisinden" geldiğine göre gruplamak için bunu kullanır —
   * sadece en az bir onaylı sorusu olan partiler döner (boş/hâlâ incelemede
   * olan partilerle havuzu kirletmesin). */
  listCompletedJobsWithApprovedQuestions(db: Database) {
    return db
      .selectDistinct({
        id: aiGenerationJobs.id,
        title: aiGenerationJobs.title,
        createdAt: aiGenerationJobs.createdAt,
      })
      .from(aiGenerationJobs)
      .innerJoin(questions, eq(questions.generationJobId, aiGenerationJobs.id))
      .where(eq(questions.status, "approved"))
      .orderBy(desc(aiGenerationJobs.createdAt));
  },

  async findGenerationJobById(db: Database, id: string) {
    const [row] = await db.select().from(aiGenerationJobs).where(eq(aiGenerationJobs.id, id)).limit(1);
    return row ?? null;
  },

  /** Sayfayı yeniden açan içerik uzmanının en son işini (hâlâ işleniyor mu,
   * bitti mi) gösterebilmesi için — üretim tarayıcı sekmesi kapansa/sayfa
   * değişse de arka planda (kuyrukta) devam ediyor. */
  async findLatestGenerationJobByRequester(db: Database, requestedBy: string) {
    const [row] = await db
      .select()
      .from(aiGenerationJobs)
      .where(eq(aiGenerationJobs.requestedBy, requestedBy))
      .orderBy(desc(aiGenerationJobs.createdAt))
      .limit(1);
    return row ?? null;
  },

  /** WHERE status = 'queued' kasıtlı — iş zaten iptal/zaman aşımıyla "failed"
   * işaretlenmişse (kullanıcı cancel'a bastıktan hemen sonra consumer bu satıra
   * gelirse tam bu race oluşuyordu) burada "processing"e geri döndürülmesin;
   * yoksa sonda completeGenerationJob'un guard'ı da anlamsız kalır. */
  async markGenerationJobProcessing(db: Database, id: string) {
    await db
      .update(aiGenerationJobs)
      .set({ status: "processing" })
      .where(and(eq(aiGenerationJobs.id, id), eq(aiGenerationJobs.status, "queued")));
  },

  /** WHERE status IN (queued, processing) kasıtlı — iş kullanıcı tarafından
   * iptal edildikten veya zaman aşımına uğrayıp "failed" işaretlendikten SONRA
   * kuyruk consumer'ı geç tamamlanırsa, bu geç sonucun zaten kapanmış işi
   * "completed"a geri çevirmesini önlüyor. */
  async completeGenerationJob(db: Database, id: string) {
    await db
      .update(aiGenerationJobs)
      .set({ status: "completed", completedAt: new Date() })
      .where(and(eq(aiGenerationJobs.id, id), inArray(aiGenerationJobs.status, ["queued", "processing"])));
  },

  async failGenerationJob(db: Database, id: string, reason: string) {
    await db
      .update(aiGenerationJobs)
      .set({ status: "failed", failureReason: reason, completedAt: new Date() })
      .where(and(eq(aiGenerationJobs.id, id), inArray(aiGenerationJobs.status, ["queued", "processing"])));
  },

  async insertGeneratedQuestions(
    db: Database,
    params: {
      documentId: string;
      learningOutcomeId: string;
      rubricId: string | null;
      generationJobId: string;
      generated: GeneratedQuestion[];
    },
  ) {
    const now = new Date();
    for (const generatedQuestion of params.generated) {
      const questionId = newId("q");
      await db.insert(questions).values({
        id: questionId,
        documentId: params.documentId,
        learningOutcomeId: params.learningOutcomeId,
        rubricId: generatedQuestion.type === "open_ended" ? params.rubricId : null,
        generationJobId: params.generationJobId,
        type: generatedQuestion.type,
        body: generatedQuestion.body,
        aiGenerated: true,
        sourceChunkIds: JSON.stringify(generatedQuestion.sourceChunkIds),
        status: "ai_draft",
        createdAt: now,
      });

      if (generatedQuestion.type === "multiple_choice" && generatedQuestion.options) {
        await db.insert(questionOptions).values(
          generatedQuestion.options.map((option, index) => ({
            id: newId("opt"),
            questionId,
            label: option.label,
            body: option.body,
            isCorrect: option.isCorrect,
            orderIndex: index,
          })),
        );
      }
    }
  },

  async countByGenerationJob(db: Database, generationJobId: string) {
    const rows = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.generationJobId, generationJobId));
    return rows.length;
  },

  listByStatus(db: Database, status?: QuestionStatus) {
    if (status) {
      return db.select().from(questions).where(eq(questions.status, status)).orderBy(desc(questions.createdAt));
    }
    return db.select().from(questions).orderBy(desc(questions.createdAt));
  },

  async findById(db: Database, id: string) {
    const [row] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
    return row ?? null;
  },

  optionsForQuestion(db: Database, questionId: string) {
    return db.select().from(questionOptions).where(eq(questionOptions.questionId, questionId));
  },

  async updateContent(db: Database, id: string, data: { body?: string; rubricId?: string | null }) {
    const set: { body?: string; rubricId?: string | null } = {};
    if (data.body !== undefined) set.body = data.body;
    if (data.rubricId !== undefined) set.rubricId = data.rubricId;
    if (Object.keys(set).length === 0) return;
    await db.update(questions).set(set).where(eq(questions.id, id));
  },

  async review(db: Database, id: string, params: { status: "approved" | "rejected"; reviewedBy: string }) {
    await db
      .update(questions)
      .set({ status: params.status, reviewedBy: params.reviewedBy, reviewedAt: new Date() })
      .where(eq(questions.id, id));
  },
};
