# FIRE — Checkout final-session promotion financial/auth races (2026-11-18)

## Scope and immutable source identifiers

- Active review: [Draft PR #270](https://github.com/kylebrooks86/first-in-response-website/pull/270), main-target source only, unmerged and not deployed.
- Real runtime change: [`5aab7aa661a665a01f050b0c01b77a9cd879df6c`](https://github.com/kylebrooks86/first-in-response-website/commit/5aab7aa661a665a01f050b0c01b77a9cd879df6c), `shared/app/api/payments/checkout/route.ts`.
- Actual-route synthetic concurrent-state tests: [`f770f55f2d0bd700a0d503f82b85b9c02cc0da78`](https://github.com/kylebrooks86/first-in-response-website/commit/f770f55f2d0bd700a0d503f82b85b9c02cc0da78), `shared/scripts/test-checkout-atomic-reservation.mjs`.
- Production-query-extracted disposable native SQLite tests: [`fa399ddba5b7d2e9b32a3951f4f994832636c425`](https://github.com/kylebrooks86/first-in-response-website/commit/fa399ddba5b7d2e9b32a3951f4f994832636c425), `shared/scripts/test-checkout-invoice-owner-integrity.mjs`.
- Later test-only head at first inspected CI: [`8966e0d57b6be892aa51bcd7f102c38cbd2b207f`](https://github.com/kylebrooks86/first-in-response-website/commit/8966e0d57b6be892aa51bcd7f102c38cbd2b207f); only an unrelated payment closeout test wording changed after the three checkout commits.

## Real defect and correction

Previously the public checkout route checked the accepted signed estimate, link token, customer-matched invoice, pending refund and unresolved overage **after the Stripe session was acknowledged**, but then performed an unguarded session-ID promotion of `UPDATE payment_checkout_sessions SET id=? WHERE id=? AND estimate_id=? AND status='open'`. An independent owner device/provider could change the relevant state in that narrow final time-of-check/time-of-use window. A now-invalid checkout URL could be disclosed after a refund hold, billing exception, revoked bearer token or financial revision.

The actual final D1 `UPDATE` now atomically requires all of the following at write time: same valid estimate/share token, accepted and signed payment-eligible status (deposit versus completed balance), original exact deposit/valid customer-matched invoice/paid principal cents, no mismatched invoice ownership, no pending `payment_refunds` and no unresolved `payment_overage` notification. If the guarded update affects zero rows, it invokes the existing final error/expiry path: the new Stripe Checkout session is expired; the provisional D1 lock is released only after provider expiry is confirmed. If expiry cannot be verified, the lock remains for safe owner reconciliation. No payment URL is returned on an ambiguous or blocked outcome.

The actual synthetic route harness injects late refund, overage and token rotation at the final promotion and requires no link plus confirmed expiration. The separate native SQLite harness extracts the exact `UPDATE` statement from the TypeScript source and tests it against a disposable schema and real SQL state changes: refund, overage, rotated token, deposit amount, invoice/quote total, paid payment row, and a clean allowed promotion. Existing prior positive/failure cases remain in place.

## Evidence and limitations

At initial GitHub inspection, current-source offline Actions for `8966e0d` were **23 of 25 workflow groups SUCCESS, zero failed, two still executing**; **the changed checkout tests were NOT yet claimed PASS**, and final exact workflow result must be retrieved before any final source test claim. The earlier `fa399dd` workflow set was superseded by subsequent branch push and many jobs cancelled; a cancelled run does not count as passed.

No provider calls, test payment, webhook, customer send, hosted code, D1/SQL migration, Access/routing, paid Cloudflare/R2, new Cloudflare login, source merge, Worker deployment, or production cutover were performed. Gate 5/9 physical evidence remains OPEN. Master checklist **45/95** accepted, 50 open; formal release **4/10** G1/G2/G3/G8 accepted; NEW LIVE DARK NO-GO and first genuine Job #0001 unused. [Issue #19 entry](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6980598527).
