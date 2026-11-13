-- SOURCE ONLY: additive owner deposit exception audit; no hosted migration authorized.
-- Recorded history is append-only. Restoring standard terms creates a NEW event.
CREATE TABLE deposit_policy_events (
 id TEXT PRIMARY KEY NOT NULL,
 estimate_id TEXT NOT NULL REFERENCES estimates(id),
 confirmation_id TEXT NOT NULL UNIQUE,
 actor_email TEXT NOT NULL CHECK(length(trim(actor_email))>0),
 mode TEXT NOT NULL CHECK(mode IN ('standard','waive','percentage','fixed','schedule-before-deposit','restore-standard')),
 previous_total_cents INTEGER NOT NULL CHECK(typeof(previous_total_cents)='integer' AND previous_total_cents BETWEEN 0 AND 9007199254740991),
 previous_deposit_cents INTEGER NOT NULL CHECK(typeof(previous_deposit_cents)='integer' AND previous_deposit_cents BETWEEN 0 AND previous_total_cents),
 new_deposit_cents INTEGER NOT NULL CHECK(typeof(new_deposit_cents)='integer' AND new_deposit_cents BETWEEN 0 AND previous_total_cents),
 paid_principal_cents INTEGER NOT NULL CHECK(typeof(paid_principal_cents)='integer' AND paid_principal_cents BETWEEN 0 AND previous_total_cents),
 percent_basis_points INTEGER CHECK(percent_basis_points IS NULL OR (typeof(percent_basis_points)='integer' AND percent_basis_points BETWEEN 0 AND 10000)),
 schedule_before_collection INTEGER NOT NULL DEFAULT 0 CHECK(schedule_before_collection IN (0,1)),
 previous_contract_version TEXT,
 updated_contract_version TEXT,
 previous_signed_at TEXT,
 requires_customer_reapproval INTEGER NOT NULL DEFAULT 0 CHECK(requires_customer_reapproval IN (0,1)),
 reason TEXT CHECK(reason IS NULL OR length(reason)<=500),
 created_at TEXT NOT NULL CHECK(length(trim(created_at))>0),
 CHECK ((mode='percentage' AND percent_basis_points IS NOT NULL) OR (mode<>'percentage' AND percent_basis_points IS NULL)),
 CHECK ((mode='schedule-before-deposit' AND schedule_before_collection=1 AND new_deposit_cents=previous_deposit_cents) OR (mode<>'schedule-before-deposit' AND schedule_before_collection=0)),
 CHECK (mode<>'waive' OR new_deposit_cents=0),
 CHECK (mode NOT IN ('standard','restore-standard') OR new_deposit_cents=(previous_total_cents/2)+(previous_total_cents%2)),
 CHECK (mode<>'percentage' OR new_deposit_cents=(previous_total_cents/10000)*percent_basis_points + ((previous_total_cents%10000)*percent_basis_points+5000)/10000),
 CHECK (requires_customer_reapproval=CASE WHEN previous_signed_at IS NOT NULL AND (new_deposit_cents<>previous_deposit_cents OR schedule_before_collection=1) THEN 1 ELSE 0 END)
);
--> statement-breakpoint
CREATE INDEX idx_deposit_policy_events_estimate_time ON deposit_policy_events(estimate_id,created_at);
--> statement-breakpoint
CREATE TRIGGER deposit_policy_events_no_update BEFORE UPDATE ON deposit_policy_events BEGIN SELECT RAISE(ABORT,'Deposit audit is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER deposit_policy_events_no_delete BEFORE DELETE ON deposit_policy_events BEGIN SELECT RAISE(ABORT,'Deposit audit is immutable'); END;
