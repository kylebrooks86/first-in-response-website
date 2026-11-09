CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`customer_id` text,
	`estimate_id` text,
	`read_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`estimate_id`) REFERENCES `estimates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_created_at` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notifications_unread` ON `notifications` (`read_at`,`created_at`);--> statement-breakpoint
ALTER TABLE `estimates` ADD `share_token` text;--> statement-breakpoint
ALTER TABLE `estimates` ADD `first_viewed_at` text;--> statement-breakpoint
ALTER TABLE `estimates` ADD `accepted_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_estimates_share_token` ON `estimates` (`share_token`);