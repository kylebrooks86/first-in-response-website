# FIRE App polish update — 2026-09-29

This staging-only independent recovery copy was updated without modifying the live ChatGPT-hosted FIRE App, production website, DNS, customer records, or payment integrations.

## Updated
- New estimates now open with no preselected service and no fabricated measured quantity.
- Measured services remain blank until a real field quantity is entered; flat-rate job services default to quantity 1 only after selection.
- The $150 minimum is applied only after a valid service and positive quantity are entered.
- Estimate save now blocks missing service or non-positive quantity with clear field errors.
- Review-request copy now says Google is preferred while Facebook and Yelp are also greatly appreciated.
- Mobile top navigation now exposes four persistent controls: Menu, Back, Home, and Theme.
- The mobile/top header no longer uses backdrop blur; it renders as a solid surface to avoid the edge-blur problem.
- The ChatGPT tool-side estimate validator now also requires a real positive quantity.

## Safety
- No live data imported.
- No Stripe/payment provider enabled.
- No production domain or DNS changes.
- No live FIRE App publish performed from this staging package.

## Continuation pass — workflow and price book
- Corrected estimate completion copy to state: 50% deposit reserves the customer's place on the schedule; remaining balance is due when work is completed.
- Added a one-tap "Mark job complete" action for scheduled jobs.
- Prevented final invoice creation until the job status is completed, in both the UI and invoice API.
- Removed the old invoice-side effect that could silently advance a draft estimate to approved.
- Added confirmed price-book items that were missing from the recovered app:
  - 2nd Floor Exterior Windows — $11/window
  - 1st Floor French Pane Windows — $12/window
  - 2nd Floor French Pane Windows — $18/window
  - 1st Floor Screen Cleaning — $3/screen
  - 2nd Floor Screen Cleaning — $6/screen
  - Trash Bin Cleaning — $25/bin
- Left services with unconfirmed current rates unchanged rather than guessing.

## v3 field-work polish
- Added a five-stage visual job tracker to every estimate/job detail: Draft → Sent → Approved → Scheduled → Completed.
- Added a clear declined-state panel instead of leaving declined estimates visually ambiguous.
- Added paid/balance progress with a percentage indicator directly in the job detail.
- Refined next-action guidance so scheduled jobs end with "mark job complete," completed jobs without invoices lead to invoice creation, and invoiced jobs lead to remaining payment/review.
- Renamed the deposit summary to "Deposit to reserve" and balance to "Balance due" to match FIRE's operating policy.
- Added a customer snapshot showing record count, paid amount, open balance, and current stage.
- Added a one-tap "Continue current job" card on customer profiles that opens the highest-priority active job.
- Added mobile-specific layout rules for the stage tracker and customer snapshot.

### Verification note
A TypeScript syntax pass completed without parser/syntax failures. Full dependency-based build verification remains unavailable in this environment because the package manager/dependencies cannot be downloaded from the network.


## v4 guided closeout pass
- Added a guided scheduled-job closeout panel with completion-report readiness, deposit status, and photo reminder.
- Mark Job Complete is now gated behind a fully saved service completion report.
- Added the same completion-report requirement to the estimate API so the rule cannot be bypassed from another UI path.
- Job report saves now immediately refresh closeout readiness.
- Preserved the rule that final invoice creation occurs only after the job is completed.

## v5 field closeout + payment safeguards
- Added direct rear-camera Before and After photo capture to scheduled/completed job details, with saved photo counts.
- Added completed-job customer handoff progress for invoice, remaining payment, and review request.
- Review-request status now updates in the open job after the message is prepared/sent.
- Customer payment checkout now requires estimate approval/signature before accepting a reservation deposit.
- Partial reservation payments charge only the amount still needed to reach the 50% deposit.
- Remaining-balance checkout is blocked until the job status is Completed.
- Customer estimate portal no longer exposes the remaining-balance payment early; it explains that the balance becomes due after completion.
- Corrected the legacy payment-page wording so the deposit reserves the schedule after approval rather than approving the estimate itself.
- Added a refresh after customer signature/approval so newly eligible deposit controls can appear without reopening the link.
- Focused TypeScript transpile checks passed for all modified files. Full project typecheck is still blocked in this isolated package by missing external type packages.


## v6 workflow/payment consistency
- New final invoices are due immediately upon job completion instead of using a conflicting 14-day term.
- Customer invoice shows total, paid-to-date, and remaining balance.
- Completed-job invoices can launch secure remaining-balance checkout directly when Stripe is connected.
- Stripe return verification now synchronizes invoice status to partial/paid after payment is confirmed.
- Customer payment pages show the actual deposit remaining or final balance instead of repeating the original 50% amount.
- Payment confirmation wording no longer promises an emailed receipt unless an email delivery integration exists.
- Customer-facing payment buttons show the exact amount being charged.

- Owner-side Payments now reports only amounts actually due now: reservation deposits for approved/scheduled work and full remaining balances only after completion.
- Manual payment recording is backend-enforced to prevent collecting beyond the 50% deposit before job completion.
- Payment cards and dialogs label deposit due vs final balance due correctly.
- Payment summary layout now adapts cleanly to two or three columns on narrow screens.

## v7 workflow consistency and mobile search
- Corrected the dashboard Outstanding metric so draft/sent estimates do not count as money due. Approved/scheduled jobs count only the unpaid portion of the 50% reservation deposit; completed jobs count the unpaid final balance.
- Creating a new draft estimate no longer inflates Outstanding in the current app session.
- Global search now filters the Ready to schedule list as well as scheduled jobs.
- Added a searchable field inside the mobile slide-out menu without changing the four-button top control layout. Pressing Enter opens matching customer results; the search can be cleared in one tap.

## v8 workflow safety pass
- Enforced the business booking policy at the API level: an approved job cannot be placed on the schedule until the full 50% reservation deposit is recorded.
- Scheduling now also requires a real job date/time; the manual status control can no longer create a date-less Scheduled job.
- A job cannot jump directly to Completed without first being Scheduled, and the existing completed job-report gate remains enforced.
- The estimate detail view now explains exactly how much deposit remains and disables scheduling until the reservation deposit is complete.
- The Schedule workspace separates "Ready to schedule" jobs from "Waiting on deposit" jobs.
- Final invoices now inherit existing payment history: a job with a recorded deposit starts the invoice as Partial rather than misleadingly showing Draft.

## v9 reliability polish
- Added duplicate-submit protection and progress labels for task and expense creation.
- Added explicit validation and visible success/error feedback for owner business records.
- Added optimistic task status updates with rollback if the server rejects the change.
- Added unsaved-change protection for message templates when switching templates or leaving the page.
- Added confirmation before restoring a message template to the FIRE default.
- Preserved all v8 booking, payment, invoice, scheduling, completion, and mobile-navigation safeguards.

## v10 release-readiness hardening

- Updated stale recovery-package identity references so deployment docs no longer describe the current polished build as the old v33 snapshot.
- Added `npm run preflight:independent`, a zero-network source/deployment preflight that checks Node version, required recovery files, core scripts, migration continuity, hosting-isolation guardrails, and optional staging resource environment values.
- Added the preflight as a required stop/go gate before Cloudflare staging resource creation.
- Removed disposable local runtime/compiler artifacts from the distributable staging package; they are not needed to restore, build, or deploy the app.
- Preserved the production safety boundary: no production domain, DNS, live database, live bucket, customer data, or payment provider is attached by this package.


## Release-readiness v11
- Verified all 10 D1/SQLite migrations apply cleanly to a new database.
- Added backup validation for normal app exports and verified complete live-database snapshots.
- Updated in-app restore and managed restore tooling to accept both safe formats.
- Verified the September 28 live snapshot is complete and contains 27 database rows.
- Confirmed incomplete/truncated snapshots are rejected.
- Full dependency-aware production compilation remains blocked in this environment because registry.npmjs.org cannot be reached.

## Payment-method update — v15
- Added Cash App and Venmo to the owner-facing Record payment method selector.
- Updated Payments and dashboard helper wording to list Cash App and Venmo alongside Wave, cash, check, card, and bank transfer.
- Kept the existing server-side payment timing, deposit, balance, and total protections unchanged.
- Added a release-readiness assertion so Cash App and Venmo remain present in future release candidates.


## Payment handle update
- Added Cash App handle `$FIREExteriors`.
- Added Venmo username `@FirstInResponseExteriors`.
- Customer estimate, invoice, and payment pages now show both handles as alternate payment options.
- Handles are centralized in `lib/payment-methods.ts` and may be overridden at deployment with `CASH_APP_HANDLE` / `VENMO_HANDLE`.
