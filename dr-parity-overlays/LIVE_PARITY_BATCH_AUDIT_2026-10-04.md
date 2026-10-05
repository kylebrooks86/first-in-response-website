# FIRE DR — Extended LIVE Parity Audit Batch

Updated: 2026-10-05

Purpose: preserve the current DR-only parity state after the owner directed that the independent app mirror the current LIVE FIRE app rather than be redesigned.

This document is **not rendered proof** and does not change `NOT_YET_FULLY_VERIFIED` to `FULL_IDENTICAL`.

## Frozen / owner-confirmed areas

- Scroll/smoothness tuning is frozen at the owner's direction.
- The standalone mobile shell V14 is now user-confirmed good after deployment.
- V14 keeps the crisp fixed/opaque top shell and explicitly gives the mobile search field its own second row; dashboard content begins below the full two-row header so the `FIRE APP` / `Welcome, Kyle` block is not covered.
- Do not modify the V14 header/search/welcome spacing unless the owner explicitly reopens it.
- Templates mobile selection/editing is user-confirmed working acceptably.
- DR Stride header control is acceptable.

## LIVE-evidence corrections applied

Stored LIVE approved-estimate evidence shows the signer name in the green signed confirmation. The DR staging overlay preserves the signed name when available:

`Estimate approved and agreement signed by <signed name>. Kyle will contact you to schedule.`

The cumulative LIVE v107/v112 billing rules require customer payment actions to be hidden while an unresolved overpayment or pending refund exists. The DR overlay:

- queries pending refund count on the standalone customer payment page;
- treats pending refunds and unresolved overpayments as payment-review holds;
- suppresses the secure-pay action during either hold;
- shows `Refund processing.` for a pending refund;
- shows `Payment received — account review in progress.` for an unresolved overpayment.

These corrections are applied after sealed-v138 extraction. The sealed archive remains unchanged.

## LIVE-captured states protected

- Customer Payments empty state and manual-payment wording.
- Customer Invoices empty state and create-invoice wording.
- Customer Photos controls and no-photo state.
- Approved/signed scheduling with 50% deposit displayed but not used as a hard scheduling gate.
- Scheduled next-step wording.
- Completed → Create invoice → Invoice created / Send invoice transition.
- Customer invoice structure, balance, due-on-receipt/specific-date treatment, manual Cash App/Venmo instructions, and Back/Home controls.
- Approved/signed customer estimate confirmation with signer name.
- Complete LIVE-captured Create Estimate service catalog in exact order.

## Owner workflow coverage

Source guards protect Dashboard, Notifications, Contracts, Customers, Follow-ups, Payments, Record payment, Job costs, Service completion report, customer action row/property preview/Messages/Notes/Payments/Invoices/Photos, owner Invoices, final-invoice edit/revision behavior, Business, Templates, refund/overpayment states, and common owner empty/error states.

The richer DR customer profile and Edit customer flow are owner-approved forward-sync targets. They must be preserved in DR and brought into LIVE before those states can be called identical.

## Shared business behavior protected

- Multi-service estimates.
- Separate 5% First Responder & Military appreciation discount.
- Additional percent or dollar discount.
- $150 minimum job charge.
- 50% deposit calculation/display.
- Approved/signed scheduling without a hard deposit-payment gate.
- Completed → Create invoice → Invoice created / Send invoice transition.
- Final invoice as canonical completed-job billing total.
- Editable final invoice with revision history and stale Stripe-session safety.
- Manual-payment safeguards, refund reconciliation, and retained-overpayment handling.
- Customer payment actions suppressed during pending-refund or unresolved-overpayment review.
- Review-request suppression while billing/refund exceptions are unresolved.
- Exact review URL: `https://firstinresponseexteriors.com/review`.
- Cash App `$FIREExteriors` and Venmo `@FirstInResponseExteriors`.

## Current build guards

The DR preparation path runs eight source/governance parity guards after applying DR overlays and before dependency install/build:

1. `scripts/verify-fire-dr-live-parity-overlays.py` — known LIVE-captured/user-confirmed shell and workflow invariants, including confirmed V14 two-row standalone-header/search layout.
2. `scripts/verify-fire-dr-owner-workflows.py` — owner workflow contracts.
3. `scripts/verify-fire-dr-forward-sync.py` — protects the owner-approved richer DR customer profile/Edit customer target and requires LIVE to catch up before FULL_IDENTICAL.
4. `scripts/verify-fire-dr-live-service-catalog.py` — all 30 LIVE-captured Create Estimate service options in exact order.
5. `scripts/verify-fire-dr-live-evidence-coverage.py` — every formal LIVE `CAPTURED` state must be mapped into current DR parity protection; restore/lifecycle/refund/Stripe integrity subguards also run here.
6. `scripts/verify-fire-dr-customer-workflows.py` — approval/signature, customer documents, payment/refund edge states, and no-R2 photo failure behavior.
7. `scripts/verify-fire-dr-parity-ledger-consistency.py` — evidence counts/status, governance consistency, persistent overlays, PIN/no-R2 rules, and current release verdict.
8. `scripts/verify-fire-dr-release-readiness.py` — derives final evidence blockers and refuses premature FULL_IDENTICAL / synchronized claims while parity remains incomplete; it never promotes production automatically.

These guards do **not** substitute for same-state rendered LIVE-vs-DR comparison.

## Current formal evidence status

- 32 release-gating parity entries.
- 11/32 LIVE evidence captured.
- 0/32 independent evidence formally registered.
- 0 VERIFIED_IDENTICAL comparisons.
- 0 recorded mismatches.
- Owner-approved forward-sync blockers are tracked in `FORWARD_SYNC_APPROVED.json`; each `PENDING_LIVE_SYNC` entry blocks `FULL_IDENTICAL` until individually verified in LIVE.

Status remains:

`STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED`

`NOT_YET_FULLY_VERIFIED`

## Remaining rendered blockers

For states where LIVE evidence already exists, the next required work is the matching independent DR render—not another LIVE recapture. Those include customer Payments, customer Invoices, customer Photos, customer invoice view, scheduling/deposit behavior, before/after photo controls, and the captured service catalog.

New LIVE visual capture is still required for owner refund modal/hold states, owner Invoices list/detail, Business, Templates, populated Payment History, customer standalone payment page, paid/zero-balance state, customer refund-processing state, change-request completion states, and expired/error links.

Do not mark any state `VERIFIED_IDENTICAL` from source inspection alone.

## DR capability boundary

The independent DR remains intentionally free-tier, D1-only, and no-R2.

- Photo UI can be compared with LIVE.
- Actual photo-file upload/archive/download is not functionally identical while no storage binding exists.
- Photo APIs must fail closed rather than pretend success.

## Safety boundaries

- LIVE production was not changed.
- Production DNS was not changed.
- Real customer data was not touched.
- The sealed v138 archive remains unchanged.
- Existing sealed-v138 TypeScript failures remain a known nonblocking deployment fact after a successful production build; do not report typecheck as passing unless it actually passes.
