# FIRE Job # — current QA25 seven-job activation candidate (SOURCE ONLY)

**Owner intent, Nov 8, 2026:** finish permanent Job # before device visual review. This is a **draft development artifact, NOT a permission to migrate, enable a feature flag, deploy or merge**. No hosting commands in this runbook are intended for immediate execution.

## Grounded private QA facts

On the owner Acer, authenticated read-only Cloudflare QA inspection and protected SQL export + offline in-memory restore found: **3 customers, 7 estimates representing 7 distinct jobs, 0 revisions, 1 invoice, 3 payment rows, 0 photo metadata, 1 completed job**, and **0 existing Job # tables**. The isolated QA D1 is bound only to the synthetic QA Worker; independent staging and LIVE are different environments. The verified backup and its receipt remain encrypted on the owner's Acer. **A separately recoverable off-device copy is not yet verified.** Do not post owner SQL, tokens, customer IDs, passwords or the restoration receipt to GitHub or chat.

## Sources reviewed in this draft

- `job_numbers_v1.sql` — generic immutable prototype with two relational tables, FK protection, index and four no-update/no-delete triggers.
- `preflight_job_history.py` — exact private historical relationship reconstruction; refuses mixed timestamps, missing superseded audits, cross-customer revisions and duplicate/forked chains.
- `qa25_job_numbers_seven_job_offline_candidate.sql` — **SQLite-only** deterministic seven-job rehearsal wrapped in explicit transaction. Do **not** submit it to D1: D1 rejects SQL `BEGIN` and `COMMIT`.
- `qa25_job_numbers_seven_job_d1_candidate.sql` — same statement body without explicit transaction commands, relying on Cloudflare's **migration-level rollback-on-error**, with an on-database precondition guard. **Stored outside active migration directories**; it is not currently eligible for `wrangler d1 migrations apply`.
- `../test_job_numbering_qa25_candidate.py` — runs actual QA25 application schema + synthetic migration journal in a disposable SQLite DB, verifies seven unique numbers, unchanged original rows, first next number eight, FKs/immutability, and negative-control failure + rollback. CI is required for every commit.

Cloudflare's D1 documentation: https://developers.cloudflare.com/d1/reference/migrations/ and https://developers.cloudflare.com/d1/wrangler-commands/ . These pages describe migration versioning, transactional rollback on failure and automatic backup at migration apply. Such safeguards do not substitute for the owner's independent recoverable data archive.

## Conditions before moving this candidate into a real isolated QA migration

1. Obtain a **new** authenticated read-only exact-worker/physical-QA-D1 check and confirm the current 25-journal sequence; no simultaneous QA test writes. The Nov 8 inventory is a historical checkpoint, not perpetual authorization.
2. Independently verify **encrypted off-device backup plus successful recovery** and match its SHA-256 and full private record history to the new live baseline. Existing Acer-only backup is not sufficient proof of external disaster recovery.
3. Recompute in owner-private memory that **exactly seven original jobs and zero revisions** still exist and that no numbering table or sequence has been partially activated. Check that no customer, invoice, signed agreement, payment, Stripe/refund or photo data has drifted. If any difference, **STOP** and prepare a new plan — never silently force the fixed seven-job mapping.
4. Review D1-specific migration semantics and exact source bundle/branch version, verify the migration file path is unique **0025** for the isolated QA family, and test an identical candidate locally via real Wrangler D1 tooling before any remote action. Do not assume separate staging/DR/LIVE journals share QA history.
5. Require a **separate explicit owner approval** specifying exact source SHA, physical D1 UUID, serving/rollback Worker version, no R2/Stripe/LIVE/public-site scope, backup custody, and recovery procedure.
6. Only after owner approval: migrate isolated QA once using guarded migration tooling; independently verify seven rows / seven immutable estimate links / highest serial seven. Then enable the separately guarded `FIRE_JOB_NUMBERS_CANDIDATE=owner-approved-schema-v1` code path in an exact QA-only Worker artifact, verify its binding and new estimate #0008, revision retention, invoice/receipt/payment labels and distinct completed-job count.
7. Stage protected staging/DR separately only with matched independent source, backups and release gates. **LIVE must not import synthetic QA numbered records**. If LIVE is truly empty of genuine historical work, its first real job begins #0001. If LIVE has real prior work, backfill without renumbering it and continue from its own high-water.

**Always hold:** no auto-merge, raw `wrangler d1 execute`, direct SQL upload, schema reset, Stripe run, private photo vault upload or production promotion. Production release remains **3/10 gates accepted, NO-GO** pending independent acceptance.
