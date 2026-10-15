-- FIRE Doomsday Gate 5 owner screenshot preflight, explicitly READ ONLY.
-- Target ONLY: D1 fire-app-staging-db, Worker binding DB, never LIVE or refund staging.
-- Output is ONE aggregate row: no provider IDs, customers, refunds, or secrets.
-- A query error is a blocker. Even 0,0,0 is NOT authorization for migration.
-- Do not click Add row, Delete row, run migrations or Retry build.
SELECT
  (SELECT COUNT(*) FROM d1_migrations
    WHERE name='0022_stripe_provider_uniqueness.sql') AS migration_0022_rows,
  (SELECT COUNT(*) FROM sqlite_master
    WHERE name='idx_payments_stripe_provider_unique'
      AND type='index' AND tbl_name='payments') AS index_0022_rows,
  (SELECT COUNT(*) FROM (
    SELECT provider_id FROM payments
    WHERE provider_id GLOB 'cs_*' OR provider_id GLOB 'refund:*'
    GROUP BY provider_id HAVING COUNT(*)>1
  )) AS duplicate_provider_groups;
