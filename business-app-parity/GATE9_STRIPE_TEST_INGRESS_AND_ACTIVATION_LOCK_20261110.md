# FIRE Gate 9 — Safe Stripe TEST ingress and activation lock (2026-11-10)

**State: prepared, SOURCE ONLY, NO PROVIDER WRITE APPROVAL. Gate 9 OPEN; LIVE NO-GO.**

## Grounded target and completed evidence
- Isolated TEST Worker: `fire-stripe-test-20261101`; existing stable HTTPS origin: `https://fire-stripe-test-20261101.kyle-bfc.workers.dev`.
- Existing TEST D1 binding ID: `dba421ba-fc66-4cf8-9c31-51616f8249ba` (historical real owner metadata; physical ordered schema/journal/backup and ledger **not yet confirmed**).
- Worker serving predecessor: `96e32262-fa33-4f04-a161-bee11f0353e2`, historical 100%. Owner physically rendered *inactive* version `ce69c574-4695-4539-8274-ee2aa3959e41` on iPhone, but created at 0% traffic; new version's code and assets are **not** currently the stable webhook target.
- The new version's source is the DRAFT PR220 frozen `a655ecbd77769add27d9ed6c5bc86c3376723563`; candidate fingerprint `4f7e6b282b56760313a24b04f8f05c506dfb9ee88a5fbe12fc177cf2ba0d4917`.
- Cloudflare Access is currently owner-only and **All traffic**, covering stable and Version URLs. Actual owner authenticated iPhone showed the rendered dashboard.
- Stripe TEST sandbox account `acct_1ULRIG7ND12rd1wI`, `livemode:false` (verify before every future write).
- Provider GET after owner-approved Stripe POST confirmed only two existing sandbox endpoints, no further pages:
  - Dedicated `we_1UXYgG7ND12rd1wIB4CmcxGy`, **enabled**, exactly six Checkout/async/refund events, URL `https://fire-stripe-test-20261101.kyle-bfc.workers.dev/api/payments/webhook`.
  - Legacy `we_1ULV3j7ND12rd1wILDuTy79G`, **disabled** (NOT deleted), URL `https://fire-app.kylebrooks8605.chatgpt.site/api/payments/webhook`, original three checkout subscriptions retained. Its disabled status is physically GET-verified.
- The current TEST Worker still has inherited `FIRE_STRIPE_MODE=disabled`, and its read-only inventory did not include a restricted TEST API key or a pin for `FIRE_STRIPE_EXPECTED_ACCOUNT_ID`. These are intentional **BLOCKERS**, not defaults to override.
- The Worker webhook handler verifies raw Stripe timestamp/HMAC before any TEST-mode gate, verifies livemode/object/session identity and routes to D1 only after valid signatures. A separate draft PR222 adds (1) refusing a second overlapping enabled sandbox Stripe destination and (2) refusing even HMAC-valid TEST events on an unpinned hostname/path.

## Exact narrow Cloudflare Access configuration (DESIGN, NOT YET APPLIED)
A normal Stripe server-to-server webhook CANNOT sign in as the owner via an interactive Cloudflare Access browser page. Its own `Stripe-Signature` verification is the intended authentication on this receiver. Do **not** disable Access for this Worker or all traffic.

Cloudflare documents that hostname/path Access applications take precedence over Worker-level Access and supports a path-scoped `Bypass` policy (but warns that Bypass disables Access logging for matching traffic). If and only if the actual UI permits a self-hosted application for this **literal** HTTPS worker hostname and **exact** `/api/payments/webhook` path:
1. Preserve the existing `FIRE Stripe TEST - Owner Only` Worker-level **All traffic** Allow policy unchanged.
2. Review a *separate* self-hosted Access application matching ONLY `fire-stripe-test-20261101.kyle-bfc.workers.dev/api/payments/webhook` (NOT `*.workers.dev`, NOT `/*`, NOT `/api/*`, NOT `/api/payments/*`, NOT a Version URL).
3. Only after **new exact-target owner approval**, apply `Bypass / Include Everyone` to this one literal receiver path and prove Cloudflare's effective policy precedence through a non-credential read-only request. This intentionally removes **Cloudflare Access login** for only that path, NOT the Stripe HMAC check performed in application code; do not claim Bypass is a security control.
4. Independently show unauthenticated `GET /api/customers` still gets the Cloudflare Access login (not raw customer JSON), and the same holds for `/api/payments/checkout`, `/api/payments/refund` and arbitrary private UI paths.
5. Unauthenticated `POST /api/payments/webhook` **without** `Stripe-Signature` must reach the handler and be rejected HTTP **400**; malformed HMAC must also be 400. Never send a valid signature or real Stripe event as this ingress check. No body/secret/header/cookie shown in chat or GitHub. The regular URL is still the original Stripe-disabled predecessor during this check.
6. If Cloudflare's UI refuses the literal `workers.dev` path, shows broader coverage, or any non-webhook route loses owner login: **STOP and DO NOT APPLY**. Do not switch to a Worker-wide bypass or new public hostname without a separate design review.

Cloudflare official references:
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/
- https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/

## Stripe TEST activation and ledger — ordered independent gates
A) Before any money-event write, use real owner-authenticated **read-only** Cloudflare D1 provider view for exact TEST D1 UUID, ordered migration history, `payment_refunds` table/indexes, invoice/payments/estimate uniqueness, no LIVE DB UUID reuse, and a recoverable target-bound private backup. Do not run migration/SQL writes or share customer rows.
B) Verify the exact receiving TEST Worker version, source SHA/compiled digest, all 41 static assets, `SITE_ORIGIN` stable canonical URL, owner Access controls including webhook-only exception, bound TEST D1, secret **names only**, and rollback version. The inactive `ce69c574` itself cannot receive existing stable URL traffic while 0%; Version URLs USE this Worker's existing DB (not an isolated clone), so signed events to them are not a safe shortcut.
C) Prepare and separately approve a NEW immutable TEST-only candidate with scoped **test-mode** Stripe restricted API key (only necessary account/webhook GET and checkout/refund operations), explicit `FIRE_STRIPE_EXPECTED_ACCOUNT_ID=acct_1ULRIG7ND12rd1wI`, `FIRE_STRIPE_MODE=test` on only the approved TEST version, proper private `STRIPE_WEBHOOK_SECRET`, and exact configured `SITE_ORIGIN`. Never print the key or webhook signing secret, and NEVER reuse a LIVE-mode key. The existing one-shot guarded inactive uploader **does not** authorize these new bindings, secrets or a traffic switch.
D) Only after owner separately authorizes **the precise TEST Worker 100% activation** and independently verifies readback, send **fresh strictly synthetic Stripe TEST-only** checkout and refund operations in approved amounts. Stripe must deliver **real signed webhooks** to the stable dedicated TEST endpoint, not the old LIVE Sites endpoint. Check duplicate/replayed deliveries, payment principal/tip cents, refunds, async failures and D1 ledger exact cents against fresh Stripe provider GETs.
E) Gate 9 becomes accepted only on independent provider evidence, privacy/security boundaries, complete rollback, exact money reconciliation. Gate 10 and LIVE production remain separate and require later owner permission.

### Prohibited shortcuts
- No second enabled webhook to the old LIVE Sites URL; no changes to Stripe LIVE mode.
- No Worker-wide Access bypass and no permitting arbitrary authenticated headers in place of real signed Access.
- No signup/checkout charges, refunds, signed event replay, D1 mutation, secret provisioning, version promotion, Cloudflare Access write, Git main merge or LIVE deploy without separate exact approved scope.
- No equating an iPhone-rendered dashboard with HMAC delivery or settled money.
