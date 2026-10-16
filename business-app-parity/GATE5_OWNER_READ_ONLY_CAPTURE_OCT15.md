# FIRE Gate 5 — owner Windows metadata capture (October 15, 2026)

**State:** Prepared and locally tested; remote ten-query batch has NOT run. Official readiness 30% (3/10); Gate 5 OPEN.

## Development deliverables

1. capture_doomsday_schema_read_only.py is dry-run by default. With --capture and typed exact full UUID, it authenticates the account D1 list, verifies the expected fire-app-staging-db UUID, and executes exactly ten vetted SELECT statements. It checks D1 inventory again after the capture.
2. Pins RELEASE_SCHEMA_CAPTURE_READ_ONLY.sql to reviewed Git blob c931e45dd4d1a177011c73458da7be2dd050e673. Stops if the source changed.
3. Rejects unexpected/malformed CLI JSON, schema row keys, missing schema, invalid financial count fields, mismatched 22-entry migration journal, wrong D1 and oversized result sets. Refuses to write a successful partial capture. Does not echo stdout/stderr containing possible account data.
4. On complete results, creates one owner-private metadata-only JSON receipt in FIRE-Private-Backups with the strict verifier structure. It leaves sourceCommit, activeVersion and providerRecordId EMPTY because deployed artifact/provider attestation cannot be inferred from D1 CLI inventory or a temporary config.
5. test_capture_doomsday_schema_read_only.py: six synthetic tests passed locally, exercising fail-closed paths, source integrity, metadata output and no inadvertent disclosure. No tests have yet run on the owner Windows machine.

This is not a deployment or migration tool, and does not perform any Stripe or database writes. The SQL file itself returns schema/index/journal definitions and aggregate anomaly counts only.

## October 15 owner observations

The owner supplied eight screenshots of the hosted payment schema query against D1 UUID afb2c05a-d794-4a9a-b580-924ce01c26ad. They show payments/payment_refunds tables and existing indexes, including payment refunds and an existing narrow refund-provider uniqueness index. This source remains pre-0022; earlier separately reviewed 0022 named journal/index counts were 0/0. Earlier ledger checks returned zero anomaly groups. Screenshots show only portions of the huge output, so do not mark ten-query completeness.

The owner also completed independent private SQL export; local disposable SQLite restore/integrity tests; offline 0022 and savepoint rollback rehearsal; private AES-256 7z archive whose test required password; Google Drive upload with Restricted owner-only access; download and byte-identical SHA-256 checksum comparison; and password recovery retained independently of the laptop. No raw SQL was uploaded to Git or ChatGPT. Cloud SQL export cannot establish writer quiescence or active runtime identity, and does not include photo storage.

## Owner follow-up

From regular PowerShell in the existing repository checkout, first update and run the default dry run:

    git -C "$HOME\first-in-response-website" pull --ff-only
    py -3 "$HOME\first-in-response-website\business-app-parity\capture_doomsday_schema_read_only.py"

No Cloudflare calls on dry run. On separate explicit owner choice, a single remote ten-SELECT batch can be started:

    py -3 "$HOME\first-in-response-website\business-app-parity\capture_doomsday_schema_read_only.py" --capture

The helper requires typing CAPTURE followed by the full exact database UUID. It then saves a metadata-only result; never send raw SQL, secrets or session tokens.

## Remaining Gate 5 requirements

- Establish authenticated active Worker deployment version, artifact provenance and exact DB binding; independently exclude LIVE/refund-staging collisions.
- Review all ten captured metadata/count-only queries against the historical schema and additive 0022; independently verify active source identity and a current zero-anomaly preflight.
- Obtain a reviewed target-specific migration checksum, writer-quiescence (including webhook writers), recovery/rollback that accounts for post-backup writes, maintenance plan, and specific separate owner authorization before any hosted migration.

No remote schema write, hosted migration, deployment, Stripe request, changes to customer records, or release-gate acceptance was performed.
