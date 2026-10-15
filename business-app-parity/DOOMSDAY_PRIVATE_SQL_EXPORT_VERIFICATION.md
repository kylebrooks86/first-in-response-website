# FIRE Doomsday D1 export — private offline recovery validation

**Status: prepared, NOT EXECUTED. Official readiness 3/10 (30%).**

## Purpose

Owner's Oct 15 screenshots confirmed `DB → fire-app-staging-db`, 19 app
tables, migration journal `0000`–`0021`, un-applied candidate `0022`,
and seven clean aggregation preflights. Cloudflare D1 Time Travel shows a
rolling seven-day restore window; restoring by date **overwrites the current
database**. Neither a Time Travel screenshot nor a records-only JSON export
proves a complete independently restorable database backup.

The new `verify_doomsday_d1_export.py` checks an **owner-held SQL export**
by restoring its SQL into disposable local in-memory SQLite. It verifies
all application tables/indexes/views/triggers against the canonical Doomsday
pre-`0022` migration source, exact ordered names for 22 migrations, SQLite
integrity, foreign keys, four ledger anomaly queries, and absence of the
`0022` Stripe uniqueness index. A SHA-256 digest covers the export;
the output contains only metadata and aggregate pass/fail flags.

**The input SQL includes potentially sensitive customer, invoice, payment
and contact records. Never upload an export to GitHub, a public deployment,
CI artifacts, support tickets or this chat. Never put its contents into
scripts or source control.** Keep encrypted, access-controlled private backup
copies; this verifier produces a metadata-only receipt.

## How a separately authorized owner export would be made

Cloudflare officially supports `wrangler d1 export` with `--remote`
and `--output`. Documentation:
https://developers.cloudflare.com/d1/best-practices/import-export-data/
and https://developers.cloudflare.com/workers/wrangler/commands/d1/ .

**DO NOT run this procedure without a separately confirmed target, read-only
export approval, source config and local secure destination.** Cloudflare
warns its export API may temporarily make the DB unavailable for queries.
No export was attempted by preparing this document. The export command
requires a computer or approved runner with correctly scoped Wrangler
authentication; the iPhone Cloudflare Studio screenshots are not an export.

For a *separately approved* local operator, after confirming the resolved
`DB` binding is the Doomsday database UUID
`afb2c05a-d794-4a9a-b580-924ce01c26ad` (not LIVE or refund-staging),
the following is the **read-only export-only** operation, with the correct
authenticated Wrangler config selected in advance:

```bash
# REVIEWED EXAMPLE ONLY. NOT AN AUTHORIZATION TO RUN.
npx wrangler d1 export fire-app-staging-db --remote --output=./PRIVATE_FIRE_DOOMSDAY_PRE0022.sql
```

Do not use `--no-data` (it omits financial records), `d1 execute`,
`d1 migrations apply`, Time Travel restore, the historical combined deploy
wrapper, or a default config that points to another database. Remote
exports can temporarily affect availability, so schedule if necessary.

## Offline verification (never connects to Cloudflare)

With a clean checkout of the exact candidate repo (with 23 canonical
migration files, ending in `0022`) on an owner-controlled computer:

```bash
# Reads existing private SQL file. It will never run a remote command.
python3 business-app-parity/verify_doomsday_d1_export.py \
  ./PRIVATE_FIRE_DOOMSDAY_PRE0022.sql
```

Optional independently recorded SHA-256 may be passed via
`--expected-sha256 <64-character-hash>`. Hash only is safe to add to a
review packet; do not attach SQL/customer data. The verifier:

- Refuses paths that are not local regular `.sql` files, symlinks, empty
  files, and files above 128 MiB; requires trusted exports.
- Executes only against in-memory disposable SQLite; attempts to attach
  external databases, load SQLite extensions, or run unreviewed PRAGMAs
  are denied.
- Checks exact **historical pre-change** Doomsday schema/journal rather
  than pretending `0022` is already applied. A new candidate version may
  legitimately require a different verifier and fresh migration review.
- Reports *only* metadata/hash, boolean check outcomes, and no individual
  records or provider IDs. It never creates a copy of the owner's data on
  disk and never alters the source file.
- Exit 0: matching restored technical snapshot. Exit 1: data/schema drift.
  Exit 2: invalid, blocked or unrestorable file.
- Always reports `ownerExportSourceIndependentlyAuthenticated: false`,
  `exportCompletenessAgainstLiveDatabaseVerified: false`,
  `migrationAuthorized: false`, and `releaseGateAccepted: false`.

## Requirements not satisfied even if verification succeeds

A passing owner-held export does not independently prove that the export
covers **all latest hosted rows** or that writers were quiesced. A locally
restored logical SQL dump is also distinct from a sealed physical SQLite
snapshot and a tested hosted rollback. Require a source-bound SHA and
capture timestamp, immutable D1 UUID/active runtime identity, independent
source row/metadata inventory, controlled write-stop/recheck immediately
before migration, secure retention independent of Time Travel, a disposable
recovery test, owner-reviewed rollback for writes after capture, and explicit
migration-specific owner approval. A D1 SQL export does not include R2
photo bytes; the independent Worker has no R2 binding in the observed
Production environment.

**No production permission granted; release gate stays OPEN.**
