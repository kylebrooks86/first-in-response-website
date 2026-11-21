# FIRE Gate 5 — owner paid-job review queue refund and invoice isolation (source only)

**November 19, 2026. UNMERGED DRAFT [PR #277](https://github.com/kylebrooks86/first-in-response-website/pull/277).** Based on previously verified integrated QA-master Draft PR276 (itself built from PR270). This is real development + native SQLite proof, **NOT hosted Gate5 acceptance.**

## Actual fix

Owner GET /api/payment-closeouts formerly excluded pending refunds but NOT independently succeeded refunds. If a succeeded refund request was durably recorded before its negative payments adjustment was durably recorded (or after an uncertain D1 acknowledgment), gross paid amounts could falsely equal the full invoice. This would offer an incorrect customer review-request prompt. Actual SQL now excludes any job with a succeeded refund request independently of its payment total. Existing pending-refund, overage, unsigned/customer-review and checkout holds remain intact. No customer messages are sent automatically.

Owner review eligibility also previously selected an invoice total by estimate ID alone. A legacy mislinked invoice from a foreign customer could appear to establish the wrong job's fully-paid state. The new SQL fails closed when ANY invoice for that estimate is linked to a different customer; it derives totals only from an exact estimate-and-customer invoice, while retaining the original estimate-total fallback for valid invoice-less jobs. Keeps original 200+ keyset page, valid same-customer invoices, true full payments, customer audit/confirmation, original customer/amounts, no-write semantics and no new Stripe calls.

The owner financial 200/400/401/503 GET responses use private/no-store, Vary: Cookie and nosniff. Missing refund-ledger table/index metadata still fails closed via the separate protected existing 503 response. No D1 schema or provider changes.

## Immutable executable-source proof

**Actual source/test SHA: [958357e1867cf473d98a24d033f903018b048e96](https://github.com/kylebrooks86/first-in-response-website/commit/958357e1867cf473d98a24d033f903018b048e96).**

- [Actual QA/STAGING GitHub run #44639553131](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44639553131) **COMPLETED SUCCESS, ALL 6/6 independent jobs**. Built real-source QA Worker job 135966756130 **PASS 41 actual paid-job closeout native SQLite assertions**. Included a succeeded refund with no negative payment, a foreign homeowner invoice on an apparently fully paid job, a correct owner invoice and unsuccessful refund as positive controls, prior 200+ cursor/cross-customer/owner scope checks, no fake delivery, no writes, private caching on 200/400/401/503 and independent D1 failure.
- Same-SHA isolated STAGING build job 135966755699, Chrome/mobile synthetic browser job 135966756180, Stripe TEST six-event offline contract job 135966755971, Windows mock controls job 135966756104 and local synthetic migration job 135966756220 all SUCCESS. [Separate public website verifier #44639553095](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44639553095) SUCCESS.
- [Main-only scope guard #44639553037](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44639553037) intentionally refuses this non-main stacked PR. DO NOT bypass this check or falsely claim a main-branch merge pass. No real hosted Stripe/Access/Cloudflare proof from an offline test.

## Official gate truth

**[x] New financial source fix plus real SQLite/QA verification. [ ] Official Gate5 hosted source/schema/provider acceptance still OPEN.** Master Issue #19 remains **50 of 95 accepted; 45 open; 4 of 10 gates accepted G1/G2/G3/G8**, G4/G5/G6/G7/G9/G10 open. DARK DR and NEW LIVE left untouched, first genuine Job #0001 unused. No Git merge, D1 writes or migration, Cloudflare/Access/routes/DNS/paid R2, Stripe/provider settings or payment, publication, text/email sends or owner Acer/iPhone re-tests. Do not reopen previously captured Cloudflare/Stripe, three-photo or owner-device evidence. Later documentation commits are NOT equivalent to the tested executable commit.
