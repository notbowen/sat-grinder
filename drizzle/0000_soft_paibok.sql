CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_account_user_id` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `answer_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`question_id` text NOT NULL,
	`user_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`response` text NOT NULL,
	`is_correct` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `practice_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_attempts_session_question` ON `answer_attempts` (`session_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `practice_session_items` (
	`session_id` text NOT NULL,
	`question_id` text NOT NULL,
	`position` integer NOT NULL,
	`first_attempt_correct` integer,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`resolved_at` integer,
	PRIMARY KEY(`session_id`, `question_id`),
	FOREIGN KEY (`session_id`) REFERENCES `practice_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_session_items_position` ON `practice_session_items` (`session_id`,`position`);--> statement-breakpoint
CREATE TABLE `practice_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mode` text NOT NULL,
	`requested_count` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`topic_filters` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	`abandoned_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_practice_sessions_user_status` ON `practice_sessions` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `question_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`mime_type` text NOT NULL,
	`file_path` text NOT NULL,
	`byte_size` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`display_id` text NOT NULL,
	`section` text NOT NULL,
	`domain_code` text NOT NULL,
	`domain_name` text NOT NULL,
	`skill_code` text NOT NULL,
	`skill_name` text NOT NULL,
	`difficulty` text NOT NULL,
	`type` text NOT NULL,
	`stimulus_html` text,
	`stem_html` text NOT NULL,
	`rationale_html` text NOT NULL,
	`answer_options` text DEFAULT '[]' NOT NULL,
	`correct_answers` text NOT NULL,
	`is_active_test` integer DEFAULT false NOT NULL,
	`is_retired` integer DEFAULT false NOT NULL,
	`source_updated_at` integer,
	`content_hash` text NOT NULL,
	`sync_run_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`sync_run_id`) REFERENCES `sync_runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `questions_display_id_unique` ON `questions` (`display_id`);--> statement-breakpoint
CREATE INDEX `idx_questions_eligible_section` ON `questions` (`is_retired`,`is_active_test`,`section`);--> statement-breakpoint
CREATE INDEX `idx_questions_domain_skill` ON `questions` (`domain_code`,`skill_code`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `idx_session_user_id` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`triggered_by` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`total_metadata` integer DEFAULT 0 NOT NULL,
	`fetched_details` integer DEFAULT 0 NOT NULL,
	`imported` integer DEFAULT 0 NOT NULL,
	`active_excluded` integer DEFAULT 0 NOT NULL,
	`error` text,
	FOREIGN KEY (`triggered_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_sync_runs_status_started` ON `sync_runs` (`status`,`started_at`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`username` text,
	`display_username` text,
	`role` text DEFAULT 'user',
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer,
	`must_change_password` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_username` ON `user` (`username`);--> statement-breakpoint
CREATE TABLE `user_question_progress` (
	`user_id` text NOT NULL,
	`question_id` text NOT NULL,
	`status` text NOT NULL,
	`first_attempt_misses` integer DEFAULT 0 NOT NULL,
	`last_answered_at` integer NOT NULL,
	`mastered_at` integer,
	PRIMARY KEY(`user_id`, `question_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_progress_user_status` ON `user_question_progress` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_verification_identifier` ON `verification` (`identifier`);