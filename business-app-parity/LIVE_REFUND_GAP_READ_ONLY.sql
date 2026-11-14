-- PRE-MIGRATION DIAGNOSTIC ONLY; this intentionally works even when payment_refunds is absent.
-- Run SELECTs individually on the exact provider-attested LIVE DB, in this order.
-- If a SELECT fails, retain its actual ERROR; do not synthesize empty rows/zeroes.
-- Do not paste business rows, full backups, keys or credentials into the repository.
-- NO DROP/CREATE/ALTER/INSERT/UPDATE/DELETE/PRAGMA/WRANGLER WRITE IS AUTHORIZED.

-- 1: ALL app-owned tables and indexes, original SQLite CREATE SQL (metadata only).
SELECT type, name, tbl_name, sql FROM sqlite_master
 WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'
   AND tbl_name <> 'd1_migrations'
 ORDER BY type,tbl_name,name;

-- 2: D1 migration journal in original application order, including any 0019 entry.
SELECT name FROM d1_migrations ORDER BY id;

-- 3: Stripe index preflight; aggregate integer only, NO payment records returned.
SELECT COUNT(*) AS provider_collision_groups FROM (
 SELECT provider_id FROM payments
 WHERE provider_id GLOB 'cs_*' OR provider_id GLOB 'refund:*'
 GROUP BY provider_id HAVING COUNT(*) > 1
);
