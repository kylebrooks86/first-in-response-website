CREATE TABLE `customer_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_customer_notes_customer_id` ON `customer_notes` (`customer_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`estimate_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_cents` integer NOT NULL,
	`due_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`estimate_id`) REFERENCES `estimates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_invoices_customer_id` ON `invoices` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_invoices_estimate_id` ON `invoices` (`estimate_id`);--> statement-breakpoint
ALTER TABLE `estimates` ADD `scheduled_at` text;--> statement-breakpoint
CREATE INDEX `idx_estimates_scheduled_at` ON `estimates` (`scheduled_at`);