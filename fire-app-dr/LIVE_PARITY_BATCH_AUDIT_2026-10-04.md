# FIRE DR — Extended LIVE Parity Audit Batch

Updated: 2026-10-05

Purpose: preserve the current DR-only parity state after the owner directed that the independent app mirror the current LIVE FIRE app rather than be redesigned.

This document is **not rendered proof** and does not change `NOT_YET_FULLY_VERIFIED` to `FULL_IDENTICAL`.

## Frozen / owner-confirmed areas

- Scroll/smoothness tuning is frozen at the owner's direction.
- Top mobile header is user-confirmed crisp and correctly inset after the standalone V11 safe-area correction.
- The accepted header fix removes the old compositing/softening treatment and keeps the top shell off the iPhone screen edge.
- Templates mobile selection/editing is user-confirmed working acceptably.
- DR Stride header control is acceptable.

## LIVE-evidence corrections applied

Stored LIVE approved-estimate evidence shows the signer name in the green signed confirmation. The DR staging overlay now preserves the signed name when available:

`Estimate approved and agreement signed by <signed name>. Kyle will contact you to schedule.`

The cumulative LIVE v107/v112 billing rules also require customer payment actions to be hidden while an unresolved overpayment or pending refund exists. The sealed v138 standalone payment page did not include `pendingRefundCount` and its `canPay` calculation did not exclude billing-review state. The DR overlay now:

- queries pending refund count on the standalone customer payment page;
- treats pending refunds and unresolved overpayments as payment-review holds;
- suppresses the secure-pay action during either hold;
- shows `Refund processing.` for a pending refund;
- shows `Payment received — account review in progress.` for an unresolved overpayment.

These corrections are applied after sealed-v138 extraction and are also synced into the checked-in DR source. The sealed archive remains unchanged.

## LIVE-captured states protected

The build guards protect the currently captured LIVE states and wording, including:

- Customer Payments empty state: `No payments recorded` plus Wave, Cash App, Venmo, cash, check, card, and bank-transfer wording.
- Customer Invoices empty state: `No invoices yet` and `Open an estimate and tap Create invoice.`
- Customer Photos controls: Photo type, Before / After / Property / damage, Optional note, Camera, Photo library, and the no-photo state.
- Scheduled estimate behavior: 50% deposit remains displayed but is not a scheduling gate after approval/signature.
- Scheduled next step: capture before photos, complete the job report, then create the invoice.
- Completion-before-final-balance transition: Completed exposes `Create invoice`; after creation the state becomes `Invoice created` and the message action becomes `Send invoice`.
- Customer invoice: INVOICE FOR, service lines, Invoice total, Balance due, due-on-receipt/specific-date treatment, manual Cash App/Venmo instructions, and floating Back/Home controls.
- Approved/signed customer estimate confirmation now retains the signer name when available.
- The complete LIVE-captured Create Estimate service catalog is guarded in exact order.

## Owner workflow coverage

Source guards now protect:

- Dashboard cards, recent estimates, quick actions, Notifications, Contracts, Customers, Follow-ups, Payments, Record payment, Job costs, and Service completion report.
- Customer action row, property preview, Messages, Notes, Payments, Invoices, and Photos states.
- Owner Invoices list, refund/payment-review states, and Open action.
- Edit final invoice controls, due-on-receipt vs specific date, percent/dollar discount, totals, and read-only invoice revision history.
- Business metrics, Tasks/reminders, Expenses, backup/restore controls, and Wave export.
- Message Templates categories, editor, unsaved-change warning, before-unload warning, save confirmation, and Restore Default confirmation.
- Refund modal/statuses and unresolved overpayment safeguards.

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

The DR preparation path now runs six source/governance parity guards after applying the DR overlays and before dependency install/build:

1. `scripts/verify-fire-dr-live-parity-overlays.py` — known LIVE-captured/user-confirmed shell, customer records, lifecycle, billing, completion-to-invoice, and document invariants.
2. `scripts/verify-fire-dr-owner-workflows.py` — owner Dashboard/Invoices/Business/Templates/refund/empty-state contracts.
3. `scripts/verify-fire-dr-live-service-catalog.py` — all 30 LIVE-captured Create Estimate service options in exact order.
4. `scripts/verify-fire-dr-live-evidence-coverage.py` — requires every formal state already marked LIVE `CAPTURED` to be explicitly mapped into current DR parity protection and runs the restore/lifecycle/refund/Stripe integrity subguards.
5. `scripts/verify-fire-dr-customer-workflows.py` — approval/signature, change requests, customer documents, payment/refund edge states, and no-R2 photo failure behavior.
6. `scripts/verify-fire-dr-parity-ledger-consistency.py` — formal evidence counts/status, queue/governance consistency, persistent-overlay synchronization, PIN/no-R2 rules, and current release verdict.

These guards prevent source/evidence-accountability regressions. They do **not** substitute for same-state rendered LIVE-vs-DR comparison.

## Current formal evidence status

The formal manifest remains authoritative:

- 32 release-gating parity entries.
- 11/32 LIVE evidence captured.
- 0/32 independent evidence formally registered.
- 0 VERIFIED_IDENTICAL comparisons.
- 0 recorded mismatches.

The evidence-coverage guard intentionally expects the current 11 LIVE-captured formal states. When new LIVE evidence is registered, the build stops until that new formal state is mapped into the DR parity protection.

Status remains:

`STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED`

`NOT_YET_FULLY_VERIFIED`

## Remaining rendered blockers

Major remaining comparisons include owner Invoices list/detail, populated payment history, Business, Templates, full approval/signature lifecycle, change request states, customer payment page, paid-in-full state, refund states, expired/not-found/error coverage, and broader owner empty/error states.

Do not mark these `VERIFIED_IDENTICAL` from source inspection alone.

## DR capability boundary

The independent DR remains intentionally free-tier, D1-only, and no-R2.

- Photo UI can be compared with LIVE.
- Actual photo-file upload/archive/download is not functionally identical while no storage binding exists.
- Photo APIs must fail closed with a clear unavailable response rather than pretend success.

## Safety boundaries

- LIVE production was not changed.
- Production DNS was not changed.
- Real customer data was not touched.
- The sealed v138 archive remains unchanged.
- Existing sealed-v138 TypeScript failures remain a known nonblocking deployment fact after a successful production build; do not report typecheck as passing unless it actually passes.
