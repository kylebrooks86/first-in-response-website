-- FIRE independent DR / NEW LIVE immutable permanent numbers, SOURCE-ONLY draft.
-- Apply ONLY as the 26th *target-specific* D1 migration on a verified,
-- isolated and EMPTY independent DR/NEW LIVE after separately approved
-- provider binding, full restore/rollback plan and exact owner authorization.
-- NOT included in legacy/QA/STAGING migration sources. No remote execution.
-- The reviewed base migrations (0000..0024) must match their exact ordered
-- D1 journal history. Any user/test record, schema drift or previous number
-- allocation stops the whole migration. Never clear or renumber records.
-- Cloudflare provider-owned _cf tables are allowed by NAME, never altered.
CREATE TABLE _fire_independent_numbers_guard (
 passed INTEGER NOT NULL CHECK(passed=1)
);
--> statement-breakpoint
INSERT INTO _fire_independent_numbers_guard(passed)
SELECT CASE WHEN
  (SELECT GROUP_CONCAT(id||':'||name,'|')
   FROM (SELECT id,name FROM d1_migrations ORDER BY id))='1:0000_wise_namora.sql|2:0001_elite_cammi.sql|3:0002_tearful_ink.sql|4:0003_absent_dracula.sql|5:0004_volatile_fenris.sql|6:0005_unknown_king_cobra.sql|7:0006_open_solo.sql|8:0007_open_bloodaxe.sql|9:0008_typical_tomorrow_man.sql|10:0009_spicy_micromax.sql|11:0010_discount_mode.sql|12:0011_editable_invoices.sql|13:0012_invoice_revisions.sql|14:0013_checkout_sessions.sql|15:0014_notification_resolution.sql|16:0015_single_open_checkout.sql|17:0016_notification_resolution_note.sql|18:0017_one_invoice_per_estimate.sql|19:0018_payment_refunds.sql|20:0019_refund_ledger_unique.sql|21:0020_notification_lifecycle_unique.sql|22:0021_manual_processing_fees.sql|23:0022_stripe_provider_uniqueness.sql|24:0023_deposit_policy_events.sql|25:0024_deposit_agreement_snapshots.sql'
  AND (SELECT COUNT(*) FROM "customers")=0
  AND (SELECT COUNT(*) FROM "estimates")=0
  AND (SELECT COUNT(*) FROM "customer_notes")=0
  AND (SELECT COUNT(*) FROM "invoices")=0
  AND (SELECT COUNT(*) FROM "invoice_items")=0
  AND (SELECT COUNT(*) FROM "invoice_revisions")=0
  AND (SELECT COUNT(*) FROM "payment_checkout_sessions")=0
  AND (SELECT COUNT(*) FROM "payment_refunds")=0
  AND (SELECT COUNT(*) FROM "deposit_policy_events")=0
  AND (SELECT COUNT(*) FROM "deposit_agreement_snapshots")=0
  AND (SELECT COUNT(*) FROM "estimate_items")=0
  AND (SELECT COUNT(*) FROM "payments")=0
  AND (SELECT COUNT(*) FROM "customer_photos")=0
  AND (SELECT COUNT(*) FROM "customer_messages")=0
  AND (SELECT COUNT(*) FROM "notifications")=0
  AND (SELECT COUNT(*) FROM "message_templates")=0
  AND (SELECT COUNT(*) FROM "estimate_change_requests")=0
  AND (SELECT COUNT(*) FROM "tasks")=0
  AND (SELECT COUNT(*) FROM "expenses")=0
  AND (SELECT COUNT(*) FROM "job_reports")=0
  AND (SELECT COUNT(*) FROM "auth_rate_limits")=0
  AND (SELECT COUNT(*) FROM sqlite_master
   WHERE type='table' AND lower(substr(name,1,7)) <> 'sqlite_'
   AND name NOT IN ('customers','estimates','customer_notes','invoices','invoice_items','invoice_revisions','payment_checkout_sessions','payment_refunds','deposit_policy_events','deposit_agreement_snapshots','estimate_items','payments','customer_photos','customer_messages','notifications','message_templates','estimate_change_requests','tasks','expenses','job_reports','auth_rate_limits','d1_migrations','_cf_KV','_cf_METADATA','_fire_independent_numbers_guard'))=0
THEN 1 ELSE 0 END;
--> statement-breakpoint
CREATE TABLE fire_customer_numbers (
  customer_number INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL UNIQUE
    REFERENCES customers(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at TEXT NOT NULL CHECK(length(created_at)>0)
);
--> statement-breakpoint
CREATE TRIGGER fire_customer_numbers_no_update
  BEFORE UPDATE ON fire_customer_numbers BEGIN
    SELECT RAISE(ABORT,'FIRE customer numbers are permanent');
  END;
--> statement-breakpoint
CREATE TRIGGER fire_customer_numbers_no_delete
  BEFORE DELETE ON fire_customer_numbers BEGIN
    SELECT RAISE(ABORT,'FIRE customer numbers cannot be reused');
  END;
--> statement-breakpoint
CREATE TABLE fire_job_numbers (
  job_number INTEGER PRIMARY KEY AUTOINCREMENT,
  root_estimate_id TEXT NOT NULL UNIQUE
    REFERENCES estimates(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at TEXT NOT NULL CHECK(length(created_at)>0)
);
--> statement-breakpoint
CREATE TABLE fire_job_estimate_links (
  estimate_id TEXT PRIMARY KEY NOT NULL
    REFERENCES estimates(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  job_number INTEGER NOT NULL
    REFERENCES fire_job_numbers(job_number) ON UPDATE RESTRICT ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX idx_fire_job_estimate_links_number
  ON fire_job_estimate_links(job_number);
--> statement-breakpoint
CREATE TRIGGER fire_job_numbers_no_update
  BEFORE UPDATE ON fire_job_numbers BEGIN
    SELECT RAISE(ABORT,'FIRE Job numbers cannot be renumbered');
  END;
--> statement-breakpoint
CREATE TRIGGER fire_job_numbers_no_delete
  BEFORE DELETE ON fire_job_numbers BEGIN
    SELECT RAISE(ABORT,'FIRE Job numbers cannot be reused');
  END;
--> statement-breakpoint
CREATE TRIGGER fire_job_estimate_links_no_update
  BEFORE UPDATE ON fire_job_estimate_links BEGIN
    SELECT RAISE(ABORT,'FIRE Job links cannot be reassigned');
  END;
--> statement-breakpoint
CREATE TRIGGER fire_job_estimate_links_no_delete
  BEFORE DELETE ON fire_job_estimate_links BEGIN
    SELECT RAISE(ABORT,'FIRE Job links are permanent');
  END;

--> statement-breakpoint
-- Enforce an untouched #0001 high-water and no synthetic numbered records.
INSERT INTO _fire_independent_numbers_guard(passed)
SELECT CASE WHEN
 (SELECT COUNT(*) FROM fire_customer_numbers)=0
 AND (SELECT COUNT(*) FROM fire_job_numbers)=0
 AND (SELECT COUNT(*) FROM fire_job_estimate_links)=0
 AND (SELECT COUNT(*) FROM sqlite_sequence
      WHERE name IN ('fire_customer_numbers','fire_job_numbers'))=0
THEN 1 ELSE 0 END;
--> statement-breakpoint
DROP TABLE _fire_independent_numbers_guard;
