# FIRE Today owner queue — urgency before customer deduplication (November 17, 2026)

## Evidence and actual application change

- Canonical working branch: `work/fire-main-qa-dr-live-unified-source-20261114`, existing **DRAFT PR #270**, unmerged; no deployment authority.
- Actual executable source change: [`555357d362b6528c1f61b33460984406f8f74133`](https://github.com/kylebrooks86/first-in-response-website/commit/555357d362b6528c1f61b33460984406f8f74133), `business-app-parity/shared/lib/follow-up-timing.ts`, `todayCustomerQueue`.
- Before: the one-customer-preview loop selected the first action encountered in the input ordering. Even where a later saved action for that same customer had higher existing `followupUrgency.rank` (such as an unresolved financial overage with rank 0), that important exception could be invisible as the chosen Today preview; only the aggregate secondary-action count remained.
- After: only actual eligible Today actions are ranked by their existing urgency rank **before** the one-preview-per-customer `seen` deduplication. Ties retain source order, the 5-card cap still applies, and `additionalCustomerActions` still counts all eligible actions for that customer. Existing billing-overage and already-past-appointment **Verify first** lanes are preserved, not converted to sending/charging instructions. No read/write API contract, schema, pricing, record data, customer communication, or payment behavior changed.
- Seven synthetic real-function assertions: [`6306afb37bfc15a8932c1001bad988f816dff1f0`](https://github.com/kylebrooks86/first-in-response-website/commit/6306afb37bfc15a8932c1001bad988f816dff1f0) in `shared/scripts/test-followup-triage.mjs`; verify out-of-order billing exception, one-card dedup, exception lane, extra-action count, other customer retention, limit after priority and stable tie ordering.
- Mandatory existing staging source-contract check: [`1d0ec19e3ab164dae81b1d0f3a508d1c266e6288`](https://github.com/kylebrooks86/first-in-response-website/commit/1d0ec19e3ab164dae81b1d0f3a508d1c266e6288), `shared/scripts/test-followups-simple-ui.mjs`, asserts that actual Today list ranks before deduplicating and the UI still calls the protected helper.

## Executed proof boundary

- The [exact executable SHA staging/native/Chrome run #44180771175](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44180771175) has **SUCCESS** for its actual step **“Gate 8 owner-preview and coarse-pointer navigation contracts (offline)”**, including the changed mandatory Follow-ups source guard. The separate staging shared-app build job also completed SUCCESS.
- During first post-commit verification, **24/25 top-level GitHub workflow groups were SUCCESS with zero failed**; the remaining longer staging/Chrome umbrella was still in progress because other synthetic browser jobs had not completed. Do not represent the whole matrix as 25/25 until the run is conclusively complete. This test evidence is **source-only / disposable CI**, not a newly approved hosted QA version.
- Separate seven-function assertions exist in the actual triage test file but are **not claimed as executed by the mandatory source-contract step**; only assert PASS where an actual execution record supports it. Do not repeat previous owner iPhone QA, signed-in Acer, backup restoration or dark Worker readbacks merely to test this source-only fix.
- [Issue #19 record](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6961615805), [targeted staging PASS follow-up](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6961666721).

## Release and authorization boundary

**45/95 checklist items completed, 50 open; formal gates G1/G2/G3/G8 accepted = 4/10; G4/G5/G6/G7/G9/G10 OPEN.** Existing QA hosted version remains older approved source; NEW LIVE stays DARK/NO-GO and genuine Job #0001 untouched. No Cloudflare Work login/retry, paid Cloudflare service or R2 activation, Worker/route/Access/SQL/D1/Stripe/payment operation, actual owner screenshot/test, public website publishing, merge, deployment, customer contact or release authorization occurred.
