CREATE TABLE `payment_checkout_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `estimate_id` text NOT NULL,
  `type` text NOT NULL,
  `amount_cents` integer NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `created_at` text NOT NULL,
  `expired_at` text,
  FOREIGN KEY (`estimate_id`) REFERENCES `estimates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_payment_checkout_sessions_estimate_status` ON `payment_checkout_sessions` (`estimate_id`,`status`);
