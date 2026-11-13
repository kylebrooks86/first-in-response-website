CREATE TABLE `auth_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`window_started_at` integer NOT NULL,
	`blocked_until` integer DEFAULT 0 NOT NULL
);
