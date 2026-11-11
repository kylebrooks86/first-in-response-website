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

**Use the EXISTING Worker-level Access application and its destination's narrow public-path override, not a second overlapping Access app.** The repository already has a guarded, rollback-aware owner-run helper at:
`business-app-parity/cloudflare-launch/stripe-test-worker/owner_add_exact_gate9_webhook_access_override.ps1`.
It is **NOT authorized to run now**; its comments about an earlier owner-approved scope are historical, not fresh consent to a new provider write.

Cloudflare's official Access API supports `destinations:[{type:"worker",worker_id:"…",overrides:[{behavior:"public",path_pattern:"…"}]}]`, including literal-path public exceptions while retaining a separate owner-only policy for the remaining paths. Source: https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/applications/ and https://developers.cloudflare.com/workers/configuration/cloudflare-access/.

The owner-run helper is specifically pinned to:
- Cloudflare TEST Worker `fire-stripe-test-20261101` and its immutable Worker Access application ID, never another Worker or LIVE Sites app.
- Exactly **SEVEN** previously defined public path overrides (customer-facing signed estimate/invoice/pay links, matched static assets and branding). Their *actual remote presence remains to be read back*, rather than inferred from source code or an "All traffic" dashboard badge.
- ONE proposed extra override: literal `/api/payments/webhook` with `behavior:"public"`, **no wildcard**. Expected count after approval is eight.
- The existing reusable owner-identity **Allow** policy, unchanged.
- A private owner-machine DPAPI-encrypted before-state snapshot, source-policy fingerprint, last-second GET drift check, only one owner-confirmed policy PUT and independent post-write GET. The existing helper also contains a possible **rollback PUT** on uncertain outcomes; that contingency is a separate real Access policy mutation to include in an exact reviewed approval.

### Access review and acceptance sequence
1. **Read-only FIRST:** Inspect the actual current Cloudflare Access Worker application ID and `destinations[0].overrides` by authenticated GET; verify only the expected seven old paths, type `worker`, correct Worker ID, owner-only reusable Allow policy and no unreviewed fields. No token or owner email in logs or chat. If the count/policy differs: **STOP**, do not apply the helper.
2. Review the exact existing helper source and its rollback contingency with owner; **obtain new explicit approval** scoped to this one TEST Access application, one added `/api/payments/webhook` public override, and documented contingent same-app restoration only, with no broad policy changes. The owner supplies temporary Access: Apps and Policies Edit credentials privately to PowerShell and revokes them after, never to the conversation.
3. Only then execute the guarded script once. On a STOP or uncertain result, DO NOT retry automatically; independently GET actual Access state and reconcile.
4. **Verify physical access boundaries:** On the canonical TEST hostname, without owner browser cookies, `POST /api/payments/webhook` with NO `Stripe-Signature` must receive application HTTP **400**, not Cloudflare's login page. An invalid HMAC is 400. No valid HMAC or real Stripe event is sent at this ingress stage. A `GET` is not evidence of event handling.
5. Other private paths (`/api/customers`, `/api/payments/checkout`, `/api/payments/refund`) must still be protected by owner login. Customer-facing signed links retain their previously approved public access and token checks. No Worker-wide public/bypass switch. The normal stable origin serves the still-Stripe-disabled predecessor until a separate deployment approval.
6. If policy readback, immutable target identity, or non-webhook protections cannot be verified: **STOP and restore the exact original policy only under an explicitly approved rollback plan**.

**Reminder:** A public Access override only removes Cloudflare's interactive login on the exact receiver; the Worker MUST continue to check fresh Stripe HMAC timestamp/signature, environment mode, canonical origin, event and session IDs, and exact cents before financial ledger mutation. Cloudflare Access logs are not available for the public override, so provider-signed delivery receipts and application-level audit are essential. No non-webhook route becomes public.

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
