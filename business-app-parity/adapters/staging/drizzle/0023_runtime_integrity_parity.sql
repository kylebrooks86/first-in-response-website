-- Fresh-install LIVE/staging integrity parity with independent Doomsday.
-- Additive UNIQUE backstops only. Never delete, rewrite, or deduplicate any
-- existing customer, notification, payment, or refund rows.
-- Any historical duplicate MUST make the remote migration fail until
-- independently reviewed by the owner; do not bypass this constraint.
CREATE UNIQUE INDEX `idx_payments_unique_refund_provider`
ON `payments` (`provider_id`)
WHERE `provider_id` LIKE 'refund:%';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_notifications_unique_lifecycle`
ON `notifications` (`type`,`estimate_id`)
WHERE `estimate_id` IS NOT NULL
  AND `type` IN ('estimate_viewed','invoice_viewed','estimate_accepted');
