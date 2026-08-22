import { sqliteTable, text, integer, real, unique } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { questions, questionOptions } from "./questions";

export const EXAM_STATUSES = ["draft", "published", "closed"] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];

export const exams = sqliteTable("exams", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  status: text("status", { enum: EXAM_STATUSES }).notNull().default("draft"),
  durationMinutes: integer("duration_minutes"),
  startsAt: integer("starts_at", { mode: "timestamp" }),
  endsAt: integer("ends_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const examQuestions = sqliteTable("exam_questions", {
  id: text("id").primaryKey(),
  examId: text("exam_id")
    .notNull()
    .references(() => exams.id, { onDelete: "cascade" }),
  questionId: text("question_id")
    .notNull()
    .references(() => questions.id),
  orderIndex: integer("order_index").notNull(),
  points: real("points").notNull(),
});

export const ASSIGNMENT_STATUSES = ["assigned", "in_progress", "submitted", "graded"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const examAssignments = sqliteTable(
  "exam_assignments",
  {
    id: text("id").primaryKey(),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id),
    status: text("status", { enum: ASSIGNMENT_STATUSES }).notNull().default("assigned"),
    assignedAt: integer("assigned_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({ uniqueExamStudent: unique().on(table.examId, table.studentId) }),
);

export const examAttempts = sqliteTable("exam_attempts", {
  id: text("id").primaryKey(),
  examAssignmentId: text("exam_assignment_id")
    .notNull()
    .unique()
    .references(() => examAssignments.id, { onDelete: "cascade" }),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  submittedAt: integer("submitted_at", { mode: "timestamp" }),
  totalScore: real("total_score"),
});

export const studentAnswers = sqliteTable(
  "student_answers",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => examAttempts.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id),
    selectedOptionId: text("selected_option_id").references(() => questionOptions.id),
    answerText: text("answer_text"),
    answeredAt: integer("answered_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({ uniqueAttemptQuestion: unique().on(table.attemptId, table.questionId) }),
);
