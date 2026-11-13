# FIRE Business App reliability and recovery handoff — 2026-10-09

Development branch: `work/fire-business-app-parity-2026-10-08`. Started from the current remote head `0f22954d5a455e8a379d9f90580cf170ada2febd`, fast-forwarding the clean older local checkout before editing. All saved prior work, historical evidence and rollback copies are preserved.

## Completed behavior

Business Tasks/Expenses/Customers reads now check HTTP results, JSON collections and records, network failures and expense values before committing all four collections together. Loading and errors hide totals and forms; retry recovers; last good records stay in state. Empty successful collections may display zero. Expense totals filter by both month and year. Request generations protect Business and the five confirmed racing Estimates, Invoices, Agreements, Follow-ups and Payments loaders from stale success, errors, finally callbacks and unmount updates.

Standalone backup validation/restoration now includes optional `payment_refunds`. The shared standalone integrity module mirrors in-app ownership, pending/succeeded reservation limits and succeeded negative-ledger matching, with regression comparisons against the actual in-app functions. Duplicate IDs/providers and missing relationships fail. Merge preflight includes preserved target reservations; immutable financial/ownership conflicts fail before writes. Inserts remain merge-only. Inserted values and final relationship/refund integrity are verified, and retry repairs a committed prefix without creating duplicates. Verified older backups without refund metadata remain supported, including older negative ledger entries; missing refund requests are not invented.

## Exact local results

All three isolated LIVE-adapter, Doomsday-adapter and staging-adapter candidates passed:

- New loader recovery suite: **961/961 checks per target**.
- New records recovery suite: **100/100 checks per target**.
- Combined new checks: **3,183/3,183** across three targets.
- Targeted suites: **42/42** (14 per target); full names, result lines and hashes in `RELIABILITY_RECOVERY_EVIDENCE.json`.
- TypeScript checks: **3/3**; final builds: **3/3**.
- Shared app source parity: **119/119 files**; deployment adapters require separate verification.
- Negative controls reject each of the five prior racing loaders, unguarded Business, and month-only expenses ($1,011.00 versus expected $12.00).

Synthetic in-app export → standalone validator → local restore → re-export verifies partial principal and tip refunds, pending and failed requests, corrupt ownership/reservations/ledger, duplicates, missing parents, preserved newer target records, immutable target conflicts, interrupted writes/retry, and verified older backups. The mocked Wrangler can operate only on temporary SQLite files and rejects remote mode. Existing financial suites mock Stripe in memory. All runtime changes were rechecked after the final expense guard; the added older-ledger fixture reran the recovery suite. Local fixture SQL only; no operational migrations.

## Official release status

**Overall verified readiness remains 3/10 gates (30%); not release-ready.** Source and local tests do not prove deployed look, functionality or flow. Hosted/mobile comparisons remain **0/32**; complete remote schemas/journals **0/3**. Pending gates: deployed identities, remote schema/journals, auth adapter, photo storage, mobile evidence, sandbox integration, rollback/seal.

LIVE, Doomsday production and refund staging deployments, their databases, Stripe settings and records were untouched. No real Stripe calls, cloud writes, deployments, operational migrations or paid services; cost **$0**. Historical manifests do not seal this batch's changed source.

Operational restore requires a compatible schema and quiescent target. Cloud concurrency is not verified. Preserved existing rows win; conflicting immutable records require review. Photo metadata does not replace the separate photo-file archive. Refund integrity cannot be reconstructed when verified old backups omit request metadata.

Next bounded batch: read-only review of release identities/schema evidence and the missing hosted/mobile comparison plan. Do not deploy, migrate, run a remote restore or use Stripe without explicit authorization. Overnight runs remain stopped; stop cleanly at this checkpoint.
