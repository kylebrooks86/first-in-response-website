CREATE TABLE `customer_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`estimate_id` text,
	`channel` text NOT NULL,
	`template` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`estimate_id`) REFERENCES `estimates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_customer_messages_customer_id` ON `customer_messages` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_customer_messages_estimate_id` ON `customer_messages` (`estimate_id`);--> statement-breakpoint
CREATE TABLE `customer_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`category` text DEFAULT 'property' NOT NULL,
	`caption` text,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`object_key` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_customer_photos_customer_id` ON `customer_photos` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_customer_photos_category` ON `customer_photos` (`customer_id`,`category`);