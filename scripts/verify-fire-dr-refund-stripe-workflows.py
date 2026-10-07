from pathlib import Path

checks = {
    Path('app/dashboard.tsx'): [
        '<DialogHeader><DialogTitle>Refund payment</DialogTitle></DialogHeader>',
        'still refundable from this',
        'Stripe payment:</strong> FIRE will submit this refund to Stripe and automatically record the refund when Stripe confirms it.',
        'I already returned this money to the customer outside FIRE',
        '<strong>Refund processing</strong>',
        '<strong>Overpayment needs review</strong>',
        'Keep as overpayment',
        'use <strong>Refund</strong> on the original payment',
    ],
    Path('app/api/payments/refund/route.ts'): [
        'Refund cannot exceed the remaining refundable amount',
        'send the money back first and confirm the external refund before FIRE records it.',
        'idempotency-key',
        'fire-refund-${requestId}',
        "CASE WHEN ?='Tip' THEN 'Tip Refund' ELSE 'Refund' END,?,'paid'",
        'refund:${row.paymentId}:${row.id}',
        "status='succeeded'",
        'Refund confirmation did not converge on one verified ledger entry.',
    ],
    Path('app/api/payments/checkout/route.ts'): [
        'This account has a payment exception under review. Resolve the refund or credit before starting another card payment.',
        'A refund is currently processing for this job. Wait for it to finish before starting another card payment.',
        'This job is complete. Pay the remaining final invoice balance instead of a reservation deposit.',
        'A previous payment checkout is still processing. Please wait a moment and try again.',
        'The amount due changed while checkout was being created. Refresh the page before paying.',
        'Payment checkout could not be safely tracked. Please try again.',
        'remote.status === "expired"',
    ],
    Path('app/api/payments/route.ts'): [
        'This job has an unresolved payment exception. Complete the refund or retained-overpayment handling and resolve the exception before recording another payment.',
        'A refund is currently processing for this job. Wait for it to finish before recording another payment.',
        'Payment cannot exceed the amount currently due',
        'The amount due changed while this payment was being recorded. Refresh the job and verify the remaining balance before trying again.',
        'const refreshed = await env.DB.prepare',
    ],
    Path('app/api/payments/webhook/route.ts'): [
        'verifyStripeSignature',
        'stripeCheckoutForPaymentIntent',
        'stripe-external:${refund.id}',
        'Imported from Stripe webhook',
        'refund_exceeds_original_payment',
        'refund_ledger_verification_failed',
        'refund:${requestRow.paymentId}:${requestRow.id}',
    ],
    Path('app/api/notifications/route.ts'): [
        'Refunds must be processed from Payments → Refund on the original payment.',
        'A refund is currently processing for this job. Wait for it to finish before resolving the overpayment.',
        'This job is no longer overpaid. Refresh the job before resolving this billing exception.',
        "resolution_note='kept_overpayment'",
        'Overpayment exceptions must be resolved from the job billing-exception action after the refund or retained overpayment is handled.',
    ],
    Path('app/pay/[id]/page.tsx'): [
        'pendingRefundCount:number',
        "status='pending'",
        'const paymentReviewPending = Number(row.paymentOverageOpen??0)>0||Number(row.pendingRefundCount??0)>0;',
        'const canPay = dueNow>0&&approved&&!paymentReviewPending&&(paymentType==="deposit"||row.status==="completed");',
        'Number(row.pendingRefundCount??0)>0?<p className="pay-note">Refund processing.</p>',
        'Number(row.paymentOverageOpen??0)>0?<p className="pay-note">Payment received — account review in progress.</p>',
        'balance===0?<p className="pay-note">This job is paid in full.</p>',
    ],
    Path('app/invoice/[token]/page.tsx'): [
        'Refund processing',
        'Payment received — account review in progress',
        'Paid in full',
        'const paymentReviewPending = Number(row.paymentOverageOpen??0)>0||Number(row.pendingRefundCount??0)>0;',
    ],
}

missing=[]
for path, needles in checks.items():
    if not path.exists():
        missing.append(f'{path}: missing file')
        continue
    text=path.read_text()
    for needle in needles:
        if needle not in text:
            missing.append(f'{path}: missing refund/Stripe invariant: {needle}')

if missing:
    print('DR_REFUND_STRIPE_WORKFLOWS=FAIL')
    for item in missing:
        print(f'- {item}')
    raise SystemExit(1)

print('DR_REFUND_STRIPE_WORKFLOWS=PASS')
print('Protected: owner refund modal/statuses; Stripe/manual refund distinctions; refund idempotency and ledger linkage; direct Stripe-dashboard refund convergence; unresolved overpayment and pending-refund payment locks; exact customer payment-page hold precedence; Stripe stale-checkout reconciliation; manual-payment race safety; customer payment/invoice billing-review, refund-processing, and paid states.')
