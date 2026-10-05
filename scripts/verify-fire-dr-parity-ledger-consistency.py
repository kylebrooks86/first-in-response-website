import json
import re
from pathlib import Path

root = Path('.')
manifest_path = root / 'PARITY_EVIDENCE_MANIFEST.json'
checklist_path = root / 'LIVE_MASTER_PARITY_CHECKLIST.md'
matrix_path = root / 'STRICT_PARITY_MATRIX.md'
queue_path = root / 'STRICT_RENDERED_PARITY_QUEUE.md'
release_path = root / 'RELEASE_STATUS.md'

required = [manifest_path, checklist_path, matrix_path, queue_path, release_path]
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

release = release_path.read_text()
if 'Strict rendered parity: **NOT_YET_FULLY_VERIFIED**' not in release and verified_identical != len(entries):
    errors.append('RELEASE_STATUS must remain NOT_YET_FULLY_VERIFIED until every formal entry is verified identical.')

summary_match = re.search(
    r'Evidence:\s*\*\*(\d+)/(\d+) LIVE,\s*(\d+)/(\d+) independent,\s*(\d+) verified identical,\s*(\d+) mismatches\*\*',
    release,
)
if summary_match:
    rel_live, rel_total_a, rel_ind, rel_total_b, rel_verified, rel_mismatch = map(int, summary_match.groups())
    expected = (live_captured, len(entries), independent_captured, len(entries), verified_identical, mismatches)
    actual = (rel_live, rel_total_a, rel_ind, rel_total_b, rel_verified, rel_mismatch)
    if actual != expected:
        errors.append(f'RELEASE_STATUS evidence summary {actual} does not match manifest-derived counts {expected}.')
else:
    errors.append('RELEASE_STATUS evidence summary could not be parsed.')

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

if errors:
    print('DR_PARITY_LEDGER_CONSISTENCY=FAIL')
    for error in errors:
        print(f'- {error}')
    raise SystemExit(1)

print('DR_PARITY_LEDGER_CONSISTENCY=PASS')
print(f'Formal states: {len(entries)}; LIVE evidence: {live_captured}; independent evidence: {independent_captured}; verified identical: {verified_identical}; mismatches: {mismatches}.')
print('Checklist IDs, manifest IDs, release evidence counts, strict verdict, staging status, scroll freeze, and photo capability exception are consistent.')
