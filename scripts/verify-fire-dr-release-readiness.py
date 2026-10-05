import json
import re
from pathlib import Path

root = Path('.')
manifest_path = root / 'PARITY_EVIDENCE_MANIFEST.json'
release_path = root / 'RELEASE_STATUS.md'
audit_path = root / 'CURRENT_PARITY_AUDIT.md'
matrix_path = root / 'STRICT_PARITY_MATRIX.md'
queue_path = root / 'STRICT_RENDERED_PARITY_QUEUE.md'
go_no_go_path = root / 'GO_NO_GO.md'
runbook_path = root / 'INDEPENDENT_DEPLOYMENT.md'

required = [manifest_path, release_path, audit_path, matrix_path, queue_path, go_no_go_path, runbook_path]
missing = [str(path) for path in required if not path.is_file()]
if missing:
    print('DR_RELEASE_READINESS=FAIL')
    for item in missing:
        print(f'- missing required release-gate input: {item}')
    raise SystemExit(1)

manifest = json.loads(manifest_path.read_text())
entries = manifest.get('entries')
errors = []
if not isinstance(entries, list) or len(entries) != 32:
    errors.append(f'expected 32 formal parity entries; found {len(entries) if isinstance(entries, list) else "invalid"}')
    entries = entries if isinstance(entries, list) else []

blockers = []
verified = mismatches = infrastructure_only = live_missing = dr_missing = 0
for item in entries:
    if not isinstance(item, dict):
        blockers.append('<non-object-entry>: invalid formal parity entry')
        continue
    entry_id = str(item.get('id') or '<blank-id>')
    live = item.get('live_evidence_status')
    dr = item.get('independent_evidence_status')
    comparison = item.get('comparison_status')
    if live != 'CAPTURED':
        live_missing += 1
        blockers.append(f'{entry_id}: LIVE evidence={live}')
    if dr != 'CAPTURED':
        dr_missing += 1
        blockers.append(f'{entry_id}: DR evidence={dr}')
    if comparison == 'VERIFIED_IDENTICAL':
        verified += 1
    elif comparison in {'MISMATCH','MISMATCHED'}:
        mismatches += 1
        blockers.append(f'{entry_id}: comparison={comparison}')
    elif comparison == 'INFRASTRUCTURE_ONLY':
        infrastructure_only += 1
    else:
        blockers.append(f'{entry_id}: comparison={comparison}')

# Formal FULL_IDENTICAL follows the manifest completion rule. Infrastructure-only
# is only acceptable when explicitly classified there; unresolved mismatches are
# never acceptable.
full_identical_ready = (
    len(entries) == 32
    and live_missing == 0
    and dr_missing == 0
    and mismatches == 0
    and all(
        isinstance(item, dict)
        and item.get('comparison_status') in {'VERIFIED_IDENTICAL','INFRASTRUCTURE_ONLY'}
        for item in entries
    )
)

release = release_path.read_text()
audit = audit_path.read_text()
matrix = matrix_path.read_text()
queue = queue_path.read_text()
go_no_go = go_no_go_path.read_text()
runbook = runbook_path.read_text()

if not full_identical_ready:
    required_markers = [
        ('RELEASE_STATUS strict verdict', release, 'Strict rendered parity: **NOT_YET_FULLY_VERIFIED**'),
        ('RELEASE_STATUS production sync', release, 'Production sync: **PENDING**'),
        ('CURRENT_PARITY_AUDIT verdict', audit, '**Verdict:** NOT_YET_FULLY_VERIFIED'),
        ('STRICT_PARITY_MATRIX verdict', matrix, '**NOT YET IDENTICAL IN EVERY SINGLE LOOK/FUNCTION STATE.**'),
        ('STRICT_RENDERED_PARITY_QUEUE staging status', queue, 'Status: `STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED`'),
        ('GO_NO_GO verdict', go_no_go, 'NOT_YET_FULLY_VERIFIED'),
        ('INDEPENDENT_DEPLOYMENT staging status', runbook, 'STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED'),
        ('INDEPENDENT_DEPLOYMENT verdict', runbook, 'NOT_YET_FULLY_VERIFIED'),
    ]
    for label, text, marker in required_markers:
        if marker not in text:
            errors.append(f'{label} must remain conservative while formal parity blockers exist: missing {marker}')

    forbidden_patterns = [
        ('RELEASE_STATUS', release, r'Strict rendered parity:\s*\*\*(?:FULL_IDENTICAL|VERIFIED_IDENTICAL|FULLY_VERIFIED)\*\*'),
        ('RELEASE_STATUS', release, r'Production sync:\s*\*\*(?:COMPLETE|SYNCHRONIZED|DONE)\*\*'),
        ('CURRENT_PARITY_AUDIT', audit, r'\*\*Verdict:\*\*\s*(?:FULL_IDENTICAL|FULLY_VERIFIED|VERIFIED_IDENTICAL)'),
        ('STRICT_RENDERED_PARITY_QUEUE', queue, r'Status:\s*`(?:FULL_IDENTICAL|SYNCHRONIZED|PRODUCTION_READY)`'),
    ]
    for label, text, pattern in forbidden_patterns:
        if re.search(pattern, text, flags=re.IGNORECASE):
            errors.append(f'{label} contains a premature completion/synchronization claim while formal blockers remain')

# Even when the evidence ledger eventually satisfies the completion rule, never
# let this guard itself promote production. It only reports readiness; actual
# production synchronization remains an explicit owner-controlled action.
if errors:
    print('DR_RELEASE_READINESS=FAIL')
    for error in errors:
        print(f'- {error}')
    raise SystemExit(1)

print('DR_RELEASE_READINESS=PASS')
print(f'Formal states={len(entries)}; LIVE missing={live_missing}; DR missing={dr_missing}; verified identical={verified}; infrastructure-only={infrastructure_only}; mismatches={mismatches}.')
if full_identical_ready:
    print('EVIDENCE_GATE=READY_FOR_EXPLICIT_OWNER_REVIEW')
    print('The evidence completion rule is satisfied, but this guard does not synchronize or modify production.')
else:
    print('EVIDENCE_GATE=NOT_YET_FULLY_VERIFIED')
    print(f'Parity remains staging-only with {len(blockers)} unresolved evidence/comparison blocker(s); release-facing documents remain conservatively labeled.')
