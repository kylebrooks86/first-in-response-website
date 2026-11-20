-- Collapse any duplicate refund-ledger rows from pre-v115 retry races before
-- enforcing one negative payment entry per durable FIRE refund request.
DELETE FROM payments
WHERE provider_id LIKE 'refund:%'
  AND rowid NOT IN (
    SELECT MIN(rowid)
    FROM payments
    WHERE provider_id LIKE 'refund:%'
    GROUP BY provider_id
  );
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_payments_unique_refund_provider`
ON `payments` (`provider_id`)
WHERE `provider_id` LIKE 'refund:%';
