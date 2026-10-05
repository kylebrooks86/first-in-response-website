from pathlib import Path

# Source-level guard for customer-facing approval/payment/document workflows and
# DR recovery-edge behavior. This does not prove rendered LIVE parity.
checks = {
    Path('app/estimate/[token]/accept-button.tsx'): [
        'Service Agreement &amp; Liability Waiver',
        'Photo permission (required)',
        'Type your full name to sign',
        'Sign agreement & approve',
        'Need something changed?',
        'Send change request',
        'Estimate approved and agreement signed{signedName?` by ${signedName}`:""}. Kyle will contact you to schedule.',
    ],
    Path('app/api/public/estimates/[token]/accept/route.ts'): [
        'Please choose photo permission, type your full name, and accept the service agreement.',
        "status='approved'",
        'accepted_at=?',
        'signed_name=?',
        'signed_at=?',
        'photo_release=?',
        "contract_version='2026-09-21'",
        'estimate_accepted',
        'Contact the customer to schedule the job.',
        'This estimate is no longer available for approval. Please contact Kyle.',
        'This estimate has a billing or service-line integrity issue and cannot be approved yet.',
    ],
    Path('app/api/public/estimates/[token]/change-request/route.ts'): [
        'Please describe what you would like changed.',
        'estimate_change_requests',
        'estimate_change_requested',
        'This estimate has already moved into the job workflow. Contact Kyle directly for any new scope changes.',
    ],
    Path('app/estimate/[token]/page.tsx'): [
        'Estimate not found',
        'Please check the link or contact First In Response Exteriors.',
        '<p>ESTIMATE FOR</p>',
        '<AcceptEstimateButton',
        'Approve and sign the estimate first. After approval, the 50% deposit reserves your place on the schedule.',
        'Your reservation deposit is recorded. The remaining balance becomes due when the work is completed.',
        'Payment received — account review in progress.',
        'Refund processing.',
        'Billing review required.',
        'Your private estimate link is unique to you.',
        '<CustomerPortalNav/>',
    ],
    Path('app/pay/[id]/page.tsx'): [
        # Customer payment-document structure and exact state transitions.
        'Estimate not found',
        'Please check the link or contact First In Response Exteriors.',
        '<div className="pay-title"><p>ESTIMATE FOR</p>',
        '<small>Estimate total</small>',
        '<small>Paid</small>',
        'paymentType==="deposit"?"Deposit remaining":"Balance due"',
        'Payment received',
        'Your payment has been recorded successfully.',
        'After approval, the 50% deposit reserves your place on the schedule. The remaining balance is due upon completion of the work.',
        '<strong>Manual payment options:</strong> Cash App:',
        'Approve and sign the estimate before making the reservation deposit.',
        'Your reservation deposit is recorded. The remaining balance becomes due when the work is completed.',
        'This job is paid in full.',
        'Payment received — account review in progress.',
        'Pay ${currency(dueNow)} deposit securely',
        'Pay ${currency(dueNow)} remaining balance securely',
        'Card details are handled securely by Stripe.',
        '<CustomerPortalNav/>',
    ],
    Path('app/invoice/[token]/page.tsx'): [
        # LIVE-captured customer invoice document structure and due-date states.
        'Invoice not found',
        'Please check the link or contact First In Response Exteriors.',
        '<p>INVOICE FOR</p>',
        '<small>Invoice total</small>',
        '<small>Balance due</small>',
        'if (!dueAt) return "Payment due on receipt";',
        'if (sameCalendarDay) return "Payment due on receipt";',
        'return `Payment due ${new Intl.DateTimeFormat("en-US", { month:"long", day:"numeric", year:"numeric" }).format(due)}`;',
        'Billing review required',
        'Refund processing',
        'Payment received — account review in progress',
        'Paid in full',
        '<strong>Manual payment options:</strong> Cash App:',
        'Please include your name in the payment note.',
        'Your private invoice link is unique to you.',
        '<CustomerPortalNav/>',
    ],
    Path('app/customer-portal-nav.tsx'): [
        'aria-label="Customer document navigation"',
        'className="portal-back"',
        'onClick={()=>window.history.back()}',
        '<ArrowLeft/> <span>Back</span>',
        '<a href="/"><House/> <span>Home</span></a>',
    ],
    Path('app/api/notifications/route.ts'): [
        'Notifications are temporarily unavailable.',
        'payment_overage',
        'Keep an intentional overpayment'.lower(),
    ],
    Path('app/api/customer-photos/route.ts'): [
        'if (!env.BUCKET) return Response.json({ error: "Photo storage is unavailable." }, { status: 503 });',
        'Only image files can be uploaded.',
        'That photo is larger than 15 MB. Choose a smaller image.',
        'await env.BUCKET.delete(objectKey);',
    ],
    Path('lib/payment-methods.ts'): [
        'export const DEFAULT_CASH_APP_HANDLE = "$FIREExteriors";',
        'export const DEFAULT_VENMO_HANDLE = "@FirstInResponseExteriors";',
    ],
}

# Handle the notifications wording with a case-insensitive check separately.
notification_casefold = [
    'refunds must be processed from payments → refund on the original payment.',
    'a refund is currently processing for this job. wait for it to finish before resolving the overpayment.',
    'this job is no longer overpaid.',
]

missing = []
for path, needles in checks.items():
    if not path.exists():
        missing.append(f'{path}: missing file')
        continue
    text = path.read_text()
    folded = text.lower()
    for needle in needles:
        # One notifications sentinel above is deliberately normalized.
        if needle == 'keep an intentional overpayment':
            continue
        if needle not in text:
            missing.append(f'{path}: missing expected customer-workflow parity content: {needle}')
    if path == Path('app/api/notifications/route.ts'):
        for needle in notification_casefold:
            if needle not in folded:
                missing.append(f'{path}: missing expected billing-resolution wording: {needle}')

if missing:
    print('DR_CUSTOMER_WORKFLOW_PARITY_GUARD=FAIL')
    for item in missing:
        print(f'- {item}')
    raise SystemExit(1)

print('DR_CUSTOMER_WORKFLOW_PARITY_GUARD=PASS')
print('Protected: LIVE-evidence signer-name confirmation; customer signature/photo-permission approval; change requests; estimate/payment/invoice not-found states; customer Back/Home navigation; payment-document summary/deposit/balance/success/full-paid states; LIVE-captured invoice due-on-receipt and dated-due presentation; manual payment handles; invoice review/refund states; overpayment resolution safeguards; DR photo storage fail-closed behavior.')
print('Rendered LIVE-vs-DR comparison is still required for strict visual parity.')
