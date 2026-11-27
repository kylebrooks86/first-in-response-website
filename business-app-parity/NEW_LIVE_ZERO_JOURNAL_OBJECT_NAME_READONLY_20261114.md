# FIRE NEW LIVE — owner-hosted read-only zero-journal result (Nov 14, 2026)

## New physical evidence, NOT an offline mock

The owner ran the previously approved PR270 read-only NEW LIVE capture from the authenticated Acer. Sanitized screenshot shows:

- Result: ZERO_JOURNAL_ROWS_NEEDS_INVESTIGATION
- Pinned D1: fire-fullapp-new-live-db, physical UUID 0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662, physicalD1UuidMatched=true
- journalCount=0, applicationObjectCount=1, full source/first Job #0001 clean start verification=false
- oneShotAttemptLockPreserved=true, oneShotCompletionReceiptCreated=false
- d1ReadOnly=true, d1Modified=false, cloudflareWorkerModified=false, migrationRetryAllowed=false
- gate4Accepted=false, gate5Accepted=false, productionReady=false

IMPORTANT: the historical source classifier counted internal sqlite_sequence as an additional application object. It returned only a count, NOT the actual name. Wrangler's migrations helper creates d1_migrations with AUTOINCREMENT, and SQLite creates sqlite_sequence automatically on creating such a table. This is consistent with one internal metadata object but has NOT been independently verified as that object's name. References: https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/src/d1/migrations/helpers.ts and https://www.sqlite.org/fileformat.html

## Code improvement (existing DRAFT PR #270; no provider changes)

The source-only recovery classifier and its negative tests now explicitly distinguish an observed sole internal sqlite_sequence table from an actual unrecognized application table. Even the internal-only result is NO_RETRY, NOT a clean/new LIVE or success receipt. Dedicated offline CI workflow remains in place. Existing owner evidence, DR migration and Worker binding, and private lock remain accepted and untouched.

## The only new target-specific read, if needed

Do NOT run the previous full capture again, previous installer, prior Cloudflare sign-in, or DR/device tests. One NEW read-only command against the existing verified NEW LIVE physical UUID may return ONLY type and name from sqlite_master, excluding d1_migrations and known _cf metadata, but including sqlite_sequence. Exact fixed SELECT:

~~~sql
SELECT type,name FROM sqlite_master WHERE name NOT IN ('d1_migrations','_cf_KV','_cf_METADATA') AND (name NOT GLOB 'sqlite_*' OR name='sqlite_sequence') ORDER BY type,name
~~~

Use existing pinned 4.92.0 Wrangler and verified one-D1 config; no writes, rows, SQL DDL, or credentials. Before choosing a future recovery plan, also independently verify that the journal has not been populated/rewritten and that physical SQL shape is still intact. Zero journal rows by itself cannot establish original command outcome or authorize a second remote D1 migration.

## Release

Formal G1/G2/G3/G8 accepted 4/10, G4/G5/G6/G7/G9/G10 OPEN. NEW LIVE NO-GO; Job #0001 not yet activated. No provider write, authorization to retry, Worker/Access change, Stripe, R2 subscription or paid Cloudflare, Git merge, DNS or legacy retirement.
