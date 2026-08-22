import { eq, desc } from "drizzle-orm";
import type { Database } from "../../shared/db/client";
import { sourceDocuments, documentChunks, learningOutcomes, type DocumentStatus } from "../../shared/db/schema";
import { newId } from "../../shared/lib/id";

export const contentRepository = {
  async createDocument(
    db: Database,
    data: { uploadedBy: string; title: string; r2Key: string; mimeType: string },
  ) {
    const id = newId("doc");
    await db.insert(sourceDocuments).values({
      id,
      uploadedBy: data.uploadedBy,
      title: data.title,
      r2Key: data.r2Key,
      mimeType: data.mimeType,
      status: "queued",
      createdAt: new Date(),
    });
    return id;
  },

  async findDocumentById(db: Database, id: string) {
    const [row] = await db.select().from(sourceDocuments).where(eq(sourceDocuments.id, id)).limit(1);
    return row ?? null;
  },

  listDocuments(db: Database) {
    return db.select().from(sourceDocuments).orderBy(desc(sourceDocuments.createdAt));
  },

  async setDocumentStatus(db: Database, id: string, status: DocumentStatus, failureReason?: string) {
    await db
      .update(sourceDocuments)
      .set({ status, failureReason: failureReason ?? null })
      .where(eq(sourceDocuments.id, id));
  },

  async insertChunks(
    db: Database,
    chunks: {
      id: string;
      documentId: string;
      chunkIndex: number;
      content: string;
      vectorId: string;
      tokenCount: number;
    }[],
  ) {
    if (chunks.length === 0) return;
    await db.insert(documentChunks).values(chunks.map((chunk) => ({ ...chunk, createdAt: new Date() })));
  },

  async createLearningOutcome(
    db: Database,
    data: { documentId?: string | null; title: string; description?: string | null; createdBy: string },
  ) {
    const id = newId("outcome");
    await db.insert(learningOutcomes).values({
      id,
      documentId: data.documentId ?? null,
      title: data.title,
      description: data.description ?? null,
      createdBy: data.createdBy,
      createdAt: new Date(),
    });
    return id;
  },

  async findLearningOutcomeById(db: Database, id: string) {
    const [row] = await db.select().from(learningOutcomes).where(eq(learningOutcomes.id, id)).limit(1);
    return row ?? null;
  },

  listLearningOutcomes(db: Database) {
    return db.select().from(learningOutcomes).orderBy(desc(learningOutcomes.createdAt));
  },
};
