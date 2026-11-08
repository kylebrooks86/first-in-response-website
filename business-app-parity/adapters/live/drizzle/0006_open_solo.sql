CREATE TABLE `estimate_change_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`estimate_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`estimate_id`) REFERENCES `estimates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_change_requests_estimate` ON `estimate_change_requests` (`estimate_id`,`status`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`estimate_id` text,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`incurred_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`estimate_id`) REFERENCES `estimates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_estimate` ON `expenses` (`estimate_id`);--> statement-breakpoint
CREATE INDEX `idx_expenses_incurred` ON `expenses` (`incurred_at`);--> statement-breakpoint
CREATE TABLE `job_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`estimate_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`checklist` text NOT NULL,
	`notes` text,
	`airflow_before` text,
	`airflow_after` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`estimate_id`) REFERENCES `estimates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_job_reports_estimate` ON `job_reports` (`estimate_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`customer_id` text,
	`estimate_id` text,
	`due_at` text,
	`status` text DEFAULT 'open' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`estimate_id`) REFERENCES `estimates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_status_due` ON `tasks` (`status`,`due_at`);--> statement-breakpoint
ALTER TABLE `customers` ADD `lead_source` text DEFAULT 'Unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `estimates` ADD `signed_name` text;--> statement-breakpoint
ALTER TABLE `estimates` ADD `signed_at` text;--> statement-breakpoint
ALTER TABLE `estimates` ADD `contract_version` text;