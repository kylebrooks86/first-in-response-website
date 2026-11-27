# FIRE G6 — owner Estimates list private-cache and bounded service-lines (2026-11-19)

**Exact executable and regression source SHA:** [`6810ec499ce9efdb1b4698f818e947b2d3d652ee`](https://github.com/kylebrooks86/first-in-response-website/commit/6810ec499ce9efdb1b4698f818e947b2d3d652ee). Existing **unmerged Draft PR #270**, branch `work/fire-main-qa-dr-live-unified-source-20261114`. Native SQLite and isolated CI only; no provider/hosted changes.

## Real source defect and correction

Owner-only `GET /api/estimates` returned the latest 100 quote summaries with customer names, email, phone, signed status, financial totals, **private bearer share tokens** and service descriptions without `Cache-Control`, `Vary` or `nosniff` on the 200/401/503 branches. Even though owner authentication was present, private data could be retained in intermediary/browser caches without an explicit server-side prohibition.

The parent quote SELECT was bounded to `LIMIT 100`, but the second batched query materialized **all historical `estimate_items` in D1** before grouping, causing growing memory/cost per dashboard load. The server now uses one consistent ordering `created_at DESC, id DESC` and selects only item rows whose parent belongs to the exact latest 100 estimates with a present customer; all historic rows remain saved in D1. Original within-quote service order, exact prices, total aggregation, default labels, owner auth and no-R2 configuration are retained. Grouping appends rather than copying a growing array for each service line.

The owner list success, owner denial and recoverable list error now set `Cache-Control: private, no-store`, `Vary: Cookie`, `X-Content-Type-Options: nosniff`. The preexisting incomplete-refund-ledger fast-fail remains as already accepted.

- [Real implementation commit `b375ffb`](https://github.com/kylebrooks86/first-in-response-website/commit/b375ffbb4cc502158f917243f147f57c3c32a2ce): `business-app-parity/shared/app/api/estimates/route.ts`.
- [New actual-route/native SQLite test `48003e1`](https://github.com/kylebrooks86/first-in-response-website/commit/48003e12582565170f635c156aca575382c330bd): `business-app-parity/shared/scripts/test-estimate-owner-list-bounded-private-sqlite.mjs`.
- [Existing CI suite wiring `2855a1e`](https://github.com/kylebrooks86/first-in-response-website/commit/2855a1efac4989780f8b738a1e07231410142097): `.github/workflows/fire-staging-offline-rehearsal.yml`.
- [Fixed the **test fixture**, not application logic, `6810ec4`](https://github.com/kylebrooks86/first-in-response-website/commit/6810ec499ce9efdb1b4698f818e947b2d3d652ee): four real boolean assertions originally omitted expected `true`; exact prior CI correctly caught test assertion misuse after first 100/200 conditions passed.

## Exact changed-source CI verification

At executable/test SHA `6810ec499ce9efdb1b4698f818e947b2d3d652ee`:
- [STAGING/QA workflow #44617417313](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44617417313) **COMPLETED SUCCESS 6/6 independent jobs**; built QA Worker/source-native SQLite job `135889884420` **SUCCESS**; its original GitHub logs explicitly report **PASS 25/25 actual owner estimates route/native SQLite: 100 quote cards/200 service lines instead of 224, no-store auth, exact cents, nonowner zero reads and fail-closed D1**. The test seeded **112 durable synthetic estimates and 224 service rows**.
- Exact-SHA GitHub workflow statuses **27/27 SUCCESS, zero failure or pending**.
- [Main-only public website/calculator preservation #44617417486](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44617417486) **SUCCESS**.
- [Independent public website verifier #44617417422](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44617417422) **SUCCESS**.
- [Gate 9 LOCAL-only full application build #44617417380](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44617417380) **SUCCESS**, no Stripe provider.
- Six-job STAGING/QA run included isolated staging source-build, synthetic D1 migration rehearsal, offline Stripe TEST-event contract, Windows read-only negative controls and two compiled QA/local synthetic Chrome browser jobs, **all SUCCESS**. No hosted Worker, D1, customer, payment or device change.

## Formal acceptance boundary

**This is completed source code + actual executable native SQLite/local CI evidence only.** It does **not** satisfy G6's external hosted owner/nonowner Access matrix, cache/network inspection of deployed endpoints, or QA/STAGING/DR/NEW LIVE version parity. The original release baseline remains **50/95 checked, 45 open; 4/10 formal gates G1/G2/G3/G8 accepted, G4/G5/G6/G7/G9/G10 OPEN**. NEW LIVE remains DARK/NO-GO, genuine Job #0001 not issued.

Previously accepted Cloudflare screenshots, Acer PowerShell, iPhone/photo restoration and source evidence retain established status. No R2 activation/paid service, Cloudflare browser login, Stripe/payment, D1/Worker/provider update, hosted deployment, merge, public site modification, owner-device repeat test or customer data writes occurred.
