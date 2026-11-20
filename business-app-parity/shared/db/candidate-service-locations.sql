-- REVIEW ONLY: not in any migration journal. Only disposable synthetic fixtures apply this file.
-- No historical backfill. Production application needs separate reviewed migration approval.
CREATE TABLE estimate_service_locations (
 estimate_id TEXT PRIMARY KEY NOT NULL REFERENCES estimates(id),
 customer_id TEXT NOT NULL REFERENCES customers(id),
 address TEXT NOT NULL,
 captured_at TEXT NOT NULL
);
CREATE INDEX idx_estimate_service_locations_customer ON estimate_service_locations(customer_id);
CREATE TRIGGER service_location_customer_match BEFORE INSERT ON estimate_service_locations
WHEN NOT EXISTS(SELECT 1 FROM estimates WHERE id=NEW.estimate_id AND customer_id=NEW.customer_id)
BEGIN SELECT RAISE(ABORT,'Service location customer mismatch'); END;
CREATE TRIGGER service_location_immutable_update BEFORE UPDATE ON estimate_service_locations
BEGIN SELECT RAISE(ABORT,'Historical service locations cannot be overwritten'); END;
CREATE TRIGGER service_location_immutable_delete BEFORE DELETE ON estimate_service_locations
BEGIN SELECT RAISE(ABORT,'Historical service locations cannot be discarded'); END;
