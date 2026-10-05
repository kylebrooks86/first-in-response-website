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
forward_sync_path = root / 'FORWARD_SYNC_APPROVED.json'

required = [manifest_path, release_path, audit_path, matrix_path, queue_path, go_no_go_path, runbook_path, forward_sync_path]
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

release = release_path.read_text()
audit = audit_path.read_text()
matrix = matrix_path.read_text()
queue = queue_path.read_text()
go_no_go = go_no_go_path.read_text()
runbook = runbook_path.read_text()

try:
    forward_sync_data = json.loads(forward_sync_path.read_text())
except Exception as exc:
    forward_sync_data = {}
    errors.append(f'FORWARD_SYNC_APPROVED.json is invalid JSON: {exc}')
forward_sync_entries = forward_sync_data.get('entries') if isinstance(forward_sync_data, dict) else None
if forward_sync_data.get('schema_version') != 1:
    errors.append('FORWARD_SYNC_APPROVED.json schema_version must be 1')
if not isinstance(forward_sync_entries, list):
    forward_sync_entries = []
    errors.append('FORWARD_SYNC_APPROVED.json entries must be an array')
forward_sync_approved = sum(1 for item in forward_sync_entries if isinstance(item, dict) and item.get('status') == 'PENDING_LIVE_SYNC' and item.get('blocks_full_identical') is True)
if forward_sync_approved:
    blockers.append(f'{forward_sync_approved} owner-approved forward-sync product difference(s) still require LIVE synchronization')

# Formal FULL_IDENTICAL follows the manifest completion rule and also requires
# every owner-approved forward-sync user-facing improvement to have been brought
# into LIVE. Infrastructure-only is acceptable only when explicitly classified;
# unresolved mismatches and user-facing forward-sync gaps are never acceptable.
full_identical_ready = (
    len(entries) == 32
    and live_missing == 0
    and dr_missing == 0
    and mismatches == 0
    and forward_sync_approved == 0
    and all(
        isinstance(item, dict)
        and item.get('comparison_status') in {'VERIFIED_IDENTICAL','INFRASTRUCTURE_ONLY'}
        for item in entries
    )
)

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

if errors:
    print('DR_RELEASE_READINESS=FAIL')
    for error in errors:
        print(f'- {error}')
    raise SystemExit(1)

print('DR_RELEASE_READINESS=PASS')
print(f'Formal states={len(entries)}; LIVE missing={live_missing}; DR missing={dr_missing}; verified identical={verified}; infrastructure-only={infrastructure_only}; mismatches={mismatches}; forward-sync approved={forward_sync_approved}.')
if full_identical_ready:
    print('EVIDENCE_GATE=READY_FOR_EXPLICIT_OWNER_REVIEW')
    print('The evidence completion rule is satisfied and no owner-approved forward-sync product gaps remain, but this guard does not synchronize or modify production.')
else:
    print('EVIDENCE_GATE=NOT_YET_FULLY_VERIFIED')
    print(f'Parity remains staging-only with {len(blockers)} unresolved evidence/comparison/forward-sync blocker(s); release-facing documents remain conservatively labeled.')
