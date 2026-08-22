CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`google_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`role` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `document_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`content` text NOT NULL,
	`vector_id` text,
	`token_count` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `source_documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `learning_outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text,
	`title` text NOT NULL,
	`description` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `source_documents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `source_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`uploaded_by` text NOT NULL,
	`title` text NOT NULL,
	`r2_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`failure_reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ai_generation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`learning_outcome_id` text NOT NULL,
	`requested_by` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`question_count` integer NOT NULL,
	`failure_reason` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`document_id`) REFERENCES `source_documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`learning_outcome_id`) REFERENCES `learning_outcomes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `question_options` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`label` text NOT NULL,
	`body` text NOT NULL,
	`is_correct` integer DEFAULT false NOT NULL,
	`order_index` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text,
	`learning_outcome_id` text NOT NULL,
	`rubric_id` text,
	`generation_job_id` text,
	`type` text NOT NULL,
	`body` text NOT NULL,
	`ai_generated` integer DEFAULT false NOT NULL,
	`source_chunk_ids` text,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`created_by` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `source_documents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`learning_outcome_id`) REFERENCES `learning_outcomes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rubric_id`) REFERENCES `rubrics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`generation_job_id`) REFERENCES `ai_generation_jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rubric_criteria` (
	`id` text PRIMARY KEY NOT NULL,
	`rubric_id` text NOT NULL,
	`criterion` text NOT NULL,
	`description` text,
	`weight` real NOT NULL,
	`order_index` integer NOT NULL,
	FOREIGN KEY (`rubric_id`) REFERENCES `rubrics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rubrics` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`max_score` integer DEFAULT 100 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exam_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`student_id` text NOT NULL,
	`status` text DEFAULT 'assigned' NOT NULL,
	`assigned_at` integer NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exam_assignments_exam_id_student_id_unique` ON `exam_assignments` (`exam_id`,`student_id`);--> statement-breakpoint
CREATE TABLE `exam_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_assignment_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`submitted_at` integer,
	`total_score` real,
	FOREIGN KEY (`exam_assignment_id`) REFERENCES `exam_assignments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exam_attempts_exam_assignment_id_unique` ON `exam_attempts` (`exam_assignment_id`);--> statement-breakpoint
CREATE TABLE `exam_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`question_id` text NOT NULL,
	`order_index` integer NOT NULL,
	`points` real NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exams` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`created_by` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`duration_minutes` integer,
	`starts_at` integer,
	`ends_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `student_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected_option_id` text,
	`answer_text` text,
	`answered_at` integer NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `exam_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`selected_option_id`) REFERENCES `question_options`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_answers_attempt_id_question_id_unique` ON `student_answers` (`attempt_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `ai_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`student_answer_id` text NOT NULL,
	`rubric_id` text NOT NULL,
	`suggested_score` real NOT NULL,
	`justification` text NOT NULL,
	`criteria_breakdown` text NOT NULL,
	`ai_provider` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_answer_id`) REFERENCES `student_answers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rubric_id`) REFERENCES `rubrics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_evaluations_student_answer_id_unique` ON `ai_evaluations` (`student_answer_id`);--> statement-breakpoint
CREATE TABLE `final_grades` (
	`id` text PRIMARY KEY NOT NULL,
	`student_answer_id` text NOT NULL,
	`ai_evaluation_id` text,
	`score` real NOT NULL,
	`graded_by` text NOT NULL,
	`override_reason` text,
	`graded_at` integer NOT NULL,
	FOREIGN KEY (`student_answer_id`) REFERENCES `student_answers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ai_evaluation_id`) REFERENCES `ai_evaluations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`graded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `final_grades_student_answer_id_unique` ON `final_grades` (`student_answer_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
