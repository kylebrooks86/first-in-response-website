ALTER TABLE `estimates` ADD `appreciation_discount` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `estimates` ADD `additional_discount_type` text DEFAULT 'percent' NOT NULL;
--> statement-breakpoint
ALTER TABLE `estimates` ADD `additional_discount_value` integer DEFAULT 0 NOT NULL;
