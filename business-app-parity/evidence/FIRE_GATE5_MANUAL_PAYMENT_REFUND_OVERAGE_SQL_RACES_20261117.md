# FIRE Business App — Gate 5 manual payment second-device refund/overage holds, SQL-time

**Date:** 2026-11-17 (America/Chicago)  
**Exact executable app + test SHA:** `bcb71bc9f8712b4f80d24e96c49f247c0a83f3cb`  
**Draft PR:** [#270](https://github.com/kylebrooks86/first-in-response-website/pull/270), unmerged/undeployed

## Actual source defect (not a repeated gate/checklist audit)

The authenticated FIRE `shared/app/api/payments/route.ts` manual payment POST already refused to record a principal/tip when a **Stripe refund was pending** or a **payment_overage alert was unresolved** at its preliminary reads. The actual conditional D1/SQLite `INSERT INTO payments ... SELECT` guarded live checkout and cross-customer invoice mismatch, but it did **not** recheck pending refunds or unresolved overage at the write. Thus a separate device, payment-refund event, or reconciliation action could introduce those two conditions after the read but immediately before the financial INSERT, and a stale request could still save money/tips. This was a genuine concurrency safety gap.

## Real functional code repaired

- [`f320f4c`](https://github.com/kylebrooks86/first-in-response-website/commit/f320f4c91edfc3bf7087d5c05b5a645d8ddb6c6): keep all existing due/amount, checkout, status, customer invoice ownership and lost-ack processing, but add **both** the following exact SQL-time anti-race gates to the real manual-payment principal INSERT and independent tip-only INSERT:

  ```sql
  AND NOT EXISTS (SELECT 1 FROM payment_refunds r
    WHERE r.estimate_id=? AND r.status='pending')
  AND NOT EXISTS (SELECT 1 FROM notifications n
    WHERE n.estimate_id=? AND n.type='payment_overage' AND n.resolved_at IS NULL)
  ```

  Both checks use the **same bound estimate ID** as the payment being saved; the principal+tip batch inherits the principal guard and does not create the paired tip when the first payment is rejected. Failure reports newly changed checkout/refund/overage status; owner is directed to refresh/reconcile. This does not create a Stripe refund, change existing provider events or touch live billing.

- [`bcb71bc`](https://github.com/kylebrooks86/first-in-response-website/commit/bcb71bc9f8712b4f80d24e96c49f247c0a83f3cb): extend the **existing native SQLite real route** fixture `shared/scripts/test-manual-payment-confirmation.mjs`, *already mandatory* in GitHub CI. Use the existing `beforePaymentInsert` injection hook to mutate disposable native SQLite **after the API's preliminary SELECT but before actual INSERT**, not a synthetic text-only assertion. Test five separate races:
  1. A pending refund appears before a regular principal save — HTTP 409, no additional payment, same exact original attempt succeeds once refund hold removed.
  2. A new unresolved `payment_overage` notification appears before principal save — 409, zero new money, same attempt succeeds once resolved.
  3. A refund becomes pending before a tip-only INSERT — 409, no tip, later valid tip saves after hold clears.
  4. An overage becomes unresolved before tip-only INSERT — 409, no tip; legitimate tip after resolution succeeds.
  5. An overage appears during a principal+tip batch — 409, neither payment nor orphaned tip/notification is recorded; after resolution the paired principal+tip succeeds.

  Preserve existing settled payment, exact-cents, no-checks method, invoice customer ownership, signed Stripe checkout/refund holds, cash/Cash App/Venmo/manual-tip and idempotent lost-ACK scenarios. No actual customer records or payment processor receives anything.

## Exact execution

[GitHub Actions on executable SHA `bcb71bc`](https://github.com/kylebrooks86/first-in-response-website/commit/bcb71bc9f8712b4f80d24e96c49f247c0a83f3cb/checks) includes [Staging offline run #44222846258](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44222846258). Mandatory job **“Gate 8 built QA Worker HTTPS Customer view and return (disposable, no deploy)”**, step **“Gate 5 real manual payment API — invoice customer ownership, lost-ACK replay, principal/tip atomic race (SQLite only)”** has **COMPLETED SUCCESS** on that exact SHA; this executes the actual payment route and the newly injected refund/overage race tests with native SQLite. First global CI check: **24/25 workflow groups success, 0 failures, staging umbrella still finishing unrelated Chrome suites**. Recheck before claiming 25/25.

## Release/authorization boundaries

Local tested app source does **not** prove a hosted D1 payment flow, provider Stripe webhook/refund delivery, live manual receipt, or target-specific Gate 5 acceptance. Previous already-approved QA owner screenshots, backups, protected dark DR/NEW LIVE and Stripe TEST Access screen evidence remain accepted and should not be repeated.

**Formal status remains 45/95 checklist items completed; 4/10 gates accepted G1/G2/G3/G8; G4/G5/G6/G7/G9/G10 OPEN.** NEW LIVE DARK NO-GO and first real Job #0001 unused. No paid Cloudflare plan/R2 activation, account login/retry, source merge, Worker deploy, SQL/D1 mutation, Stripe change, production payment, customer communication, routes/Access/DNS or legacy app cutover.

## FINAL exact-source CI readback — all workflows PASS

[Source + test commit `bcb71bc9f8712b4f80d24e96c49f247c0a83f3cb`](https://github.com/kylebrooks86/first-in-response-website/commit/bcb71bc9f8712b4f80d24e96c49f247c0a83f3cb/checks) has now **25/25 GitHub Actions workflow groups SUCCESS, zero failures, zero pending**. [Exact staging run #44222846258](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44222846258) has **all 6/6 jobs SUCCESS**, including the *changed* actual native SQLite Gate 5 manual-payment API step. Earlier 24/25 pending figures above are historical and **superseded by this final confirmed outcome**. The test is local synthetic money/accounting, not hosted D1/Stripe/physical release acceptance.
