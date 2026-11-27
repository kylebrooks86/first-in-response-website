-- Additive only. Existing collisions abort index creation; never delete/deduplicate history.
-- Run the read-only collision preflight on the exact target before applying.
CREATE UNIQUE INDEX `idx_payments_stripe_provider_unique` ON `payments` (`provider_id`)
WHERE `provider_id` GLOB 'cs_*' OR `provider_id` GLOB 'refund:*';
