-- FIRE clean, new-app, permanent Job # migration candidate (OFFLINE SOURCE REVIEW ONLY).
-- INTENTIONALLY NOT IN ANY ACTIVE MIGRATION DIRECTORY. NEVER RUN AGAINST LIVE.
-- Matches a disposable 25-migration QA-family database with ZERO operational
-- customers/jobs/payments/photos and ZERO other durable application records.
-- This is NOT yet a LIVE lineage migration, identity attestation, recovery
-- receipt, or permission to deploy. An authorized LIVE launch must use its
-- independently confirmed migration lineage, isolated D1, full off-device
-- recovery point, unchanged QA-master app, and separate owner approval.
-- Cloudflare D1 migration application supplies transactional rollback on
-- failure; do NOT submit this through raw d1 execute as separate statements.
-- Exact provider-reserved _cf_METADATA and _cf_KV table NAMES are ignored
-- for clean-app record emptiness. Do not read, export or alter their contents.
-- Unknown application tables remain a hard stop. Check the literal
-- sqlite_ reserved prefix: SQL LIKE 'sqlite_%' would hide names such as
-- sqliteX_private_history because _ matches any one character.
-- Provider attestation is
-- still needed for actual hosted D1 resource identity and schema.
CREATE TABLE _fire_job_empty_precondition (
  passed INTEGER NOT NULL CHECK(passed=1)
);
INSERT INTO _fire_job_empty_precondition(passed)
SELECT CASE WHEN
  (SELECT COUNT(*) FROM d1_migrations)=25
  AND (SELECT COUNT(*) FROM customers)=0
  AND (SELECT COUNT(*) FROM estimates)=0
  AND (SELECT COUNT(*) FROM customer_notes)=0
  AND (SELECT COUNT(*) FROM invoices)=0
  AND (SELECT COUNT(*) FROM invoice_items)=0
  AND (SELECT COUNT(*) FROM invoice_revisions)=0
  AND (SELECT COUNT(*) FROM payment_checkout_sessions)=0
  AND (SELECT COUNT(*) FROM payment_refunds)=0
  AND (SELECT COUNT(*) FROM deposit_policy_events)=0
  AND (SELECT COUNT(*) FROM deposit_agreement_snapshots)=0
  AND (SELECT COUNT(*) FROM estimate_items)=0
  AND (SELECT COUNT(*) FROM payments)=0
  AND (SELECT COUNT(*) FROM customer_photos)=0
  AND (SELECT COUNT(*) FROM customer_messages)=0
  AND (SELECT COUNT(*) FROM notifications)=0
  AND (SELECT COUNT(*) FROM message_templates)=0
  AND (SELECT COUNT(*) FROM estimate_change_requests)=0
  AND (SELECT COUNT(*) FROM tasks)=0
  AND (SELECT COUNT(*) FROM expenses)=0
  AND (SELECT COUNT(*) FROM job_reports)=0
  AND (SELECT COUNT(*) FROM auth_rate_limits)=0
  AND (SELECT COUNT(*) FROM sqlite_master
       WHERE type='table' AND lower(substr(name,1,7)) <> 'sqlite_'
         AND name NOT IN ('customers','estimates','customer_notes','invoices','invoice_items','invoice_revisions','payment_checkout_sessions','payment_refunds','deposit_policy_events','deposit_agreement_snapshots','estimate_items','payments','customer_photos','customer_messages','notifications','message_templates','estimate_change_requests','tasks','expenses','job_reports','auth_rate_limits','d1_migrations','_cf_KV','_cf_METADATA','_fire_job_empty_precondition'))=0
  AND (SELECT COUNT(*) FROM sqlite_master
       WHERE name IN ('fire_job_numbers','fire_job_estimate_links',
                      'idx_fire_job_estimate_links_number',
                      'fire_job_numbers_no_update','fire_job_numbers_no_delete',
                      'fire_job_estimate_links_no_update',
                      'fire_job_estimate_links_no_delete'))=0
THEN 1 ELSE 0 END;

CREATE TABLE fire_job_numbers (
  job_number INTEGER PRIMARY KEY AUTOINCREMENT,
  root_estimate_id TEXT NOT NULL UNIQUE
    REFERENCES estimates(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at TEXT NOT NULL CHECK(length(created_at)>0)
);
CREATE TABLE fire_job_estimate_links (
  estimate_id TEXT PRIMARY KEY NOT NULL
    REFERENCES estimates(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  job_number INTEGER NOT NULL
    REFERENCES fire_job_numbers(job_number) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX idx_fire_job_estimate_links_number
  ON fire_job_estimate_links(job_number);
CREATE TRIGGER fire_job_numbers_no_update
  BEFORE UPDATE ON fire_job_numbers BEGIN
    SELECT RAISE(ABORT,'FIRE Job numbers cannot be renumbered');
  END;
CREATE TRIGGER fire_job_numbers_no_delete
  BEFORE DELETE ON fire_job_numbers BEGIN
    SELECT RAISE(ABORT,'FIRE Job numbers cannot be reused');
  END;
CREATE TRIGGER fire_job_estimate_links_no_update
  BEFORE UPDATE ON fire_job_estimate_links BEGIN
    SELECT RAISE(ABORT,'FIRE Job links cannot be reassigned');
  END;
CREATE TRIGGER fire_job_estimate_links_no_delete
  BEFORE DELETE ON fire_job_estimate_links BEGIN
    SELECT RAISE(ABORT,'FIRE Job links are permanent');
  END;

-- No historical job, customer or financial row is created or renumbered.
-- A future owner-approved numbered estimate creation allocates Job #0001.
INSERT INTO _fire_job_empty_precondition(passed)
SELECT CASE WHEN
  (SELECT COUNT(*) FROM fire_job_numbers)=0
  AND (SELECT COUNT(*) FROM fire_job_estimate_links)=0
  AND (SELECT COALESCE(MAX(seq),0) FROM sqlite_sequence
       WHERE name='fire_job_numbers')=0
THEN 1 ELSE 0 END;
DROP TABLE _fire_job_empty_precondition;
