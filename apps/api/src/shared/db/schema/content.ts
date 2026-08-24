import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const DOCUMENT_STATUSES = ["queued", "processing", "ready", "failed"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const sourceDocuments = sqliteTable("source_documents", {
  id: text("id").primaryKey(),
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  r2Key: text("r2_key").notNull(),
  mimeType: text("mime_type").notNull(),
  status: text("status", { enum: DOCUMENT_STATUSES }).notNull().default("queued"),
  failureReason: text("failure_reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const documentChunks = sqliteTable("document_chunks", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => sourceDocuments.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  vectorId: text("vector_id"),
  tokenCount: integer("token_count").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const OUTCOME_LEVELS = ["temel", "orta", "ileri"] as const;
export type OutcomeLevel = (typeof OUTCOME_LEVELS)[number];

export const learningOutcomes = sqliteTable("learning_outcomes", {
  id: text("id").primaryKey(),
  documentId: text("document_id").references(() => sourceDocuments.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  topic: text("topic"),
  level: text("level", { enum: OUTCOME_LEVELS }),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
