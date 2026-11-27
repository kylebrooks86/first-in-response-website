# FIRE G5/G6 — owner payment-history failure isolation and session privacy (Nov 19, 2026)

## Actual code, not a release gate closure

**Code/test head before this evidence-only commit:** `97600aa6f15bd73f7be8b835b311a5fdedf7f60d`. Unmerged main-target draft PR #282; QA is the visual/functional master. No approved hosted operation.

The actual `GET /api/payments` owner financial-history route previously served its success response with a private no-store cache directive **without** `Vary: Cookie` or `X-Content-Type-Options: nosniff`, and denied/non-integer financial paths lacked full session-private headers. After a valid refund-ledger schema read, either the payment list or pending-checkout list D1 query could throw out of the GET route and yield an unhandled 500 rather than an explicit controlled unavailable response. This could mislead clients and is an owner financial isolation/reliability defect. It is not evidence of an actual data leak.

### Changes committed

1. `business-app-parity/shared/app/api/payments/route.ts` source commit `ab8b3a638f7467f4be8b6134685294df3a0cb300`: preserve owner-auth-before-D1 and the established refund-ledger schema hold; require `Cache-Control: private, no-store`, `Vary: Cookie`, `X-Content-Type-Options: nosniff` on GET 200, 401, 409 and controlled 503 D1-failure paths. Existing 503 incomplete-ledger helper already supplies all three. No SELECT ownership SQL, payment/refund writes, balance calculations or customer data were changed.
2. `shared/scripts/test-owner-financial-list-refund-holds-sqlite.mjs` commit `f696d89d5408199eac1ac3b6c6d6fbbdcf4e850b`: include actual payments GET in the existing missing-refund-table/index, D1 metadata error, and unauthorized 401 route-loaded native SQLite assertions; add a valid-schema/financial-query-error case expecting private 503 and no financial-list payload.
3. `shared/scripts/test-manual-payment-confirmation.mjs` commit `3a798cf4538b2d366b4797f1998eed2afeb2523b`, fixture-matcher correction `97600aa6f15bd73f7be8b835b311a5fdedf7f60d`: add actual payment-history owner 200 private response and injected D1 GET failure 503 assertions to existing manual-payment native SQLite suite. Tests are **new coverage for changed functionality**, not a rerun of owner QA, iPhone, Acer or Cloudflare provider acceptance.

**Validation status at documentation time:** Source and test changes committed; GitHub automatic checks on exact source SHA have **not yet been independently attested**. Do not infer PASS from previous PR281/282 or later docs-only commits. Run or inspect only changed-code CI needed, not historic accepted owner tests.

**Checklist boundary:** closes only the narrow source patch/prepared regression subtask, **not** formal G5-05/G5-06/G6-04/G6-09 hosted criteria or Stripe TEST evidence. Formal accepted tracker remains **50/95**, Gates 1/2/3/8 accepted **4/10**; G4/G5/G6/G7/G9/G10 remain open. NEW LIVE dark, first real Job #0001 unissued. No merge, Cloudflare upload/Access/routing, paid R2, D1 migration/hosted query, Stripe/payment, customer message or public website operation.
