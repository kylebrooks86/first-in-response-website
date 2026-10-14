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
