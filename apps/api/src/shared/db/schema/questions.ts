import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { sourceDocuments, learningOutcomes } from "./content";

export const RUBRIC_MAX_SCORE_DEFAULT = 100;

export const rubrics = sqliteTable("rubrics", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  maxScore: integer("max_score").notNull().default(RUBRIC_MAX_SCORE_DEFAULT),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const rubricCriteria = sqliteTable("rubric_criteria", {
  id: text("id").primaryKey(),
  rubricId: text("rubric_id")
    .notNull()
    .references(() => rubrics.id, { onDelete: "cascade" }),
  criterion: text("criterion").notNull(),
  description: text("description"),
  weight: real("weight").notNull(),
  orderIndex: integer("order_index").notNull(),
});

export const GENERATION_JOB_STATUSES = ["queued", "processing", "completed", "failed"] as const;
export type GenerationJobStatus = (typeof GENERATION_JOB_STATUSES)[number];

export const aiGenerationJobs = sqliteTable("ai_generation_jobs", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => sourceDocuments.id),
  learningOutcomeId: text("learning_outcome_id")
    .notNull()
    .references(() => learningOutcomes.id),
  requestedBy: text("requested_by")
    .notNull()
    .references(() => users.id),
  rubricId: text("rubric_id").references(() => rubrics.id),
  status: text("status", { enum: GENERATION_JOB_STATUSES }).notNull().default("queued"),
  questionCount: integer("question_count").notNull(),
  multipleChoiceCount: integer("multiple_choice_count").notNull().default(0),
  openEndedCount: integer("open_ended_count").notNull().default(0),
  failureReason: text("failure_reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const QUESTION_TYPES = ["multiple_choice", "open_ended"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_STATUSES = ["ai_draft", "pending_review", "approved", "rejected"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  documentId: text("document_id").references(() => sourceDocuments.id, { onDelete: "set null" }),
  learningOutcomeId: text("learning_outcome_id")
    .notNull()
    .references(() => learningOutcomes.id),
  rubricId: text("rubric_id").references(() => rubrics.id),
  generationJobId: text("generation_job_id").references(() => aiGenerationJobs.id),
  type: text("type", { enum: QUESTION_TYPES }).notNull(),
  body: text("body").notNull(),
  aiGenerated: integer("ai_generated", { mode: "boolean" }).notNull().default(false),
  sourceChunkIds: text("source_chunk_ids"), // JSON array, provenance for grounded generation
  status: text("status", { enum: QUESTION_STATUSES }).notNull().default("pending_review"),
  createdBy: text("created_by").references(() => users.id),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const questionOptions = sqliteTable("question_options", {
  id: text("id").primaryKey(),
  questionId: text("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  body: text("body").notNull(),
  isCorrect: integer("is_correct", { mode: "boolean" }).notNull().default(false),
  orderIndex: integer("order_index").notNull(),
});
