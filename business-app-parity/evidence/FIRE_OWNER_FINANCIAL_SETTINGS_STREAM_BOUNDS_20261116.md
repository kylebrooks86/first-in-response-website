<!-- FIRE_OWNER_FINANCIAL_SETTINGS_STREAM_BOUNDS_20261116 -->
# FIRE owner financial-setting catalog writes — source-only bounded-body repair (Nov 16, 2026 CST)

**Current review:** existing DRAFT PR #270, unmerged/undeployed, no new branch or provider action. **Changed-code HEAD:** `53bd40b6891d0476d6ae8a4c6c2c3bdad2c80263` before this evidence documentation. Historical 4/10 accepted release gates remain G1/G2/G3/G8; G4/G5/G6/G7/G9/G10 OPEN, NEW LIVE DARK / NO-GO.

## Concrete issue repaired
Three authenticated owner financial/settings PUT routes were still using unrestricted `request.json()` ahead of service-rate, saved promotion and reusable quote-package validation. An oversized/malformed owner-session request could buffer an arbitrary body before field validation even when no D1 write would ultimately be accepted.

Exact changes reuse the existing owner-only `readOwnerWriteObject` in `shared/lib/customer-write-request-guard.mjs` (already part of Worker source, zero new runtime modules):
- `/api/service-pricing` PUT: bounded strict UTF-8/JSON object, **24,000 bytes**; `7b2f715eeb70e709b7e35ed52441dbc28a7d2c94`.
- `/api/saved-promotions` PUT: bounded strict UTF-8/JSON object, **262,144 bytes**; `f8308f028cafc7af0e7f2eee71fb5ddbb1b0ed20`.
- `/api/quote-packages` PUT: bounded strict UTF-8/JSON object, **32,000 bytes**; `b234077b7b4cb15d28eb6b265c1cb6393b7b6b49`.

The guard checks actual bytes *as streamed*, declared length (including contradictions), fatal UTF-8 decoding, nonempty body and JSON-object shape **before D1 SELECT or write**. It fails 400/413 with private no-store responses. Original owner authentication executes first; original validated fields, rate cents, promotion stacking and deadline rules, package composition, revision compare-and-swap, readback, lost-ACK fail-closed and history integrity remain unchanged. These are source corrections, not proof of hosted deployment.

## Changed-function actual-route regression work
`shared/scripts/test-owner-settings-confirmed-cas-sqlite.mjs` now issues actual route requests for all three catalogs: excessive claimed length, excessive actually streamed body, false-short Content-Length and invalid UTF-8. Every refusal asserts expected HTTP 400/413 and **zero change in D1 read/write counters** (24 new route-level assertions), before the original real disposable SQLite price/promotion/package/repeat-setting persistence, revision conflict, lost acknowledgment and readback cases. Test commit `53bd40b6891d0476d6ae8a4c6c2c3bdad2c80263`.

The older isolated actual-route test loaders needed the now-existing shared module exposed in their explicit VM import maps; these are test-harness only commits `33ce87b008a1f108940915d8d6f9364cb7210d10` (pricing) and `3d796b2211c425e302722c78ee83f360942e9b5c` (promotions), with no simulated bypass.

**Current validation status at creation:** GitHub Actions launched for exact changed-code HEAD `53bd40b6`. Relevant runs:
- [Shared app, staging, native SQLite/Chrome #44017769940](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44017769940) — awaiting completed conclusion at creation.
- [Full-app LOCAL TypeScript/build #44017769771](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44017769771) — awaiting completed conclusion at creation.
- [Public website/calculator preservation #44017770068](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44017770068) — **SUCCESS** (exact code HEAD).
- [Public website verify #44017769822](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44017769822) — awaiting completed conclusion at creation.

Never turn queued/in-progress tests into PASS claims. If a regression fails, repair it on PR270 with a new exact source head and rerun only changed cases. An older previous-code source head `4fa8d8c8` had its previously pending staging run #44015318138 complete with all six jobs SUCCESS; do not rerun that already accepted older head.

## Physical boundary preserved
The owner-approved one-time NEW LIVE DARK code-only publisher has already run and its attempt lock is **consumed**. Owner's actual readback already confirmed 100%-serving version `cfacbb3d-43de-4d2c-8008-c6732d78f756`, physically separate NEW LIVE D1 `0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662`, dark login vars, no R2/extra bindings and predecessor rollback listing. **Do not rerun publishing, old hosted readbacks or 26/26 D1 migrations.**

This newer PR270 code is **NOT** that hosted immutable version, and is **NOT** verified on QA/STAGING/DR/NEW LIVE Cloudflare. Do not merge, deploy, migrate, enable login or routes/Access, spend on R2/paid Cloudflare, change Stripe/payment state, activate Job #0001, or retire legacy Sites without independent exact authorization and full physical gate proof.
