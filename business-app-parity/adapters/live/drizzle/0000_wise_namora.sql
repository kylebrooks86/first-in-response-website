CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`address` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `estimate_items` (
	`id` text PRIMARY KEY NOT NULL,
	`estimate_id` text NOT NULL,
	`name` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit` text NOT NULL,
	`total_cents` integer NOT NULL,
	FOREIGN KEY (`estimate_id`) REFERENCES `estimates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_estimate_items_estimate_id` ON `estimate_items` (`estimate_id`);--> statement-breakpoint
CREATE TABLE `estimates` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer NOT NULL,
	`deposit_cents` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_estimates_customer_id` ON `estimates` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_estimates_created_at` ON `estimates` (`created_at`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`estimate_id` text NOT NULL,
	`type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`estimate_id`) REFERENCES `estimates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_payments_estimate_status` ON `payments` (`estimate_id`,`status`);