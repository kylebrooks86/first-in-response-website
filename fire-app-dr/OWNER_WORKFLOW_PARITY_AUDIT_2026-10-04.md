# FIRE DR — Owner Workflow Parity Audit

Updated: 2026-10-04

This is source-level parity protection, not rendered proof. Formal status remains `NOT_YET_FULLY_VERIFIED`.

## Business screen

Verified in DR source and now build-guarded:

- Business heading / owner-operations layout
- Full records backup
- Photo archive control (UI retained; DR still has no R2 binding)
- Restore missing records
- Export for Wave
- Tasks and reminders
- Expenses
- Open-task / monthly-expense / recorded-expense metrics
- Empty task / expense states
- Merge-style restore confirmation that says existing records are not deleted or overwritten
- Warning that photo files are separate from the JSON records backup

## Templates

Verified in DR source and now build-guarded:

- editable email subject where applicable
- editable template body / service-agreement text
- personalized merge-tag insertion
- Text + email channel label
- Restore default
- Save template
- mobile template-selection/editing overlay already confirmed by the owner

## Final invoice owner workflow

Verified in DR source and now build-guarded:

- Edit final invoice
- add/remove services and adjust prices
- due on receipt or a specific date
- percentage/dollar final-invoice discount
- invoice revision history
- prior revision service lines and totals
- save invoice changes
- recorded payments preserved and invoice total cannot be reduced below paid amount

## Refund / billing-exception owner workflow

Verified in DR source and now build-guarded:

- Refund payment modal
- refund amount and note
- Stripe refund path
- manual refund path requiring external-return confirmation
- pending/succeeded refund lifecycle
- durable negative refund ledger entry
- unresolved overpayment visibility
- Keep as overpayment action
- Payment review / Billing exception open / Refund processing states

## Backup / restore integrity

Verified in DR source and now build-guarded:

- records format `fire-app-records-backup`
- invoice revision history included
- checkout-session safety state included
- refund history included
- restore audit attempt ID
- input-validation and target-conflict-validation phases
- photo-file exclusion warning retained

## Common owner empty states guarded

- No matching estimates
- No upcoming jobs
- No invoices yet
- No payments recorded
- No agreements yet
- No notifications yet

## Guard execution

`scripts/verify-fire-dr-owner-workflows.py` is now called by `scripts/prepare-fire-v138-dr-no-r2.sh` before dependency installation/build. A future source change that removes one of the protected owner-workflow contracts will stop the DR preparation step instead of silently drifting away.

## Still not claimed

This audit does not prove pixel-identical rendering of Business, Templates, invoice editing/history, refund states, or empty/error states. Those remain pending in the formal rendered-evidence ledger.

Scrolling/smoothness remains frozen and is intentionally outside this audit.
