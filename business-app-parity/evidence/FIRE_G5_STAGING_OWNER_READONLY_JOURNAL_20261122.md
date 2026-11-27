# FIRE Gate 5 — owner Acer pinned STAGING journal capture (November 22, 2026)

> **Evidence scope:** independently reviewed owner-provided partial Acer PowerShell photograph, taken November 22, 2026. This is an authenticated provider *read* receipt, **not** an approved schema migration or hosted release acceptance.

## Actual owner screenshot and immutable scope

- Original uploaded chat photograph: `IMG_89220C90-BDAA-4BAC-AF87-10EB3AE44B5C.jpeg` (retained in owner's original conversation; **the original image bytes have not been published to GitHub**).
- Original JPEG SHA-256: `6962f786fdc3c04cbc50dfe89fc3b6570c8e775843299b9bdcab29a345c37aa9`.
- Existing committed collector: `business-app-parity/owner_g4_g5_existing_session_readonly.mjs`, which calls the pinned `owner_staging_journal_existing_session_readonly.mjs`.
- Visible composite receipt: `stagingJournalCaptured: true`; `physicalDatabaseIdentityBeforeAfterVerified: true`; `sqlReadOnly: true`; `providerWrites: false`; `loginAttempted: false`; `noCustomerRowsRead: true`; `hostedWorkerBindingVerified: false`; `gate5Accepted: false`.
- The photo is of the **ending portion of JSON**, not its full header. The UUID/target field and command/credential option are not separately visible in the supplied crop. The collector's `stagingJournalCaptured: true` guard requires the pinned target name, physical identity before and after, 22 or 25 approved ordered migration rows, read-only status, and zero provider writes; the screenshot does not independently prove hosted Worker binding.

## Cryptographically cross-checked journal count (important distinction)

The visible `journalSha256` is:

```
b36bf9d7e623f31079f31de0adc73c70b6895ad37122fbc9b6d3efff2737adfb
```

Independently recomputing the collector's SHA-256 formula over the first **22** reviewed `id|name` rows, with original D1 migration IDs 1–22, produces exactly that value. Recomputing it for the **25** approved rows (IDs 1–25) produces **`dde0dc4644382a9acd75422825489e3c5066aea6c3842f7bace6876011e6d047`**, **not** the screenshot hash. Thus this is further validated **22/25** STAGING lineage, not 25/25.

The three filenames visible at the beginning of the photograph are in the collector's **pendingMigrationNames** tail, not evidence they were installed:

- `0022_stripe_provider_uniqueness.sql`
- `0023_deposit_policy_events.sql`
- `0024_deposit_agreement_snapshots.sql`

This *corroborates*, rather than contradicts, the previously accepted STAGING 22/25 migration state. **Do not run 0022–0024, any schema change, or SQL write** from this evidence; target-specific backup, rollback, authorization and reviewed migration procedure remain required.

## Separate Gate 4 result

The same owner's receipt shows `accountWideDarkExposure.result: DARK_ACCOUNT_READONLY_STOP`, `accountWideInventoryCaptured: false`, and `darkPublicEndpointsAbsent: false`. The last flag means **absence was not verified**; it does not prove an active public endpoint. Root cause of the failed GET/inventory is not visible: do not assert that permissions, DNS, routes or Access caused it. Preserve earlier accepted per-Worker DR and NEW LIVE dark screenshots; no replay of the STAGING query or previously failed browser login.

## Checklist disposition

- **[x] NEW supplemental owner-provider receipt:** pinned physical STAGING migration journal (22/25), read-only SELECT, before/after identity and immutable digest independently reviewed. Do **not** request another STAGING full journal for this unchanged physical state.
- **[ ] Original G5-01 remains OPEN:** it requires actual bound schema and ordered journal parity on all four candidates, and the screenshot says `hostedWorkerBindingVerified:false`; STAGING still lacks migrations 0022–0024.
- **[ ] Original G4-05 remains OPEN:** complete account/zone-wide routes, domains, aliases and Access inventory not verified by this STOP.
- Original formal count remains **51/95; whole gates 4/10 (G1/G2/G3/G8)**. G4/G5/G6/G7/G9/G10 remain open. Dark NEW LIVE NO-GO; genuine Job #0001 unissued.
- This entry records a read-only user-supplied snapshot. There was **no** Git merge, deployment, Worker route/Access change, D1 migration, paid Cloudflare/R2 activation, Stripe/payment change, or real customer/photo modification by the assistant.
