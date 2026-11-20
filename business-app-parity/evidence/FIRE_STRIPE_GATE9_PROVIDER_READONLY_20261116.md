# FIRE Gate 9 — direct Stripe sandbox provider readback, 2026-11-16

**New authenticated, read-only Stripe connector observation. NO payment/refund/webhook mutation, provider keys, D1/Cloudflare write, or LIVE transaction.**

## Verified sandbox account and scope

Connected account name: **First In Response Exteriors sandbox**. `livemode=false`. Stripe account identity is the previously recorded Gate9 sandbox target, not the LIVE business account. Calls were read-only list operations: `GET /v1/payment_intents`, `GET /v1/charges`, `GET /v1/checkout/sessions`, `GET /v1/refunds`, `GET /v1/events`, `GET /v1/webhook_endpoints`, each limited to 30 and returned `has_more=false`.

**Provider readback, 2026-11-16:**

| Stripe sandbox object | Observed status | Last relevant created date, UTC |
| --- | --- | --- |
| PaymentIntents | 3 succeeded, for USD $484.00, $75.00, and $75.00; 0 newer objects in the returned complete list | Oct 8, 2026 |
| Charges | 3 succeeded, all TEST mode, matching the three succeeded PaymentIntents | Oct 8, 2026 |
| Checkout Sessions | 5 total: 3 complete/paid; 2 expired/unpaid, all TEST mode | Oct 8, 2026 |
| Refunds | 1 succeeded partial USD $100.00 refund linked to the Oct 8 USD $484.00 PaymentIntent | Oct 8, 2026, 16:35:47 |
| Events | list returned 0 event objects and `has_more=false` | No event returned |
| Webhook endpoints | 2 total: 1 TEST Worker endpoint enabled, 1 legacy Sites endpoint disabled, both TEST mode | TEST Worker endpoint created Nov 3, 2026, 03:46:40 |

Dedicated enabled TEST webhook URL (public nonsecret resource identity): `https://fire-stripe-test-20261101.kyle-bfc.workers.dev/api/payments/webhook`. Configured types: `checkout.session.completed`, `checkout.session.async_payment_failed`, `checkout.session.async_payment_succeeded`, `refund.created`, `refund.updated`, `refund.failed`. Older legacy Sites webhook remains disabled.

## Release consequence

**New, important chronological constraint:** all observed successful TEST PaymentIntents, completed sessions, refund and charges **precede creation of the currently enabled isolated TEST Worker webhook endpoint**. Thus those past provider records **cannot** demonstrate that this endpoint successfully received, verified HMAC signatures, reconciled the dedicated isolated TEST D1 payment ledger, or processed replay/idempotency/refunds on its current hosted code. The events-list zero result is a *bounded result of that API call*, not proof that Stripe never delivered any event, that history was deleted, or that a future webhook is misconfigured.

The isolated Cloudflare TEST full-app source version remains blocked by its earlier consumed one-shot upload attempt; physical current-code Worker/secret/Access/route and signed TEST delivery/D1 ledger are **not** attested by this readback. An authenticated Stripe-side TEST transaction is not equal to a signed WEBHOOK receipt in FIRE D1. **Do not mark G9 accepted.**

**Avoid repetitive work:** Past successful provider payments/refund and webhook endpoint creation/configuration are now recorded read-only. Do not repeat these queries as routine checks. The actual next Gate9 step is a separately authorized and guarded TEST-only code/activation and *new* signed checkout/refund/webhook/replay+exact-cent hosted ledger verification. Previous consumed Cloudflare upload permission is not reusable. No real customer payments, LIVE mode, or hosted changes authorized by this document.

Source: fresh read-only connected Stripe sandbox API observations on November 16, 2026; no customer PII, account key, full test checkout token, webhook signing secret, raw provider response, charge ID, or personal email is stored here. The baseline no-R2/source/QA records remain in the canonical continuity register.

**Formal release acceptance remains G1/G2/G3/G8 (4/10), G4/G5/G6/G7/G9/G10 OPEN, NEW LIVE DARK NO-GO.**