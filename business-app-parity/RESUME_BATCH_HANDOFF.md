# Resumed candidate batch — 2026-10-08 Chicago

Parent checkpoint: 3783f629e7487d30c0541c228dfefb146d26ca49 on work/fire-business-app-parity-2026-10-08. Local tracked checkout clean before changes; freshly fetched remote FETCH_HEAD exactly matched. No lost/unsaved work was found. No expired action was assumed completed.

## Candidate-only change

A new actual-route webhook boundary regression exposed a correctly signed JSON null payload causing an unhandled exception. Shared webhook now rejects null, arrays, and primitive envelopes with HTTP400 before any reconciliation. Applied identically to LIVE, Doomsday and staging candidates; no deployed code changed. Existing financial algorithms and records are unchanged.

## Schema preparation

Corrected read-only Cloudflare checklist table from stripe_checkout_sessions to payment_checkout_sessions; added index introspection. New audit-local-schema.mjs opens supplied local SQLite files read-only and checks required financial columns and exact unique-index predicates. Journal names are reported separately: an absent journal is unknown, and missing journal names do not cause migrations to run or imply damaged records. No customer records are printed. It never connects to Cloudflare or executes migration SQL.

Disposable test fixtures do execute each candidate migration history locally: LIVE21, staging21, DR23. Inspector recognizes the semantic equivalence between LIVE's unfiltered refund-provider unique index and DR's WHERE provider_refund_id IS NOT NULL index (SQLite permits repeated NULLs). Wrong predicate, missing checkout table, and nonunique index negative tests fail closed. Byte-for-byte CLI read-only preservation verified. Schema compatibility alone is not deployment authorization/readiness.

Run against an approved local SQLite export: node scripts/audit-local-schema.mjs /absolute/export.sqlite /absolute/candidate. Never copy secrets or production exports into GitHub. Remote schema verification remains0/3.

## Verification

New schema suite3/3 plus new webhook-boundary suite3/3; rerun affected Stripe-refund suite3/3 and final-tipping suite3/3:12/12 suite executions in this batch. Signature tests cover missing/wrong/expired/future/body-tampered signatures, rotated v1 signatures, invalid JSON/envelopes, strict staging live-event rejection and missing objects. Rejected inputs make zero reconciliation calls. Existing refund tests include partial refunds, idempotent retry/lost response, concurrent limits, duplicate/out-of-order webhook behavior, tip separation and backup/restore. They use disposable SQLite/mocked Stripe, not hosted Stripe end-to-end. TypeScript3/3; production build3/3; shared source118/118 matched. Other earlier passing suites were preserved, not unnecessarily rerun.

## Read-only deployed observations

Native LIVE version61 and existing refund-staging version3 unchanged. Current staging synthetic invoice at /invoice/qa-mobile-layout-invoice-staging-only defaults No tip, invoice/balance100.00. Browser15% yields15.00 and115.00 total; custom7.50 yields107.50; invoice principal stays100.00. Reset to No tip. No Pay button clicked, checkout created, charge or refund processed. Links exactly https://cash.app/$FIREExteriors and https://venmo.com/FirstInResponseExteriors. Desktop screenshot inspection confirms two-column tips/full-width Custom and colored payment-option cards; not iPhone rendering or sealed parity evidence.

Independent Worker browser session opens owner dashboard and Owner Account with DOOMSDAY · Independent staging label. Authenticated /api/app-version returns404, so exact deployed commit/build identity remains unverified. Browser label alone does not seal provenance. Previous unauthenticated HTTP403 was not proof of missing route; current browser404 is now direct evidence.

Stripe sandbox v2 inventory complete (next_page_url=null), livemode=false, returns the same single endpoint we_1ULV3j7ND12rd1wILDuTy79G as classic inventory, targeting LIVE /api/payments/webhook and only checkout.session.completed/async_payment_failed/async_payment_succeeded. No refund-event subscription or isolated-stage destination observed in this sandbox. No settings/endpoint changed, events replayed, charges or refunds created. Do not send tests to LIVE or change this existing endpoint.

Cloudflare current tab is now a login page with a verification error and disabled Sign in; no authenticated Worker/D1 schema obtained. Owner sign-in/verification or read-only schema/journal results are required to unblock. No credentials requested in chat, login/security controls changed, CAPTCHA bypassed, paid service activated or migration applied.

## Remaining gates

Remote D1 schema/index/journal0/3, exact Worker provenance, isolated stage webhook credentials/routing, hosted sandbox payment/refund reconciliation, iPhone light/dark evidence0/32, verified actual DR auth adapter and recovery plan, photo object-storage recovery. An existing restore-photo-archive CLI exists in source, but has not been verified against independent storage; no available DR bucket confirmed. Do not infer absence of source tooling from lack of working remote recovery. Production readiness stays3/10, not ready. Preserve all databases/Stripe configs/rollback copies.

QC is read-only: review the three-line webhook guard, boundary tests, schema inspector/negative fixtures, corrected SQL checklist, and this routing/provenance evidence. No production deployment approval is requested.
