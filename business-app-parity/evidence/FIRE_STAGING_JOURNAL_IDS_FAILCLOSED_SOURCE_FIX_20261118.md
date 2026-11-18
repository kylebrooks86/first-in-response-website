# Nov 18, 2026 — STAGING 22→25 offline migration rehearsal: journal ID gap/shift fail-closed fix

## Existing evidence reused, not retested

Master target: new QA Business App, separate QA/STAGING/DR/NEW LIVE resources. Owner's actual STAGING `fire-app-staging-db` physical D1 UUID `afb2c05a-d794-4a9a-b580-924ce01c26ad` had **22 exact ordered journal rows**, already independently shown in read-only owner screenshots; the first 22 migration names match `adapters/doomsday/drizzle/0000..0021`, not the distinct historical `adapters/staging` lineage. QA has independently accepted 25/25, DR and NEW LIVE separately have 26/26; never replay their successful migrations. Existing Oct 29 STAGING Stripe-provider collision preflight **0 duplicate groups**, preserved at [Issue #19 #6513760737](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6513760737), **must not be requested again**. Actual STAGING is populated with synthetic test records and the prospective 0022–0024 files are not yet approved for provider execution.

## Actual source defect fixed

The existing `business-app-parity/rehearse_staging_22_to_25.py` rehearsal previously read `SELECT name FROM d1_migrations ORDER BY id` and accepted any 22 filenames in order. A private restored SQL export with 22 expected **names**, but IDs 2–23, 0–21, or a gap (1–10,12–23), could pass as an authentic exact 22-migration D1 prefix. This disagreed with the release's strict physical `SELECT id,name` contract and the separately reviewed independent LIVE verifier requiring IDs 1..26.

**Runtime safety correction:** [commit `0af61c37f467d96f2f56ccb4fbc522dcbdef5592`](https://github.com/kylebrooks86/first-in-response-website/commit/0af61c37f467d96f2f56ccb4fbc522dcbdef5592) now explicitly selects `id,name` and requires true Python integer IDs **exactly** 1,2,... with no shifted, zero-based, gapped, or non-integer IDs before any pending SQL is rehearsed, still in disposable **in-memory SQLite only**. It changes no provider D1 database.

**Actual negative regression:** [commit `74b4ef83baf67f71cfb094a2b40ac300870d7410`](https://github.com/kylebrooks86/first-in-response-website/commit/74b4ef83baf67f71cfb094a2b40ac300870d7410) extends the existing strict Python SQLite export fixture with explicit IDs and three new negative tests: IDs start 2, IDs start 0, internal journal gap. Existing normal source synthetic baseline and owner-private export model tests remain.

## Real changed-source CI result

GitHub Actions workflow [`FIRE Staging Migration and Shared-App Parity` run #44370723685](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44370723685), exact changed-source/test SHA `74b4ef83baf67f71cfb094a2b40ac300870d7410`:

- **Job #135036625854, `Synthetic 22-to-25 D1 migration rehearsal (NO Cloudflare writes)`: COMPLETED SUCCESS**. The required step `Six negative-control unit tests` **COMPLETED SUCCESS** (the historical display label now includes the added tests); the independent `Rehearse actual 25-source migration files in memory` step **COMPLETED SUCCESS**. This is executed, not a code-only claim.
- `Gate 9 exact six-event Stripe TEST contract (offline, NO provider)` and Windows current-QA-code read-only mock jobs were also **SUCCESS** at the observed readback. Remaining extended build/browser jobs were still running at that observation and are **not** claimed green.

**Acceptance:** The new *offline STAGING journal-ID safety defect* is fixed and its changed test suite passed in hosted GitHub CI. This **does NOT mean** physical Cloudflare STAGING 22→25 migrations applied, STAGING hosted app/source parity, Stripe signed delivery, owner-backed rollback or a newly completed full 95-item gate. No new D1/Stripe/Access/Worker deploy or legacy website action occurred.

**Official unchanged** 45/95 checked, 50 open; G1/G2/G3/G8 = four formal gates accepted; G4/G5/G6/G7/G9/G10 OPEN, NEW LIVE DARK/NO-GO, first Job #0001 unused. Existing PR270 remains unmerged and draft. No paid Cloudflare or R2, and no private export or customer data was uploaded to GitHub.
