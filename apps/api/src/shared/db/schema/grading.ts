import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { rubrics } from "./questions";
import { studentAnswers } from "./exams";

export const aiEvaluations = sqliteTable("ai_evaluations", {
  id: text("id").primaryKey(),
  studentAnswerId: text("student_answer_id")
    .notNull()
    .unique()
    .references(() => studentAnswers.id, { onDelete: "cascade" }),
  rubricId: text("rubric_id")
    .notNull()
    .references(() => rubrics.id),
  suggestedScore: real("suggested_score").notNull(), // 1-100
  justification: text("justification").notNull(),
  criteriaBreakdown: text("criteria_breakdown").notNull(), // JSON: [{criterionId, score, comment}]
  aiProvider: text("ai_provider").notNull(), // e.g. "anthropic:claude-sonnet-5"
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const finalGrades = sqliteTable("final_grades", {
  id: text("id").primaryKey(),
  studentAnswerId: text("student_answer_id")
    .notNull()
    .unique()
    .references(() => studentAnswers.id, { onDelete: "cascade" }),
  aiEvaluationId: text("ai_evaluation_id").references(() => aiEvaluations.id),
  score: real("score").notNull(),
  gradedBy: text("graded_by")
    .notNull()
    .references(() => users.id),
  overrideReason: text("override_reason"),
  gradedAt: integer("graded_at", { mode: "timestamp" }).notNull(),
});
