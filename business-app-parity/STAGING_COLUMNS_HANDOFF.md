# Staging column verification batch — October 9, 2026

Resumed development branch work/fire-business-app-parity-2026-10-08 at 664fc407a9adc655a11d094f1c21ec66c1a9be93. Remote head matched local HEAD and the checkout was clean before work. This batch is FIRE Business App only and continues the saved staging preflight.

## New deployed evidence

Read-only Sites database overview returned exact staging project appgprj_6ac7e8e358dc81918d0a47c4034c4a41, binding DB, and 19 user tables with no omitted identifiers. Bounded table reads (one row maximum per table) expose column-name metadata. All 19 tables were inspected once; row values were neither printed nor persisted, and no further row pages were requested. This does not prove the database contains only synthetic records.

STAGING_COLUMNS_EVIDENCE.json stores only project/binding, table/column names, omission counts, scope and limitations. The connector exposes column names, not SQL types/defaults/constraints, index predicates, foreign keys, database resource IDs or migration journals. No unsupported system-table read or arbitrary SQL was attempted.

## Comparison and checks

check-staging-columns.py derives expected names by executing the staging candidate's preserved migrations in disposable in-memory SQLite, then compares them with saved deployed metadata. No external database or network access occurs. Column order is immaterial. Wrong target/binding, missing/extra tables or columns, omitted columns, and duplicate names fail the comparison. The report always keeps completeRemoteSchemaVerified and productionReady false even when names match.

Actual deployed staging names match 19/19 candidate tables and 163/163 column names (100%). This includes fee, checkout, refund, customer/photo, invoice/revision and notification fields. test-staging-columns.py passes 9/9 tests: actual evidence, missing/extra column, missing/extra table, omitted projection, duplicate table, duplicate column and wrong target. JSON/content consistency and git diff --check also pass before the branch save.

This is inspection tooling and evidence only. No application source/adapters, candidate commits, migration histories or deployment changed. Unchanged application suites/builds and 57 photo recovery checks were not repeated. No remote migration/write, secret change, Stripe operation, event replay, charge/refund, storage activation, paid service or publication occurred. Historical rollback copies remain unchanged.

## Accurate progress

- Bounded column-name comparison: 19/19 tables and 163/163 columns (100%).
- New checker tests: 9/9 (100%).
- Candidate shared-source parity: prior 118/118 (100%) preserved, not rerun.
- Full remote schema/journal verification: 0/3 (0%); no release gate cleared.
- Formal deployed/mobile comparisons: 0/32 (0%).
- Overall production readiness: 3/10 (30%), NOT READY.
- Previous staging preflight remains 3/8 (37.5%); its combined columns/indexes/journals check is only partially inspected and remains false.

## Next bounded task

Verify staging database resource isolation and indexes/migration journal through an authenticated read-only surface that supports them; the bounded Sites table API does not expose these. If that surface is unavailable, move directly to one candidate mobile workflow improvement rather than repeating column inspection. Sandbox key/endpoint pairing, synthetic-only data, database rollback restore, independent Doomsday identity/auth/storage and real mobile evidence remain unverified. No owner intervention is needed to save this checkpoint. Stop after verification and branch save.

Read-only QC can rerun the checker against saved metadata and inspect the negative fixtures without touching deployed databases or Stripe. A successful name comparison must never be described as full schema compatibility or release approval.
