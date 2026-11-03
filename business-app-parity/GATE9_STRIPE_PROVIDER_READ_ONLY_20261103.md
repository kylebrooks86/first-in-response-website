# FIRE Gate 9 — first-party Stripe sandbox recheck (2026-11-03, read-only)

**Evidence source:** Connected Stripe account API, directly queried with the existing Stripe connector, `GetWebhookEndpoints` with `limit=100` and `GetEvents` with `delivery_success=false,limit=100`. The connection explicitly returned **`acct_1ULRIG7ND12rd1wI`, `livemode=false`**, name `First In Response Exteriors sandbox`. All requests were **GET only**. No signing secret, API key, customer, payment, email or address data was collected or recorded. No API POST, event replay, payment/refund, endpoint edits or Cloudflare access.

## Verified first-party provider facts

1. The Stripe webhook endpoint list is **complete** (`has_more=false`), with **exactly two** enabled sandbox endpoints:
   - Isolated TEST endpoint: `we_1UXYgG7ND12rd1wIB4CmcxGy`; URL `https://fire-stripe-test-20261101.kyle-bfc.workers.dev/api/payments/webhook`; `livemode=false`, `status=enabled`, API version `2026-08-26.dahlia`; **exact five events**: `checkout.session.completed`, `checkout.session.async_payment_failed`, `checkout.session.async_payment_succeeded`, `refund.created`, `refund.updated`.
   - Original preexisting Sites endpoint: `we_1ULV3j7ND12rd1wILDuTy79G`; URL `https://fire-app.kylebrooks8605.chatgpt.site/api/payments/webhook`; `livemode=false`, `status=enabled`, same API version; **three Checkout events only**. It has **not been changed, deleted, or repointed** by this work.
2. Stripe `GET /v1/events?delivery_success=false&limit=100` returned **one** event and `has_more=false`: `evt_1UOIpm7ND12rd1wI9zV8ZOIC`, `checkout.session.completed`, `pending_webhooks=1`, `livemode=false`. This is a historical event **predating the creation of the separate TEST endpoint**. This response alone cannot determine which individual endpoint owes that pending delivery, whether FIRE's database recorded anything, or whether a fresh TEST event has been accepted.
3. The original TEST Worker identity was owner-confirmed in earlier authenticated read-only Wrangler: `fire-stripe-test-20261101`, physical D1 `dba421ba-fc66-4cf8-9c31-51616f8249ba`, four required encrypted secret **names**, `FIRE_STRIPE_MODE=disabled`, and immutable version `96e32262-fa33-4f04-a161-bee11f0353e2` serving 100% at that checkpoint. **These are historical owner receipts, not refreshed Cloudflare state from the Stripe GET.**

## What this evidence does and does not establish

**Stripe-side setup PASS:** The *separate* required five-event TEST webhook exists, is enabled, points to the expected isolated worker route, uses TEST mode and the required API version, and did not replace the original. **Stop recommending creation of another webhook or adding the same missing events to the old Sites webhook.**

**NOT verified:** Cloudflare's current active-version inventory following the failed inactive upload; actual signed delivery to the TEST Worker; signature-secret pairing at that runtime; success/duplicate/failure HTTP statuses from a genuine provider event; database schema/journal and HMAC-to-ledger exact cents; $440 balance + $44 tip + $100 partial refund allocation; idempotency, order variance, retry and rollback.

**No inference from pending historical event:** An event created before the dedicated TEST webhook cannot independently prove a new-endpoint failure. Stripe `pending_webhooks=1` on the account-wide event list is not a target-specific error count.

**Owner authorization:** The earlier one-upload-only Cloudflare approval was consumed by the Wrangler CLI-parse failure. **No new upload, traffic activation, Stripe mode enablement, event trigger/replay, payment, refund or DB write is authorized by this receipt.** Until refreshed Acer `deployments status` plus `versions list` is reviewed, do not attempt another upload. If a new inactive version is found, verify provenance and its immutable bindings before considering traffic activation. A separate owner decision is necessary for each write/test transaction.

**Formal release status remains 3 of 10 gates accepted, NO-GO.** Gate 9 is OPEN, pending the independent hosting and signed-delivery/ledger evidence above. This file is an evidence record, not a release approval.
