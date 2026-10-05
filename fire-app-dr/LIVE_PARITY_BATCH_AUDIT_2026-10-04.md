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
- Top mobile header is user-confirmed crisp and correctly inset after the standalone V11 safe-area correction.
- The accepted header fix removes the old compositing/softening treatment and keeps the top shell off the iPhone screen edge.
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
  - No-property-photos empty state
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

## Source-level look/feel structure audited and guarded

### Owner navigation and shell

- Owner navigation retains Dashboard, Contracts, Customers, Estimates, Follow-ups, Schedule, Invoices, Business, Payments, and Templates.
- Mobile top actions retain Back, Home, Theme, and Menu controls.
- Bottom mobile navigation retains Home, Contracts, Customers, Estimates, and Schedule.
- Light/dark theme preference remains stored in local browser storage and reapplied through the document theme data attribute.
- Search remains available for customers/jobs/addresses and mobile menu search remains available.
- The user-confirmed standalone header uses the V11 safe-area treatment and explicitly avoids `translate3d`/paint-containment softening on the top shell.

### Customer records

- Customer profile retains jobs/estimates, paid total, open balance, current stage, and Continue current job summary.
- Customer profile tabs remain Estimates, Payments, Invoices, Photos, Messages, and Notes.
- Phone, text, email, Google Maps, Stride, Google Earth, Zillow, and property preview actions remain in the customer workflow when data is available.

### Estimate pipeline / schedule / invoice owner states

- Estimate pipeline retains New quotes, Follow up, Approved, Scheduled, Completed, Paid, and Lost columns.
- Schedule retains Needs attention and Upcoming jobs sections.
- Owner invoice list keeps Payment review / Billing exception open states for unresolved overpayment cases.
- Owner invoice list keeps Refund processing / Refund pending states while a refund is still pending.

## Source-level business/functionality parity audited and guarded

### Estimate pricing and creation

- Multi-service estimate creation remains available with Add another service.
- Standard 5% First Responder & Military appreciation discount remains separate.
- Additional discount supports Percentage or Dollar amount.
- Percentage stacking is constrained to the governed maximum.
- $150 minimum job charge remains enforced.
- 50% deposit is calculated from the final estimate total.
- Estimate creation retains the two-step Customer details → Services and pricing flow.

### Estimate lifecycle

- Customer approval/signature is required before owner scheduling.
- Scheduling requires a date/time.
- Scheduling does **not** require the deposit to already be recorded, preserving the approved exception behavior.
- Accepted / financially active estimates are frozen from service-line rewrites; later price/scope changes belong on the final invoice.
- Job completion requires the scheduled stage and a completed job report.

### Customer approval / signature / change request

- Customer approval requires selected photo permission, typed full name, and explicit acceptance of the service agreement/payment terms.
- Approval records `accepted_at`, `signed_name`, `signed_at`, photo permission, and the governed contract version.
- Approval is idempotent when the estimate was already accepted.
- Draft/sent estimates with invalid billing or service-line data fail closed rather than being approved.
- Customer approval creates the owner `estimate_accepted` notification.
- Before approval, the customer can submit a change request from the estimate portal.
- Change requests create both an open `estimate_change_requests` record and an owner notification.
- Once the estimate has entered the accepted/job workflow, the public change-request endpoint refuses a new pre-approval change request and directs the customer to contact Kyle.

### Customer estimate / payment behavior

- Customer estimate shows Estimate total and 50% deposit.
- Customer must approve/sign before reservation-deposit payment.
- Approved, non-completed work uses the remaining deposit obligation.
- Completed work uses the resolved final-invoice total / remaining balance.
- Pending refunds and unresolved overpayment exceptions suppress new normal payment flow.
- Customer account-review wording is retained during unresolved billing review.
- Successful payment state says the payment was received and recorded.
- Paid-in-full state is distinct from reservation-deposit-recorded state.
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
- Customer invoice fails closed with Billing review required when the stored billing snapshot is unsafe.
- Customer invoice distinguishes Refund processing, Payment received — account review in progress, and Paid in full.

### Manual payment behavior

- Approved/scheduled jobs collect only the reservation-deposit obligation.
- Completed jobs collect against the resolved final-invoice obligation.
- Unresolved overpayment exception blocks another payment.
- Pending refund blocks another payment.
- Manual payment insert is guarded at database-write time against stale/concurrent overpayment.
- The payment total / remaining balance is re-read after insertion.

### Refund / overpayment behavior

- Refund request is linked to the original payment and estimate.
- Refund amount cannot exceed the remaining refundable amount.
- Stripe refund calls use an idempotency key tied to the FIRE refund request ID.
- Manual-method refunds require explicit confirmation that money was returned externally before FIRE records the negative ledger entry.
- Successful refund writes one negative `Refund` payment row and reconciles invoice status.
- Successful reconciliation can clear the matching unresolved overpayment exception when the net paid amount is no longer above the obligation.
- Pending/succeeded refund state is durable in `payment_refunds`.
- Overpayment exceptions cannot be generically resolved; refund handling must happen through Payments → Refund on the original payment.
- Intentional retained overpayment is a separate explicit action.
- Pending refund blocks retained-overpayment resolution.
- The retained-overpayment action rechecks the current billing state before resolving the exception.

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

### DR photo-storage boundary

- Independent DR deliberately has no R2 binding.
- Customer photo upload API explicitly returns `503 Photo storage is unavailable.` when `BUCKET` is absent.
- Image-only validation and the 15 MB upload limit remain present if storage is ever bound later.
- If metadata insertion fails after an object upload, the uploaded object is deleted to avoid orphan storage.
- This DR build must not be represented as having working photo-file storage while the R2 binding is absent.

## Build guards

The DR preparation script runs four source/governance parity guards after applying DR overlays and before dependency install/build:

1. `scripts/verify-fire-dr-live-parity-overlays.py` — known LIVE-captured/user-confirmed screens, the user-confirmed top shell, and core billing/lifecycle invariants.
2. `scripts/verify-fire-dr-owner-workflows.py` — already-matched owner surfaces plus Business, Templates, invoice edit/history, refund UI, restore UI, billing-exception states, and common owner empty states.
3. `scripts/verify-fire-dr-customer-workflows.py` — signature/photo permission approval, change requests, customer payment/invoice edge states, overpayment safeguards, and DR photo-storage fail-closed behavior.
4. `scripts/verify-fire-dr-parity-ledger-consistency.py` — formal evidence counts/status, queue/governance consistency, free D1-only/no-R2 deployment rules, and persistent overlay synchronization.

These guards prevent accidental source regressions. They intentionally do **not** claim pixel-identical rendered parity.

## Still pending for strict rendered parity

The formal evidence ledger remains authoritative. Major items still needing actual same-state LIVE vs independent rendered comparison include, among others:

- populated owner Payments history
- owner Invoices list
- owner invoice detail/edit/revision states
- Business screen
- Templates screen exact visual comparison
- customer approval/signature flow rendered comparison
- customer change-request states
- customer payment page rendered comparison
- payment-success state
- paid-in-full / zero-balance customer states
- owner refund modal / refund processing state
- customer refund-processing state
- overpayment-review customer/owner states
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
