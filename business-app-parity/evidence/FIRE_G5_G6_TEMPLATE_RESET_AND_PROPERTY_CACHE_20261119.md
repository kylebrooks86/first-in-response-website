# FIRE Business App — G5/G6 saved-template integrity and private customer-property GET — 2026-11-19

**Scope and authorization:** Existing unmerged Draft [PR #270](https://github.com/kylebrooks86/first-in-response-website/pull/270), branch `work/fire-main-qa-dr-live-unified-source-20261114`. Source-only implementation, local native SQLite and synthetic browser/CI verification. No Cloudflare/Stripe provider access, payment actions, R2 subscription, D1 migration, deployment, Git merge, real-data mutation, public website publishing or owner-device re-test.

## Material defects repaired

**1. Settings: malformed reset could erase an owner-authored message template.** The owner-only `PUT /api/message-templates` handler formerly used `if(body.reset)`: strings such as `"false"`, values `1`, arrays and JSON objects were truthy, causing destructive `DELETE FROM message_templates` despite not explicitly selecting Restore Defaults. Owner message subject/body were also coerced from arbitrary JSON shapes into strings. The handler now enforces exact known input keys and typed text, literal boolean `reset:true`, and disallows combined reset/edit instructions **before D1 write or readback**. Valid Settings saves, default restores, existing 64 KiB streaming request guard, exact D1 confirmation, interrupted-ACK recovery and unchanged original message content remain supported. Authenticated/denied GET returns `Cache-Control: private, no-store`, `Vary: Cookie`, `X-Content-Type-Options: nosniff`.

- Actual route: [commit 3325937](https://github.com/kylebrooks86/first-in-response-website/commit/33259370173e48c55e3a3b0acf975a9798a0468b) — `business-app-parity/shared/app/api/message-templates/route.ts`.
- Actual-source + native SQLite regression: [commit 553db79](https://github.com/kylebrooks86/first-in-response-website/commit/553db791ab69af6da60c1829b5df496c59cd35a1) — `business-app-parity/shared/scripts/test-template-save-d1-confirmed-sqlite.mjs`. Ten invalid reset/edit combinations cannot delete or alter the real synthetic SQLite row; owner/anonymous private GET checks retained.

**2. Customer addresses: authenticated owner property GET lacked explicit private-cache boundary.** `GET /api/customer-properties` returned customer street addresses, designations and owner/customer relationships without `Cache-Control`, `Vary: Cookie` or `nosniff` on owner and 401/validation responses. Every GET branch now supplies private/no-store session-varied headers. Existing customer-bound property list, selected-property relation, pagination, feature gate, POST/PATCH idempotent writes and the exact owner auth contract stay intact.

- Actual route: [commit 78ec4df](https://github.com/kylebrooks86/first-in-response-website/commit/78ec4df64c387a9e3b571f51b05f2c298fef97ac) — `business-app-parity/shared/app/api/customer-properties/route.ts`.
- Actual-source + native SQLite regression: [commit 39bbbf2](https://github.com/kylebrooks86/first-in-response-website/commit/39bbbf22f91f7e8287fdc039dd3c824cfe35132c) — `business-app-parity/shared/scripts/test-customer-property-create-receipt-sqlite.mjs`. Verifies owner read, private/no-store/Vary/nosniff, no cross-customer address or selected-property exposure, denied anonymous GET without any DB read and existing owner-safe D1 mutation/lost-ACK behavior.

## Exact verified CI

**Source and test SHA:** [`39bbbf22f91f7e8287fdc039dd3c824cfe35132c`](https://github.com/kylebrooks86/first-in-response-website/commit/39bbbf22f91f7e8287fdc039dd3c824cfe35132c).

- [QA/STAGING six-job CI #44607839829](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44607839829) — **COMPLETED SUCCESS, 6/6 independent jobs**. Its actual shared-app source-build job `135856330289` **COMPLETED SUCCESS**. Source-loaded/native SQLite logs show **PASS 35/35 Settings template assertions** and **PASS 88/88 customer-property assertions**; existing test runners were already wired into staging. All synthetic/local.
- [App-only integration/source guard #44607839797](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44607839797) — **SUCCESS**, preserves public website and calculator.
- [Public website verification #44607839657](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44607839657) — **SUCCESS**.
- [Gate 9 LOCAL full-app build #44607839866](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44607839866) — **SUCCESS**, no Stripe provider or remote deployment.
- GitHub exact-SHA check readback **27/27 SUCCESS**, zero failures and zero outstanding at time of seal.

**Acceptance boundary:** This is verified local source and disposable database test evidence, **NOT** hosted QA/STAGING/DR/NEW LIVE version parity, actual Access/nonowner denial, deployed customer isolation, LIVE financial or Stripe TEST signed-event evidence. Formal owner release criteria cannot be checked off from source tests.

## Unchanged owner release state

- **50/95 formally checked**, **45 OPEN**.
- **4/10 formal gates accepted:** G1, G2, G3, G8. **G4, G5, G6, G7, G9 and G10 OPEN.**
- **NEW LIVE DARK/NO-GO**, initial real Job #0001 unissued.
- Previously accepted Cloudflare, Stripe TEST historical, Acer PowerShell, iPhone, Google Drive encrypted backups, three-original-photo recovery and evidence reconciliation remain established history; no repeat requested.
- No Cloudflare paid R2/free-plan activation, provider login, Access/route/DNS modification, payment configuration, webhook, hosted D1/Worker write, merge, migration, deployed app/public website or customer record change.
