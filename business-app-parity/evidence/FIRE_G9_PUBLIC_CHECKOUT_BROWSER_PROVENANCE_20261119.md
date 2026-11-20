# FIRE G9/G6 public Stripe Checkout browser provenance — 2026-11-19

**Source-only implementation, NOT hosted TEST delivery or permission to activate payments.** Existing Draft PR #270, development branch `work/fire-main-qa-dr-live-unified-source-20261114`.

## Genuine source defect and correction

The public `POST /api/payments/checkout` route already pinned `SITE_ORIGIN`, enforced synthetic TEST mode/keys and a 16,384-byte actual-stream JSON limit, and checked the estimate bearer link, customer/invoice association, payment amounts and atomic D1 reservations. However, it had no early browser-Origin/Fetch-Metadata or browser JSON content-type refusal. A foreign origin or simple cross-site form with a known bearer link could reach checkout logic and potentially reserve an open session.

In `shared/app/api/payments/checkout/route.ts`, following the canonical HTTPS origin validation and **before body parsing, customer D1 reads or Stripe calls**, the route now refuses:
- `Sec-Fetch-Site` values other than `same-origin`;
- any present `Origin` that differs from the exact configured HTTPS `SITE_ORIGIN`, including `null`, same-site sibling and foreign origins;
- browser-originated requests not using JSON content type (including `text/plain` and URL-encoded form submissions).

The existing non-browser synthetic caller boundary, actual-stream body limit, isolated TEST kill switch, share-token checks, D1 reservation, currency/amount invariants and Stripe provider assertions remain unchanged. No claims of identity authorization are derived from Origin alone.

## Actual changed-source regression

`shared/scripts/test-checkout-atomic-reservation.mjs` now invokes the real transpiled Checkout handler with foreign/sibling/null Origin, cross-site Fetch Metadata, contradictory request headers, text/plain, URL-encoded and missing JSON type; each negative asserts **zero D1 prepares, zero reservations and zero Stripe calls**. Legitimate exact same-origin browser JSON is also asserted to create precisely one synthetic Checkout session.

Commits on existing PR #270:
- [source refusal](https://github.com/kylebrooks86/first-in-response-website/commit/25c7b8ebe38f9f63c94aa2a0ca991deb5b7973a7) (initial source change and exact JSON regex correction).
- [actual route regression](https://github.com/kylebrooks86/first-in-response-website/commit/845110d82d11d7c52965a85a4f594fe680ad38dd).

**Confirmed GitHub Actions execution at exact changed-code SHA `845110d82d11d7c52965a85a4f594fe680ad38dd`:** [FIRE Staging Migration and Shared-App Parity run #44600716079](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44600716079), job `135831095247` step **“Gate 9 actual public checkout bounded JSON, Stripe TEST session and HTTPS host guard (synthetic provider ONLY)” — COMPLETED SUCCESS**. Same job's Gate 6 wrong-customer invoice/atomic Checkout step and no-deploy QA Worker compilation also completed successfully. Full workflow/other checks were still running at this evidence-writing checkpoint; consult exact head CI for final disposition.

## Gate boundaries and release state

This is new verified **source and synthetic regression** progress under G6-08/G9; it is **NOT** formal checkbox satisfaction: G6-08 requires hosted nonowner/CSRF/zero-write tests, and G9 needs owner-approved protected real TEST Checkout, signed webhook delivery, and independent D1 ledger reconciliation. No Cloudflare, R2, Stripe configuration, charges/refunds, D1 schema/data, owner screenshots, login or hosted deployment occurred.

Keep the accepted **50 of 95** items, **45 open**, formal **G1/G2/G3/G8 = 4 of 10** accepted, G4/G5/G6/G7/G9/G10 open. NEW LIVE remains DARK/NO-GO; real Job #0001 unissued. Do not re-request previously accepted provider, Acer, iPhone, Drive or photo evidence.
