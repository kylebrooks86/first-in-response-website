-- READ ONLY. Run separately on each exact target; no migration execution.
SELECT name,type,sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY type,name;
SELECT name,type FROM pragma_table_info('payments');
SELECT name,type FROM pragma_table_info('payment_refunds');
SELECT name,type FROM pragma_table_info('stripe_checkout_sessions');
-- Only if sqlite_master confirms d1_migrations exists:
SELECT * FROM d1_migrations ORDER BY id;
-- Separately run the candidate stripe-ledger-preflight.sql; it is read-only.
