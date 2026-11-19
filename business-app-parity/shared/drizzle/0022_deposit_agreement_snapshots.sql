-- Additive source-only signed deposit agreements. No hosted migration authorized.
CREATE TABLE deposit_agreement_snapshots (
 event_id TEXT PRIMARY KEY NOT NULL REFERENCES deposit_policy_events(id),
 estimate_id TEXT NOT NULL REFERENCES estimates(id),
 document_version TEXT NOT NULL UNIQUE CHECK(length(document_version)>40 AND document_version LIKE 'deposit-exception-v1:%'),
 document_digest TEXT NOT NULL CHECK(length(document_digest)=64 AND document_digest NOT GLOB '*[^0-9a-f]*'),
 total_cents INTEGER NOT NULL CHECK(typeof(total_cents)='integer' AND total_cents BETWEEN 0 AND 9007199254740991),
 deposit_cents INTEGER NOT NULL CHECK(typeof(deposit_cents)='integer' AND deposit_cents BETWEEN 0 AND total_cents),
 mode TEXT NOT NULL CHECK(mode IN ('standard','restore-standard','waive','fixed','percentage','schedule-before-deposit')),
 scope_json TEXT NOT NULL CHECK(json_valid(scope_json) AND length(scope_json)<=100000),
 agreement_text TEXT NOT NULL CHECK(length(agreement_text)>50 AND length(agreement_text)<=50000),
 signed_name TEXT NOT NULL CHECK(length(trim(signed_name)) BETWEEN 2 AND 120),
 photo_release TEXT NOT NULL CHECK(photo_release IN ('yes','no')),
 signed_at TEXT NOT NULL CHECK(length(signed_at)>0),
 accepted_at TEXT NOT NULL CHECK(length(accepted_at)>0),
 CHECK(document_version='deposit-exception-v1:'||event_id)
);
--> statement-breakpoint
CREATE INDEX idx_deposit_agreement_snapshots_estimate ON deposit_agreement_snapshots(estimate_id,accepted_at);
--> statement-breakpoint
CREATE TRIGGER deposit_agreement_snapshots_no_update BEFORE UPDATE ON deposit_agreement_snapshots BEGIN SELECT RAISE(ABORT,'Signed deposit agreement is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER deposit_agreement_snapshots_no_delete BEFORE DELETE ON deposit_agreement_snapshots BEGIN SELECT RAISE(ABORT,'Signed deposit agreement is immutable'); END;
