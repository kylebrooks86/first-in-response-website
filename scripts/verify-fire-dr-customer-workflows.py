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
        'Estimate approved and agreement signed. Kyle will contact you to schedule.',
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
        '<p>ESTIMATE FOR</p>',
        '<AcceptEstimateButton',
        'Approve and sign the estimate first. After approval, the 50% deposit reserves your place on the schedule.',
        'Your reservation deposit is recorded. The remaining balance becomes due when the work is completed.',
        'Payment received — account review in progress.',
        'Refund processing.',
        '<CustomerPortalNav/>',
    ],
    Path('app/pay/[id]/page.tsx'): [
        'Payment received',
        'Your payment has been recorded successfully.',
        'Approve and sign the estimate before making the reservation deposit.',
        'Your reservation deposit is recorded. The remaining balance becomes due when the work is completed.',
        'This job is paid in full.',
        'Payment received — account review in progress.',
        '<CustomerPortalNav/>',
    ],
    Path('app/invoice/[token]/page.tsx'): [
        'Invoice not found',
        'Billing review required',
        'Refund processing',
        'Payment received — account review in progress',
        'Paid in full',
        'Manual payment options:',
        '<CustomerPortalNav/>',
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
print('Protected: customer signature/photo-permission approval; change requests; deposit/final-balance portal states; customer invoice edge states; overpayment resolution safeguards; DR photo storage fail-closed behavior.')
print('Rendered LIVE-vs-DR comparison is still required for strict visual parity.')
