import json
import re
from pathlib import Path

root = Path('.')
manifest_path = root / 'PARITY_EVIDENCE_MANIFEST.json'
checklist_path = root / 'LIVE_MASTER_PARITY_CHECKLIST.md'
matrix_path = root / 'STRICT_PARITY_MATRIX.md'
queue_path = root / 'STRICT_RENDERED_PARITY_QUEUE.md'
release_path = root / 'RELEASE_STATUS.md'
audit_path = root / 'CURRENT_PARITY_AUDIT.md'
go_no_go_path = root / 'GO_NO_GO.md'
runbook_path = root / 'INDEPENDENT_DEPLOYMENT.md'

required = [
    manifest_path,
    checklist_path,
    matrix_path,
    queue_path,
    release_path,
    audit_path,
    go_no_go_path,
    runbook_path,
]
missing_files = [str(path) for path in required if not path.exists()]
if missing_files:
    print('DR_PARITY_LEDGER_CONSISTENCY=FAIL')
    for path in missing_files:
        print(f'- missing required parity file: {path}')
    raise SystemExit(1)

manifest = json.loads(manifest_path.read_text())
entries = manifest.get('entries', [])
entry_count = manifest.get('entry_count')
errors: list[str] = []

if not isinstance(entries, list):
    errors.append('PARITY_EVIDENCE_MANIFEST entries must be an array.')
    entries = []

ids = [str(item.get('id', '')) for item in entries if isinstance(item, dict)]
if entry_count != len(entries):
    errors.append(f'manifest entry_count={entry_count!r} but actual entries={len(entries)}.')
if len(entries) != 32:
    errors.append(f'formal parity manifest must contain 32 entries; found {len(entries)}.')
if any(not value for value in ids):
    errors.append('manifest contains a blank entry id.')
if len(ids) != len(set(ids)):
    errors.append('manifest contains duplicate entry ids.')

checklist = checklist_path.read_text()
checklist_ids = re.findall(r'`([^`]+)`\s+—', checklist)
if len(checklist_ids) != len(set(checklist_ids)):
    errors.append('LIVE_MASTER_PARITY_CHECKLIST contains duplicate ids.')
if set(checklist_ids) != set(ids):
    missing_from_checklist = sorted(set(ids) - set(checklist_ids))
    missing_from_manifest = sorted(set(checklist_ids) - set(ids))
    if missing_from_checklist:
        errors.append('manifest ids missing from checklist: ' + ', '.join(missing_from_checklist))
    if missing_from_manifest:
        errors.append('checklist ids missing from manifest: ' + ', '.join(missing_from_manifest))

live_captured = 0
independent_captured = 0
verified_identical = 0
mismatches = 0

for entry in entries:
    if not isinstance(entry, dict):
        errors.append('manifest contains a non-object entry.')
        continue
    entry_id = str(entry.get('id', '<unknown>'))
    evidence = entry.get('evidence', [])
    if not isinstance(evidence, list):
        errors.append(f'{entry_id}: evidence must be an array.')
        evidence = []
    live_evidence = [item for item in evidence if isinstance(item, dict) and item.get('side') == 'live']
    independent_evidence = [item for item in evidence if isinstance(item, dict) and item.get('side') == 'independent']
    live_status = str(entry.get('live_evidence_status', ''))
    independent_status = str(entry.get('independent_evidence_status', ''))
    comparison = str(entry.get('comparison_status', ''))

    if live_status == 'CAPTURED':
        live_captured += 1
        if not live_evidence:
            errors.append(f'{entry_id}: live_evidence_status is CAPTURED but no live evidence is registered.')
    if independent_status == 'CAPTURED':
        independent_captured += 1
        if not independent_evidence:
            errors.append(f'{entry_id}: independent_evidence_status is CAPTURED but no independent evidence is registered.')
    if comparison == 'VERIFIED_IDENTICAL':
        verified_identical += 1
        if live_status != 'CAPTURED' or independent_status != 'CAPTURED':
            errors.append(f'{entry_id}: VERIFIED_IDENTICAL requires both LIVE and independent evidence CAPTURED.')
    if comparison in {'MISMATCH', 'MISMATCHED'}:
        mismatches += 1

expected = (live_captured, len(entries), independent_captured, len(entries), verified_identical, mismatches)

release = release_path.read_text()
if 'Strict rendered parity: **NOT_YET_FULLY_VERIFIED**' not in release and verified_identical != len(entries):
    errors.append('RELEASE_STATUS must remain NOT_YET_FULLY_VERIFIED until every formal entry is verified identical.')

summary_match = re.search(
    r'Evidence:\s*\*\*(\d+)/(\d+) LIVE,\s*(\d+)/(\d+) independent,\s*(\d+) verified identical,\s*(\d+) mismatches\*\*',
    release,
)
if summary_match:
    actual = tuple(map(int, summary_match.groups()))
    if actual != expected:
        errors.append(f'RELEASE_STATUS evidence summary {actual} does not match manifest-derived counts {expected}.')
else:
    errors.append('RELEASE_STATUS evidence summary could not be parsed.')

audit = audit_path.read_text()
audit_patterns = {
    'entries': (r'Evidence entries:\s*\*\*(\d+)\*\*', len(entries)),
    'live': (r'LIVE evidence captured:\s*\*\*(\d+)/(\d+)\*\*', (live_captured, len(entries))),
    'independent': (r'Independent evidence captured:\s*\*\*(\d+)/(\d+)\*\*', (independent_captured, len(entries))),
    'verified': (r'VERIFIED_IDENTICAL comparisons:\s*\*\*(\d+)\*\*', verified_identical),
    'mismatches': (r'Mismatches:\s*\*\*(\d+)\*\*', mismatches),
}
for label, (pattern, wanted) in audit_patterns.items():
    match = re.search(pattern, audit)
    if not match:
        errors.append(f'CURRENT_PARITY_AUDIT {label} count could not be parsed.')
        continue
    values = tuple(map(int, match.groups()))
    actual_value = values[0] if len(values) == 1 else values
    if actual_value != wanted:
        errors.append(f'CURRENT_PARITY_AUDIT {label} count {actual_value} does not match {wanted}.')
if '**Verdict:** NOT_YET_FULLY_VERIFIED' not in audit and verified_identical != len(entries):
    errors.append('CURRENT_PARITY_AUDIT must remain NOT_YET_FULLY_VERIFIED while formal evidence is incomplete.')

matrix = matrix_path.read_text()
if '**NOT YET IDENTICAL IN EVERY SINGLE LOOK/FUNCTION STATE.**' not in matrix and verified_identical != len(entries):
    errors.append('STRICT_PARITY_MATRIX must retain the NOT YET IDENTICAL verdict while formal evidence remains incomplete.')

queue = queue_path.read_text()
if 'Status: `STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED`' not in queue:
    errors.append('STRICT_RENDERED_PARITY_QUEUE must retain STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED status.')
if 'Do not change scrolling/smoothness unless the owner explicitly reopens that issue.' not in queue:
    errors.append('STRICT_RENDERED_PARITY_QUEUE must retain the owner-requested scroll/smoothness freeze.')
if 'Photo-file functionality remains an explicit capability gap until storage exists' not in queue:
    errors.append('STRICT_RENDERED_PARITY_QUEUE must retain the DR photo-storage capability-gap disclosure.')

go_no_go = go_no_go_path.read_text()
for needle in [
    'free-tier, D1-only, no R2',
    '4-digit PIN',
    'Photo-file storage: **not provisioned**',
    'NOT_YET_FULLY_VERIFIED',
]:
    if needle not in go_no_go:
        errors.append(f'GO_NO_GO is missing current DR deployment rule: {needle}')

runbook = runbook_path.read_text()
for needle in [
    'free-tier, D1-only, no R2',
    '4-digit PIN',
    'Photo-file storage: not provisioned',
    'STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED',
    'NOT_YET_FULLY_VERIFIED',
]:
    if needle not in runbook:
        errors.append(f'INDEPENDENT_DEPLOYMENT is missing current DR deployment rule: {needle}')

if errors:
    print('DR_PARITY_LEDGER_CONSISTENCY=FAIL')
    for error in errors:
        print(f'- {error}')
    raise SystemExit(1)

print('DR_PARITY_LEDGER_CONSISTENCY=PASS')
print(f'Formal states: {len(entries)}; LIVE evidence: {live_captured}; independent evidence: {independent_captured}; verified identical: {verified_identical}; mismatches: {mismatches}.')
print('Manifest, checklist, release status, current audit, strict verdict, queue status, scroll freeze, free D1-only/no-R2 runbook, PIN auth documentation, and photo capability exception are consistent.')
