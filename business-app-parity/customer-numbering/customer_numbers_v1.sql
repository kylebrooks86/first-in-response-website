-- FIRE Customer # v1. SOURCE-ONLY DESIGN; never run in hosted D1 without
-- isolated backup, deterministic historical preflight, migration review and
-- explicit owner approval for the exact Worker/D1 target.
-- Separate from Job #. Never reuse identifiers, including after deletions.
CREATE TABLE fire_customer_numbers (
  customer_number INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL UNIQUE
    REFERENCES customers(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at TEXT NOT NULL CHECK(length(created_at)>0)
);
CREATE TRIGGER fire_customer_numbers_no_update
  BEFORE UPDATE ON fire_customer_numbers BEGIN
    SELECT RAISE(ABORT,'FIRE customer numbers are permanent');
  END;
CREATE TRIGGER fire_customer_numbers_no_delete
  BEFORE DELETE ON fire_customer_numbers BEGIN
    SELECT RAISE(ABORT,'FIRE customer numbers cannot be reused');
  END;
