# Customer Follow-up Action Center — feature review

Feature branch: `work/customer-followup-action-center-2026-10-21`.
Starting owner checkpoint: `c729f42de48ce03fb0435742084241602e0adec5` (CI `39541738725`, successful).
Preserved newer development through `8bfa6c39e6abccdab1a0d2d87d1fbc96f65b4b86` (CI `39548675126`, eight successful jobs). Earlier unfinished scratch edits remain in the original worktree; they were not overlaid on this newer source.

## Working scope

The existing Follow-ups page becomes the Action Center. It retains priority/category filters, exact customer/estimate navigation, bounded pagination, read-only reconciliation and per-estimate contact history. New Due, Snoozed and Recorded views derive exclusively from existing estimate/message records; there is no new checklist, database migration or duplicate ledger.

- Due retains owner-review-first billing exceptions and current reminder timing. Billing exceptions cannot prepare a customer payment reminder.
- Snoozed exposes valid future estimate pauses. Expiry returns work to the existing eligibility rules. Invoice and overpayment records cannot hide in this queue.
- Recorded shows recent manual contact, satisfied reminder stages and the final reminder stage. It does not mean delivery, customer acceptance or a completed job. Resending an estimate starts a new cycle; old final-stage history cannot complete that cycle.
- Cards distinguish estimate/invoice send confirmation from creation, copying and preparation. Invoice send metadata is owner-only, bound to both estimate and customer and excludes prepared/copy/legacy channels. Message bodies are not added to the list API.
- Exact invoices use the existing owner-preview URL. Customer and estimate callbacks retain their exact saved identifiers.
- Contact and seven-day snooze show a focused confirmation with customer/service and consequences. Opening or cancelling it writes nothing. Confirming reuses the existing idempotent endpoint. An ambiguous reply retains the original operation ID; no automatic write retry occurs.
- A verified save refreshes queues and any open per-estimate contact history. Preparing/copying a message refreshes history without claiming a send. The real existing composer still requires explicit owner confirmation after external sending.
- Empty search results no longer claim the owner is caught up. Queue counts explicitly cover loaded records; older records remain accessible through existing pagination.

## Verification

Local: TypeScript; actual follow-up handlers with ambiguous responses and rapid taps; pagination/read recovery and stale reads; notification/deep-link regressions; 36 original timing cases plus saved-history expiry/resend cases; actual SQLite owner-only invoice metadata SQL; shared parity gate and financial regression.

The feature branch enables the existing complete eight-job CI workflow without changing hosted permissions. A new real-Chrome fixture mounts actual FollowUpsView and MessageComposer, real UI primitives/Radix and compiled shared CSS at 320x568, 390x844 and 844x390, light/dark. Synthetic tests cover queue transitions, exact targets, privacy-bound history errors, editable/copy-only message preparation, confirmation/cancellation, save recovery, same-ID retry and read failure. Screenshots are retained as `fire-followup-center-mobile-ui`. A fixture compilation pass alone is not a rendered/browser pass; consult the exact commit's completed CI.

## Release boundary

Feature branch only; not merged, deployed or physically accepted on iPhone. Production acceptance remains **3/10 gates (30%)**. No real customer records, hosted databases, migration history, Stripe processing or protected environment changed.

Owner-observed original-backup restoration, original 23-migration schema comparison and local 23-to-25 rehearsal remain completed; do not repeat them merely for this UI feature. Before any future hosted release, retain the original private export/checksum/receipts on encrypted access-controlled storage plus an independently recoverable secure copy, verify both copies against the recorded original hash, and retain authenticated Cloudflare account/Worker/D1-binding provenance. Execution freshness still applies to read-only identity/schema evidence. Exact migration and Worker-publication approvals remain separate and absent. Physical iPhone testing remains outstanding.

Concurrent development through `42abfe41c6b8dd5ed359217adb29475c353714eb` was reviewed and reconciled on this feature branch, preserving urgency ranking, timing filters, confirmed/prepared timestamps and deep-link filter reset alongside saved-state queues. The development branch itself was not updated.

Next bounded review: finish exact-commit CI and inspect mobile screenshots, then review integration against the current development head. Do not auto-merge this overlapping feature branch. Follow with physical QA usability once the separate hosted release safeguards and approvals are satisfied.
