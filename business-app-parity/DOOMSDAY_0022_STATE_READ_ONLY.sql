-- Read-only diagnostic; not an execution or retry authorization.
-- Run only on the owner-selected database and retain its UUID/time separately.
-- Missing d1_migrations is a blocking query error; missing payments returns STOP.
-- BOTH_PRESENT still requires exact SQL/checksum, full schema and financial checks.
WITH migration_state AS (
  SELECT COUNT(*) AS prefix_rows,
    COALESCE(SUM(name='0022_stripe_provider_uniqueness.sql'),0) AS exact_rows
  FROM d1_migrations WHERE name GLOB '0022_*'
), index_state AS (
  SELECT COUNT(*) AS objects,
    MAX(type) AS object_type, MAX(tbl_name) AS table_name, MAX(sql) AS index_sql
  FROM sqlite_master WHERE name='idx_payments_stripe_provider_unique'
), index_flags AS (
  SELECT COUNT(*) AS flag_rows, MAX("unique") AS is_unique, MAX(partial) AS is_partial
  FROM pragma_index_list('payments') WHERE name='idx_payments_stripe_provider_unique'
), index_columns AS (
  SELECT COUNT(*) AS column_count, MAX(name) AS column_name
  FROM pragma_index_info('idx_payments_stripe_provider_unique')
)
SELECT
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='payments')
      THEN 'STOP_MISSING_PAYMENTS_TABLE'
    WHEN prefix_rows<>exact_rows THEN 'STOP_UNEXPECTED_JOURNAL_NAME'
    WHEN exact_rows>1 THEN 'STOP_DUPLICATE_JOURNAL_ENTRIES'
    WHEN objects>0 AND (object_type<>'index' OR table_name<>'payments'
      OR flag_rows<>1 OR COALESCE(is_unique,0)<>1 OR COALESCE(is_partial,0)<>1
      OR column_count<>1 OR COALESCE(column_name,'')<>'provider_id')
      THEN 'STOP_INDEX_METADATA_MISMATCH'
    WHEN objects=0 AND exact_rows=0 THEN 'BOTH_ABSENT_REVIEW_PREFLIGHT'
    WHEN objects>0 AND exact_rows=0 THEN 'STOP_INDEX_WITHOUT_JOURNAL'
    WHEN objects=0 AND exact_rows=1 THEN 'STOP_JOURNAL_WITHOUT_INDEX'
    ELSE 'BOTH_PRESENT_REVIEW_EXACT_DEFINITION'
  END AS recovery_state,
  prefix_rows AS migration_0022_prefix_rows, exact_rows AS migration_0022_exact_rows,
  objects AS named_index_objects, table_name, index_sql, is_unique, is_partial,
  column_count, column_name
FROM migration_state CROSS JOIN index_state CROSS JOIN index_flags CROSS JOIN index_columns;
