# FIRE App v138 — Exact LIVE Parity Capture Checklist

**Master target:** the current LIVE FIRE business app.

Each item below must be captured in both LIVE and independent using the same test state/viewport, then marked VERIFIED IDENTICAL.

## Owner app
- [ ] `owner-app-customer-payments-tab` — Customer Payments tab (LIVE EVIDENCE CAPTURED; INDEPENDENT RENDER PENDING)
- [ ] `owner-app-customer-invoices-tab` — Customer Invoices tab (LIVE EVIDENCE CAPTURED; INDEPENDENT RENDER PENDING)
- [ ] `owner-app-customer-photos-tab` — Customer Photos tab (LIVE EVIDENCE CAPTURED; INDEPENDENT RENDER PENDING)
- [ ] `owner-app-50-deposit-scheduling-rule` — 50% deposit scheduling behavior (LIVE EVIDENCE CAPTURED; INDEPENDENT RENDER PENDING)
- [ ] `owner-app-follow-up-prepare-message-workflow` — Follow-up prepare-message workflow (FUNCTIONALLY VERIFIED)
- [ ] `owner-app-payment-history` — Payment history (FUNCTIONALLY VERIFIED)
- [ ] `owner-app-refund-payment-workflow` — Refund payment modal/workflow (NEEDS LIVE VISUAL)
- [ ] `owner-app-refund-processing-state` — Refund processing hold (NEEDS LIVE VISUAL)
- [ ] `owner-app-invoices-list` — Invoices list (NEEDS LIVE VISUAL)
- [ ] `owner-app-invoice-detail-owner-view` — Invoice detail owner view (NEEDS LIVE VISUAL)
- [ ] `owner-app-business-screen` — Business screen (NEEDS LIVE VISUAL)
- [ ] `owner-app-templates-screen` — Templates screen (NEEDS LIVE VISUAL)
- [ ] `owner-app-before-after-photos-workflow` — Before/after photos workflow (LIVE EVIDENCE CAPTURED; INDEPENDENT RENDER PENDING)
- [ ] `owner-app-empty-error-states-across-all-owner-routes` — Empty/error states across all owner routes (FUNCTIONALLY VERIFIED / NEEDS LIVE VISUAL)

## Customer-facing app
- [ ] `customer-facing-ap-customer-approval-signature-flow` — Customer approval/signature flow (FUNCTIONALLY VERIFIED)
- [ ] `customer-facing-ap-change-request-flow` — Change-request flow (FUNCTIONALLY VERIFIED)
- [ ] `customer-facing-ap-customer-invoice-view` — Customer invoice view (LIVE EVIDENCE CAPTURED; INDEPENDENT RENDER PENDING)
- [ ] `customer-facing-ap-customer-payment-page` — Customer payment page (NEEDS LIVE VISUAL)
- [ ] `customer-facing-ap-stripe-checkout-initiation` — Stripe checkout initiation (FUNCTIONALLY VERIFIED in code)
- [ ] `customer-facing-ap-stripe-webhook-completion` — Stripe webhook completion (FUNCTIONALLY VERIFIED in independent code)
- [ ] `customer-facing-ap-paid-invoice-zero-balance-customer-state` — Paid invoice / zero-balance customer state (NEEDS LIVE VISUAL)
- [ ] `customer-facing-ap-refund-processing-state` — Refund processing state (NEEDS LIVE VISUAL)
- [ ] `customer-facing-ap-customer-error-expired-link-states` — Customer error/expired-link states (NEEDS LIVE VISUAL)

## Shared business behavior
- [ ] `shared-business-be-multi-service-calculations` — Multi-service calculations (FUNCTIONALLY VERIFIED)
- [ ] `shared-business-be-no-duplicate-parent-rows-from-estimate-items-joins` — No duplicate parent rows from estimate_items joins (FUNCTIONALLY VERIFIED)
- [ ] `shared-business-be-150-minimum-logic` — $150 minimum logic (FUNCTIONALLY VERIFIED)
- [ ] `shared-business-be-service-catalog-pricing-rules` — Service catalog/pricing rules (FUNCTIONALLY VERIFIED)
- [ ] `shared-business-be-50-deposit-requirement` — 50% deposit calculation/display + non-gated scheduling behavior (LIVE EVIDENCE CAPTURED; INDEPENDENT RENDER PENDING)
- [ ] `shared-business-be-completion-before-final-balance-workflow` — Completion-before-final-balance workflow (FUNCTIONALLY VERIFIED)
- [ ] `shared-business-be-stripe-server-side-amount-calculation` — Stripe server-side amount calculation (FUNCTIONALLY VERIFIED)
- [ ] `shared-business-be-stripe-signed-webhook-idempotency` — Stripe signed webhook + idempotency (FUNCTIONALLY VERIFIED)
- [ ] `shared-business-be-manual-payment-safeguards` — Manual payment safeguards (FUNCTIONALLY VERIFIED)

## Completion rule

No release may claim FULL_IDENTICAL until every checkbox above is supported by evidence in `PARITY_EVIDENCE_MANIFEST.json` and the strict parity gate passes.
