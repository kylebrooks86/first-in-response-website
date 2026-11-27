# Candidate database contract preflight — October 9, 2026

Resumed b9edf60da30ec9e628fb83c3aa970bd9de96a3e1, clean local checkout and matching remote development head. FIRE Business App only.

Extended audit-local-schema.mjs with inspectCandidatePreflight. Besides existing financial column/index checks, it verifies the auth_rate_limits single-column primary key, TEXT key and non-null INTEGER counters required by the independent atomic login counter. It executes the existing read-only financial preflight as count queries, reporting provider collision groups, invalid refund links and invalid/missing succeeded-refund ledger entries without exposing customer/payment rows or identifiers. Inaccessible ledger tables fail closed. Migration journal names must match the target's expected SQL filenames without missing/unexpected/duplicate entries.

CLI behavior is deliberately stricter: exit zero requires all inspected local contracts, zero observed ledger anomalies and a compatible filename journal. A missing journal now exits one even if financial schema is compatible. productionReady and remoteVerified always remain false. The inspector opens supplied SQLite files read-only; it never connects to Cloudflare, repairs records, runs migrations or deduplicates collisions. READ_ONLY_CLOUDFLARE_SCHEMA.sql now requests auth table types/nullability/key/index information for a future authorized read-only remote inspection.

From each materialized target, inspect only its own permitted local SQLite export:

```sh
node scripts/audit-local-schema.mjs /absolute/target-export.sqlite /absolute/target-candidate
```

Never pass another target's history or infer remote identity from a filename. This checks a contract subset, not the complete database schema. Journal filenames do not prove applied migration bytes, timestamps, backup recovery or resource isolation. Actual remote schemas/journals are still 0/3.

New test-candidate-db-preflight.mjs passes 32/32 checks in each isolated LIVE/DR/staging candidate, 96/96 executions. It covers auth missing/wrong/composite key, wrong type and nullable columns, uncertain/duplicate journals, provider collisions, excessive refund amounts, missing successful-refund ledger and clean/failing CLI byte-for-byte read-only inspection. The existing financial schema audit regression passes in all three targets, 6/6 total suite runs. These use disposable synthetic databases and simulated journals. Migration sets tested: LIVE 21, Doomsday 23, staging 21 files. Existing migration histories were preserved; the old DR 22-file deployment seal remains untouched and cannot publish this candidate.

Shared inspection/test tools match byte-for-byte across all three new materializations. Exact candidate snapshot commits/paths/hashes are in CANDIDATE_DB_PREFLIGHT_EVIDENCE.json and CANDIDATE_COMMITS.json. No application runtime change; prior TypeScript/build/auth results retained rather than rerun unrelated suites. Production, deployments, secrets, independent records, Stripe and rollback archives unchanged. No paid service.

Scoped status: local new checks 96/96 (100%), selected suites 6/6 (100%). Formal deployed/mobile parity 0/32 (0%); complete remote schemas/journals 0/3 (0%); production readiness 3/10 (30%), NOT READY.

Next bounded batch: establish an explicit candidate release manifest tying the three candidate source/config/adapters/migration hashes to target-specific outstanding gates, without any deploy command or migration execution. Then advance an accessible read-only rendered flow comparison; real mobile evidence still requires supported viewport controls. Remote identity/schema/resource access, PIN/session configuration, sandbox routing, photo capability and rollback approval remain blockers. Stop after saving this batch.
