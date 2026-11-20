# FIRE G6 — owner-only dashboard, house history and review reminder response isolation

**November 19, 2026 (America/Chicago) — SOURCE ONLY. Not hosted, merged, deployed or approved for release.**

## Current integrated source lineage
- Existing exact-head, main-target GREEN source before this change: [Draft PR277](https://github.com/kylebrooks86/first-in-response-website/pull/277) at `565cd8b25f3b2881928c735e65fabf19a1b2d6a7`, previously **27/27** CI workflows SUCCESS.
- New separate draft branch `work/fire-private-owner-dashboard-reads-20261119`, based on the precise approved source SHA, preserving original PR277 and all accepted provider/owner evidence.
- This is NOT verification of served Cloudflare code, nonowner provider Access, QA/STAGING/DR/LIVE byte identity or real customer records.

## Concrete source defect and correction
Six existing owner-only GET route modules exposed private customer, address, visit, review, quote-linked message or follow-up details. Authentication and local `no-store` already existed, but the response paths lacked the consistent session `Vary: Cookie` and `X-Content-Type-Options: nosniff`; selected 401, 503 and owner yard-sign responses were missing explicit `private` cache scope.

Changed only response headers, leaving original SQL, auth, pagination, status codes, business calculations, prices, 50% deposit and saved-customer data untouched:
1. `/api/dashboard-review-checks` (200, 401, 503).
2. `/api/dashboard-yard-signs` (200, 401, 503).
3. `/api/job-closeout-history` (200, 400, 401, 503).
4. `/api/door-knocking` owner history responses (with existing write response helper also protected).
5. `/api/door-knocking/followups` (200, 401, 503).
6. `/api/followup-contact-history` (200, 400, 401, 404, 503).

All six return `Cache-Control: private, no-store`, `Vary: Cookie`, `X-Content-Type-Options: nosniff` on the modified paths.

## Changed-code test plan (no provider requests)
Existing disposable native SQLite/real-route regressions were strengthened, not replaced:
- `test-dashboard-review-checks.mjs` checks 200 and 503 privacy, plus existing owner/foreign-user denial and review status correctness.
- `test-dashboard-yard-signs.mjs` checks 200 and 503 privacy, plus existing yard-sign lifecycle and DB denial.
- `test-job-closeout-history.mjs` checks all three headers for the real 200 response while retaining original linked-job, paging, seven-day reminder and no-write assertions.
- `test-door-knocking.mjs` checks owner history and due followup 200 headers, preserving existing native SQLite, auth, idempotency and recovery tests.
- Existing GitHub staging/QA workflow now runs the three previously unwired dashboard/job-history native SQLite tests alongside the already-wired door-knocking test.
- GitHub CI is required on the **new exact code+test HEAD**. No source or hosted PASS is claimed here until the actual run is read back.

## Formal release STOP unchanged
**50/95 formally checked; 45 remain open.** G1/G2/G3/G8 accepted (4/10); G4/G5/G6/G7/G9/G10 OPEN. NEW LIVE DARK, Job #0001 unissued. No merged code, Cloudflare/Access/D1/route changes, paid Cloudflare/R2 subscription, Stripe configuration or charge, real photo/customer writes, iPhone/Acer retest, outbound communication, production publication or legacy retirement.
