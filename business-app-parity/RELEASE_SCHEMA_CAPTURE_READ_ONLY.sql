-- READ ONLY; review and run individual SELECT statements only on the owner-selected target.
-- No deployment, migration, resource write or approval is granted by this file.
-- These queries return schema/journal metadata and anomaly COUNTS, never customer/payment rows or secrets.
-- LIVE currently lacks payment_refunds: record the missing-table failure; do not create it.
-- Keep each output with target URL, immutable D1 UUID and capture timestamp.
-- Binding UUID and full Worker build/version identity must be captured separately from Cloudflare.

SELECT type, name, tbl_name, sql FROM sqlite_master WHERE tbl_name IN ('auth_rate_limits', 'customer_messages', 'customer_notes', 'customer_photos', 'customers', 'estimate_change_requests', 'estimate_items', 'estimates', 'expenses', 'invoice_items', 'invoice_revisions', 'invoices', 'job_reports', 'message_templates', 'notifications', 'payment_checkout_sessions', 'payment_refunds', 'payments', 'tasks', 'd1_migrations') AND type IN ('table','index') ORDER BY type,tbl_name,name;

SELECT m.name AS table_name, p.cid, p.name AS column_name, p.type, p."notnull", p.dflt_value, p.pk FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type='table' AND m.name IN ('auth_rate_limits', 'customer_messages', 'customer_notes', 'customer_photos', 'customers', 'estimate_change_requests', 'estimate_items', 'estimates', 'expenses', 'invoice_items', 'invoice_revisions', 'invoices', 'job_reports', 'message_templates', 'notifications', 'payment_checkout_sessions', 'payment_refunds', 'payments', 'tasks') ORDER BY m.name,p.cid;

SELECT m.name AS table_name, p.id, p.seq, p."table" AS parent_table, p."from" AS child_column, p."to" AS parent_column, p.on_update, p.on_delete, p.match FROM sqlite_master m JOIN pragma_foreign_key_list(m.name) p WHERE m.type='table' AND m.name IN ('auth_rate_limits', 'customer_messages', 'customer_notes', 'customer_photos', 'customers', 'estimate_change_requests', 'estimate_items', 'estimates', 'expenses', 'invoice_items', 'invoice_revisions', 'invoices', 'job_reports', 'message_templates', 'notifications', 'payment_checkout_sessions', 'payment_refunds', 'payments', 'tasks') ORDER BY m.name,p.id,p.seq;

SELECT m.name AS table_name, i.name AS index_name, i."unique", i.origin, i.partial, c.seqno, c.cid, c.name AS column_name FROM sqlite_master m JOIN pragma_index_list(m.name) i JOIN pragma_index_info(i.name) c WHERE m.type='table' AND m.name IN ('auth_rate_limits', 'customer_messages', 'customer_notes', 'customer_photos', 'customers', 'estimate_change_requests', 'estimate_items', 'estimates', 'expenses', 'invoice_items', 'invoice_revisions', 'invoices', 'job_reports', 'message_templates', 'notifications', 'payment_checkout_sessions', 'payment_refunds', 'payments', 'tasks') ORDER BY m.name,i.name,c.seqno;

SELECT name FROM d1_migrations ORDER BY name;

SELECT COUNT(*) AS foreign_key_violation_count FROM pragma_foreign_key_check;

SELECT COUNT(*) AS provider_collision_groups FROM (SELECT provider_id, COUNT(*) AS collision_count
FROM payments
WHERE provider_id GLOB 'cs_*' OR provider_id GLOB 'refund:*'
GROUP BY provider_id HAVING COUNT(*) > 1);

SELECT COUNT(*) AS invalid_refund_links FROM (SELECT r.id AS refund_id, r.payment_id, r.estimate_id
FROM payment_refunds r LEFT JOIN payments p ON p.id=r.payment_id
WHERE p.id IS NULL OR p.estimate_id<>r.estimate_id
   OR p.status<>'paid' OR p.amount_cents<=0 OR r.amount_cents<=0
   OR r.amount_cents>p.amount_cents);

SELECT COUNT(*) AS invalid_succeeded_refund_ledgers FROM (SELECT r.id AS refund_id, COUNT(p.id) AS ledger_count
FROM payment_refunds r LEFT JOIN payments p
 ON p.provider_id='refund:' || r.payment_id || ':' || r.id
WHERE r.status='succeeded'
GROUP BY r.id
HAVING COUNT(p.id)<>1
 OR SUM(CASE WHEN p.estimate_id=r.estimate_id AND p.status='paid'
       AND p.amount_cents=-r.amount_cents
       AND p.type=CASE WHEN (SELECT type FROM payments WHERE id=r.payment_id)='Tip'
                    THEN 'Tip Refund' ELSE 'Refund' END THEN 1 ELSE 0 END)<>1);

SELECT COUNT(*) AS over_reserved_refund_payments FROM (SELECT r.payment_id, SUM(r.amount_cents) AS reserved_cents,
       p.amount_cents AS original_cents
FROM payment_refunds r JOIN payments p ON p.id=r.payment_id
WHERE r.status IN ('pending','succeeded')
GROUP BY r.payment_id
HAVING SUM(r.amount_cents)>p.amount_cents);
