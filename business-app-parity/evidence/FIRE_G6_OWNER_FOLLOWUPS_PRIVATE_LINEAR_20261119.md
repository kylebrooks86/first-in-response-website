# FIRE G6 — owner Follow-ups private GET & saved service grouping (source evidence)

Date: November 19, 2026; isolated unmerged [DRAFT PR #275](https://github.com/kylebrooks86/first-in-response-website/pull/275) based on existing integrated Draft PR270, not a new app.

## Actual source change

- `shared/app/api/followups/route.ts` previously served owner-only homeowners' names/contact details, saved quote cents, financial statuses and bearer share tokens with missing private cache controls on successful, invalid, anonymous and failed GET paths. It now explicitly returns `Cache-Control: private, no-store`, `Vary: Cookie`, `X-Content-Type-Options: nosniff` on real GET 200/400/401/409/503, including foreign-invoice ownership refusal.
- Saved `estimate_items` service lines are now grouped in O(n) with in-place insertion, instead of copying accumulated arrays for each historical service line. Quotes still preserve original service IDs, order, exact cents, owner/customer scoping, maximum 50-row page, opaque pagination, one-job focused lookup and repeat/cadence rules.
- New native SQLite + actual transpiled owner GET test `shared/scripts/test-owner-followups-private-sqlite.mjs` creates 60 disposable quote records and 120 saved service rows and verifies anonymous/foreign-owner no D1 reads, invalid 400 no D1 reads, 50+10 stable paginated history, exact scoped one-job navigation, original cents and tokens, foreign-invoice 409 no auto-repair and D1 unavailable 503 without writes. Added as a separate test step to existing STAGING/QA workflow.
- Existing scoped GET test `shared/scripts/test-followup-exact-lookup.mjs` now loads the ACTUAL route's source-level private header declaration alongside the extracted handler instead of throwing a VM-only `ReferenceError`. Native regressions still require exact auth, no SQL injection and bounded results. Existing `test-invoice-current-state.mjs` correctly verifies BOTH mandatory cache directives irrespective of their HTTP serialization order; it never weakens `private` or `no-store`.

## Exact executable SHA and real CI result

- **Immutable actual tested source SHA** [`045ff1374a5c707dec5d5446ec245d9f4d8399b8`](https://github.com/kylebrooks86/first-in-response-website/commit/045ff1374a5c707dec5d5446ec245d9f4d8399b8).
- **[STAGING/QA workflow #44631344344](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44631344344) COMPLETED SUCCESS 6/6 jobs** including actual built QA Worker native SQLite job `135938613446`, isolated STAGING build job `135938613664`, Windows no-provider negatives, synthetic D1 migration, synthetic browser, Stripe TEST offline contract.
- Immutable built QA Worker test log: **PASS 75/75 owner Follow-ups private SQLite route tests**, **PASS 28/28 original exact follow-up lookup auth/scope tests**, **PASS 30/30 original original saved service-lines SQLite tests**. No paid service, hosted provider or customer records involved. Initial test-only VM fixture issue was caught in earlier SHA then repaired and rerun; no bypass.
- **[Public website verifier #44631344268](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44631344268) completed SUCCESS** on exact source SHA. The main-only integration safeguard rejects intentionally stacked DRAFT PRs; it was not bypassed.

## Master release status and STOP

**[x] Source implementation and independent compiled/native regression; [ ] actual hosted G6 verification.** Official master 50/95 checked, 45 OPEN; 4/10 accepted G1/G2/G3/G8 and G4/G5/G6/G7/G9/G10 remain OPEN. All owner-required visual/function QA parity, 50%-deposit, stacking, payments, communications, mobile and first NEW LIVE Job #0001 preserved. NEW LIVE DARK/NO-GO. No merge, deployment, Cloudflare Access, hosted D1, paid R2/service, source of photos, Stripe/payment change, published website, Acer or iPhone tests. Documentation-only commit does not supersede executable test SHA.
