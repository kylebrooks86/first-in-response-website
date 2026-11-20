# LIVE FIRE App — cumulative v55 sync queue

Apply these approved shared changes to the current LIVE FIRE business app in one pass. This file supersedes all earlier LIVE sync queues/prompts (v34 through v54).

Preserve the current LIVE FIRE design, customer data, estimates, payments, pricing, navigation, authentication, and database records except for schema additions strictly required by these approved features.

## Approved shared changes
1. Add **View invoice** after an invoice exists. Customer view remains the estimate; View invoice opens the private invoice page.
2. **Send invoice** must open with **Invoice ready** selected by default.
3. Keep the current customer invoice document structure: Invoice total + Balance due, due on receipt or specific due date, Cash App/Venmo instructions, and current footer wording.
4. Additional estimate discount can switch between **Percentage** and **Dollar amount**. Keep the separate 5% First Responder & Military appreciation discount.
5. Create/Edit Estimate use the same multi-service and discount model.
6. Final invoice is editable after creation: add/remove last-minute services, edit descriptions, quantities/unit prices, discounts, and due date.
7. Invoice edits must not rewrite accepted estimates or recorded payments, and may not reduce the invoice total below recorded paid amount.
8. Preserve invoice delivery/payment state through edits: sent/viewed unpaid stays Sent; partial stays Partial; paid stays Paid; only never-sent/unviewed unpaid stays Draft.
9. Before each invoice edit, retain a read-only invoice revision including line items, discount, total, status, and due date. Include revision history in backup/restore while keeping older valid backups compatible.
10. Owner scheduling may proceed without deposit for exceptions. Keep customer-facing wording that a 50% deposit normally reserves the service date.
11. Once a final invoice exists, every completed-job owner balance/profit/follow-up/payment calculation must use the final invoice total rather than the original estimate total.
12. Completed customer payment pages must collect the final remaining balance, never a reservation deposit.
13. Stripe confirmation must mark Paid/Partial against the final invoice total.
14. Track active Stripe Checkout sessions. Expire older open sessions before a new checkout and before final-invoice edits. Block edits/new checkouts if a payment is already processing and cannot be safely expired.
15. Persist checkout-session state in backup/restore while keeping older backups compatible.
16. If a rare race produces an overpayment, preserve the real charge and create an owner billing-exception notification instead of discarding it.
17. Fix manual **Record payment** response math so the returned remaining balance uses the resolved amount due/final invoice total after final-invoice edits.
18. Add explicit billing-exception resolution state for overpayment alerts. Reading an alert must not resolve it.
19. Show **Overpayment needs review** on the owner job detail until the refund/credit has actually been handled, then allow **Mark billing exception resolved**.
20. While an overpayment exception is unresolved, suppress normal review-request and repeat-marketing recommendations and prioritize the billing exception as the next step.
21. Include notification `resolved_at` state in backup/restore and keep older backups without that field restorable.
22. Harden overpayment resolution so the owner action targets unresolved `payment_overage` exceptions by estimate/job instead of searching only the latest notification list. Resolve one exception at a time and return the true remaining unresolved count so multiple overpayment exceptions cannot be hidden prematurely.
23. Make the customer Stripe success/redirect fallback idempotent at insertion time: use a provider-session guarded payment insert (`WHERE NOT EXISTS` for the Stripe session/provider ID), and if already recorded, do not create a second payment or duplicate payment/overpayment notifications. Keep tracked checkout-session status synchronized to paid.

24. Reconcile Stripe overpayment races against the obligation for the actual payment mode: **deposit** sessions compare against the remaining reservation deposit, while **balance** sessions compare against the remaining edited final invoice total. Apply this consistently in both the signed webhook and customer success/redirect fallback. If a stale/second deposit exceeds the remaining deposit due, preserve the real charge and create the owner billing exception even if total payments are still below the full job total. Use customer/owner exception wording based on the **current amount due**, not always “invoice balance.”

## Required schema addition
- Add nullable `resolved_at` to `notifications` with an index supporting type/estimate/resolution lookups.

## Safety / regression requirements
- Never alter or delete existing recorded payments.
- Never silently treat reading a notification as resolving a billing exception.
- Never make billing-exception resolution depend on the latest-notification display limit; older unresolved exceptions must remain resolvable.
- Never allow an invoice total below recorded paid amount.
- Never leave two active Stripe checkout links for different amounts on the same job.
- Do not send a review request while an overpayment exception is unresolved.
- Preserve Cash App `$FIREExteriors` and Venmo `@FirstInResponseExteriors`.
- Preserve the current dark navy/red FIRE design.
- Keep Stripe webhook idempotency and signature verification intact.
- Keep the customer redirect confirmation path idempotent against repeated/concurrent confirmation of the same Stripe Checkout Session.
- Never evaluate a deposit-session overpayment against the full job total; use the remaining deposit obligation for deposit sessions and the remaining final invoice obligation for balance sessions.

25. Make manual **Record payment** race-safe at database write time. The insert must succeed only when the submitted amount still fits within the job's current obligation at the instant of insertion: reservation deposit for approved/scheduled jobs, edited final invoice total for completed jobs. If another payment changed the amount due first, reject the stale submission and require the owner to refresh rather than recording an overpayment. After a successful insert, re-read the paid total/current obligation before returning the remaining balance and updating invoice payment status.

## Additional v55 safety requirement
- Never rely only on a pre-insert balance read for manual payments; concurrent owner submissions must not jointly exceed the current amount due.

## v56 — Single Open Stripe Checkout Concurrency Hardening

Apply this section in addition to every earlier item already retained above. This queue remains cumulative; applying v56 supersedes the need to separately apply older queue files.

- Add migration `drizzle/0015_single_open_checkout.sql`.
- Before adding the invariant, normalize any legacy duplicate `open` `payment_checkout_sessions` rows per estimate to `expired` so migration can succeed on an existing database.
- Add a partial UNIQUE index on `payment_checkout_sessions(estimate_id)` for rows where `status='open'`.
- Preserve the existing checkout behavior that expires a newly-created Stripe session if its tracking INSERT fails. With the unique index, a racing second checkout-start request therefore cannot return a second active payment link for the same estimate.
- Preserve all v51-v55 overpayment, idempotency, final-invoice, manual-payment concurrency, backup/restore, and billing-exception behavior.
- Update the independent/LIVE release manifest to v56 and include the new migration in shared-core fingerprint coverage.
- Do not claim full visual parity. LIVE evidence remains 11/29 and independent rendered evidence remains 0/29 until actual rendered comparisons are completed.

### v56 verification

- Release readiness: 114/114 PASS
- Independent preflight: 37/37 PASS
- Shared-core fingerprint: 63 files PASS
- Shared-core SHA256: `84bc106d22b83a115f0dce8a9321c162b224145d58f70497d1c044c90865289f`
- Strict parity: `NOT_YET_FULLY_VERIFIED`

## v57 — Stripe stale-open checkout reconciliation hardening

Apply after all earlier cumulative items in this file.

- In `app/api/payments/checkout/route.ts`, add authoritative Stripe-state reconciliation when expiring an already tracked open Checkout Session.
- If Stripe's expire request does not succeed, retrieve that Checkout Session from Stripe before treating it as still active.
- If Stripe reports the session is already `expired`, accept that authoritative state and update the local `payment_checkout_sessions` row from `open` to `expired` before creating the replacement checkout.
- Do not treat `complete` or other non-expired remote states as safely replaceable; preserve the existing wait/reconciliation behavior for those states.
- Preserve the v56 one-open-session database invariant and all v34-v56 safeguards.
- Add the v57 release-readiness assertion covering stale-open reconciliation.

Purpose: prevents a remote-success/local-write-failure split from leaving a dead Stripe checkout represented locally as permanently open, which could otherwise block replacement payment links.

## v58 — Invoice-edit Stripe stale-open reconciliation + package completeness hardening

This section is cumulative on top of every prior item in this queue.

- In `app/api/invoices/[id]/route.ts`, when an invoice edit needs to invalidate an open Stripe Checkout Session, do not permanently block merely because Stripe's expire endpoint reports the session is no longer expirable.
- Re-read the Checkout Session from Stripe. If Stripe reports `status=expired`, reconcile the local `payment_checkout_sessions` row to `expired` and allow the safe invoice edit to continue.
- If Stripe cannot be inspected or still reports a non-expired session, keep the existing 409 safety block.
- Preserve all v57 checkout-creation reconciliation, v56 single-open-session enforcement, v55 manual-payment concurrency protection, and all earlier cumulative changes.
- Ensure the independent disaster-recovery release package retains the strict-parity photo fixture and validates required recovery/parity assets before a release ZIP is accepted.
- Do not mark full LIVE visual parity verified until rendered independent-side comparisons are actually completed.

## v59 — Stripe return type-contract + release typecheck hardening

This section is cumulative on top of every prior item in this queue.

- In `app/estimate/[token]/page.tsx`, make the `confirmPayment` estimate contract explicitly include `depositCents`, because deposit-mode overpayment reconciliation reads that value.
- Preserve the v54 deposit-vs-balance obligation boundary in the customer Stripe success/redirect fallback.
- Add a release-readiness regression assertion that prevents `depositCents` from being removed from that reconciliation contract while still being used.
- Add a `typecheck` package script (`tsc --noEmit`) so dependency-complete build environments have an explicit compiler gate in addition to source-policy checks.
- Advance package/release metadata to v59; do not leave the disaster-recovery package reporting an older RC version.
- Preserve every v34-v58 cumulative safeguard and do not claim full visual parity before rendered comparisons are complete.

## v60 — Customer invoice unresolved-overpayment paid-in-full suppression

Apply after all earlier cumulative items in this file.

- In `app/invoice/[token]/page.tsx`, query the count of unresolved `payment_overage` notifications for the invoice estimate.
- While any billing exception remains unresolved, do not render the normal customer-facing `Paid in full` due-state merely because raw paid cents meet/exceed the invoice total.
- Render the neutral customer message `Payment received — account review in progress` until the owner explicitly resolves the billing exception after the refund/credit is handled.
- Preserve the existing owner-only overpayment detail and explicit resolution workflow; do not expose internal refund/credit handling details to the customer.
- Add/retain the release-readiness regression check for this state.

Do not redesign unrelated UI, pricing, customer records, workflows, navigation, authentication, or database behavior.

## v61 — Owner invoice unresolved-overpayment state alignment

Apply after all earlier cumulative items in this file.

- In `app/api/invoices/route.ts`, include the unresolved `payment_overage` count for each invoice estimate as `paymentOverageOpen`.
- In owner invoice lists, when `paymentOverageOpen > 0`, do not present the invoice as normally `Paid` or as a routine `$0 balance` settlement state.
- Show an owner-facing `Payment review` status and `Billing exception open` detail until the exception is explicitly resolved after the refund/credit is handled.
- In customer-record invoice history, show `Payment review in progress` for the same unresolved state.
- Preserve the actual recorded payment totals and invoice totals; this is a workflow/status safeguard, not a financial-data rewrite.
- Preserve v60 customer-facing neutral review state, v51 explicit resolution semantics, and all earlier cumulative safeguards.
- Add the release-readiness regression assertion for owner invoice overpayment state.
- Do not claim full visual parity until rendered independent-side comparisons are complete.

## v62 — Customer payment-page overpayment-state & manifest consistency hardening
- On `app/pay/[id]/page.tsx`, include the unresolved `payment_overage` count for the estimate.
- While an unresolved overpayment exception exists, do not display the normal `This job is paid in full.` state on the customer payment page; display the neutral `Payment received — account review in progress.` state instead.
- Preserve the existing explicit owner resolution workflow; reading/viewing customer pages must not resolve the exception.
- Correct release-manifest metadata so the current recovery release/version fields identify v62; regenerate shared-core hashes/fingerprint after synchronized source changes.
- Do not change unrelated customer data, pricing, workflows, navigation, authentication, database behavior, or visual design.


## v63 — Unresolved Overpayment Checkout Lock Hardening
- `app/api/payments/checkout/route.ts`
  - Before creating or replacing any Stripe Checkout Session, query for an unresolved `payment_overage` notification for the estimate.
  - If one exists, return HTTP 409 and require the owner to resolve the refund/credit billing exception before another deposit or balance card payment can begin.
  - This closes the case where a deposit overpayment remained unresolved but the later completed-job balance path could still create another Checkout Session.
- `scripts/release-readiness.mjs`
  - Adds a regression gate requiring the unresolved-overpayment checkout lock.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance independent recovery release metadata to v63 / `1.0.0-rc.63`.


## v64 — Manual Payment Billing-Exception Lock Hardening
- `app/api/payments/route.ts`
  - Before accepting an owner-recorded payment, check for an unresolved `payment_overage` notification on the estimate.
  - Return HTTP 409 while the refund/credit exception remains unresolved.
  - This aligns manual Record payment with the v63 Stripe Checkout lock so no new-payment path can add money while billing reconciliation is pending.
- `scripts/release-readiness.mjs`
  - Adds regression coverage for the manual-payment billing-exception lock.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery release metadata to v64 / `1.0.0-rc.64`.


## v65 — Overpayment Resolution API Bypass Hardening
- `app/api/notifications/route.ts`
  - Generic `{id, resolve:true}` notification resolution now loads the notification type first.
  - `payment_overage` returns HTTP 409 from the generic path and must use the dedicated estimate-scoped `resolveOverpayment` action.
  - Prevents direct API calls from bypassing the owner billing-exception workflow.
- `scripts/release-readiness.mjs`
  - Adds regression coverage proving the generic resolution path cannot clear an overpayment.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery release metadata to v65 / `1.0.0-rc.65`.


## v66 — Refund Adjustment Reconciliation Hardening
- `app/api/notifications/route.ts`
  - Dedicated overpayment resolution now requires `resolutionMode` of `refund` or `credit`.
  - Refund resolution requires the actual refund amount, writes a negative paid `Refund adjustment` row, and recomputes invoice status from the new net paid total before resolving the alert.
  - Refund adjustment is idempotency-tagged to the alert via `refund-adjustment:<alert id>`.
  - Credit resolution preserves the payment ledger but explicitly resolves the billing exception as handled credit.
- `app/dashboard.tsx`
  - Replaces the ambiguous single resolve button with explicit `Refund handled` and `Credit handled` actions.
  - Refund handling requires the actual refund amount and refreshes the owner-side paid total from the API response.
- `scripts/release-readiness.mjs`
  - Adds regression coverage for refund-adjustment reconciliation and invoice-status recomputation.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery release metadata to v66 / `1.0.0-rc.66`.


## v67 — Billing Exception Resolution Audit Persistence
- `drizzle/0016_notification_resolution_note.sql`
  - Adds nullable `notifications.resolution_note` for durable billing-exception outcome history.
- `db/schema.ts`
  - Adds `resolutionNote` to the notifications schema.
- `app/api/notifications/route.ts`
  - Refund resolution stores `refund:<amountCents>` with the resolved alert.
  - Customer-credit resolution stores `credit`.
  - Notification reads expose the resolution note for future owner audit/history UI.
- `app/api/backup/route.ts`
  - Includes `resolution_note` in notification restore columns so the outcome survives backup/restore.
- `scripts/release-readiness.mjs`
  - Adds regression gates for resolution-outcome persistence and backup/restore coverage.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery metadata to v67 / `1.0.0-rc.67`.
  - Shared-core fingerprint expands to 64 files because the new migration is now fingerprinted.


## v68 — Partial Refund Exception-Resolution Hardening
- `app/api/notifications/route.ts`
  - Refund reconciliation now calculates the net paid ledger after the proposed refund.
  - If net paid would still exceed the current final invoice total, resolution returns HTTP 409 and leaves the billing exception open.
  - The owner must enter enough refund to clear the excess, or intentionally settle the remainder as customer credit.
  - Prevents a partially reconciled overpayment from being mislabeled as resolved and re-enabling normal paid-in-full/review/payment workflows.
- `scripts/release-readiness.mjs`
  - Adds a regression gate proving partial refunds cannot falsely resolve an overpayment.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery metadata to v68 / `1.0.0-rc.68`.


## v69 — Retained Overpayment Semantics Hardening
- `app/api/notifications/route.ts`
  - Replaces the unsupported `credit` resolution mode with `keep`.
  - Stores `kept_overpayment` as the durable resolution outcome.
  - Does not create or imply a reusable customer-credit balance.
- `app/dashboard.tsx`
  - Replaces **Credit handled** with **Keep as overpayment**.
  - Clearly states that this preserves the excess on the job and does not create reusable customer credit.
  - Follow-up and billing-exception wording now says refund or retained overpayment.
- `scripts/release-readiness.mjs`
  - Adds a regression gate preventing retained overpayments from being mislabeled as customer credits.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery metadata to v69 / `1.0.0-rc.69`.


## v70 — Stripe Overpayment Messaging Alignment
- `app/api/payments/webhook/route.ts`
- `app/estimate/[token]/page.tsx`
  - Replace stale “refund or credit” overpayment alert language with the supported choices: refund the excess or intentionally keep it as an overpayment on this job.
  - Keeps webhook and customer-return fallback notifications consistent with v69 and avoids implying a reusable customer-credit ledger.
- `scripts/release-readiness.mjs`
  - Adds a regression gate requiring both Stripe reconciliation paths to use supported retained-overpayment semantics.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery metadata to v70 / `1.0.0-rc.70`.


## v71 — Multi-Alert Overpayment Reconciliation Hardening
- `app/api/notifications/route.ts`
  - Once a refund fully reconciles the job-level overpayment, resolve all currently open `payment_overage` alerts for that estimate in the same batch.
  - `Keep as overpayment` likewise resolves the full current overpayment alert set for the estimate.
  - Prevents stale sibling alerts from falsely keeping Stripe/manual payments and paid/review workflows locked after the accounting issue has actually been settled.
  - Updates the generic overpayment-resolution error wording to `refund or retained overpayment`.
- `scripts/release-readiness.mjs`
  - Adds regression coverage for sibling-alert cleanup after completed reconciliation.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery metadata to v71 / `1.0.0-rc.71`.


## v72 — Refund Reconciliation Race Hardening
- `app/api/notifications/route.ts`
  - The guarded refund-adjustment row is authoritative during concurrent/retried **Refund handled** actions.
  - Overpayment alerts only resolve when the persisted refund adjustment matches the requested refund amount.
  - A losing concurrent request with a different amount returns HTTP 409 instead of stamping its amount into resolution history.
  - Invoice status is recomputed directly from the current payment ledger after the guarded insert instead of using pre-insert request math.
  - The returned `paidCents` is refreshed from the database after reconciliation.
- `scripts/release-readiness.mjs`
  - Updates the refund-resolution regression to require ledger-derived invoice status.
  - Adds a regression gate for concurrent refund-resolution authority.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery metadata to v72 / `1.0.0-rc.72`.


## v73 — Final Invoice Owner Workflow Classification
- `app/dashboard.tsx`
  - Pipeline Paid/Completed and other payment-state classification now compares `paidCents` to `resolvedBillingTotalCents(row)`, which uses the final edited invoice total when present.
  - Pipeline column dollar totals use the resolved final billing total.
  - Calendar/Needs attention no longer treats the stale estimate total as the completed-job balance authority.
  - Needs attention displays `billingBalanceCents(job)` so edited final invoices drive the amount due.
  - Prevents jobs from appearing paid too early or outstanding after the final invoice was edited.
- `scripts/release-readiness.mjs`
  - Adds a regression gate requiring owner pipeline and Needs attention to use final billing totals.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery metadata to v73 / `1.0.0-rc.73`.


## v74 — Final Invoice Owner Amount Display Alignment
- `app/dashboard.tsx`
  - Pipeline job-card amount, estimate-list amount, customer estimate/job history, and job-detail header now display `resolvedBillingTotalCents(estimate)`.
  - **High value** classification now uses the resolved final billing total.
  - Keeps owner-facing dollar displays consistent with v73 workflow classification and the editable final invoice.
- `scripts/release-readiness.mjs`
  - Adds regression coverage requiring owner job summaries to display the final billing total.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery metadata to v74 / `1.0.0-rc.74`.


## v75 — Post-Invoice Dashboard and Messaging Alignment
- `app/dashboard.tsx`
  - Main dashboard recent-job price now displays the resolved final billing total.
  - Customer message-template `total` uses the resolved final billing total, preventing post-job messages from quoting a stale pre-edit estimate amount.
  - Synthetic customer aggregates created from a job detail/follow-up now use the resolved billed value.
  - Original estimate editor and agreement/signature displays intentionally retain estimate totals; v75 does not rewrite historical quote semantics.
- `scripts/release-readiness.mjs`
  - Adds regression coverage separating post-invoice billing surfaces from original estimate/agreement semantics.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery metadata to v75 / `1.0.0-rc.75`.


## v76 — Customer Billed-Value Aggregate Alignment
- `app/api/customers/route.ts`
  - Customer `estimateTotal` aggregate now sums each job's final invoice total when an invoice exists, falling back to the original estimate total otherwise.
  - Prevents the customer list lifetime-dollar figure from disagreeing with edited final invoices and owner job/billing surfaces.
  - Estimate count and original estimate records remain unchanged.
- `scripts/release-readiness.mjs`
  - Adds the customer API to source-gate coverage and verifies final-invoice-aware customer aggregation.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery metadata to v76 / `1.0.0-rc.76`.


## v77 — Scheduled Job Billing-Value Alignment
- `app/dashboard.tsx`
  - Upcoming jobs/schedule board now displays `resolvedBillingTotalCents(job)`.
  - If a scheduled job has an edited invoice, the operational board no longer shows the stale original estimate amount.
  - Scheduling state, dates, accepted estimate/agreement values, and database behavior are unchanged.
- `scripts/release-readiness.mjs`
  - Adds a regression gate for final-invoice-aware schedule-board values.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery metadata to v77 / `1.0.0-rc.77`.


## v78 — Home Outstanding Invoiced-Balance Alignment
- `app/page.tsx`
  - Home Outstanding summary now detects invoices on approved/scheduled jobs.
  - Before invoicing, approved/scheduled jobs retain the existing deposit-only outstanding behavior.
  - Once invoiced, the home metric uses the final invoice total minus paid payments, matching Payments and final billing behavior.
  - Completed-job behavior remains final-invoice-aware.
- `scripts/release-readiness.mjs`
  - Adds a regression gate requiring the home outstanding metric to switch to invoice balance after invoicing.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery metadata to v78 / `1.0.0-rc.78`.


## v79 — Live Dashboard Metric Refresh
- `app/api/dashboard-summary/route.ts` (new)
  - Adds an owner-authenticated summary endpoint for estimates, open estimate value, and outstanding billing balance.
  - Uses the same invoice-aware outstanding semantics as the server-rendered Home page.
- `app/dashboard.tsx`
  - Returning to Dashboard now refreshes summary metrics from `/api/dashboard-summary` with `no-store`.
  - Prevents invoice edits and recorded payments from leaving Home Outstanding stale until a full browser reload.
  - Existing navigation and mutation workflows remain unchanged.
- `scripts/release-readiness.mjs`
  - Adds source coverage and a regression gate for live Home metric refresh.
- `FIRE_UNIFIED_RELEASE.json`
  - Adds the new dashboard-summary route to shared-core fingerprint coverage (65 files).
- `package.json` / release metadata
  - Advance recovery build to v79 / `1.0.0-rc.79`.


## v80 — Coherent Live Dashboard Snapshot Refresh
- `app/api/dashboard-summary/route.ts`
  - Summary endpoint now returns the same eight recent estimate/job records used by the server-rendered Home page, including current paid amount and final invoice identifiers/totals.
  - Metrics and recent records are fetched together as one current owner snapshot.
- `app/dashboard.tsx`
  - Returning to Dashboard now refreshes both `liveMetrics` and `estimateRows`.
  - Prevents a freshly corrected Outstanding metric from appearing beside stale recent-job amounts/statuses from the initial page load.
  - No navigation, authentication, pricing, scheduling, or mutation behavior changed.
- `scripts/release-readiness.mjs`
  - Strengthens the v79 refresh regression gate to require a coherent metrics + recent-record snapshot.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery build to v80 / `1.0.0-rc.80`.


## v81 — Refund Invoice-Status Atomicity Hardening
- `app/api/notifications/route.ts`
  - Overpayment refund reconciliation no longer recalculates invoice status by re-summing payments inside the same batch that inserts the negative refund adjustment.
  - Invoice status now uses the already validated post-refund `paidCents` amount directly.
  - Prevents a refunded invoice from remaining incorrectly marked `paid` if same-batch reads observe the pre-refund payment sum.
  - Existing refund amount validation, idempotent refund-adjustment provider ID, notification resolution, and retained-overpayment path remain unchanged.
- `scripts/release-readiness.mjs`
  - Adds a regression gate requiring invoice status to be derived from validated post-refund payment state.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery build to v81 / `1.0.0-rc.81`.


## v82 — Refund Reconciliation Retry Convergence
- `app/api/notifications/route.ts`
  - Refund adjustment insertion is completed and verified before invoice status is reconciled.
  - The persisted paid total is re-read after the idempotent adjustment insert.
  - Invoice status is then derived from that persisted post-adjustment total.
  - Repeated or concurrent refund-resolution attempts therefore converge on database truth instead of potentially using a stale pre-insert `paidCents` calculation.
  - Notification resolution still requires the matching persisted refund adjustment.
- `scripts/release-readiness.mjs`
  - Strengthens the refund regression gate to require persisted-state re-read before invoice-status reconciliation.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery build to v82 / `1.0.0-rc.82`.


## v83 — Manual Deposit Invoice-Lifecycle Isolation
- `app/api/payments/route.ts`
  - Recording a manual payment on an approved/scheduled job still follows the existing reservation-deposit due limit.
  - Such deposit payments no longer force an existing draft/sent invoice to `partial`.
  - Invoice paid/partial/draft/sent reconciliation now runs from this route only when the refreshed job status is `completed`.
  - Completed-job manual payments still use the final invoice total and persisted paid amount.
- `scripts/release-readiness.mjs`
  - Adds a regression gate preventing pre-completion manual deposits from mutating invoice lifecycle status.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery build to v83 / `1.0.0-rc.83`.


## v84 — Stripe Deposit Invoice-Lifecycle Isolation
- `app/api/payments/webhook/route.ts`
  - Webhook estimate lookup now includes job status.
  - Stripe reservation deposits no longer force an existing draft/sent invoice into `partial`.
  - Invoice status is reconciled only when the job is completed or the Checkout Session is a balance payment.
  - Completed/balance payment reconciliation uses the invoice's own total and preserves draft/sent fallback semantics when no amount is paid.
- `app/estimate/[token]/page.tsx`
  - Customer-return fallback confirmation applies the same invoice-lifecycle rule as the webhook path.
  - Prevents fallback confirmation from behaving differently than webhook confirmation.
- `app/api/payments/route.ts`
  - Aligns unresolved-overpayment wording with the supported refund/retained-overpayment workflow.
- `scripts/release-readiness.mjs`
  - Adds a cross-path regression gate requiring Stripe deposit lifecycle isolation.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery build to v84 / `1.0.0-rc.84`.


## v85 — Concurrent Stripe Overpayment Ledger Reconciliation
- `app/api/payments/webhook/route.ts`
  - After the guarded Stripe payment insert succeeds, re-read the persisted total paid for the job.
  - Derive invoice status and current overpayment from that persisted total instead of pre-insert `paidBefore + sessionAmount` math.
  - Overpayment detection now catches combined excess from multiple near-simultaneous Stripe sessions.
  - Create an unresolved overpayment alert only when none is already open for the job; alert amount reflects the current job-level excess.
- `app/estimate/[token]/page.tsx`
  - Customer-return fallback uses the same post-insert persisted-ledger reconciliation as the webhook.
  - Prevents webhook/fallback divergence for concurrent payment completion.
- `scripts/release-readiness.mjs`
  - Adds a regression gate requiring post-insert ledger refresh and job-level overpayment detection on both Stripe completion paths.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery build to v85 / `1.0.0-rc.85`.


## v86 — Canonical Overpayment Alert Amount Refresh
- `app/api/payments/webhook/route.ts`
  - When persisted Stripe payments leave an unresolved overpayment, refresh the existing open alert title/body to the current ledger excess.
  - Still inserts an alert only when no unresolved payment-overage alert exists.
  - Prevents a second/concurrent payment from increasing the actual overpayment while the owner UI continues showing the older smaller amount.
- `app/estimate/[token]/page.tsx`
  - Customer-return fallback applies the same canonical-alert refresh behavior.
- `scripts/release-readiness.mjs`
  - Adds a regression gate requiring unresolved overpayment alerts to track the current excess on both Stripe completion paths.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery build to v86 / `1.0.0-rc.86`.


## v87 — Financial Lifecycle Integrity Batch

This is a larger coordinated hardening batch rather than a single-issue release.

### 1. Freeze accepted estimate financial terms
- `app/api/estimates/[id]/route.ts`
  - Service/pricing edits are rejected once an estimate is approved, scheduled, completed, has a payment, or has an invoice.
  - Historical accepted quote/agreement values therefore cannot be silently rewritten after the customer commits.
  - Last-minute/final changes remain supported through the existing editable final invoice.

### 2. Race-safe one-invoice invariant
- `drizzle/0017_one_invoice_per_estimate.sql` (new)
  - Adds a unique database index enforcing one invoice per estimate.
  - Migration fails safely if legacy duplicates require reconciliation; it does not delete financial records.
- `app/api/invoices/route.ts`
  - Concurrent invoice-create requests recover and return the canonical invoice if another request wins the race.

### 3. Block customer payment prompts during unresolved overpayment
- `app/invoice/[token]/page.tsx`
  - While a payment-overage exception is unresolved, hide both Stripe balance checkout and manual Cash App/Venmo payment prompts.
  - Customer sees the existing account-review message instead of being invited to add another payment.

### 4. Server-enforce review-request eligibility
- `app/api/customer-messages/route.ts`
  - Review text/email logging requires the job to be completed, fully paid against final billing total, and free of unresolved overpayment.
  - Copying review wording remains allowed and is not treated as a sent review request.
- `app/dashboard.tsx`
  - If message logging is rejected, FIRE no longer launches SMS/email or marks the review request as sent.

### 5. Final-invoice-aware owner amount due
- `app/dashboard.tsx`
  - `amountDueNow` uses an existing final invoice total when present, including unusual approved/scheduled edge states.
  - Manual payment UI cannot contradict invoice-aware dashboard/payment totals by reverting to deposit-only math.

### Release integrity
- `scripts/release-readiness.mjs`
  - Adds five regression gates covering this batch.
- `package.json` / `FIRE_UNIFIED_RELEASE.json`
  - Advance recovery build to v87 / `1.0.0-rc.87`.
  - Shared-core fingerprint coverage expands to include the new invariant migration and any newly protected source.


## v88 — Lifecycle State Integrity Batch

### 1. Replace arbitrary status editing with action-driven lifecycle
- `app/dashboard.tsx`, `app/globals.css`
  - Job status is displayed read-only in detail view.
  - Status advances through the actual workflow actions instead of a generic dropdown.
- `app/api/estimates/[id]/route.ts`
  - Owner API cannot manually manufacture customer approval without the signed estimate acceptance.
  - Accepted/financially active jobs cannot be changed to Declined.
  - Customer/financially active jobs cannot be moved backward to earlier lifecycle states.

### 2. Race-safe customer approval
- `app/api/public/estimates/[token]/accept/route.ts`
  - Approval uses a conditional database write limited to draft/sent + not-yet-accepted.
  - Only the request that actually wins the acceptance update creates the acceptance notification.
  - Concurrent/stale attempts re-read authoritative acceptance state instead of emitting duplicate/false activity.

### 3. Job-report ownership and sequence validation
- `app/api/job-reports/route.ts`
  - Estimate/customer relationship is validated server-side.
  - A report cannot be marked completed before the approved job is scheduled.
  - Existing completed-job reports remain editable for documentation corrections.

### 4. Stripe checkout post-create revalidation
- `app/api/payments/checkout/route.ts`
  - After Stripe creates a remote checkout session, FIRE re-reads current status, final billing total, paid amount, and billing-exception state.
  - If the due amount changed during checkout creation, the new remote session is expired immediately and never exposed to the customer.

### Release integrity
- `scripts/release-readiness.mjs`
  - Adds four coordinated lifecycle/race-condition regression gates.
- Recovery package advances to v88 / `1.0.0-rc.88`.


## v89 — Cross-Record Integrity Batch

### 1. Customer-note ownership validation
- `app/api/customer-notes/route.ts`
  - Refuses to create a CRM note for a stale/nonexistent customer ID.

### 2. Job-expense integrity
- `app/api/expenses/route.ts`
  - Job-linked expenses verify that the estimate still exists before insertion.
  - Prevents orphan costs from corrupting job-cost/profit reporting.

### 3. Task customer/job integrity
- `app/api/tasks/route.ts`
  - Linked jobs must exist.
  - When both customer and job are supplied, the job must belong to that customer.
  - Customer-only tasks validate the customer.
  - Updating a stale task ID now returns Not Found instead of false success.

### 4. Close the pre-approval change-request channel after acceptance
- `app/api/public/estimates/[token]/change-request/route.ts`
  - Customer quote-change requests are accepted only while the estimate is Draft/Sent and unaccepted.
  - Once signed/accepted or otherwise advanced into the job workflow, customers are directed to contact FIRE directly for new scope changes.

### 5. Scheduling requires actual signed acceptance evidence
- `app/api/estimates/[id]/route.ts`
  - Scheduling now requires persisted `accepted_at` + `signed_at` in addition to Approved state.
  - Prevents malformed/imported status text from bypassing customer agreement evidence.

### Release integrity
- Five new workflow regression gates added.
- Recovery build advances to v89 / `1.0.0-rc.89`.


## v90 — Disaster Recovery Fidelity Batch

### 1. Preserve estimate discount metadata in standalone restore
- `scripts/restore-records-backup.mjs`
  - Restores `appreciation_discount`, `additional_discount_type`, and `additional_discount_value`.
  - Legacy backups missing these fields receive safe defaults: no appreciation discount, `percent` mode, zero additional value.

### 2. Preserve overpayment-resolution audit state
- `scripts/restore-records-backup.mjs`
- `app/api/backup/route.ts`
  - Restores `notifications.resolution_note`.
  - Legacy backups without the field safely restore it as null.
  - Keeps `refund:<amount>` vs `kept_overpayment` audit meaning available after disaster recovery.

### 3. Fail closed on stale Stripe checkout sessions
- `scripts/restore-records-backup.mjs`
- `app/api/backup/route.ts`
  - Any backed-up checkout session whose status was `open` is restored as `expired` with a recovery timestamp.
  - Prevents an independent recovery environment from trusting an old external Stripe session.

### 4. Validate recovery-critical backup fields before restore
- `scripts/validate-records-backup.mjs`
  - Current app exports must contain critical estimate discount, notification resolution, invoice revision, and checkout-session fields.

### 5. Harden partial photo archive recovery
- `scripts/restore-photo-archive.mjs`
  - Honors `missingPhotoIds` emitted by the photo backup instead of requiring intentionally missing source objects to exist in the ZIP.
  - Validates manifest counts and missing-ID consistency.
  - After R2 upload + D1 insert, re-reads customer/object-key/size metadata.
  - If metadata insert/verification fails, removes the just-uploaded object so the restore does not leave a new orphan.

### Recovery documentation
- `INDEPENDENT_DEPLOYMENT.md`
- `SECURITY_AND_RECOVERY_STATUS.md`
  - Documents checkout-session expiry and verified partial photo restore behavior.

### Release integrity
- Four new recovery regression gates added.
- Recovery build advances to v90 / `1.0.0-rc.90`.


## v91 — Verified Restore Integrity Batch
- Standalone disaster restore now re-reads every newly inserted record and compares every restored column against the exact normalized backup value.
- ID existence alone is no longer accepted as proof of successful recovery.
- Any mismatch in restored financial, customer, signature, invoice-revision, checkout, audit, task, expense, or job-report data fails verification loudly.
- One additional regression gate protects this behavior.


## v92 — Payment Provenance & Portal Privacy Batch

### 1. Stripe webhook payment provenance
- `app/api/payments/webhook/route.ts`
  - A paid Stripe session must match an existing FIRE `payment_checkout_sessions` row.
  - Session ID, estimate ID, payment type, amount, and allowed local state must all match.
  - A validly signed Stripe webhook can no longer create a FIRE payment from an untracked/stale checkout session whose metadata merely names a real estimate.

### 2. Stripe success-redirect payment provenance
- `app/estimate/[token]/page.tsx`
  - The customer redirect fallback now enforces the same locally tracked checkout match before recording payment.
  - Preserves the fallback while preventing arbitrary paid Stripe sessions from being attached to a FIRE estimate.

### 3. Customer portal search privacy
- `app/estimate/[token]/page.tsx`
- `app/invoice/[token]/page.tsx`
- `app/pay/[id]/page.tsx`
  - Adds explicit `noindex`, `nofollow`, and `nocache` robots metadata to private tokenized customer financial pages.

### Release integrity
- Three new regression gates added.
- Recovery build advances to v92 / `1.0.0-rc.92`.


## v93 — Atomic Approval & Communication Integrity Batch

### 1. Atomic estimate acceptance
- `app/api/public/estimates/[token]/accept/route.ts`
  - Customer signature/approval update and the owner `estimate_accepted` notification now execute in one D1 batch.
  - Notification insertion is conditioned on the exact acceptance timestamp written by that request.
  - Prevents the estimate from becoming approved while the request returns a failure because the notification write failed.
  - Concurrent/repeated acceptance remains idempotent.

### 2. Customer communication cross-record integrity
- `app/api/customer-messages/route.ts`
  - Verifies the target customer exists before saving communication history.
  - When an estimate is attached, verifies that estimate actually belongs to that customer.
  - Prevents message-history records from silently linking one customer's communication to another customer's estimate.

### Release integrity
- Two new regression gates added.
- Recovery build advances to v93 / `1.0.0-rc.93`.


## v94 — Job Relationship Integrity Batch

### 1. Job-linked task ownership
- `app/api/tasks/route.ts`
  - When a task is attached to an estimate/job, the task now inherits that estimate's authoritative customer ID.
  - A supplied mismatched customer is still rejected.
  - Prevents job-linked tasks from being saved with a null customer relationship even though the job has a customer.

### 2. Existing job-report corruption guard
- `app/api/job-reports/route.ts`
  - Existing report lookup now includes its stored customer ID.
  - Before editing an existing report, FIRE verifies its stored customer still matches the job/customer being edited.
  - If a restored or otherwise corrupted report is cross-linked to another customer, the edit stops with an explicit integrity warning instead of silently preserving the bad relationship.

### Release integrity
- Two new regression gates added.
- Recovery build advances to v94 / `1.0.0-rc.94`.


## v95 — Financial Input Precision Hardening Batch

### 1. Estimate money precision
- `app/api/estimates/route.ts`
  - Service-line cents must be safe integers.
  - Aggregate subtotal must remain inside the exact integer range.
  - Additional discount values must also be exact safe integers.
  - Prevents extremely large/malformed numeric input from silently losing cent precision.

### 2. Final invoice money precision
- `app/api/invoices/[id]/route.ts`
  - Invoice line cents, aggregate subtotal, and discount value now enforce safe-integer precision before billing math is persisted.

### 3. Manual payment and expense precision
- `app/api/payments/route.ts`
- `app/api/expenses/route.ts`
  - Manual payment and expense amounts reject unsafe cent values instead of allowing imprecise rounding/storage.

### 4. Expense date integrity
- `app/api/expenses/route.ts`
  - Expense dates are parsed and validated before insertion.
  - Invalid dates are rejected.
  - Valid dates are normalized to ISO timestamps for reliable sorting and Wave CSV export.

### Release integrity
- Four new regression gates added.
- Recovery build advances to v95 / `1.0.0-rc.95`.


## v96 — Edit-Path Precision & Scheduling Integrity Batch

### 1. Close estimate-edit financial precision bypass
- `app/api/estimates/[id]/route.ts`
  - Edited service-line cents must be safe integers.
  - Edited aggregate subtotal must remain exactly representable.
  - Edited additional discount values must be safe integers.
  - This closes the remaining path where an existing estimate could bypass the v95 create-time money safeguards.

### 2. Job scheduling timestamp integrity
- `app/api/estimates/[id]/route.ts`
  - Non-empty schedule values are parsed and validated.
  - Invalid schedule values are rejected.
  - Valid schedule values are normalized to canonical ISO timestamps before persistence.

### 3. Task due-date integrity
- `app/api/tasks/route.ts`
  - Task due dates are parsed and validated.
  - Invalid due dates are rejected.
  - Valid dates are normalized to ISO timestamps for reliable task ordering/display.

### Release integrity
- Three new regression gates added.
- Recovery build advances to v96 / `1.0.0-rc.96`.


## v97 — Payment Boundary Precision Batch

### 1. Overpayment/refund reconciliation precision
- `app/api/notifications/route.ts`
  - Refund adjustment cents must be safe integers.
  - Persisted paid totals and billed totals are checked for exact safe-integer representation before reconciliation.
  - If accounting values are outside the safe range, FIRE stops instead of writing a refund adjustment or resolving the exception.

### 2. Stripe checkout accounting precision
- `app/api/payments/checkout/route.ts`
  - Paid sum, final billed total, deposit obligation, calculated amount due, and the final race-check due amount must all remain exact safe integers.
  - FIRE fails closed before creating Stripe Checkout if any of those values are unsafe.
  - This extends v95/v96 precision protection all the way to the external payment boundary.

### Release integrity
- Two new regression gates added.
- Recovery build advances to v97 / `1.0.0-rc.97`.


## v98 — Stripe Webhook Accounting Integrity Batch

### 1. Exact Stripe webhook amount validation
- `app/api/payments/webhook/route.ts`
  - Signed webhook amount must be a positive safe integer number of cents.
  - Expected-amount metadata must also be a safe integer and exactly match Stripe's paid amount.
  - Signature verification remains required; this adds accounting validation after authenticity validation.

### 2. Aggregate paid-total preflight before mutation
- Before inserting the Stripe payment, FIRE reads the existing paid sum.
- Existing paid cents and `existing + incoming` must both remain exactly representable.
- If not, the webhook fails closed before inserting a payment record.

### 3. Reconciliation arithmetic safeguards
- Deposit/final obligation, refreshed paid sum, and calculated overpayment must remain safe integer cents before invoice-status or billing-exception follow-up work.

### Release integrity
- Three new regression gates added.
- Recovery build advances to v98 / `1.0.0-rc.98`.


## v99 — Manual Payment Concurrency Integrity Batch

### 1. Manual payment persisted-total preflight
- `app/api/payments/route.ts`
  - Existing paid cents and the current deposit/final obligation must be exact safe integers.
  - Existing paid plus the new owner-recorded payment must remain exactly representable before mutation.

### 2. Concurrency-safe aggregate limit inside the insert
- The conditional payment INSERT now also checks the current database paid sum against JavaScript's maximum exact integer boundary in the same SQL statement.
- This closes the race where two otherwise valid owner payment requests could pass separate preflight reads and jointly push aggregate accounting outside FIRE's exact-cent range.

### 3. Refreshed reconciliation guard
- Persisted paid total and refreshed amount due are validated before final invoice-status and returned-balance reconciliation.

### Release integrity
- Three new regression gates added.
- Recovery build advances to v99 / `1.0.0-rc.99`.


## v100 — Overpayment Stale-State Integrity Milestone

### 1. Current-overpayment requirement
- `app/api/notifications/route.ts`
  - Both refund and intentionally-kept resolution modes now re-read the job's final billed total and persisted paid sum.
  - FIRE refuses to resolve a stale overpayment alert if the job is no longer actually overpaid.
  - A stale alert therefore cannot create an unnecessary refund adjustment.

### 2. Retained-overpayment mutation race guard
- The `keep` resolution now includes a database-time condition that paid cents still exceed the final invoice/estimate obligation.
- If billing state changes between the initial read and the resolution UPDATE, no alert is resolved and FIRE requires a refresh/review.

### Release integrity
- Two new regression gates added.
- Recovery build advances to milestone v100 / `1.0.0-rc.100`.


## v101 — Invoice Edit Payment-Race Integrity Batch

### 1. Safe paid-total validation on invoice edits
- `app/api/invoices/[id]/route.ts`
  - Existing paid cents must be an exact nonnegative safe integer before FIRE compares them with an edited final invoice total.

### 2. Recheck payments after Stripe checkout expiration
- FIRE already expires active Stripe checkout sessions before changing an invoice total.
- v101 now re-reads the persisted paid sum after that checkout guard and immediately before revision/write work.
- If a payment arrived during the edit and the proposed invoice would now fall below recorded payments, the edit stops and requires refresh.

### 3. Preserve valid invoice quantities
- Valid positive service quantities are now written exactly as validated instead of being rounded at persistence time.
- This prevents a valid fractional quantity from silently changing (including values below 0.5 becoming zero) during an invoice edit.

### Release integrity
- Three new regression gates added.
- Recovery build advances to v101 / `1.0.0-rc.101`.


## v102 — Final Invoice Creation Integrity Batch

### 1. Validate completed-job billing snapshot before invoice creation
- `app/api/invoices/route.ts`
  - Estimate service lines must still have valid names, positive finite quantities, and exact nonnegative cent totals.
  - Calculated subtotal, final estimate total, paid sum, and derived discount must remain inside FIRE's exact safe accounting range.
  - This protects invoice creation from legacy, restored, or otherwise corrupted estimate/payment data.

### 2. Verify customer ownership when reusing an invoice
- Existing one-invoice-per-estimate behavior remains.
- Before returning an existing invoice, FIRE verifies that invoice's customer matches the completed estimate's customer.
- The same ownership check runs during duplicate-creation race recovery.
- Cross-customer invoice corruption now stops billing instead of being silently reused.

### Release integrity
- Two new regression gates added.
- Recovery build advances to v102 / `1.0.0-rc.102`.


## v103 — Estimate Acceptance-Race Integrity Batch

### 1. Preserve valid service quantities
- `app/api/estimates/route.ts`
- `app/api/estimates/[id]/route.ts`
- Positive finite service quantities are now persisted exactly as validated instead of being rounded only during the database write.
- This matches the v101 invoice-side correction and prevents fractional quantities from silently changing.

### 2. Recheck financial/acceptance state before owner estimate edits
- Immediately before replacing estimate lines, FIRE re-reads the current estimate status, paid sum, and invoice count.
- If the customer accepted the estimate, a payment arrived, or billing became active while the owner was editing, FIRE stops the edit and requires a refresh.
- The refreshed paid sum must also remain an exact nonnegative safe integer.

### Release integrity
- Three new regression gates added.
- Recovery build advances to v103 / `1.0.0-rc.103`.


## v104 — Customer Acceptance Snapshot Integrity Batch

### 1. Approval-time billing integrity
- `app/api/public/estimates/[token]/accept/route.ts`
  - Customer approval now succeeds only if persisted subtotal, discount, final total, and deposit remain within exact-cent accounting bounds.
  - Discount cannot exceed subtotal and deposit cannot exceed the final total.
  - These checks are part of the same conditional UPDATE that records acceptance/signature.

### 2. Approval-time service-line integrity
- Approval requires at least one persisted service line.
- Invalid/blank service names, nonpositive quantities, negative prices, and unsafe cent values block approval.
- This prevents legacy/restored/corrupted quote state from becoming an immutable accepted agreement.

### 3. Signature input bound
- Typed signer names remain required and are now capped at 120 characters before persistence.

### Release integrity
- Three new regression gates added.
- Recovery build advances to v104 / `1.0.0-rc.104`.


## v105 — Job Workflow Transition Race Integrity Batch

### 1. Recheck workflow state immediately before scheduling/status mutation
- `app/api/estimates/[id]/route.ts`
  - FIRE re-reads current status, accepted timestamp, signed timestamp, and persisted paid sum immediately before schedule/status changes.
  - If approval/signature/workflow state changed since the request's initial snapshot, the transition stops and requires refresh.

### 2. Safe payment-state validation during workflow transitions
- Refreshed paid cents must remain an exact nonnegative safe integer before scheduling, completion, or other workflow-status changes.
- This does **not** add a deposit requirement. The existing owner-controlled exception remains: an approved/signed job can still be scheduled without a deposit when the owner chooses.

### Release integrity
- Two new regression gates added.
- Recovery build advances to v105 / `1.0.0-rc.105`.


## v106 — Service Completion Report Integrity Batch

### 1. Server-verified completion checklist
- `app/api/job-reports/route.ts`
- A report can be marked completed only when all six required service-completion checklist items are explicitly true in the persisted request.
- The API no longer trusts a client-supplied `complete/completed` status by itself.
- Draft reports remain allowed with incomplete checklists.

### 2. Bound report text fields
- Technician notes are capped at 5,000 characters.
- Before/after airflow fields are capped at 100 characters each.
- Existing dryer-vent airflow fields remain optional.

### 3. Workflow preserved
- Completed reports still require the correct scheduled/completed job and matching customer.
- The owner deposit exception and all pricing/billing behavior are unchanged.

### Release integrity
- Two new regression gates added.
- Recovery build advances to v106 / `1.0.0-rc.106`.


## v107 — Customer Billing Action Integrity Batch

### 1. Estimate/customer payment page mirrors billing-exception state
- `app/estimate/[token]/page.tsx`
  - Adds unresolved payment-overage state to the customer estimate/payment snapshot.
  - Deposit and final-balance payment actions are hidden while an overpayment exception is unresolved.
  - Customer sees an account-review message instead of being invited to make another payment.
  - Unsafe persisted billing totals also fail closed and direct the customer to contact FIRE.

### 2. Invoice portal fails closed on unsafe accounting totals
- `app/invoice/[token]/page.tsx`
  - Paid cents and final invoice total must be exact nonnegative safe integers before FIRE calculates or exposes a payable balance.
  - Unsafe billing state displays “Billing review required” and suppresses Stripe/manual-payment instructions.

### 3. Review request billing-state integrity
- `app/api/customer-messages/route.ts`
  - Review text/email requests now require exact safe persisted paid and final-billed cents in addition to completed status, fully paid state, and no unresolved overpayment.
  - Corrupted billing state cannot be interpreted as “paid enough” for post-job review automation.

### Release integrity
- Three new regression gates added.
- Recovery build advances to v107 / `1.0.0-rc.107`.


## v108 — Customer Invoice Snapshot & Review Idempotency Batch

### 1. Customer invoice line-snapshot validation
- `app/invoice/[token]/page.tsx`
  - Invoice must still contain at least one valid service line.
  - Service names must be present, quantities must be positive finite values, and line totals must be exact nonnegative safe integers.
  - Aggregate invoice-item subtotal must also remain exactly representable.
  - Unsafe/malformed invoice-line state now forces billing review instead of exposing a misleading payable balance.

### 2. Manual final-balance instructions require completed job state
- Customer invoice Cash App/Venmo instructions now require the linked job to still be `completed`, matching the existing Stripe balance-payment gate.
- This protects against stale/restored/corrupted lifecycle state.

### 3. Review-request rapid retry idempotency
- `app/api/customer-messages/route.ts`
  - Review text/email logging uses a conditional insert.
  - A matching review request for the same customer/job/channel within 30 seconds is reused instead of duplicating communication history.
  - Preserves normal later follow-up/resend behavior.

### 4. Communication payload bound
- Saved message bodies are capped at 10,000 characters to prevent abnormal CRM payload growth.

### Release integrity
- Four new regression gates added.
- Recovery build advances to v108 / `1.0.0-rc.108`.


## v109 — Review Request Message Integration Batch

### 1. Default FIRE review-request message
- `lib/fire-templates.ts`
  - Replaces the older review wording with the approved FIRE review-request copy.
  - Keeps customer first name and service personalization.
  - Directs the customer to the single FIRE review page through `@review_link`.
  - Explains that Google is most helpful while Facebook and Yelp are also appreciated.

### 2. Exact review-page link regression lock
- `app/dashboard.tsx`
  - Existing `@review_link` substitution is verified and regression-tested against:
    `https://firstinresponseexteriors.com/review`
  - No change to completed/paid-job eligibility rules or overpayment safeguards.

### Release integrity
- Two new regression gates added.
- Recovery build advances to v109 / `1.0.0-rc.109`.


## v110 — Extended Billing & Dashboard Integrity Milestone

This is a larger consolidated improvement run rather than a single small fix.

### 1. Customer-return Stripe confirmation parity
- `app/estimate/[token]/page.tsx`
- The customer-return fallback now mirrors webhook exact-cent safeguards:
  - safe positive Stripe session amount
  - exact expected amount
  - safe tracked checkout amount
  - safe persisted paid aggregate before insertion
  - safe billing obligation
  - safe refreshed paid aggregate
  - safe overpayment arithmetic
- Existing webhook behavior remains unchanged.

### 2. Estimate customer portal financial-snapshot validation
- Estimate service lines must remain valid.
- Line subtotal must equal the stored estimate subtotal.
- Stored discount must be valid and not exceed subtotal.
- Deposit/final/paid values must remain exact nonnegative safe cents.
- Customer payment actions fail closed when this snapshot is inconsistent.

### 3. Estimate manual payment presentation alignment
- Cash App/Venmo instructions now appear only when:
  - the estimate is approved/signed,
  - billing state is safe,
  - no unresolved payment exception exists, and
  - there is actually a deposit/final balance currently payable.

### 4. Invoice financial-snapshot reconciliation
- Customer invoice portal now verifies:
  - invoice line subtotal equals stored invoice subtotal,
  - stored discount is valid,
  - stored final invoice total equals the expected minimum-charge/discount result.
- Mismatched restored/corrupted invoice financial state triggers billing review instead of payment actions.

### 5. Review rapid-retry launch suppression
- v108 already prevented duplicate review communication rows.
- v110 closes the remaining UI side: a duplicate retry no longer launches a second SMS or email composer.

### 6. Owner paid/review classification safety
- Paid-pipeline and review-request eligibility now require an exact safe billing state.
- Unsafe values trigger billing review rather than being treated as normally paid.

### 7. Owner aggregate exact-cent protection
- Customer paid totals and Payments-page collected/outstanding summaries now use safe summation and do not accumulate past JavaScript exact-integer limits.

### Release integrity
- Seven new regression gates added.
- Recovery build advances to v110 / `1.0.0-rc.110`.


## v111 — Refund Workflow & Payment-Ledger Integrity Milestone

This is another long consolidated run.

### 1. General payment-level refund workflow
- New owner API: `app/api/payments/refund/route.ts`
- Supports partial or full refunds against an original positive payment.
- Refund requests are idempotent and cannot reserve more than the remaining refundable amount.
- Each refund is tied to the original payment and estimate.

### 2. Real Stripe refunds
- Original Stripe deposit/balance payments can be refunded from FIRE.
- FIRE resolves the Stripe Checkout Session to its payment intent and submits the refund to Stripe.
- Refund creation uses a stable idempotency key and FIRE metadata.
- FIRE only records the negative refund ledger entry when Stripe confirms the refund succeeded.
- Pending Stripe refunds remain pending until Stripe confirmation.

### 3. Manual-method refund workflow
- Cash App, Venmo, cash, check, bank, Wave, and other manual-method refunds are not represented as money moved by FIRE.
- Owner must first send the money back outside FIRE, then explicitly confirm that the external refund was completed.
- FIRE then records the refund and reconciles accounting.

### 4. Stripe refund webhook reconciliation
- Signed Stripe `refund.created` / `refund.updated` events reconcile asynchronous refund status.
- FIRE verifies refund request ID, payment ID, and exact amount.
- Successful refund events create the negative payment ledger entry idempotently and update invoice state.

### 5. Refund-aware accounting
- Successful refunds are stored as negative paid ledger entries.
- Invoice status is recalculated after each completed refund.
- Customer/payment totals now use signed safe-cent summation so refunds subtract correctly.
- Partial refunds can reopen a balance due.

### 6. Overpayment integration
- The old owner UI “Refund handled” bookkeeping shortcut has been removed.
- Overpayment alerts direct the owner to refund the original payment.
- Overpayment exception closes automatically only if the persisted paid ledger is no longer above the final billed amount.
- “Keep as overpayment” remains available for intentional retained excess.

### 7. Owner refund UI
- Refund button added to payment history and customer payment history.
- Shows amount remaining refundable.
- Stripe payments explain that FIRE sends the money through Stripe.
- Manual payments require explicit confirmation that money was already returned externally.

### 8. Refund recovery coverage
- New `payment_refunds` table and migration.
- Records backup/export includes refund history.
- Restore and backup validation understand refund requests.
- In-flight/pending refund requests fail closed to `failed` after disaster restore because remote provider state cannot be trusted blindly.

### Release integrity
- New refund-specific regression gates added.
- Recovery build advances to v111 / `1.0.0-rc.111`.


## v112 — Refund Processing Hold & Recovery Compatibility Milestone

This long follow-up hardens the v111 refund workflow across the rest of FIRE.

### 1. Pending refund state is exposed everywhere
- Estimate API
- Customer-record API
- Dashboard summary API
- Invoice API
- Owner UI now knows when a refund is actively processing.

### 2. Collection pauses while a refund is processing
- Manual payment recording is blocked.
- Stripe checkout creation is blocked.
- Estimate/customer payment page hides payment actions.
- Invoice customer page hides payment actions.
- Owner job detail hides Record Payment.
- Invoice list hides Record Payment.
- Payments page removes the job from Balances to collect until the refund finishes.

### 3. Review requests pause during refunds
- Server review-request gate rejects requests while a refund is pending.
- Owner job detail and Follow-ups no longer offer the review request during refund processing.

### 4. Invoice and overpayment mutation pauses
- Final invoice edits are blocked while a refund is pending.
- “Keep as overpayment” resolution is blocked while a refund is pending.
- This prevents billing terms or exception handling from racing the refund ledger update.

### 5. Owner refund-processing visibility
- Job detail shows a clear Refund processing alert.
- Next-action guidance explains that collection/review should wait for reconciliation.
- Invoice list shows Refund processing / Refund pending state.

### 6. Older backup compatibility restored
- `payment_refunds` remains optional when validating older compatible FIRE app backups.
- If the refund table exists, its critical fields are validated.
- Pre-v111 backups are not rejected merely because the refund feature did not exist yet.

### Release integrity
- Six new regression gates added.
- Recovery build advances to v112 / `1.0.0-rc.112`.


## v113 — External Stripe Refund Convergence & Collectible-Balance Integrity Milestone

### 1. Direct Stripe-dashboard refunds reconcile into FIRE
- Stripe refund webhooks without FIRE metadata now use the refund PaymentIntent to locate its Checkout Session.
- FIRE maps that Checkout Session back to the original recorded payment before importing the refund.
- Imported direct Stripe refunds receive durable local refund-request records and normal refund ledger reconciliation.

### 2. Disaster-recovery refund convergence
- A pending Stripe refund intentionally restored as failed/unknown can later be repaired by a signed Stripe success event.
- Provider-refund ID mismatches fail closed.
- This prevents a restored app from keeping the refund request marked failed after Stripe actually returned the money.

### 3. Payments screen follows real due-now semantics
- Draft/sent estimates no longer appear as balances to collect.
- Approved/scheduled jobs expose only the current deposit due.
- Completed jobs expose only the final invoice/job balance.
- Unsafe billing state still fails closed.

### 4. Post-refund repeat marketing hold
- A successful refund that reopens a completed-job balance now suppresses repeat-service/win-back outreach.
- Repeat marketing resumes only after the billing balance returns to zero and no refund/overpayment exception remains.

### 5. Existing refund safeguards retained
- Pending refund state still blocks payment, review, invoice edits, and overpayment resolution.
- Partial/full refund limits and Stripe idempotency remain unchanged.

### Release integrity
- Four new regression gates added.
- Recovery build advances to v113 / `1.0.0-rc.113`.


## v114 — Refund Trust Boundary & Summary Integrity Milestone

### 1. Stripe refund webhook mode isolation
- Signed Stripe refund events can finalize only refund requests whose stored mode is `stripe`.
- Manual refunds cannot be finalized or mutated by Stripe webhook events.
- The finalizer also rechecks the mode so future call paths cannot bypass this rule.

### 2. Customer invoice-history billing state
- Customer-record invoice history now includes open overpayment and pending-refund counts.
- Refund-processing invoices display `Refund processing` instead of an ordinary paid/partial lifecycle label.
- Existing overpayment review messaging remains intact.

### 3. Customer portal refund messaging
- Estimate/payment portal now says `Refund processing` when a refund is pending.
- Invoice portal shows the same specific refund state.
- Generic account-review messaging remains for overpayment review.

### 4. Dashboard summary exact-accounting guard
- Dashboard metric and recent-job financial values must be exact, nonnegative safe integers.
- Unsafe persisted accounting values make the summary endpoint fail closed instead of refreshing misleading owner metrics.

### 5. Customer aggregate exact-accounting guard
- Customer estimate counts, lifetime billed totals, paid totals, and estimate-level billing values are validated before response.
- Unsafe aggregate data fails closed for owner review instead of being silently rounded.

### 6. Local dashboard metric overflow protection
- Immediate post-estimate dashboard metric updates no longer add beyond JavaScript exact-integer range.

### Release integrity
- Five new regression gates added.
- Recovery build advances to v114 / `1.0.0-rc.114`.


## v115 — Refund Ledger Uniqueness & Convergence Milestone

### 1. Database-level refund-ledger uniqueness
- New migration `0019_refund_ledger_unique.sql`.
- Normalizes any duplicate pre-v115 negative refund payment rows by provider ID.
- Adds a partial unique index for `payments.provider_id LIKE 'refund:%'`.
- One durable refund request can no longer create two refund ledger entries even under near-simultaneous retries.

### 2. Owner refund finalization convergence
- Refund request is transitioned first.
- Negative payment insertion requires the refund request to be durably succeeded.
- FIRE re-reads and verifies both the succeeded refund request and exact negative ledger row before returning success.

### 3. Stripe webhook refund convergence
- Stripe webhook follows the same durable-state rule.
- Ledger insertion requires a succeeded Stripe-mode request with the matching Stripe refund ID.
- Post-write verification rejects non-converged states instead of acknowledging success.

### 4. Direct Stripe-dashboard refund reservation hardening
- Fixes SQL NULL comparison so pending refund rows without provider IDs still count against refundable value.
- External Stripe refund import now rechecks remaining refundable value inside the INSERT statement itself.
- Concurrent import conflicts fail closed.

### 5. Owner invoice/payment summary safeguards
- Invoice-list billing values are validated before response.
- Payment-history signed amounts, refunded totals, and refundable balances are validated before response.
- Unsafe values require owner review rather than being silently displayed.

### Release integrity
- Seven new regression gates added.
- Recovery build advances to v115 / `1.0.0-rc.115`.


## v116 — Refund Bypass Removal & Recovery Graph Integrity Milestone

### 1. Legacy refund bypass removed
- `app/api/notifications/route.ts`
- Overpayment resolution is now keep-only.
- Refunds cannot be created through the old local “refund adjustment” notification path, even with a crafted request.
- All refunds must use Payments → Refund on the original payment.
- Stripe refunds therefore go through Stripe; manual-method refunds require external-return confirmation.

### 2. Backup refund referential integrity
- Backup validator now verifies every refund references:
  - an existing positive paid payment,
  - an existing estimate,
  - the same estimate as the original payment.
- Refund amount, mode, status, and provider-refund uniqueness are validated.

### 3. Aggregate refund reservation integrity
- Pending + succeeded refund reservations for one original payment cannot exceed that payment.
- This is checked in:
  - standalone backup validation,
  - managed restore preflight,
  - in-app backup/export validation,
  - in-app restore validation.

### 4. Succeeded refund ledger integrity
- Every succeeded refund must have exactly one matching negative paid ledger entry with the exact amount.
- Duplicate refund ledger provider IDs are rejected.
- Orphan `refund:` ledger entries without a matching succeeded refund request are rejected.

### 5. Corrupt backup prevention
- FIRE will not export a records backup if its live refund graph is internally inconsistent.
- The in-app restore rejects malformed refund graphs before preparing database writes.
- Managed restore rejects the same conditions before SQL generation.

### Release integrity
- Five new regression gates added.
- Recovery build advances to v116 / `1.0.0-rc.116`.


## v117 — Restore Collision & Financial Identity Integrity Milestone

### 1. Restore-time provider collision protection
- Managed restore and in-app restore now inspect the target database before writing.
- Stripe Checkout IDs (`cs_...`) and FIRE refund-ledger IDs (`refund:...`) cannot be restored onto a different existing payment.
- Stripe refund provider IDs cannot be restored onto a different existing refund request.

### 2. Same-ID immutable financial conflict protection
- Existing refund IDs are compared against backup:
  - original payment
  - estimate
  - refund amount
  - refund mode
- Existing payment IDs are compared against backup:
  - estimate
  - amount
  - provider identity
- Mismatches stop the restore instead of silently preserving the conflicting target record.

### 3. Manual references remain reusable
- Restore provider collision checks intentionally apply only to strong provider identifiers.
- Ordinary manual payment references/notes are not treated as globally unique.
- This avoids breaking legitimate repeated Cash App, Venmo, check, cash, bank, or Wave reference text.

### 4. Both restore paths aligned
- `scripts/restore-records-backup.mjs`
- `app/api/backup/route.ts`
- Both now use the same collision-safety rules before database writes.

### Release integrity
- Six new regression gates added.
- Recovery build advances to v117 / `1.0.0-rc.117`.


## v118 — Core Financial Restore Identity Milestone

### 1. Estimate restore identity
- Existing estimate IDs must match backup customer, subtotal, discount, final total, deposit, and share token.
- A conflicting estimate ID stops restore instead of silently preserving different billing data.
- Estimate share-token collisions are rejected before writes.

### 2. Invoice restore identity
- Existing invoice IDs must match backup estimate, customer, subtotal, discount, total, and share token.
- One-invoice-per-estimate is checked against the target database before writes.
- Invoice share-token collisions are rejected before writes.

### 3. Checkout-session restore identity
- Existing checkout-session IDs must match estimate, payment type, and amount.
- Open checkout sessions from backup still restore fail-closed as expired.

### 4. Invoice-revision restore identity
- Existing revision IDs must match invoice, total, and items snapshot.
- A revision collision cannot silently preserve different historical billing evidence.

### 5. Backup uniqueness validation
- Backup validator now rejects duplicate estimate/invoice IDs.
- Rejects duplicate estimate or invoice share tokens.
- Rejects more than one invoice for the same estimate.

### 6. Both restore paths aligned
- Managed CLI restore and in-app Business restore apply the same financial-identity protections.

### Release integrity
- Five new regression gates added.
- Recovery build advances to v118 / `1.0.0-rc.118`.


## v119 — Child Record Restore Relationship Integrity Milestone

### 1. Estimate and invoice line-item restore identity
- Existing estimate-item IDs must match estimate, service name, quantity, unit, and amount.
- Existing invoice-item IDs must match invoice, service name, quantity, unit, and amount.
- Conflicts stop restore before writes.

### 2. Task and expense restore identity
- Existing task IDs must preserve customer/job relationship, title, and creation identity.
- Existing expense IDs must preserve job relationship, category, description, amount, and incurred date.

### 3. Job report and change-request identity
- Existing job reports must remain tied to the same estimate/customer/checklist/status.
- Existing estimate change requests must remain tied to the same estimate/customer/message.

### 4. Backup child-parent validation
- Duplicate IDs are rejected for child/history tables.
- Missing estimate/invoice/customer parents are rejected.
- Job report customer must match the linked estimate customer.
- Estimate change request customer must match the linked estimate customer.

### 5. Both restore paths aligned
- Managed restore and in-app Business restore apply the same child-record conflict protections.

### Release integrity
- Five new regression gates added.
- Recovery build advances to v119 / `1.0.0-rc.119`.


## v120 — CRM Restore Identity & History Relationship Milestone

### 1. Customer restore identity
- Existing customer IDs must match name, email, phone, address, lead source, and original creation identity.
- Conflicting customer identity/contact data stops restore.

### 2. Customer-note restore identity
- Existing note IDs must match customer, note body, and creation identity.
- Notes cannot silently reattach to another customer.

### 3. Customer-message restore identity
- Existing message IDs must match customer, optional estimate, channel, template, body, and creation identity.
- Backup validation also requires a message linked to an estimate to use that estimate’s customer.

### 4. Notification restore identity
- Existing notification IDs must match type, title, body, optional customer/estimate relationship, and creation identity.
- If both customer and estimate are present, backup validation requires the customer to match the estimate owner.

### 5. Message-template restore identity
- Existing template keys must match subject, body, and saved version timestamp.
- Restore stops instead of silently preserving different template content under the same key.

### 6. Task relationship validation
- Backup validation now verifies tasks with both customer and estimate references use the estimate’s customer.

### Release integrity
- Five new regression gates added.
- Recovery build advances to v120 / `1.0.0-rc.120`.


## v121 — Photo Recovery Identity & Object Ownership Milestone

### 1. Photo archive identity validation
- Duplicate photo IDs are rejected.
- Duplicate R2 object keys are rejected.
- Missing-photo manifest metadata must remain internally consistent.

### 2. Existing-photo collision protection
- Existing photo IDs are no longer blindly skipped.
- Existing metadata must match customer, category, caption, filename, content type, size, object key, and creation identity.
- Mismatched metadata stops restore.
- An R2 object key already owned by another photo ID stops restore.

### 3. Records-backup photo metadata validation
- Customer photo metadata must reference an existing customer.
- Photo IDs and object keys must be unique.
- Object keys must match the expected customer/photo path and may not contain unsafe traversal.
- Category, content type, and size are validated.

### 4. Live backup export fail-closed behavior
- FIRE refuses to export a records backup if customer-photo metadata is internally inconsistent.
- This prevents a seemingly valid JSON backup from carrying broken photo ownership information.

### Release integrity
- Four new regression gates added.
- Recovery build advances to v121 / `1.0.0-rc.121`.


## v122 — Parity Governance & Refund Fixture Milestone

### 1. Stale parity governance corrected
- `PARITY_EVIDENCE_MANIFEST.json` advanced from v56 to v122.
- `STRICT_PARITY_MATRIX.md` and `LIVE_MASTER_PARITY_CHECKLIST.md` now identify v122.
- Stale package-level `RELEASE_STATUS.md` v57 reference removed.

### 2. Missing authoritative governance artifacts restored
- `CURRENT_VERSION.json`
- `SHARED_CORE_MANIFEST.json`
- `CURRENT_PARITY_AUDIT.md`
- `UNIFIED_RELEASE_PACKAGE.json`
These provide one clear current-release handoff inside the recovery ZIP.

### 3. Refund lifecycle added to strict-parity scope
- Owner Refund payment modal/workflow.
- Owner Refund processing hold.
- Customer-facing Refund processing state.
- All remain explicit PENDING parity blockers until rendered LIVE + independent comparison is complete.

### 4. Disposable parity fixture expanded
- Adds a succeeded partial refund that reopens a completed-job balance.
- Adds a pending refund that exercises payment/review/invoice mutation holds.
- Includes `payment_refunds`, `invoice_items`, `invoice_revisions`, and `payment_checkout_sessions` current-table coverage.
- Cleanup script removes the added parity-only table rows.

### 5. Staging acceptance expanded
- Refund full/partial limits.
- Manual refund external-return confirmation.
- Exactly-one negative refund ledger entry.
- Pending-refund action holds.
- Retry/idempotency behavior.

### 6. Recovery package completeness strengthened
- Package validator increases from 6 required assets to 12.
- Current-version, parity-audit, evidence, manifest, and capture-checklist governance files are now mandatory.

### Release integrity
- Strict parity gate must pass structurally while correctly retaining `NOT_YET_FULLY_VERIFIED`.
- Recovery build advances to v122 / `1.0.0-rc.122`.


## v123 — Parity Evidence Integrity Milestone

### 1. Evidence files are cryptographically bound
- Every captured parity evidence file now stores SHA256 and byte size in `PARITY_EVIDENCE_MANIFEST.json`.
- Existing captured evidence count: 12 files.

### 2. Exact checklist/evidence identity
- The strict gate requires all 32 evidence IDs to match all 32 master-checklist IDs exactly.
- Duplicate/blank evidence IDs and duplicate checklist IDs fail closed.

### 3. Evidence side/status truth checks
- LIVE CAPTURED requires an actual LIVE evidence file.
- Independent CAPTURED requires an actual independent evidence file.
- VERIFIED_IDENTICAL still requires both sides.
- Invalid evidence side values fail closed.

### 4. Evidence-file ownership
- One evidence file cannot silently satisfy two unrelated parity entries.
- Missing files, unsafe paths, changed hashes, or changed byte sizes fail the strict parity gate.

### 5. ZIP evidence verification
- Release-package validation now reads the evidence files directly from the ZIP.
- Every embedded evidence file is SHA256/size checked against the manifest.
- Missing/tampered evidence prevents the ZIP from passing.

### Release integrity
- Five new regression/governance gates added.
- Recovery build advances to v123 / `1.0.0-rc.123`.


## v124 — Parity Capture Intake & Independent-Evidence Workflow Milestone

### 1. Deterministic evidence registration
- New `scripts/register-parity-evidence.mjs`.
- Requires a known parity state ID and explicit `live` or `independent` side.
- Supports PNG/JPG/JPEG/WebP/PDF evidence.
- Dry-run by default; `--apply` is required to copy bytes and mutate the evidence ledger.
- Copies to deterministic `evidence/<side>/<parity-id>.<ext>` paths.
- Computes SHA256 + byte size from the exact copied file.
- Replaces only the same side's prior evidence for that parity state.
- Does not automatically claim `VERIFIED_IDENTICAL`.

### 2. Auto-generated capture queue
- New `scripts/build-parity-capture-queue.mjs`.
- Generates `PARITY_CAPTURE_QUEUE.md` directly from `PARITY_EVIDENCE_MANIFEST.json`.
- Current queue: 32 independent captures needed; 21 LIVE captures needed.
- Includes parity ID, state name, capture group, and notes for each missing side.

### 3. Package scripts
- `npm run parity:evidence:register`
- `npm run parity:capture:queue`

### 4. Independent deployment runbook updated
- Stale release-candidate v26 wording removed.
- Runbook now identifies v124.
- Adds exact post-deployment independent screenshot capture + registration sequence.
- Explicitly requires disposable parity fixture records and strict-parity gate after each batch.

### 5. Evidence intake guide updated
- Current dry-run/apply commands documented.
- Manual CAPTURED claims without registered evidence are prohibited by process.

### Release integrity
- Recovery build advances to v124 / `1.0.0-rc.124`.


## v125 — Hash-Bound Parity Comparison Milestone

### 1. Legacy evidence intake disabled
- `parity:evidence:intake` now fails intentionally.
- It can no longer attach labels/non-files or directly mark a state verified.
- Current workflow is registration first, comparison second.

### 2. New hash-bound comparison command
- New `scripts/compare-parity-evidence.mjs`.
- New `npm run parity:evidence:compare`.
- Requires both registered LIVE and independent files.
- Re-verifies SHA256 and byte size before comparison.
- Dry-run by default; `--apply` is required.
- Saves exact LIVE and independent file hashes with the verdict.
- Requires meaningful comparison notes.

### 3. Evidence replacement invalidates verdict
- Registering/replacing either LIVE or independent evidence resets `comparison_status` to `PENDING`.
- Any previous comparison record is deleted.
- A fresh comparison is required against the new evidence bytes.

### 4. Strict parity gate validates comparison freshness
- `VERIFIED_IDENTICAL` and `MISMATCH` both require a saved comparison object.
- Saved comparison file paths/hashes must still match current registered evidence.
- Stale comparison hashes fail closed.

### 5. Evidence file verifier strengthened
- `parity:evidence:files` now verifies SHA256, byte size, safe embedded path, and evidence count.

### 6. Current parity runbook corrected
- Stale 29-state count removed.
- Current runbook explicitly states 32 required parity states.
- Successful-refund and pending-refund capture states included.
- Evidence replacement and comparison rules documented.

### 7. Preflight/package completeness strengthened
- Independent preflight now requires register/compare/queue scripts and npm commands.
- Recovery ZIP now requires `PARITY_CAPTURE_QUEUE.md`, registration script, and comparison script.

### Release integrity
- Recovery build advances to v125 / `1.0.0-rc.125`.


## v126 — Parity Evidence Provenance & Chronology Milestone

### 1. Evidence provenance labels
- `parity:evidence:register` now requires `--source-label`.
- Evidence records store:
  - source environment (`live` or `independent`)
  - source deployment/session label
  - registration timestamp
  - SHA256
  - byte size
- Existing LIVE captures are backfilled as `legacy-live-capture` without changing evidence bytes.

### 2. Comparison chronology
- Comparison records now store both evidence registration timestamps and both source labels.
- Strict parity rejects a comparison if:
  - its saved source labels no longer match,
  - its saved registration timestamps no longer match,
  - its comparison timestamp predates either evidence registration.

### 3. Machine-readable parity progress
- New `scripts/build-parity-progress.mjs`.
- New `npm run parity:progress`.
- Generates `PARITY_PROGRESS.json`.
- Current real-package counts:
  - 32 total states
  - 11 LIVE captured
  - 0 independent captured
  - 0 both-sides captured
  - 0 verified
  - 0 mismatches
  - 32 pending

### 4. Comparison-only work queue
- Generates `PARITY_COMPARISON_QUEUE.md`.
- Only states with both LIVE and independent evidence but no verdict appear there.
- Current queue is empty because independent rendered capture has not begun.

### 5. Preflight/package completeness
- Independent preflight now requires progress tooling and both generated progress artifacts.
- Recovery package validation now requires the progress script, progress JSON, and comparison queue.

### Release integrity
- Recovery build advances to v126 / `1.0.0-rc.126`.


## v127 — Visual Evidence Dimension Integrity Milestone

### 1. Objective image-dimension metadata
- Existing captured image evidence is backfilled with actual pixel width and height from the file bytes.
- New registrations store media type, pixel width, and pixel height.

### 2. Registration dimension parsing
- PNG dimensions are read directly from the PNG header.
- JPEG dimensions are read from the JPEG SOF marker.
- VP8X WebP dimensions are supported.
- PDF evidence remains hash/size/provenance validated without pixel-dimension comparison.

### 3. Identical verdict size guard
- `parity:evidence:compare --result identical` now refuses different LIVE vs independent image dimensions.
- A mismatch verdict can still be recorded when different dimensions are part of the observed mismatch.

### 4. Strict parity dimension freshness
- Strict parity re-reads image dimensions from the current evidence bytes.
- Registered dimension metadata must still match.
- Saved comparison dimension metadata must still match both registered files.
- `VERIFIED_IDENTICAL` cannot survive different image sizes.

### 5. Evidence verifier
- `parity:evidence:files` now validates image dimensions in addition to SHA256, byte size, safe path, and evidence count.

### Release integrity
- Recovery build advances to v127 / `1.0.0-rc.127`.


## v128 — Capture Context Integrity Milestone

### 1. Full capture-profile metadata
New evidence registration requires:
- device class: mobile / tablet / desktop
- orientation: portrait / landscape
- viewport width
- viewport height
- pixel ratio
- source deployment/session label

### 2. Existing LIVE evidence backfill
- Existing captured LIVE evidence receives an explicit legacy-inferred capture profile.
- No screenshot bytes are changed.
- Legacy viewport values are clearly marked as inferred from evidence pixels.

### 3. Identical verdict context guard
- `parity:evidence:compare --result identical` rejects:
  - device-class mismatch
  - orientation mismatch
  - viewport-width mismatch
  - viewport-height mismatch
  - pixel-ratio mismatch
  - screenshot pixel-dimension mismatch

### 4. Comparison record binding
- Saved comparisons include both LIVE and independent capture profiles.
- Strict parity rejects stale comparisons whose saved profile no longer matches the registered evidence.

### 5. Capture queue guidance
- For states with existing LIVE evidence, `PARITY_CAPTURE_QUEUE.md` now prints the exact target profile for independent capture.
- This removes guesswork before the independent render pass.

### 6. Evidence verifier
- Evidence verification now validates capture-profile fields in addition to SHA256, byte size, and image dimensions.

### Release integrity
- Recovery build advances to v128 / `1.0.0-rc.128`.


## v129 — Deployment Provenance Integrity Milestone

### 1. Source release required
- Evidence registration now requires `--source-release`.
- Independent evidence used for `VERIFIED_IDENTICAL` must come from the current recovery release.
- For v129, independent evidence must declare `source_release=v129`.

### 2. Stable route/state family required
- Evidence registration now requires `--route-family`.
- LIVE and independent evidence must use the same route/state family for an identical verdict.
- Recommended default route family is the parity state ID.

### 3. Comparison provenance binding
Saved comparison records now include:
- LIVE source release
- independent source release
- LIVE route family
- independent route family

Strict parity rejects stale comparison provenance after evidence changes.

### 4. Old independent screenshots cannot prove new releases
- If an independent screenshot was captured from v128 or earlier, it cannot mark a v129 state identical.
- The state must be recaptured from v129.
- This keeps parity evidence tied to the actual code being released.

### 5. Legacy LIVE evidence
- Existing LIVE captures are backfilled as `live-master-legacy`.
- Their route family is bound to the parity state ID.
- Screenshot bytes remain unchanged.

### 6. Capture queue guidance
- Each independent capture now states:
  - required recovery release
  - stable route family
  - matching LIVE device/viewport profile when available.

### Release integrity
- Recovery build advances to v129 / `1.0.0-rc.129`.


## v130 — Release Evidence-Chain Fingerprint Milestone

### 1. Shared-core fingerprint bound into evidence governance
The current shared-core fingerprint is:

`2863f0efd18715c523e8a2adffe172e75c1f8d56e72db1b83b6bd1ed44cb17b9`

It is now stored in:
- `FIRE_UNIFIED_RELEASE.json`
- `CURRENT_VERSION.json`
- `SHARED_CORE_MANIFEST.json`
- `UNIFIED_RELEASE_PACKAGE.json`
- `PARITY_EVIDENCE_MANIFEST.json`

### 2. Independent capture fingerprint required
- Evidence registration adds `--source-fingerprint`.
- New independent evidence must record the exact shared-core fingerprint of the build that produced it.
- `VERIFIED_IDENTICAL` is rejected when the independent evidence fingerprint differs from the current recovery fingerprint.

### 3. Comparison fingerprint binding
Saved comparison records now persist:
- LIVE source fingerprint
- independent source fingerprint

Strict parity rejects comparisons whose saved fingerprints no longer match current registered evidence.

### 4. Legacy LIVE evidence handled honestly
- Existing LIVE screenshots were captured before shared-core fingerprint provenance was recorded.
- They are marked with a deterministic legacy-unknown marker and `legacy-unknown-not-recorded-at-capture`.
- They are not falsely labeled as v130 source bytes.

### 5. Recovery ZIP cross-file consistency
The release-package validator now opens the ZIP and verifies all five authoritative governance files agree on:
- release version
- shared-core fingerprint

A valid-looking evidence manifest cannot be packaged with a different source tree.

### 6. Capture queue guidance
- Every independent capture now prints the exact required release.
- It also prints the exact required shared-core fingerprint and route family.

### Release integrity
- Recovery build advances to v130 / `1.0.0-rc.130`.


## v131 — Release Evidence Seal Milestone

### 1. New non-circular release evidence seal
- Added `RELEASE_EVIDENCE_SEAL.json`.
- Added `scripts/build-release-evidence-seal.mjs`.
- Added `scripts/validate-release-evidence-seal.mjs`.
- Added package commands:
  - `npm run release:evidence-seal`
  - `npm run release:evidence-seal:check`

### 2. What the seal covers
The seal hashes:
- current-version governance
- unified/shared-core/package manifests
- parity evidence manifest
- strict parity matrix
- master checklist
- current parity audit
- capture queue
- comparison queue
- parity progress
- every captured parity evidence file

### 3. Why the seal is non-circular
- It does not attempt to store the final ZIP hash inside the ZIP.
- Instead it seals the authoritative files and evidence bytes that define the release.
- The final ZIP still gets its normal external `.sha256` digest.

### 4. Strict parity fail-closed behavior
- Missing seal = failure.
- Missing sealed file = failure.
- Changed sealed file hash/size = failure.
- Seal count/digest mismatch = failure.
- Release/shared-core fingerprint mismatch = failure.

### 5. Independent preflight
- The seal manifest and both seal scripts are mandatory.
- Both build/check package commands are mandatory.

### 6. ZIP validation
- The validator opens the ZIP and re-hashes every sealed file.
- The computed seal digest must equal the stored seal.
- The seal release and shared-core fingerprint must match the package manifests.

### Release integrity
- Recovery build advances to v131 / `1.0.0-rc.131`.


## v132 — Canonical Recovery Package Hygiene Milestone

### 1. Canonical package policy
- Added `RELEASE_PACKAGE_POLICY.json`.
- Added `scripts/build-release-package.mjs`.
- Added `npm run release:package:build`.

### 2. Historical artifact cleanup
- Older top-level `FIRE_v*_...`, `LIVE_v*_...`, and `LIVE_V*_...` artifacts are excluded from the distributable.
- Only the current v132 release status and cumulative LIVE sync queue are retained.

### 3. Transient directory exclusion
The canonical builder excludes:
- node_modules
- dist
- .next
- .wrangler
- .git
- __pycache__
- .DS_Store

### 4. Fail-closed package validation
- ZIP validation rejects stale top-level versioned artifacts.
- Package policy and builder are mandatory recovery assets.
- The release evidence seal now covers the package policy itself.

### Release integrity
- Recovery build advances to v132 / `1.0.0-rc.132`.


## v133 — Current Recovery Documentation Alignment Milestone

### 1. README refreshed
- Removed obsolete v27 baseline language.
- Removed obsolete legacy parity-intake instructions.
- Documents the current v133 recovery workflow.
- Documents the standard 50% deposit plus the intentional owner scheduling exception.

### 2. GO / NO-GO refreshed
- Removed obsolete v14 candidate counts and old offline-build claims.
- Current GO rule is based on the real source gates plus isolated staging acceptance.
- Strict-parity governance PASS is explicitly not treated as rendered-parity completion.

### 3. Security/recovery status refreshed
- Migration range corrected to 20 contiguous migrations: 0000–0019.
- Current refund, restore, evidence, seal, and package-hygiene safeguards documented.
- Obsolete v90-era footer removed.

### 4. Independent deployment guide refreshed
- Header advanced from stale v124 to v133.
- Stripe test webhook guidance includes refund events.
- Evidence registration example now includes current source release/fingerprint, route family, capture profile, and compare/seal flow.
- Approved/signed scheduling-without-deposit exception is explicitly tested.

### 5. Staging acceptance corrected
- Removed obsolete rule that all approved jobs are unschedulable until deposit.
- Current intentional exception is now a required acceptance test:
  approved/signed jobs may be scheduled before deposit collection.
- Standard 50% deposit requirement and payment tracking remain intact.
- Removed stale live-v49 and v29+ wording.

### 6. Documentation freshness gate
- Added `scripts/validate-current-recovery-docs.mjs`.
- Added `npm run release:docs:check`.
- Independent preflight requires the validator and command.
- Recovery ZIP validation independently rejects stale current-facing instructions.

### 7. Evidence seal expansion
- README
- GO_NO_GO
- SECURITY_AND_RECOVERY_STATUS
- INDEPENDENT_DEPLOYMENT
- STAGING_ACCEPTANCE_TEST
- current-doc freshness validator
are now covered by the internal release evidence seal.

### Release integrity
- Recovery build advances to v133 / `1.0.0-rc.133`.


## v134 — Lifecycle Notification Race Integrity Milestone

### 1. Estimate first-view race fixed
- First-view notification insertion is now conditional on the request's own `first_viewed_at` timestamp actually winning the transition.
- `INSERT OR IGNORE` provides a second idempotency layer.

### 2. Invoice first-view race fixed
- Invoice first-view notification follows the same winner-only conditional insert.
- Concurrent page loads cannot produce duplicate `invoice_viewed` notifications.

### 3. Acceptance notification backstop
- Existing conditional acceptance logic remains atomic.
- Acceptance notification insertion now uses `INSERT OR IGNORE` as a database-idempotency backstop.

### 4. New migration 0020
`drizzle/0020_notification_lifecycle_unique.sql`:
- collapses historical duplicate lifecycle notifications;
- creates partial unique index `idx_notifications_unique_lifecycle`;
- enforces one notification per `(type, estimate_id)` for:
  - `estimate_viewed`
  - `invoice_viewed`
  - `estimate_accepted`.

### 5. Recovery compatibility
- Existing restore paths use `INSERT OR IGNORE`, so historical duplicate lifecycle notifications are safely skipped once the new index exists.
- Current recovery documentation now requires **21 contiguous migrations: 0000–0020**.

### 6. Database-level test
- Historical duplicates were seeded in SQLite.
- Migration 0020 reduced each lifecycle type to one row.
- A post-migration duplicate insert was rejected by the unique index.

### Release integrity
- Recovery build advances to v134 / `1.0.0-rc.134`.


## v135 — Legacy Notification Restore Compatibility Milestone

### 1. Pre-v134 backup compatibility
Older FIRE backups may contain duplicate lifecycle notifications created before the v134 uniqueness fix.

Restore now normalizes duplicates for:
- `estimate_viewed`
- `invoice_viewed`
- `estimate_accepted`

### 2. Deterministic preservation rule
For each `(type, estimate_id)` lifecycle key:
- preserve the earliest `created_at`;
- on an exact timestamp tie, preserve the lexicographically smallest notification ID;
- skip later duplicates;
- preserve unrelated notification types exactly.

### 3. Standalone restore
`scripts/restore-records-backup.mjs`:
- applies lifecycle normalization before planning inserts;
- reports `legacyLifecycleNotificationsSkipped` in dry-run and apply output.

### 4. In-app restore
`app/api/backup/route.ts`:
- applies the same lifecycle normalization before restore validation/insertion;
- reports `legacyLifecycleNotificationsSkipped` in the restore result.

### 5. Backup validation
`scripts/validate-records-backup.mjs`:
- accepts otherwise-valid legacy backups with duplicate lifecycle events;
- reports `legacyLifecycleNotificationDuplicates`;
- clearly documents that restore preserves the earliest historical row.

### 6. Compatibility test
A synthetic pre-v134 backup with two duplicate lifecycle notifications validated successfully.
The actual standalone normalizer preserved the earliest estimate-view and invoice-view rows and kept an unrelated payment-overage notification.

### Release integrity
- Recovery build advances to v135 / `1.0.0-rc.135`.


## v136 — Restore Post-Apply Verification Milestone

### 1. Standalone restore verifies persisted records
- Existing per-record post-apply verification remains.
- Restore now also verifies the lifecycle-notification uniqueness invariant after apply.
- Success output explicitly reports:
  - `fieldValuesVerified: true`
  - `lifecycleNotificationUniquenessVerified: true`

### 2. In-app restore now verifies writes
Previously the browser restore counted `INSERT OR IGNORE` results but did not re-read inserted records before reporting success.

It now:
- tracks record insert statements separately from compatibility/derived statements;
- identifies which records were actually inserted;
- re-reads each newly inserted record by identity;
- compares every restored column against the normalized backup value;
- verifies inserted-record count equals verified-record count.

### 3. Merge-only behavior preserved
- Rows already present in the target remain preserved.
- Preserved rows are not falsely required to match mutable backup fields.
- Only newly inserted records are field-verified.

### 4. Lifecycle invariant verified after recovery
Both restore paths query for duplicate lifecycle notifications after apply.
Restore fails closed if any duplicate remains for:
- `estimate_viewed`
- `invoice_viewed`
- `estimate_accepted`

### 5. New verification contract
- Added `scripts/validate-restore-verification.mjs`.
- Added `npm run restore:verify-contract`.
- Independent preflight and recovery-package validation require the checker.
- The release evidence seal covers the checker.

### Release integrity
- Recovery build advances to v136 / `1.0.0-rc.136`.


## v137 — Restore Audit Transparency Milestone

### 1. Restore attempt audit ID
- In-app restore assigns a unique `attemptId`.
- Audit metadata accompanies success and verification failures.

### 2. Phase tracking
Restore audit tracks:
- input validation
- target conflict validation
- write apply
- record verification
- invariant verification
- complete

### 3. Post-write failure distinction
- Before writes: HTTP 400 with `writesAttempted=false`.
- After writes: HTTP 500 with `writesAttempted=true`.
- Post-write failures explicitly instruct the operator to inspect the audit before retrying.

### 4. Progress counters
Audit records:
- inserted records
- verified records
- skipped legacy lifecycle duplicates
- lifecycle uniqueness verification status.

### 5. Standalone restore
Managed restore output now includes a matching restore-audit object with expected inserted rows, verified rows, verification phase, and lifecycle invariant result.

### Release integrity
- Recovery build advances to v137 / `1.0.0-rc.137`.


## v138 — Restore Failure Audit Completeness Milestone

Apply after every earlier cumulative item in this queue.

- `scripts/restore-records-backup.mjs`
  - Add a unique restore audit `attemptId` for the managed/standalone restore path.
  - Mark `target_conflict_validation` before target identity inspection.
  - Include restore audit state in dry-run/no-op output.
  - For no-op apply, verify lifecycle notification uniqueness before reporting complete.
  - If an error occurs after writes were attempted, emit structured audit data and explicitly require inspection of the restore audit before retrying.
- `app/api/backup/route.ts`
  - Route every post-write record/invariant verification failure through one audit-first failure helper.
  - Include explicit `Database writes occurred. Inspect the restore audit before retrying.` guidance on those failures.
- Preserve merge-only restore semantics, existing-record preservation, lifecycle uniqueness, refund/payment identity protections, photo recovery ownership protections, and every earlier billing/review/refund safeguard.
- Do not claim full rendered parity. Independent evidence remains required for all 32 parity states.
