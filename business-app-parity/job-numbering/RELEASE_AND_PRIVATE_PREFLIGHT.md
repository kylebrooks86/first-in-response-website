# FIRE Job # — release-safe installation and historical numbering plan

**SOURCE REVIEW ONLY.** This draft is **not** permission to run any SQL on Cloudflare D1, merge PRs, or deploy to QA/staging/LIVE.

## Required invariant

One immutable Job # follows the initial estimate, any signed quote replacement, scheduled work, closeout, final invoice and customer-accessible document. Original estimate/invoice UUIDs, share tokens, payments, and signatures remain intact. Every new unrelated job for an existing customer receives another Job #. Distinct completed jobs are counted from completed statuses, not from the last serial.

## First LIVE launch numbering policy — owner confirmation November 8, 2026

- **QA and LIVE are independent physical D1 databases and numbering namespaces.** The current isolated synthetic QA rehearsal has **seven distinct test jobs**; it must NOT seed the production counter or transfer any synthetic job, customer, payment or invoice row into LIVE.
- On a **genuinely empty LIVE job history**, install and enable numbering with an empty job serial history. The first real estimate allocates **Job #0001** (SQLite integer 1), the next **#0002**. **No Job #0000** is issued.
- If LIVE contains **any genuine earlier work**, do NOT erase data, silently reset an existing counter, or reassign existing invoices. First do a physical LIVE-only immutable source/backup/history preflight and deterministic backfill under separate authorization, then continue at max+1. Production emptiness remains a required independently verified fact, **not established by QA having seven jobs**.
- Once assigned, a Job # is permanent and never reused; revisions share the original number. QA may continue numbering at **#0008** for its next unrelated synthetic test job. QA numbering does not affect LIVE.
- These are acceptance requirements and *source-only tests*, not permission to migrate QA/staging/LIVE, reset counters, delete records, set feature flags or publish the app. Official production gates remain open.

## What already exists in Draft PR #60

- Source-only `job_numbers_v1.sql` **outside** all active target migration folders; immutable tables, FK/index/unique constraints and four anti-reassignment triggers.
- Gated new-estimate and replacement-quote transaction statements; no new customer/owner D1 reads or feature flags on existing Workers.
- Owner lists and customer token-based estimate/invoice pages have optional compact Job # labels; no artificial number for unlinked records.
- In-memory synthetic schema tests and revision/duplicate-ID/complete-count tests.
- A PRIVATE-ONLY history preflight to reconstruct legacy quote-replacement chains from `message_templates` audit keys, sort original jobs by creation timestamp and ID, reject missing/cross-customer/ambiguous/cyclic history, and propose stable numbering without modifying records.

## Private archive rehearsal — not yet run

Only the owner on the authorized local Acer can use an existing private SQL export, **not** the encrypted `.7z` directly. Do not upload SQL, encryption passwords, customer IDs, share tokens or any results containing them to GitHub or chat. The command below reads the export into memory and reports only counts; it never applies the new schema or writes to Cloudflare:

```powershell
python business-app-parity/job-numbering/preflight_job_history.py --sql-export "$env:LOCALAPPDATA\FIRE-Private-Backups\fire-app-staging-db-20261029-215537.sql"
```

A result with `historicalNumberAssignmentProposedOnly=true` is a *planning check*, not a permission to backfill and not evidence of full application parity. If the local file is missing, **do not** recreate it or download secrets without a separate plan. The owner's protected Google Drive archive must remain Restricted.

## Release blockers before turning the feature on

1. Review all per-environment D1 histories, currently distinct (the protected independent staging D1 had 22 Doomsday-family migrations while approved source has 25). Never apply the wrong lineage or blindly append migration numbers.
2. Independently verify a private historical preflight on the correct protected staging backup; investigate ALL anomalies and preserve rollback snapshots.
3. Build an additive, reviewed migration and transactional deterministic backfill for each isolated target. Refuse if any estimate lacks a legitimate mapping or any quote-revision chain is ambiguous. Preserve historical rows, payment ledgers and existing document links.
4. Verify the exact bound Worker, D1 identity and deployed source artifact. Ensure existing 50 service prices, approved iPhone UI, Google Voice and notification behavior remain unchanged.
5. Enable `FIRE_JOB_NUMBERS_CANDIDATE` only after independently confirming both schema tables, four immutable triggers and historical coverage, with exact owner consent. Never share the private signing key.
6. Perform synthetic end-to-end first-estimate, approval/revision, repeat customer, scheduled job, invoice and completion, owner/customer/print view, stale-session retries, and distinct completed count; verify zero impact on Stripe sandbox/live ledgers.
7. Promote **the same app artifact** across QA, independent staging, and LIVE, with distinct origin, secrets, D1 and Stripe mode. Production is a separate explicit owner gate.

**Formal accepted production gates remain 3/10.** A green source test does not close a hosted or financial gate.