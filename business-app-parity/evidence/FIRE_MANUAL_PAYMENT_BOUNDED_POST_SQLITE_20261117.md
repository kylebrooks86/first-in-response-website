# FIRE Business App — bounded financial-write request parsing

**Date:** November 17, 2026 (America/Chicago)  
**Exact executable source + regression SHA:** `1c39c63ecab20834737195ce900c055f546cf5f9`  
**Working PR:** DRAFT [#270](https://github.com/kylebrooks86/first-in-response-website/pull/270); unmerged and undeployed.

## Verified source defect

The actual owner-only `business-app-parity/shared/app/api/payments/route.ts` **POST** previously used `await request.json()` without a bounded HTTP body-size or streaming UTF-8/JSON object guard. This contrasted with the existing estimate, invoice and customer-message write routes. A stale, malformed, or hostile payment client could require an unbounded JSON parse on a financially sensitive route. Exact cent validation and conditional ledger SQL guards still existed, but the input parsing boundary was unnecessarily weaker.

## Actual app repair

- [`387cad708`](https://github.com/kylebrooks86/first-in-response-website/commit/387cad708e559f76f45b44479a7442f8410580a9) imports the existing `readOwnerWriteObject` from `shared/lib/customer-write-request-guard.mjs` in the **actual manual payment POST**. Parses `request` with strict **16,000 bytes** cap, rejects non-object/array/primitive/malformed UTF-8 or wrong Content-Length, returns the shared explicit HTTP 400/413, and only afterwards enters original financial logic. This adds no new dependency/module to the Worker. All normal owner payment request fields, accepted cash/Cash App/Venmo/Wave/Card/ACH/Other methods, processing fees, exact-cents checks, tip and deposit limits, D1 refund readiness, customer/invoice ownership, Stripe checkout holds, idempotent payment confirmation and request IDs remain unchanged. No check payments accepted.
- [`1c39c63`](https://github.com/kylebrooks86/first-in-response-website/commit/1c39c63ecab20834737195ce900c055f546cf5f9) extends the **actual route native SQLite** `shared/scripts/test-manual-payment-confirmation.mjs`, invoked already by mandatory Gate5 real manual payment API step. Negative cases include null/array/number/string JSON bodies, invalid syntax, empty request, malformed UTF-8 bytes, mismatched/invalid Content-Length and both claimed and streamed oversized bodies; each asserts HTTP 400/413 and **zero payment DB writes**. Existing successful principal, tip-only, combined tip, lost-ACK, cross-customer invoice, processing-fee and race tests remain.

## Real CI verification

The exact executable [SHA checks](https://github.com/kylebrooks86/first-in-response-website/commit/1c39c63ecab20834737195ce900c055f546cf5f9/checks) and [Staging/real built QA Worker run #44220832299](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44220832299) show **mandatory “Gate 5 real manual payment API — invoice customer ownership, lost-ACK replay, principal/tip atomic race (SQLite only)” COMPLETED SUCCESS** in the built-QA workstream. This is real disposable native SQLite; no Cloudflare D1/payment/Stripe was accessed. At the first documented readback **24/25** top-level workflow groups SUCCESS, zero failure, remaining staging umbrella still finishing unrelated browser tests. See final verification update below when checked.

## Strict release boundary

These changes and synthetic SQLite execution **do not establish deployment or formal Gate 5 acceptance**. No owner Cloudflare sign-in/retry, paid R2/plan, hosted D1/SQL, Stripe checkout/payment/refund/webhook, customer message, owner Acer/iPhone repeat, PR merge, Workers Access/routes/DNS, deployment, cutover or live data mutation occurred.

**Release status unchanged:** 45/95 atomic checklist items accepted, 50 OPEN; 4/10 gates G1/G2/G3/G8 accepted, G4/G5/G6/G7/G9/G10 OPEN; NEW LIVE DARK NO-GO, first genuine Job #0001 unused.

## Final exact SHA CI verification (supersedes interim 24/25)

Final exact executable source/test SHA [`1c39c63ecab20834737195ce900c055f546cf5f9`](https://github.com/kylebrooks86/first-in-response-website/commit/1c39c63ecab20834737195ce900c055f546cf5f9/checks) shows **all 25/25 GitHub Actions workflow groups SUCCESS, zero failures and zero pending**. [Mandatory staging + built QA/native SQLite run #44220832299](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44220832299) **6/6 jobs SUCCESS**, specifically including the actual `Gate 5 real manual payment API — invoice customer ownership, lost-ACK replay, principal/tip atomic race (SQLite only)` step success on the newly bounded parser and negative tests. No hosted Worker/D1/Stripe interaction, real payment, merge or deployment occurred. Formal release checklist and gates remain unchanged pending physical hosted evidence and owner approval.
