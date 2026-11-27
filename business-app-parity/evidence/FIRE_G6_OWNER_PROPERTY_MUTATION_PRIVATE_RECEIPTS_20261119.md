# FIRE G6 — owner property create/archive private response boundary (2026-11-19)

## Concrete source defect repaired, no hosted release

Before this patch, the existing `GET /api/customer-properties` used a private no-store, owner-session-varied, nosniff response helper, but the **real owner-only POST property create and PATCH property archive responses did not consistently use the same headers**. In particular, successful property/address receipts, saved-replay/lost-ack recoveries, invalid/denied/disabled replies and request-stream guard rejections could lack `Vary: Cookie` or `X-Content-Type-Options: nosniff`; some also lacked explicit private no-store. These owner-scoped responses may contain saved service addresses, customer IDs and operation receipts. No evidence of an actual privacy incident is claimed.

## Implemented code (existing main-target unmerged Draft PR #282)

- Source commit [`aee642d8607a032490209446c053ada6999de50b`](https://github.com/kylebrooks86/first-in-response-website/commit/aee642d8607a032490209446c053ada6999de50b), exactly one real route: `business-app-parity/shared/app/api/customer-properties/route.ts`.
- Retain existing functions and SQL for customer association, immutable operation ID, idempotent create, native revisioned archive, correct missing-customer behavior, and lost D1 acknowledgement recovery. The exported POST/PATCH functions now normalize **every returned response** through a single private response wrapper: `Cache-Control: private, no-store`, `Vary: Cookie`, `X-Content-Type-Options: nosniff`. The wrapper preserves the original response **body, status, status text, and other headers**, including exact shared streaming-request guard outcomes. GET was already protected and unchanged.
- Changed-route regression commit [`1ab7bb05fe2561351d573d495a51ea42b5f63752`](https://github.com/kylebrooks86/first-in-response-website/commit/1ab7bb05fe2561351d573d495a51ea42b5f63752), existing real route/native SQLite test `shared/scripts/test-customer-property-create-receipt-sqlite.mjs`: asserts the three headers on owner successful create, replay/conflict, missing customer/invalid/disabled, no-ack/false-ack save states, archive and lost-ack, anonymous/nonowner denials, plus malformed/oversized streamed POST/PATCH requests. The test already runs in the existing `fire-staging-offline-rehearsal.yml` workflow. No test was faked or removed.

## Independent check and acceptance boundary

At initial readback, automatic GitHub PR CI for source/test commit `1ab7bb05...` had **27 triggered workflow groups**, most queued/in progress; completion and PASS must be read from GitHub, not assumed. The changed-function real SQLite test is CI-wired. Any later documentation-only head does not change this executable source/test commit's identity.

**Source implementation [x]; source CI acceptance [ ] pending verified run; formal G6 hosted owner/nonowner release [ ] OPEN.** This fixes an actual source privacy defect but **does not** attest deployed Worker bytes, real host authentication, cross-customer denial, Cloudflare Access, complete physical Gate 4–7 or TEST Stripe. Source-only improvement cannot advance the official 95-row release checklist. Existing status remains **50/95 accepted, 45 OPEN; formal 4/10 gates G1/G2/G3/G8 accepted, G4/G5/G6/G7/G9/G10 OPEN; NEW LIVE DARK/NO-GO, actual Job #0001 not issued**.

No app deployment, Git merge, Cloudflare login/Access/route/D1 write, migration, Stripe action, payment, customer communication, owner device recheck, paid R2 or other subscription. All prior owner screenshots and halted Acer read-only inventory attempt remain credited, not repeated.
