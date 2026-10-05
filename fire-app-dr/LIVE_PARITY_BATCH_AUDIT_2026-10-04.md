# FIRE DR — Extended LIVE Parity Audit Batch

Updated: 2026-10-04

Purpose: record the longer source-level parity batch performed after the owner directed that scrolling/smoothness be left alone and that DR should mirror LIVE look, feel, and functionality as closely as possible.

This document is **not** rendered proof and does not change `NOT_YET_FULLY_VERIFIED` to `FULL_IDENTICAL`.

## Frozen area

- Scroll/smoothness tuning is frozen at the owner's direction.
- The parity verifier must not require a specific scroll-performance experiment or add new scrolling behavior.
- Future work should focus on LIVE look/feel/functionality and evidence capture.

## User-confirmed DR states preserved

- Templates mobile selection/editing flow is working acceptably.
- Top mobile header is acceptable after safe-area / opaque-status-bar corrections.
- DR Stride header control is acceptable.

## LIVE-captured visual/content states protected by build guard

- Customer profile Payments empty state:
  - `No payments recorded`
  - Wave, Cash App, Venmo, cash, check, card, bank transfer wording.
- Customer profile Invoices empty state:
  - `No invoices yet`
  - `Open an estimate and tap Create invoice.`
- Customer Photos controls:
  - Photo type selector
  - Before / After / Property / damage
  - Optional note
  - Camera / Photo library workflow
- Owner scheduled-job next step:
  - capture before photos
  - complete the job report
  - create the invoice
- Customer invoice structure:
  - `INVOICE FOR`
  - Invoice total
  - Balance due
  - Cash App / Venmo instructions
  - Back / Home customer portal navigation

## Source-level business/functionality parity audited and guarded

### Estimate lifecycle

- 50% deposit is calculated from the approved estimate total.
- Customer approval/signature is required before owner scheduling.
- Scheduling requires a date/time.
- Scheduling does **not** require the deposit to already be recorded, preserving the approved exception behavior.
- Accepted / financially active estimates are frozen from service-line rewrites; later price/scope changes belong on the final invoice.
- Job completion requires the scheduled stage and a completed job report.

### Customer estimate / payment behavior

- Customer estimate shows Estimate total and 50% deposit.
- Customer must approve/sign before reservation-deposit payment.
- Approved, non-completed work uses the remaining deposit obligation.
- Completed work uses the resolved final-invoice total / remaining balance.
- Pending refunds and unresolved overpayment exceptions suppress new normal payment flow.
- Customer account-review wording is retained during unresolved billing review.
- Back / Home customer-document navigation remains available.

### Final invoice behavior

- Final invoice can only be created after job completion.
- One invoice per estimate is preserved.
- Invoice starts from the estimate service-line snapshot.
- Recorded payments determine Draft / Partial / Paid initial invoice state.
- Invoice edits can change line items, discounts, and due date.
- Invoice total cannot be reduced below recorded paid amount.
- Each invoice edit records a read-only revision before applying the change.
- Sent/viewed state is preserved through edits when unpaid.
- Active Stripe checkout sessions are expired/reconciled before invoice amount changes.
- Pending refund blocks invoice editing until reconciliation completes.

### Manual payment behavior

- Approved/scheduled jobs collect only the reservation-deposit obligation.
- Completed jobs collect against the resolved final-invoice obligation.
- Unresolved overpayment exception blocks another payment.
- Pending refund blocks another payment.
- Manual payment insert is guarded at database-write time against stale/concurrent overpayment.
- The payment total / remaining balance is re-read after insertion.

### Refund behavior

- Refund request is linked to the original payment and estimate.
- Refund amount cannot exceed the remaining refundable amount.
- Stripe refund calls use an idempotency key tied to the FIRE refund request ID.
- Manual-method refunds require explicit confirmation that money was returned externally before FIRE records the negative ledger entry.
- Successful refund writes one negative `Refund` payment row and reconciles invoice status.
- Successful reconciliation can clear the matching unresolved overpayment exception when the net paid amount is no longer above the obligation.
- Pending/succeeded refund state is durable in `payment_refunds`.

### Templates

- Owner can load saved template overrides.
- Owner can save edited subject/body values.
- Owner can Restore Default by deleting the override.
- Empty template body is rejected.
- User-confirmed mobile template selection/editing behavior remains protected by the DR overlay.

### Review-request safety

- Normal review-request action is suppressed while a refund is pending.
- Normal review-request action is suppressed while an overpayment exception is unresolved.
- Review action only appears for a completed, fully paid, safe-accounting job.

## Build guard

`scripts/verify-fire-dr-live-parity-overlays.py` is executed by `scripts/prepare-fire-v138-dr-no-r2.sh` after DR overlays are applied and before dependency install/build.

The guard now protects the above known parity contracts from accidental regression. It intentionally does not claim that visual pixel parity has been proven.

## Still pending for strict rendered parity

The formal evidence ledger remains authoritative. Major items still needing actual same-state LIVE vs independent rendered comparison include, among others:

- populated owner Payments history
- owner Invoices list
- owner invoice detail/edit/revision states
- Business screen
- Templates screen exact visual comparison
- customer approval/signature flow rendered comparison
- customer payment page rendered comparison
- paid-in-full / zero-balance customer states
- owner refund modal / refund processing state
- customer refund-processing state
- expired/error-link states
- broader owner empty/error state coverage

Do not mark these `VERIFIED_IDENTICAL` from this source audit alone.

## Safety boundaries retained

- LIVE production deployment was not changed by this batch.
- Production DNS was not changed.
- Real customer data was not touched.
- The sealed v138 archive remains unchanged.
- DR remains D1-only / no R2; photo-storage capability must not be represented as working until an appropriate storage binding exists.
- Existing typecheck failures from the sealed v138 source remain a known nonblocking deployment fact; this batch does not claim typecheck passes.
