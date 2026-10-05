from pathlib import Path

path = Path('app/api/backup/route.ts')
if not path.exists():
    raise SystemExit('app/api/backup/route.ts not found')

text = path.read_text()
needles = [
    'Restore conflict: customer ${id} already exists with different immutable identity/contact values.',
    'Restore conflict: estimate ${id} already exists with different immutable financial values.',
    'Restore conflict: estimate share token already belongs to another estimate.',
    'Restore conflict: estimate ${estimateId} already has a different invoice.',
    'Restore conflict: invoice share token already belongs to another invoice.',
    'Restore conflict: estimate item ${id} already exists with different immutable values.',
    'Restore conflict: invoice item ${id} already exists with different immutable values.',
    'Restore conflict: customer note ${id} already exists with different immutable values.',
    'Restore conflict: customer message ${id} already exists with different immutable values.',
]

missing=[needle for needle in needles if needle not in text]
if missing:
    print('DR_RESTORE_IDENTITY_GUARD=FAIL')
    for needle in missing:
        print(f'- missing restore identity safeguard: {needle}')
    raise SystemExit(1)

print('DR_RESTORE_IDENTITY_GUARD=PASS')
print('Protected: customer identity, estimate financial identity/share tokens, one-invoice relationship, invoice share tokens, line-item ownership/value identity, and customer history identity conflicts stop restore instead of silently merging incompatible records.')
