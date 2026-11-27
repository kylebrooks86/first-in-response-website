-- FIRE permanent Job # — QA25 SEVEN-JOB OFFLINE REHEARSAL ONLY.
-- NEVER run this file with Wrangler, against hosted QA, staging, DR or LIVE.
-- It is intentionally OUTSIDE all 25 active Drizzle migration directories.
-- This freezes the owner's Nov 8 *synthetic QA* baseline: 3 customers,
-- 7 distinct estimates/jobs, 0 quote revisions, 1 invoice, 3 payments,
-- 0 photo metadata, 1 completed job, 25 migration journal entries.
-- Numbers are assigned in chronological UTC creation order, tie-break by ID.
-- A separate owner-authorized, D1-compatible, fresh-backup deployment and
-- rollback must be reviewed BEFORE any hosted migration is considered.
-- Never run for a live database that has existing real jobs without backfill.
BEGIN IMMEDIATE;
CREATE TEMP TABLE _fire_job_qa25_precondition (
  passed INTEGER NOT NULL CHECK(passed=1)
);
-- All preconditions are evaluated before touching original business tables.
INSERT INTO _fire_job_qa25_precondition(passed)
SELECT CASE WHEN
  (SELECT COUNT(*) FROM customers)=3
  AND (SELECT COUNT(*) FROM estimates)=7
  AND (SELECT COUNT(*) FROM invoices)=1
  AND (SELECT COUNT(*) FROM payments)=3
  AND (SELECT COUNT(*) FROM customer_photos)=0
  AND (SELECT COUNT(*) FROM d1_migrations)=25
  AND (SELECT COUNT(*) FROM message_templates
       WHERE key LIKE 'fire:quote-revision:v1:%')=0
  AND (SELECT COUNT(*) FROM estimates WHERE status='completed')=1
  AND (SELECT COUNT(*) FROM estimates
       WHERE customer_id IS NULL OR created_at IS NULL OR length(trim(created_at))=0)=0
  AND (SELECT COUNT(*) FROM estimates e LEFT JOIN customers c ON c.id=e.customer_id
       WHERE c.id IS NULL)=0
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

-- The reviewed QA snapshot has zero revision chains. Each estimate is
-- consequently its own root, and all existing business UUIDs remain intact.
INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at)
SELECT ROW_NUMBER() OVER (ORDER BY created_at,id),id,created_at
FROM estimates
ORDER BY created_at,id;
INSERT INTO fire_job_estimate_links(estimate_id,job_number)
SELECT e.id,j.job_number
FROM estimates e JOIN fire_job_numbers j ON j.root_estimate_id=e.id;

-- Fail closed on incomplete assignments, duplicates and high-water drift.
INSERT INTO _fire_job_qa25_precondition(passed)
SELECT CASE WHEN
  (SELECT COUNT(*) FROM fire_job_numbers)=7
  AND (SELECT COUNT(*) FROM fire_job_estimate_links)=7
  AND (SELECT COUNT(DISTINCT job_number) FROM fire_job_estimate_links)=7
  AND (SELECT COUNT(*) FROM estimates e LEFT JOIN fire_job_estimate_links l
       ON l.estimate_id=e.id WHERE l.estimate_id IS NULL)=0
  AND (SELECT COUNT(*) FROM fire_job_numbers j LEFT JOIN fire_job_estimate_links l
       ON l.job_number=j.job_number AND l.estimate_id=j.root_estimate_id
       WHERE l.estimate_id IS NULL)=0
  AND (SELECT COUNT(*) FROM fire_job_estimate_links l
       JOIN estimates e ON e.id=l.estimate_id
       JOIN fire_job_numbers j ON j.job_number=l.job_number
       WHERE e.customer_id <> (SELECT r.customer_id FROM estimates r
                                WHERE r.id=j.root_estimate_id))=0
  AND (SELECT COUNT(DISTINCT l.job_number) FROM fire_job_estimate_links l
       JOIN estimates e ON e.id=l.estimate_id WHERE e.status='completed')=1
  AND (SELECT seq FROM sqlite_sequence WHERE name='fire_job_numbers')=7
THEN 1 ELSE 0 END;
DROP TABLE _fire_job_qa25_precondition;
COMMIT;
