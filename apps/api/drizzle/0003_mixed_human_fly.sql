ALTER TABLE `ai_generation_jobs` ADD `rubric_id` text REFERENCES rubrics(id);--> statement-breakpoint
ALTER TABLE `ai_generation_jobs` ADD `multiple_choice_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_generation_jobs` ADD `open_ended_count` integer DEFAULT 0 NOT NULL;