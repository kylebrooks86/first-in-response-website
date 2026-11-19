# FIRE G6 — owner history and notification private GET, immutable source CI

Date: November 19, 2026. Separate UNMERGED [Draft PR #274](https://github.com/kylebrooks86/first-in-response-website/pull/274), stacked on existing integrated Draft PR #270; no existing reviewed source branch overwritten.

## Actual source issues and fixes

1. `shared/app/api/estimate-history/route.ts`: original owner paginated historical estimates included homeowner identity/contact, quote/invoice totals and share tokens but lacked session-bound private no-store security for several GET responses. Real route now explicitly applies `Cache-Control: private, no-store`, `Vary: Cookie`, `X-Content-Type-Options: nosniff` across 200/400/401/409/503. The existing persisted service-line order is preserved using O(n) incremental Map-array pushes rather than repeated O(n²) array copies.
2. `shared/app/api/notifications/route.ts`: owner notification text/customer and payment exceptions are now private/no-store, cookie-varied and nosniff on actual GET 200/401/503. The existing 40-row display and durable unread, mark-all, single read and resolution semantics remain unchanged.
3. `shared/scripts/test-owner-estimate-history-private-sqlite.mjs`: new native disposable SQLite + actual transpiled GET regression verifies anonymous/nonowner zero D1 reads, malformed input 400, 60 persisted estimates/120 service rows, exact 50+10 paging and cents, original owner/customer/share-token associations, failure 503, no writes and all cache headers. Wired into the pre-existing staging/QA workflow.
4. `shared/scripts/test-notification-mark-all-sqlite.mjs`: extended actual route and native SQLite tests to require private cache protections on owner/anonymous/DB outage.
5. `shared/scripts/test-invoice-current-state.mjs`: existing literal-string assertion was ordering-sensitive to semantically identical `private, no-store` vs `no-store, private`. Corrected test to require BOTH actual Cache-Control directives independently, and to verify history 409 session `Vary: Cookie`. This keeps the security requirement strict rather than hiding failures.

## Independently observed exact-head source CI

- **Verified executable/test SHA:** [`048c6b8e70330f3736bc9c9a0b76f05883e19430`](https://github.com/kylebrooks86/first-in-response-website/commit/048c6b8e70330f3736bc9c9a0b76f05883e19430).
- **[Actual 6/6 success staging/QA workflow #44630002721](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44630002721):** six independent jobs completed success, including the native SQLite compiled QA Worker job `135933939859` and isolated STAGING build.
- Immutable job log: **PASS 63/63 actual new owner estimate-history native SQLite cases** and **PASS 52 actual notifications route/SQLite cases** on the same exact SHA. Existing invoice/customer financial ownership test and synthetic Chrome negative-controls also passed after semantic assertion repair. Other jobs include D1 migration rehearsal and offline Stripe TEST contract; NONE is provider-signed/hosted proof.
- [Independent public website verifier #44630002737](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44630002737) succeeded at this code SHA.
- The main-only integration guard intentionally rejects the stacked non-main draft; it was NOT bypassed. No claim of a successful main-target merge gate.

## Strict release boundary

**Real source development/regression subtask: [x] implemented, independently tested and recorded. Formal hosted G6 remains [ ].** Current master **50/95 checked, 45 open; 4/10 gates accepted G1/G2/G3/G8; G4/G5/G6/G7/G9/G10 OPEN**. Hosted exact version, owner/nonowner Access, genuine signed Stripe TEST events, full future-photo recovery, hosted QA/STAGING/DR/NEW LIVE parity, and final approval are separate requirements. NEW LIVE DARK/NO-GO; first genuine Job #0001 unused. No Git merge, Cloudflare worker/Access/DB/router/R2/paid service, Stripe/payment, hosted D1, owner photo/data mutation, public website publish, Acer or iPhone retest performed. This evidence-file commit is documentation-only, not another executed-source identity.
