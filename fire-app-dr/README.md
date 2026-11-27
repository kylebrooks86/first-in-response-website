# First In Response Exteriors — Independent FIRE App Recovery

This is the independently hostable disaster-recovery/staging source for **FIRE App v138**.

It preserves the current customer, estimate, invoice, payment/refund, scheduling, job-report, backup/restore, photo, and owner workflows while using isolated Cloudflare Worker/D1/R2 resources for the independent deployment.

No production domain, production database, production storage bucket, customer record, or live integration is changed by this package.

## Start here

Run the current source gates before deployment:

```sh
npm run preflight:independent
npm run release:readiness
npm run release:strict-parity
npm run release:evidence-seal:check
```

Then follow:

- `INDEPENDENT_DEPLOYMENT.md`
- `STAGING_ACCEPTANCE_TEST.md`
- `PARITY_CAPTURE_RUNBOOK.md`
- `PARITY_CAPTURE_QUEUE.md`

## Important business rules

- Standard estimate deposit remains **50%**.
- The customer-facing estimate continues to describe the 50% deposit as the normal way to reserve the schedule.
- **Intentional owner exception:** after the customer has approved/signed the estimate, the owner may schedule the job without first collecting the deposit.
- Remaining balance is due after completion.
- Final invoice totals become canonical billing totals once an invoice exists.
- Refund processing, overpayment review, payment actions, invoice edits, and review requests follow the current server-side safety gates.

## Current parity status

Strict rendered parity remains `NOT_YET_FULLY_VERIFIED` until all required LIVE and independent rendered evidence is captured and compared.

Use:

```sh
npm run parity:capture:queue
npm run parity:progress
```

Do not use the disabled legacy `parity:evidence:intake` workflow.

## Required secrets

- `FIRE_ADMIN_PASSWORD_HASH`
- `FIRE_SESSION_SECRET`
- optional Stripe test-mode secrets only when deliberately testing Stripe in isolated staging

Never store real secret values in this package.
