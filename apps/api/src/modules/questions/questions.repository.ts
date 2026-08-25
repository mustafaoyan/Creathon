import { eq, desc } from "drizzle-orm";
import type { Database } from "../../shared/db/client";
import { questions, questionOptions, aiGenerationJobs, type QuestionStatus } from "../../shared/db/schema";
import { newId } from "../../shared/lib/id";
import type { GeneratedQuestion } from "../../ai/ports/question-generator.port";

export const questionsRepository = {
  async createGenerationJob(
    db: Database,
    data: {
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

  async markGenerationJobProcessing(db: Database, id: string) {
    await db.update(aiGenerationJobs).set({ status: "processing" }).where(eq(aiGenerationJobs.id, id));
  },

  async completeGenerationJob(db: Database, id: string) {
    await db
      .update(aiGenerationJobs)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(aiGenerationJobs.id, id));
  },

  async failGenerationJob(db: Database, id: string, reason: string) {
    await db
      .update(aiGenerationJobs)
      .set({ status: "failed", failureReason: reason, completedAt: new Date() })
      .where(eq(aiGenerationJobs.id, id));
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

  async updateContent(db: Database, id: string, data: { body: string }) {
    await db.update(questions).set({ body: data.body }).where(eq(questions.id, id));
  },

  async review(db: Database, id: string, params: { status: "approved" | "rejected"; reviewedBy: string }) {
    await db
      .update(questions)
      .set({ status: params.status, reviewedBy: params.reviewedBy, reviewedAt: new Date() })
      .where(eq(questions.id, id));
  },
};
