-- REVIEW ONLY: outside migration journals. Disposable synthetic fixtures only.
CREATE TABLE customer_properties (
 id TEXT PRIMARY KEY NOT NULL,
 customer_id TEXT NOT NULL REFERENCES customers(id),
 address TEXT NOT NULL CHECK(length(trim(address)) BETWEEN 1 AND 2000),
 designation TEXT NOT NULL DEFAULT '' CHECK(length(designation)<=200),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 created_at TEXT NOT NULL
);
CREATE INDEX customer_properties_owner_page ON customer_properties(customer_id,id);
CREATE TRIGGER customer_property_identity_immutable BEFORE UPDATE ON customer_properties
WHEN NEW.id<>OLD.id OR NEW.customer_id<>OLD.customer_id OR NEW.address<>OLD.address OR NEW.designation<>OLD.designation OR NEW.created_at<>OLD.created_at
BEGIN SELECT RAISE(ABORT,'Property identity and location are immutable'); END;
CREATE TRIGGER customer_property_archive_only BEFORE UPDATE ON customer_properties
WHEN OLD.active<>1 OR NEW.active<>0 OR NEW.revision<>OLD.revision+1
BEGIN SELECT RAISE(ABORT,'Only deliberate revision-checked archival is supported'); END;
CREATE TRIGGER customer_property_no_delete BEFORE DELETE ON customer_properties
BEGIN SELECT RAISE(ABORT,'Property history must be retained'); END;

CREATE TABLE estimate_property_links(
 estimate_id TEXT PRIMARY KEY NOT NULL REFERENCES estimates(id),
 customer_id TEXT NOT NULL REFERENCES customers(id),
 property_id TEXT NOT NULL REFERENCES customer_properties(id),
 property_revision INTEGER NOT NULL CHECK(property_revision>=1),
 selection_mode TEXT NOT NULL CHECK(selection_mode IN ('sole','explicit')),
 captured_at TEXT NOT NULL
);
CREATE INDEX estimate_property_owner ON estimate_property_links(customer_id,property_id);
CREATE TABLE property_recovery_guard(id INTEGER PRIMARY KEY CHECK(id=1));
CREATE TRIGGER property_recovery_empty_destination BEFORE INSERT ON property_recovery_guard
WHEN EXISTS(SELECT 1 FROM customers) OR EXISTS(SELECT 1 FROM estimates) OR EXISTS(SELECT 1 FROM customer_notes) OR EXISTS(SELECT 1 FROM invoices) OR EXISTS(SELECT 1 FROM invoice_items) OR EXISTS(SELECT 1 FROM invoice_revisions) OR EXISTS(SELECT 1 FROM payment_checkout_sessions) OR EXISTS(SELECT 1 FROM estimate_items) OR EXISTS(SELECT 1 FROM payments) OR EXISTS(SELECT 1 FROM payment_refunds) OR EXISTS(SELECT 1 FROM customer_messages) OR EXISTS(SELECT 1 FROM notifications) OR EXISTS(SELECT 1 FROM message_templates) OR EXISTS(SELECT 1 FROM estimate_change_requests) OR EXISTS(SELECT 1 FROM tasks) OR EXISTS(SELECT 1 FROM expenses) OR EXISTS(SELECT 1 FROM job_reports) OR EXISTS(SELECT 1 FROM customer_photos) OR EXISTS(SELECT 1 FROM estimate_service_locations) OR EXISTS(SELECT 1 FROM customer_properties) OR EXISTS(SELECT 1 FROM estimate_property_links)
BEGIN SELECT RAISE(ABORT,'Recovery destination is occupied'); END;
CREATE TRIGGER estimate_property_ownership BEFORE INSERT ON estimate_property_links
WHEN NOT EXISTS(SELECT 1 FROM customer_properties p JOIN estimates e ON e.id=NEW.estimate_id JOIN estimate_service_locations sl ON sl.estimate_id=e.id
 WHERE p.id=NEW.property_id AND p.customer_id=NEW.customer_id AND e.customer_id=NEW.customer_id AND sl.customer_id=NEW.customer_id
 AND p.active=1 AND p.revision=NEW.property_revision AND sl.captured_at=NEW.captured_at AND sl.address=p.address||CASE WHEN p.designation<>'' THEN ' · '||p.designation ELSE '' END
 AND (NEW.selection_mode='explicit' OR (SELECT COUNT(*) FROM customer_properties other WHERE other.customer_id=p.customer_id AND other.active=1)=1))
 AND NOT (EXISTS(SELECT 1 FROM property_recovery_guard WHERE id=1) AND EXISTS(SELECT 1 FROM customer_properties p JOIN estimates e ON e.id=NEW.estimate_id JOIN estimate_service_locations sl ON sl.estimate_id=e.id WHERE p.id=NEW.property_id AND p.customer_id=NEW.customer_id AND e.customer_id=NEW.customer_id AND sl.customer_id=NEW.customer_id AND NEW.property_revision=1 AND NEW.captured_at>=p.created_at AND sl.captured_at=NEW.captured_at AND sl.address=p.address||CASE WHEN p.designation<>'' THEN ' · '||p.designation ELSE '' END))
BEGIN SELECT RAISE(ABORT,'Property selection or captured address changed'); END;
CREATE TRIGGER estimate_property_immutable_update BEFORE UPDATE ON estimate_property_links
BEGIN SELECT RAISE(ABORT,'Historical property links cannot be overwritten'); END;
CREATE TRIGGER estimate_property_immutable_delete BEFORE DELETE ON estimate_property_links
BEGIN SELECT RAISE(ABORT,'Historical property links cannot be deleted'); END;
