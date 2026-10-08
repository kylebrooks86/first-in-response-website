CREATE TABLE `message_templates` (
	`key` text PRIMARY KEY NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`updated_at` text NOT NULL
);
