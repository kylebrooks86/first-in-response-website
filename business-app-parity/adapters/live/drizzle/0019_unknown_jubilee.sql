CREATE TABLE `payment_refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`estimate_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_refund_id` text,
	`note` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`estimate_id`) REFERENCES `estimates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_payment_refunds_payment_status` ON `payment_refunds` (`payment_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_payment_refunds_estimate_status` ON `payment_refunds` (`estimate_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_payment_refunds_provider` ON `payment_refunds` (`provider_refund_id`);