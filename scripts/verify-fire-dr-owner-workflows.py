from pathlib import Path

# Secondary DR parity guard for owner workflows that are easy to regress while
# visual parity work continues. This is source-level protection only; it is not
# rendered proof and does not authorize FULL_IDENTICAL.
checks = {
    Path('app/dashboard.tsx'): [
        # Already-verified LIVE owner/dashboard surfaces.
        'Welcome, {userName}',
        '<p>Outstanding</p>',
        '<p>Upcoming jobs</p>',
        '<p>Saved estimates</p>',
        '<p>Completed jobs</p>',
        'Keep every job moving',
        '<h2>Recent estimates</h2>',
        '<h2>Quick actions</h2>',
        'Profiles, photos, and history',
        'Jobs and driving plan',
        'Reminders and customer contact',
        'Deposits and balances',
        'const reviewLink = "https://firstinresponseexteriors.com/review";',

        # Notification control/popup already matched to LIVE.
        '<strong>Notifications</strong>',
        'Mark all read',
        'You’re all caught up',
        'No notifications yet',
        'Customer views, approvals, and confirmed payments will appear here.',
        'type==="estimate_viewed"',
        'type==="invoice_viewed"',
        'type==="estimate_accepted"',

        # Add-customer / customer-property workflow already matched to LIVE.
        '<DialogTitle>Add customer</DialogTitle>',
        '<Label>Customer name</Label>',
        '<Label>Email</Label>',
        '<Label>Phone</Label>',
        '<Label>Service address</Label>',
        'Property preview',
        'Satellite',
        'Street View',
        'Google Earth',
        'Navigate',

        # Customer action row and permanent-record Messages / Notes states.
        '<Phone />Call</a>',
        '<Send />Text</a>',
        '<Mail />Email</a>',
        '>Google Maps</a>',
        '<StrideButton />',
        '<Globe2 />Google Earth</a>',
        '<House />Zillow</a>',
        'No messages prepared yet',
        'Use the Message button to create a personalized text or email.',
        'Gate code, pets, property details…',
        'No notes yet',
        'Save access details and job-specific reminders here.',

        # Contracts / agreements surfaces already matched to LIVE.
        '<h1>Agreements</h1>',
        'Signed agreements',
        'Awaiting signature',
        'Change requests',

        # Follow-ups dashboard / prepare-message workflow.
        '<h1>Follow-ups</h1>',
        'recommended actions',
        'Messages open prefilled and editable. Your phone still lets you review and tap Send.',
        'triggerLabel="Prepare message"',
        'You’re caught up',

        # Payments dashboard + Record payment modal.
        '<p className="eyebrow">Money received</p><h1>Payments</h1>',
        '<h2>Balances to collect</h2>',
        '<h2>Payment history</h2>',
        '<DialogTitle>Record payment</DialogTitle>',
        '<small>Deposit due</small>',
        '<small>Full balance</small>',
        '<Label>Amount received</Label>',
        '<Label>Payment method</Label>',
        '"Wave","Cash App","Venmo","Cash","Check","Card","ACH / bank","Other"',
        'Cash App {DEFAULT_CASH_APP_HANDLE} · Venmo {DEFAULT_VENMO_HANDLE}',

        # Job costs/profit and service-completion report already matched to LIVE.
        '<DialogTitle>Job costs and profit</DialogTitle>',
        '<small>Estimated gross profit</small>',
        'No job costs recorded yet.',
        '<DialogTitle>Service completion report</DialogTitle>',
        'Property condition documented',
        'Before photos captured',
        'Plants and fragile areas protected',
        'Service completed as quoted',
        'After photos captured',
        'Customer walkthrough completed',
        'Job report saved.',

        # Business screen structure.
        '<p className="eyebrow">Owner operations</p><h1>Business</h1>',
        'Tasks, expenses, and job profitability in one simple place.',
        'Full records backup',
        'Photo archive',
        'Restore missing records',
        'Export for Wave',
        '<h2>Tasks and reminders</h2>',
        '<h2>Expenses</h2>',
        'No tasks yet.',
        'No expenses recorded yet.',
        'Restore missing FIRE App records?',
        'It will not delete or overwrite records already in the app.',
        'Customer photo files are not included and will be skipped.',

        # Templates screen structure and edit/reset behavior.
        'function SettingsView(){',
        'Email subject',
        'Service agreement text',
        'Insert a personalized field',
        'Restore default',
        'Save template',
        'Text + email',
        'Personalized fields are filled automatically when you prepare the message.',

        # Owner invoice and refund UI.
        '<DialogTitle>Edit final invoice</DialogTitle>',
        'Invoice revision history',
        'Refund payment',
        'Refund amount',
        'Refund note',
        'Record completed refund',
        'Stripe refund completed and FIRE billing was updated.',
        'Manual refund recorded and FIRE billing was updated.',
        'I already returned this money to the customer outside FIRE',

        # Owner billing-exception visibility / recovery actions.
        'Overpayment needs review',
        'Keep as overpayment',
        'Refund processing',
        'Billing exception open',
        'Payment review',

        # Common owner empty states.
        'No matching estimates',
        'No upcoming jobs',
        'No invoices yet',
        'No payments recorded',
        'No agreements yet',
        'No notifications yet',
    ],
    Path('app/api/backup/route.ts'): [
        # Restore remains merge-oriented and should never silently replace the app.
        'fire-app-records-backup',
        'invoiceRevisionHistory: true',
        'paymentCheckoutSessionSafety: true',
        'paymentRefundHistory: true',
        'Customer photo files are stored separately and are not included in this JSON backup.',
        'attemptId:crypto.randomUUID()',
        'phase:"input_validation"',
        'phase="target_conflict_validation"',
    ],
    Path('app/api/payments/refund/route.ts'): [
        # Refund request lifecycle / durable reconciliation.
        'payment_refunds',
        "status='pending'",
        "status='succeeded'",
        'refundPaymentProvider=`refund:${row.paymentId}:${row.id}`',
        'idempotency-key',
    ],
    Path('lib/payment-methods.ts'): [
        # Captured LIVE manual-payment instructions.
        'DEFAULT_CASH_APP_HANDLE = "$FIREExteriors"',
        'DEFAULT_VENMO_HANDLE = "@FirstInResponseExteriors"',
    ],
    Path('lib/fire-services.ts'): [
        # Captured LIVE service-selector tail options.
        'Seasonal / Holiday Lighting',
        'Commercial Exterior Cleaning',
        'Specialty Exterior Service',
        'Custom Service',
    ],
}

missing = []
for path, needles in checks.items():
    if not path.exists():
        missing.append(f'{path}: missing file')
        continue
    text = path.read_text()
    for needle in needles:
        if needle not in text:
            missing.append(f'{path}: missing expected owner-workflow parity content: {needle}')

# The captured LIVE selector specifically established this tail ordering; do not
# let later catalog work silently reorder these options.
services_path = Path('lib/fire-services.ts')
if services_path.exists():
    service_text = services_path.read_text()
    captured_tail = [
        'Seasonal / Holiday Lighting',
        'Commercial Exterior Cleaning',
        'Specialty Exterior Service',
        'Custom Service',
    ]
    positions = [service_text.find(name) for name in captured_tail]
    if any(position < 0 for position in positions) or positions != sorted(positions):
        missing.append('lib/fire-services.ts: captured LIVE service-selector tail ordering regressed.')

if missing:
    print('DR_OWNER_WORKFLOW_PARITY_GUARD=FAIL')
    for item in missing:
        print(f'- {item}')
    raise SystemExit(1)

print('DR_OWNER_WORKFLOW_PARITY_GUARD=PASS')
print('Protected: already-verified Dashboard/Notifications/Customers/Contracts/Follow-ups/Payments/job-cost/job-report surfaces; customer action row and Messages/Notes states; exact LIVE manual-payment handles and review URL; captured service-selector tail order; Business tasks/expenses/backup-restore UI; Templates editing/reset; owner invoice editing/history; refund modal/statuses; billing-exception states; common owner empty states; restore audit/integrity markers.')
print('This remains source-level protection only; rendered LIVE-vs-DR comparison is still required for strict parity.')
