from pathlib import Path

checks = {
    Path('app/estimate/[token]/page.tsx'): [
        'UPDATE estimates SET first_viewed_at=?,status=CASE WHEN status=\'draft\' THEN \'sent\' ELSE status END WHERE id=? AND first_viewed_at IS NULL',
        'INSERT OR IGNORE INTO notifications',
        'WHERE EXISTS (SELECT 1 FROM estimates WHERE id=? AND first_viewed_at=?)',
        '"estimate_viewed"',
    ],
    Path('app/invoice/[token]/page.tsx'): [
        'UPDATE invoices SET first_viewed_at=?,status=CASE WHEN status=\'draft\' THEN \'sent\' ELSE status END WHERE id=? AND first_viewed_at IS NULL',
        'INSERT OR IGNORE INTO notifications',
        'WHERE EXISTS (SELECT 1 FROM invoices WHERE id=? AND first_viewed_at=?)',
        '"invoice_viewed"',
    ],
    Path('app/api/public/estimates/[token]/accept/route.ts'): [
        "WHERE id=? AND accepted_at IS NULL AND status IN ('draft','sent')",
        'INSERT OR IGNORE INTO notifications',
        'WHERE EXISTS (SELECT 1 FROM estimates WHERE id=? AND accepted_at=? AND signed_at=?)',
        '"estimate_accepted"',
    ],
    Path('drizzle/0020_notification_lifecycle_unique.sql'): [
        "type IN ('estimate_viewed','invoice_viewed','estimate_accepted')",
        'CREATE UNIQUE INDEX IF NOT EXISTS `idx_notifications_unique_lifecycle`',
        'ON `notifications` (`type`,`estimate_id`)',
        '`estimate_id` IS NOT NULL',
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
            missing.append(f'{path}: missing v134 lifecycle invariant: {needle}')

if missing:
    print('DR_LIFECYCLE_V134_GUARD=FAIL')
    for item in missing:
        print(f'- {item}')
    raise SystemExit(1)

print('DR_LIFECYCLE_V134_GUARD=PASS')
print('Protected: race-safe first-view/approval transitions, conditional lifecycle notifications, INSERT OR IGNORE idempotency, and the migration-level unique lifecycle notification backstop.')
