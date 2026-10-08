ALTER TABLE `invoices` ADD `share_token` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `first_viewed_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invoices_share_token` ON `invoices` (`share_token`);