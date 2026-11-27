-- FIRE Job # schema prototype (SOURCE-ONLY REVIEW; NOT A HOSTED D1 MIGRATION).
-- This file is intentionally OUTSIDE every live/staging/doomsday/QA drizzle directory.
-- Existing private databases and current production migration journals are untouched.
-- Before promotion: assess legacy rows/revisions, freeze source SHA, assign
-- deterministic historical numbers and separately approve a target-specific D1 migration.
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
