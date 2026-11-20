# FIRE G6 — owner task write receipts and D1 preflight failure safety (2026-11-19)

## Scope and exact source

New source-only repair in the **existing main-target, unmerged Draft PR #282**, branch `work/fire-private-notes-followup-search-20261119`:

- Production route: `shared/app/api/tasks/route.ts`, implementation commit `e450c8b71968c3fd40b4dfa2cb0bd4ea74e7407b`.
- Existing real-route/native disposable SQLite POST suite: `shared/scripts/test-task-create-ownership-recovery-sqlite.mjs`, final test commit `820304a888326b277617ab893fa94d6b1e4a9af4`.
- Existing real-route/native disposable SQLite PATCH suite: `shared/scripts/test-task-status-confirmation.mjs`, exact executable+test commit `177140026dabbd4ae5a7e74712b1911a1a87c7f4`.
- CI is automatically triggered on the new source SHA. **At the initial evidence checkpoint, the matching staging/QA source job and both changed-function test steps had not yet completed. Do not claim those checks PASSED until actual GitHub job results say SUCCESS.**

## Actual production code changes

1. `POST /api/tasks` initial estimate/customer preflight lookup errors previously could escape to an unhandled failure before any task INSERT. The route now converts the two D1 read errors to controlled owner-private HTTP **503**, clearly stating that no task was created and instructing retry with the same immutable request ID. A genuine missing customer/job still returns **404**; mismatch remains **409**. This does not change successful task persistence or D1 idempotency.
2. All task `POST/PATCH` successful, retry, conflict, validation, owner-denied, transient/readback/outage receipts and bounded shared-body-reader denials now apply `Cache-Control: private, no-store`, `Vary: Cookie` and `X-Content-Type-Options: nosniff`. Existing status codes, response content, task data and other response headers preserved. Task `GET` already had these headers.
3. The exact existing SQL write transaction/readback/CAS, 50% deposit, task/job relation, due-date reschedule, completion/reopen and lost-ack behavior were not deliberately changed. No new routes, UI features, database changes or external calls.

## Focused checks added to existing CI-wired tests

- Confirm POST owner 201 and denied 401 have all three private headers.
- Inject a real `env.DB.prepare` failure at linked-estimate lookup and customer-only lookup, independently; assert 503, private headers, unchanged SQLite row count and no attempted save. Recover using the original immutable operation ID.
- Confirm PATCH completion 200, stale conflict 409 and deadline reschedule 200 retain the same private/session-bound response headers.
- Preserve all existing actual route SQLite ownership/concurrent reassignment/zero-row/lost-ACK and PATCH status/deadline CAS assertions.

## Release / evidence boundaries

This is **[x] a completed source implementation + committed regression coverage**, **not** proof that the newest CI completed or that the changed app code is being served by Cloudflare. Formal 95-row master **51/95 accepted, 44 OPEN** because G9-03 was separately accepted; formal whole release gates **G1/G2/G3/G8 accepted = 4/10**, G4/G5/G6/G7/G9/G10 open. No Git merge, deployment, D1 or Stripe modification, Access/route change, Cloudflare login, paid Cloudflare/R2 subscription, customer contact/data/photo action, or repeated owner Acer/iPhone tests. NEW LIVE remains DARK/NO-GO, first real Job #0001 unused.
