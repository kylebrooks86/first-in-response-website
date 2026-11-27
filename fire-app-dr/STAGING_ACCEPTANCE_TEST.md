# FIRE App — Staging Acceptance Test

Use this checklist only on the isolated temporary staging deployment. Do not connect the production domain or import real business data until every blocking test passes.

## Gate A — Before deployment

- Run `npm run preflight:independent` and require every check to PASS.
- Run `npm run release:readiness` and require every check to PASS.
- Confirm the Worker, D1 database, and R2 bucket names all contain `staging` and are newly created.
- Confirm no production domain is attached.
- Confirm the staging database is empty before migrations.

## Gate B — Authentication

1. Open the temporary `workers.dev` URL in a private browser window.
2. Confirm it redirects to the owner login page.
3. Enter a wrong password once; confirm access is denied.
4. Confirm the correct owner password opens the dashboard.
5. Sign out and confirm the dashboard is inaccessible afterward.
6. Do not intentionally trigger the five-failure lockout during the main acceptance run; test lockout separately if desired.

## Gate C — Disposable customer and estimate

Use a fake customer such as `FIRE Staging Test` with no real customer contact information.

1. Create a new estimate.
2. Confirm no service quantity is prefilled for measured services.
3. Confirm a zero/blank measured quantity cannot be saved.
4. Confirm an estimate below $150 cannot be created.
5. Create a House Wash estimate and verify the rate basis is $0.22/sq ft.
6. Verify the deposit shown is exactly 50% of the final estimate total.
7. Verify the estimate says the 50% deposit is required to be placed on the schedule and the remaining balance is due upon completion.

## Gate D — Approval, deposit, and scheduling

1. Open the customer estimate link.
2. Approve/sign the disposable estimate.
3. Confirm the standard required deposit remains exactly 50% of the approved estimate total.
4. Confirm the **intentional owner exception** works: after approval/signature, the owner may choose a job date and schedule the job even when the deposit has not yet been collected.
5. Record the disposable deposit using a non-live/manual staging method unless Stripe test mode has been deliberately configured.
6. Confirm recording the deposit updates paid/deposit state without changing the already-saved schedule unexpectedly.
7. Confirm a scheduled job still requires a valid date/time.
8. Confirm overdue unresolved jobs appear under `Needs attention` and future scheduled jobs appear under `Upcoming jobs`.

## Gate E — Field workflow

1. Open the scheduled job on an iPhone-sized screen.
2. Verify Menu, Back, Home, and Theme remain available.
3. Capture one disposable before photo and one disposable after photo.
4. Complete the job report.
5. Confirm the job cannot be marked complete until the completion report is complete.
6. Mark the job complete.

## Gate F — Invoice and payment

1. Confirm a final invoice cannot be created before job completion.
2. Create the invoice after completion.
3. Confirm the invoice begins as Partial when the 50% deposit is already recorded.
4. Confirm the invoice shows total, paid, and remaining balance.
5. Confirm the remaining-balance payment action is unavailable before completion and available after completion when online payments are configured.
6. Record the remaining payment and confirm the invoice/job reaches Paid.

### Stripe test-mode subtest, when configured

1. Use Stripe test mode only; never use a live card during staging.
2. Confirm the customer cannot open Stripe Checkout before approving/signing the estimate.
3. Confirm Stripe Checkout offers only the remaining amount needed to reach the 50% deposit.
4. Complete the test deposit and confirm FIRE records it even if the return page is not relied upon; the signed Stripe webhook is the primary confirmation path.
5. Reload/return through the success URL and confirm the same Checkout Session is not recorded twice.
6. Before job completion, confirm a final-balance Stripe checkout request is rejected.
7. After completion, confirm Stripe Checkout offers only the actual remaining balance.
8. Complete the final test payment and confirm Payment History and invoice status update correctly.

## Gate F2 — Refund lifecycle

Use only disposable staging payments.

1. From Payment History, verify a positive payment exposes the Refund action and remaining refundable amount.
2. Verify a partial refund cannot exceed the remaining refundable amount.
3. For a manual-method test payment, confirm FIRE requires external-return confirmation before recording the refund.
4. Confirm a successful partial refund creates exactly one negative Refund ledger row and reopens the correct invoice/job balance.
5. Confirm a pending refund suppresses new payment actions, invoice edits, overpayment resolution, and review requests.
6. Confirm refund completion restores the correct invoice lifecycle from the persisted paid ledger.
7. Confirm a repeated completion/retry does not create a second negative refund ledger row.

## Gate G — Review and customer closeout

1. Prepare the review request.
2. Confirm the wording says Google is preferred and Facebook/Yelp are also appreciated.
3. Confirm the customer record shows the review request as sent/prepared according to the workflow.
4. Confirm the completed/paid job no longer appears as money due now.

## Gate H — Backup and recovery

1. Export a fresh staging JSON backup.
2. Run `npm run validate:backup -- <backup-file>` locally and require PASS.
3. Dry-run restore into the same isolated staging database and confirm existing IDs are skipped rather than overwritten.
4. Upload one disposable photo, export the photo archive, and dry-run photo restoration.
5. Confirm no real customer data was used during the acceptance test.

## GO / NO-GO

**GO** only when all blocking tests above pass, the temporary staging URL behaves correctly on the owner's iPhone, and a fresh rollback/export exists.

**NO-GO** if authentication, pricing, deposit enforcement, scheduling gates, completion gates, invoice/payment math, backup validation, or restore safety fails. Fix the staging build and repeat the acceptance test before importing real records.

## Strict parity fixture — current release
Use the disposable parity fixture in isolated staging to reproduce the same UI states in both deployments before taking comparison screenshots.

1. Validate fixture without changing data:
   `npm run parity:fixture:validate`
2. Dry-run records restore:
   `npm run parity:fixture:load -- --remote --config dist/server/wrangler.independent.json`
3. Apply records only after confirming the isolated staging DB:
   `npm run parity:fixture:load -- --remote --config dist/server/wrangler.independent.json --apply --confirm-database <staging-db-name>`
4. Dry-run photo restore, then apply to the isolated staging bucket with `--apply --confirm-bucket <staging-bucket-name>`.
5. Capture the parity matrix screens/states using the single customer named `Parity Test Customer`.
6. Remove all disposable parity data after capture with `npm run parity:fixture:remove -- --remote ... --apply --confirm-database <staging-db-name> --confirm-bucket <staging-bucket-name>`.

Never load this fixture into the real production database. Every fixture identity begins with `parity-` to make accidental mixing obvious and cleanup narrowly scoped.
