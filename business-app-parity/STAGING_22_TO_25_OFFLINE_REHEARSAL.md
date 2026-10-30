# FIRE independent staging D1: protected 22 → 25 review-only rehearsal

This script is an **offline safety test**, NOT permission to migrate Cloudflare D1 or deploy any Worker.
The owner's restricted 7z staging backup must never be committed, emailed unencrypted, or supplied to GitHub Actions.

The observed independent staging DB journal is exactly the first 22 migrations from
`adapters/doomsday/drizzle` (not `adapters/staging/drizzle`). The three candidate-only
scripts are `0022_stripe_provider_uniqueness.sql`, `0023_deposit_policy_events.sql`
and `0024_deposit_agreement_snapshots.sql`. Never mix the two historical lineages.

## Source-only CI check (uses no real data)

```
python business-app-parity/rehearse_staging_22_to_25.py
python -m unittest discover -s business-app-parity -p 'test_rehearse_staging_22_to_25.py' -v
```

This constructs disposable baseline 0000–0021 entirely in memory, rehearses 0022–0024,
and checks unchanged existing records/schema, the new indexes/tables/triggers, and
integrity. Its green result **does not** establish that the owner-held staging D1
or currently deployed staging Worker is compatible.

## Owner-only private backup rehearsal (optional; NO upload)

After separately verifying the intended export is a locally protected, authorized
copy of `fire-app-staging-db` with a 22-entry ordered journal, run on the owner's
private Acer account:

```
python business-app-parity/rehearse_staging_22_to_25.py --sql-export "$env:LOCALAPPDATA\FIRE-Private-Backups\fire-app-staging-db-20261029-215537.sql"
```

Do not provide the SQL file, file contents, or encryption password to ChatGPT,
GitHub, or a third party. The script loads the SQL **only into process memory**,
re-checks migration ordering, prevents duplicate Stripe provider IDs, executes
three candidate migrations in-memory, verifies existing tables/data/schema
remain unchanged, and emits only non-sensitive pass/fail summary. The original
backup is not modified. Keep the encrypted copy off-device and private.

A passing local rehearsal does not prove remote D1 identity, current hosted schema,
Worker build parity, Stripe sandbox behavior, rollback readiness, or the LIVE gate.
Those require further independently reviewed evidence and exact owner approval.
