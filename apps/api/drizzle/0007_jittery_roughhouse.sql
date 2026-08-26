CREATE TABLE `exam_allowed_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`email` text NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exam_allowed_emails_exam_id_email_unique` ON `exam_allowed_emails` (`exam_id`,`email`);