-- Normalize any legacy duplicate open checkout tracking rows before enforcing
-- the invariant. Stripe payment recording remains idempotent and overpayment-
-- aware if a customer later completes one of those legacy external sessions.
UPDATE payment_checkout_sessions
SET status='expired', expired_at=COALESCE(expired_at, datetime('now'))
WHERE status='open'
  AND rowid NOT IN (
    SELECT MAX(rowid)
    FROM payment_checkout_sessions
    WHERE status='open'
    GROUP BY estimate_id
  );
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_payment_checkout_sessions_one_open_per_estimate`
ON `payment_checkout_sessions` (`estimate_id`)
WHERE `status`='open';
