from pathlib import Path

# Secondary DR parity guard for owner workflows that are easy to regress while
# visual parity work continues. This is source-level protection only; it is not
# rendered proof and does not authorize FULL_IDENTICAL.
checks = {
    Path('app/dashboard.tsx'): [
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
        '<DialogTitle>Edit invoice</DialogTitle>',
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
    ],
    Path('app/api/payments/refund/route.ts'): [
        # Refund request lifecycle / durable reconciliation.
        'payment_refunds',
        "status='pending'",
        "status='succeeded'",
        'refundPaymentProvider=`refund:${row.paymentId}:${row.id}`',
        'idempotency-key',
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

if missing:
    print('DR_OWNER_WORKFLOW_PARITY_GUARD=FAIL')
    for item in missing:
        print(f'- {item}')
    raise SystemExit(1)

print('DR_OWNER_WORKFLOW_PARITY_GUARD=PASS')
print('Protected: Business tasks/expenses/backup-restore UI; Templates editing/reset; owner invoice editing/history; refund modal/statuses; billing-exception states; common owner empty states.')
print('This remains source-level protection only; rendered LIVE-vs-DR comparison is still required for strict parity.')
