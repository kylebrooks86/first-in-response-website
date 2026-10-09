# Doomsday 0022 migration review — non-executing plan

No migration, deployment, database write, Stripe request or resource activation is authorized by this plan. Do not execute the historical preparation/deploy wrappers: they can replace local source, apply remote migrations and deploy. This batch does not run them.

## Reconciled target and source

Owner independently observed Worker `fire-app-independent-staging`, active version prefix `61fa32a3` at 100% traffic, binding `DB` → `fire-app-staging-db`, 19 application tables, 11 payments columns, 10 payment_refunds columns and three refund application indexes. Duplicate Stripe ledger provider checks and foreign_key_check returned no rows; journal includes 0000–0021; 0022/index absent. These are current owner-supplied observations; raw query output, exact SQL definitions and full Worker version UUID are not included in this intake.

Read-only GitHub verification resolves deployment-link reference a1cdb94 to a1cdb94be76b0ded16b213b84616e741651e140d, head of repository branch fire-calculator-exact-live-clone. The commit adds only 11 handoff-document lines; it does not change app runtime code. The branch name does not imply the deployed app is the calculator: its runbook/build scripts select the Business App under fire-app-dr, extract the sealed v138 archive, then apply DR overlays. Reference dashboard/package differ from the development candidate; the runtime app-version endpoint is absent in the raw reference tree. The built overlays may change those files, so this is not an exact deployed-bundle comparison.

All 22 reference SQL migrations match candidate Doomsday migrations 0000–0021 byte-for-byte. This supports migration-source lineage, but journal numbering alone does not prove remote SQL definitions or runtime artifact equivalence. The historical wrapper expects D1 ID afb2c05a-d794-4a9a-b580-924ce01c26ad; that is a source expectation, not a freshly observed binding UUID. The legacy preparation scripts insist on exactly 22 migrations and cannot be assumed to build the latest coordinated candidate.

## Exact proposed change

Candidate file: adapters/doomsday/drizzle/0022_stripe_provider_uniqueness.sql. It creates unique index idx_payments_stripe_provider_unique on payments(provider_id), restricted to provider IDs matching the case-sensitive SQLite GLOB predicates cs_* or refund:*. Tip checkout identifiers also fall under cs_*. Unrelated manual references remain outside the predicate. No table/row/column rewrite or automatic deduplication. The earlier refund-provider index remains in place. Migration SQL and existing migration history are unchanged in this batch.

## Stop conditions before seeking execution approval

1. Obtain full active Worker version UUID, deployment/build source SHA, build root/commands and artifact identity from the same deployment. Compare authenticated /api/dr-capture-identity to the GitHub link and saved provenance; do not assume the metadata link seals the built code. Confirm DB binding's actual immutable D1 UUID/account and isolation from LIVE/refund staging. Do not inspect secret values.
2. Capture exact sqlite_master definitions and pragma_table_info/index_list/index_info for payments, payment_refunds and the relevant indexes, plus ordered d1_migrations rows. Confirm 0000–0021 names and no drift/reordering, absence of 0022, no unexpected existing index under the intended name. Do not use IF NOT EXISTS to hide mismatched definitions. If index exists but journal does not, or vice versa, stop for reconciliation.
3. Run all four statements of shared/scripts/stripe-ledger-preflight.sql on the exact identified target: Stripe provider collisions; refund ownership/positive-original/individual amounts; succeeded negative-ledger matching; cumulative pending+succeeded reservations. Every returned row blocks the plan. Never delete, rewrite or invent ledger history to force a pass. Run foreign_key_check independently. Clean results are point-in-time evidence, not a concurrency guarantee.
4. Confirm the exact migration checksum and inspect the pending migration list using an isolated reviewed config containing only this target's binding. Approval must name the full Worker version, database UUID, candidate source, 0022 checksum, backup verification, rollback decision and maintenance window. This plan supplies no remote execution command.

## Backup and concurrency precautions

Before any separately authorized mutation, preserve a timestamped complete D1 SQL export including schema, indexes, all rows and migration journal, and an in-app records export with refund/revision metadata. Record SHA-256, source UUID, row counts and capture time; keep customer/financial data in an owner-controlled secure location, not Git. Verify full export restoration and records-validator compatibility in disposable local fixtures without Stripe/network access. Records JSON alone cannot restore physical schema/journal or photo bytes. Preserve any existing independent photo archive; documented D1-only deployment has no photo-file storage.

Preserve current Worker version/build config as an immutable rollback reference. Establish a quiescent window that stops all relevant application/payment/webhook writers through a separately approved operational procedure; merely avoiding browser clicks is insufficient. Re-run collisions/reservations immediately before applying. If quiescence cannot be guaranteed, stop: a new collision can appear after a clean preflight. Index creation itself must fail rather than repair/delete colliding rows. Verify available free backup/recovery facilities; do not activate paid storage.

## Future approved execution and verification boundaries

An approved operator would apply only the reviewed pending migration through the target-specific migration mechanism, not the historical combined deploy wrapper. Preserve the migration runner's journal consistency. If the journal update and DDL have ambiguous/interrupted outcomes, inspect both index definition and journal before any retry; do not blindly rerun CREATE INDEX or hand-edit journal rows.

After an approved apply, independently verify exact unique/partial index definition, indexed column and predicate; one matching journal row; unchanged row counts and financial invariants; no FK violations/collisions; and unchanged Worker version/traffic, bindings and other targets. Prove duplicate checkout/refund rejection only on local/synthetic fixtures, not by inserting tests into this database or triggering Stripe. Applying 0022 alone does not deploy candidate refund/UI/recovery code or establish full parity.

## Rollback considerations

This additive index leaves existing financial rows unchanged. If CREATE UNIQUE INDEX fails due to collisions, verify absence of the new index and journal entry and unchanged rows; preserve evidence and stop. SQLite local tests show failure does not change rows, but do not substitute that for inspecting D1/runner outcomes.

Do not default to restoring an old database: that can discard payments/refunds recorded since backup. Preserve/export any post-backup records first and reconcile under owner approval. Do not automatically drop the index or delete journal entries; dropping uniqueness reopens duplicate-event risk. If removal is necessary, design and approve a forward compensating migration with explicit application/idempotency and journal consequences. Rolling the Worker back does not roll the database back. Prefer leaving an additive compatible index while separately restoring a previously verified Worker, if compatibility is proven. No rollback action is executed or authorized here.

## Release checklist outcome

Doomsday table/column/index-count, clean duplicate/FK and journal observations are accepted as targeted owner evidence. Full remote-schema gate remains incomplete: actual definitions/resource IDs, 0022 gap, LIVE/staging checks and runtime provenance remain open. Other auth, photo, mobile, sandbox and rollback/seal gates remain open. Official readiness stays 3/10 (30%), NOT READY. Single most useful next step: read-only capture of the exact deployment build root/source/runtime identity and immutable DB UUID for active version 61fa32a3 before proposing any 0022 execution.
