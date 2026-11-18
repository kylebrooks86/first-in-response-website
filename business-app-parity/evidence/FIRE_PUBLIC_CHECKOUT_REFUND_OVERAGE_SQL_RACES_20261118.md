# FIRE checkout reservation refund/overage SQL-time race protections — November 18, 2026

## Exact source and test custody

- Existing **draft, unmerged, undeployed PR #270**, branch `work/fire-main-qa-dr-live-unified-source-20261114`.
- Actual checkout runtime change: [`a585a8951120fcae0627c24ec0844c9a4cc77bd9`](https://github.com/kylebrooks86/first-in-response-website/commit/a585a8951120fcae0627c24ec0844c9a4cc77bd9), file `shared/app/api/payments/checkout/route.ts`.
- Real route synthetic Stripe/atomic-reservation regression: [`946140281075be7fd3460e64fb0f27eb61fc1200`](https://github.com/kylebrooks86/first-in-response-website/commit/946140281075be7fd3460e64fb0f27eb61fc1200), file `shared/scripts/test-checkout-atomic-reservation.mjs`.
- Disposable **native SQLite** regression now executing the **source-derived real SQL** for late refund/overpayment holds: [`eb25c250aeba5be8c5b7bc3840d2be098dc14ef0`](https://github.com/kylebrooks86/first-in-response-website/commit/eb25c250aeba5be8c5b7bc3840d2be098dc14ef0), file `shared/scripts/test-checkout-invoice-owner-integrity.mjs`.
- These are executable source/test changes, **not** a provider deployment or physical D1/Stripe verification. No owner device work or Cloudflare authentication.

## Actual behavior corrected

Before this change, public `POST /api/payments/checkout` checked `payment_refunds.status='pending'` and open unresolved `notifications.type='payment_overage'` before creating its Stripe checkout reservation, but not **inside the reservation's conditional SQLite/D1 INSERT**. A second device could create such a financial hold after preliminary SELECTs. The new source requires **both NOT EXISTS** predicates in the same SQL statement reserving the one-open-checkout slot. It also re-reads pending refunds together with overage and invoice ownership **after Stripe acknowledges a session**; a newly held account does not receive the payment link, and existing verified Stripe-expiry / safe-reconciliation semantics remain.

The public checkout bounded JSON decoder now rejects empty bodies, inconsistent declared `Content-Length` versus actual streamed UTF-8 bytes and cross-realm non-Uint8Array chunks safely, without changing the 16 KiB maximum. Existing real payments, totals, refunds, issued sessions, share links, ledger, source QA master and branding remain unmodified.

## Targeted executable regressions

The existing mandated staging job `Gate 6 wrong-customer invoice blocks public charge and atomic checkout reservation (native SQLite, no Stripe)` runs `test-checkout-invoice-owner-integrity.mjs`. That test now creates the refund table in its synthetic schema and inserts a pending refund **after** the first read, then separately an unresolved overage; the actual source-derived reservation SQL must record 0 new checkout rows. The same SQL must permit exactly one slot after the holds are cleared. It also verifies the real post-provider read sees new refund and overage flags.

The existing mandated `Gate 9 actual public checkout bounded JSON, Stripe TEST session and HTTPS host guard (synthetic provider ONLY)` step runs `test-checkout-atomic-reservation.mjs`. It now checks preflight-to-reservation refund/overage races, post-provider holds and safe expiry, and malformed/empty/inconsistent-length request bodies with zero unauthorized DB/Stripe writes. Neither test makes a real provider call.

### CI status / superseded intermediate failure

The first source/test SHA `94614028` had an intermediate **failure** in [offline staging run #44315442110](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44315442110): the older disposable invoice-owner fixture lacked the now-referenced `payment_refunds` table. It is NOT a production defect nor a PASS. The fixture was updated and new native SQLite race cases added at **`eb25c250`**; [corrected staging run #44315931970](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44315931970) must be checked for its actual step outcome before claiming validation. Earlier successful source/test builds belong solely to their recorded immutable SHA, not this revision.

## Release boundaries

- No Cloudflare login, Access/routes/hostname changes, Worker deploy, D1 schema migration or provider database write, R2/subscription, live or TEST Stripe transaction/refund/webhook, customer message, PR merge, release or cutover.
- Full hosted target and nonowner proof still required. The TEST webhook Access destination/routing risk remains an open owner/provider decision.
- Checklist remains **45/95 completed, 50 open**, formal gates **4/10 accepted** (G1/G2/G3/G8); **G4/G5/G6/G7/G9/G10 OPEN**. **NEW LIVE DARK / NO-GO**; genuine first Job #0001 unused.
