# FIRE G6/G9 — owner booking review, invoice sharing and checkout reconciliation request-boundary proof

**Date:** 2026-11-19 (CST)  
**Code-only exact verified commit:** `114bd064103b7ab2478ed63b6f959bd92836e623` on unmerged Draft PR [#270](https://github.com/kylebrooks86/first-in-response-website/pull/270)  
**No provider deployment, login, migration, mutation, Cloudflare billing, R2 subscription or Stripe action.** All tests are local/disposable, not hosted release evidence.

## Concrete code changes

1. [`70fa576`](https://github.com/kylebrooks86/first-in-response-website/commit/70fa576f8923b53c9f61d777466bc4765dcce2dc): `shared/app/api/estimates/[id]/promotion-amendment/route.ts` replaces unbounded owner booking-preview `request.json()` with `readOwnerWriteObject(request,4096)` after authentication and before D1.
2. [`6797349`](https://github.com/kylebrooks86/first-in-response-website/commit/6797349281129db77397b76581155218341cd4cf): internal amendment review `POST` and `DELETE` now use 8 KiB and 4 KiB guarded JSON respectively, before D1.
3. [`561bad1`](https://github.com/kylebrooks86/first-in-response-website/commit/561bad125512f5316a0359ddc987d1290dfb06bb), [`4734b04`](https://github.com/kylebrooks86/first-in-response-website/commit/4734b043f794f27bcf38ffbd1ccfbdcc3ae62697): real-source native SQLite amendment preview/review tests now execute inside EXISTING staging saved-promotion step, covering hostile Origin/Fetch Metadata, same-site sibling, text forms and oversized bodies; source-confirmed zero D1 touches on denial and normal same-origin preview.
4. [`4b38528`](https://github.com/kylebrooks86/first-in-response-website/commit/4b38528d97ac427cb499b49bea8ce55ece127e10) with build-path correction [`114bd064`](https://github.com/kylebrooks86/first-in-response-website/commit/114bd064103b7ab2478ed63b6f959bd92836e623): invoice share-token `POST` runs existing `ownerBrowserWriteScope(request,false)` after owner identity before invoice/customer D1 reads or private token generation. [`98e3088`](https://github.com/kylebrooks86/first-in-response-website/commit/98e3088225276bb7037a178924c64d1a021a7208) adds actual-source disposable SQLite cross-origin/sibling/forged-browser denial, zero D1/token touches, legitimate same-origin owner creation.
5. [`ab9703c`](https://github.com/kylebrooks86/first-in-response-website/commit/ab9703ccef00cd4daf162aeeafb52d10ade33b7a), [`c54986e`](https://github.com/kylebrooks86/first-in-response-website/commit/c54986e6bf11a762fbcdc7b8b324ef3da8787026): owner Stripe checkout reconciliation uses 8 KiB bounded same-origin JSON guard AFTER TEST/DR kill-switch and BEFORE any D1/Stripe; real route + native SQLite + synthetic Stripe tests cover malicious origins, cross-site navigation, form encodings, length violations, no network/ledger changes and valid same-origin input.

## Observed CI on exact code SHA

[Staging migration/shared-app parity run **#44549613109**](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44549613109) **COMPLETED SUCCESS, ALL 6/6 independent jobs SUCCESS**:
- Isolated staging release build no-upload **SUCCESS**; compiled shared app source includes all new guards.
- Native SQLite owner standard pricing/promotions/settings **SUCCESS**; job log: **42 saved-promotion checks PASS; 84 owner amendment-review draft assertions PASS**, including new guard negatives (plus separately 73/73 owner settings).
- Owner share-link ownership/native SQLite **SUCCESS**; job log: **22 checks PASS**, including new cross-origin invoice/estimate scenarios.
- Owner checkout recovery/native SQLite/synthetic Stripe **SUCCESS**; job log: **100 assertions PASS**, including new origin, body and no-money-mutation cases.
- Other Gate8 synthetic browser, Gate9 contract, Windows read-only, local migration jobs **SUCCESS** as recorded by the six-job workflow. This remains source-only; no owner device QA repeated.

On the same exact SHA, [website/calculator preservation run #44549613225](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44549613225) **SUCCESS**, and [website verification #44549613334](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44549613334) **SUCCESS**.

**Failure and correction preserved:** preceding source `4734b04` build failed because invoice guard was imported from a path one parent too shallow. The actual error in staging run [#44549332362](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44549332362) was `UNRESOLVED_IMPORT`; corrected in [`114bd064`](https://github.com/kylebrooks86/first-in-response-website/commit/114bd064103b7ab2478ed63b6f959bd92836e623), then the **full six-job run passed**, not hidden or presumed.

## Acceptance boundary

**Development subtask: COMPLETE and exact-code CI verified.** **Formal G6-08 and G6/G9 release gates: OPEN**, pending physical hosted owner/nonowner/CSRF/zero-write and actual signed Stripe TEST proof. Canonical checklist remains **50/95 checked, 45 open**; accepted formal release gates G1/G2/G3/G8 = **4/10**. G4/G5/G6/G7/G9/G10 OPEN. NEW LIVE stays DARK/NO-GO with first real Job #0001 unused. Existing Acer dual DARK owner-session STOP and accepted iPhone/QA/photo evidence must not be rerun. No Cloudflare login, Worker/Access/route/D1/Stripe/payment, paid R2, Git merge, DNS or public-site changes.

Release tracker follow-ups: [Issue #19 source entry](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-7012794198) and [targeted CI entry](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-7012898729).
