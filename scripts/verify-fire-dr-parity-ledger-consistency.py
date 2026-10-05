import hashlib
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
batch_audit_path = root / 'LIVE_PARITY_BATCH_AUDIT_2026-10-04.md'
overlay_dir = Path('..') / 'dr-parity-overlays'

required = [manifest_path, checklist_path, matrix_path, queue_path, release_path, audit_path, go_no_go_path, runbook_path, batch_audit_path]
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
if entry_count != len(entries): errors.append(f'manifest entry_count={entry_count!r} but actual entries={len(entries)}.')
if len(entries) != 32: errors.append(f'formal parity manifest must contain 32 entries; found {len(entries)}.')
if any(not value for value in ids): errors.append('manifest contains a blank entry id.')
if len(ids) != len(set(ids)): errors.append('manifest contains duplicate entry ids.')

checklist = checklist_path.read_text()
checklist_ids = re.findall(r'`([^`]+)`\s+—', checklist)
if len(checklist_ids) != len(set(checklist_ids)): errors.append('LIVE_MASTER_PARITY_CHECKLIST contains duplicate ids.')
if set(checklist_ids) != set(ids):
    missing_from_checklist = sorted(set(ids) - set(checklist_ids))
    missing_from_manifest = sorted(set(checklist_ids) - set(ids))
    if missing_from_checklist: errors.append('manifest ids missing from checklist: ' + ', '.join(missing_from_checklist))
    if missing_from_manifest: errors.append('checklist ids missing from manifest: ' + ', '.join(missing_from_manifest))

live_captured = independent_captured = verified_identical = mismatches = 0
allowed_evidence_statuses = {'PENDING', 'READY_FOR_CAPTURE', 'CAPTURED', 'NOT_REQUIRED', 'INFRASTRUCTURE_ONLY'}
allowed_comparison_statuses = {'PENDING', 'VERIFIED_IDENTICAL', 'MISMATCH', 'MISMATCHED', 'INFRASTRUCTURE_ONLY'}
seen_evidence_files: dict[tuple[str, str], str] = {}
verified_evidence_files = 0
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
    if live_status not in allowed_evidence_statuses: errors.append(f'{entry_id}: invalid live_evidence_status {live_status!r}.')
    if independent_status not in allowed_evidence_statuses: errors.append(f'{entry_id}: invalid independent_evidence_status {independent_status!r}.')
    if comparison not in allowed_comparison_statuses: errors.append(f'{entry_id}: invalid comparison_status {comparison!r}.')
    if live_status == 'CAPTURED':
        live_captured += 1
        if not live_evidence: errors.append(f'{entry_id}: live_evidence_status is CAPTURED but no live evidence is registered.')
    elif live_evidence:
        errors.append(f'{entry_id}: LIVE evidence exists but live_evidence_status is {live_status!r}, not CAPTURED.')
    if independent_status == 'CAPTURED':
        independent_captured += 1
        if not independent_evidence: errors.append(f'{entry_id}: independent_evidence_status is CAPTURED but no independent evidence is registered.')
    elif independent_evidence:
        errors.append(f'{entry_id}: independent evidence exists but independent_evidence_status is {independent_status!r}, not CAPTURED.')
    if comparison == 'VERIFIED_IDENTICAL':
        verified_identical += 1
        if live_status != 'CAPTURED' or independent_status != 'CAPTURED': errors.append(f'{entry_id}: VERIFIED_IDENTICAL requires both LIVE and independent evidence CAPTURED.')
        if not live_evidence or not independent_evidence: errors.append(f'{entry_id}: VERIFIED_IDENTICAL requires actual evidence objects from both sides.')
    if comparison in {'MISMATCH', 'MISMATCHED'}: mismatches += 1
    for item in evidence:
        if not isinstance(item, dict):
            errors.append(f'{entry_id}: evidence contains a non-object item.')
            continue
        side = str(item.get('side', ''))
        if side not in {'live', 'independent'}:
            errors.append(f'{entry_id}: evidence side must be live or independent, found {side!r}.')
        file_path = str(item.get('file', '')).strip()
        sha256 = str(item.get('sha256', '')).strip().lower()
        notes = str(item.get('notes', '')).strip()
        if not file_path: errors.append(f'{entry_id}: {side or "unknown"} evidence is missing file path.')
        if not re.fullmatch(r'[0-9a-f]{64}', sha256): errors.append(f'{entry_id}: {side or "unknown"} evidence has missing/invalid sha256.')
        if not notes: errors.append(f'{entry_id}: {side or "unknown"} evidence is missing notes.')
        if file_path:
            evidence_path = Path(file_path)
            if evidence_path.is_absolute() or '..' in evidence_path.parts:
                errors.append(f'{entry_id}: evidence path must stay inside the extracted app: {file_path}')
            else:
                physical = root / evidence_path
                if not physical.is_file():
                    errors.append(f'{entry_id}: registered evidence file is missing: {file_path}')
                else:
                    actual_bytes = physical.stat().st_size
                    recorded_bytes = item.get('bytes')
                    if isinstance(recorded_bytes, int) and recorded_bytes != actual_bytes:
                        errors.append(f'{entry_id}: evidence byte-size mismatch for {file_path}: manifest={recorded_bytes}, actual={actual_bytes}.')
                    if re.fullmatch(r'[0-9a-f]{64}', sha256):
                        actual_sha256 = hashlib.sha256(physical.read_bytes()).hexdigest()
                        if actual_sha256 != sha256:
                            errors.append(f'{entry_id}: evidence SHA256 mismatch for {file_path}: manifest={sha256}, actual={actual_sha256}.')
                        else:
                            verified_evidence_files += 1
            key = (side, file_path)
            prior = seen_evidence_files.get(key)
            shared = bool(item.get('shared_evidence'))
            if prior and prior != entry_id and not shared:
                errors.append(f'{entry_id}: evidence file {file_path} is also registered to {prior} without shared_evidence=true.')
            else:
                seen_evidence_files[key] = prior or entry_id

expected = (live_captured, len(entries), independent_captured, len(entries), verified_identical, mismatches)
release = release_path.read_text()
if 'Strict rendered parity: **NOT_YET_FULLY_VERIFIED**' not in release and verified_identical != len(entries): errors.append('RELEASE_STATUS must remain NOT_YET_FULLY_VERIFIED until every formal entry is verified identical.')
summary_match = re.search(r'Evidence:\s*\*\*(\d+)/(\d+) LIVE,\s*(\d+)/(\d+) independent,\s*(\d+) verified identical,\s*(\d+) mismatches\*\*', release)
if summary_match:
    actual = tuple(map(int, summary_match.groups()))
    if actual != expected: errors.append(f'RELEASE_STATUS evidence summary {actual} does not match manifest-derived counts {expected}.')
else: errors.append('RELEASE_STATUS evidence summary could not be parsed.')

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
    if actual_value != wanted: errors.append(f'CURRENT_PARITY_AUDIT {label} count {actual_value} does not match {wanted}.')
if '**Verdict:** NOT_YET_FULLY_VERIFIED' not in audit and verified_identical != len(entries): errors.append('CURRENT_PARITY_AUDIT must remain NOT_YET_FULLY_VERIFIED while formal evidence is incomplete.')

matrix = matrix_path.read_text()
if '**NOT YET IDENTICAL IN EVERY SINGLE LOOK/FUNCTION STATE.**' not in matrix and verified_identical != len(entries): errors.append('STRICT_PARITY_MATRIX must retain the NOT YET IDENTICAL verdict while formal evidence remains incomplete.')

queue = queue_path.read_text()
if 'Status: `STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED`' not in queue: errors.append('STRICT_RENDERED_PARITY_QUEUE must retain STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED status.')
if 'Do not change scrolling/smoothness unless the owner explicitly reopens that issue.' not in queue: errors.append('STRICT_RENDERED_PARITY_QUEUE must retain the owner-requested scroll/smoothness freeze.')
if 'Photo-file functionality remains an explicit capability gap until storage exists' not in queue: errors.append('STRICT_RENDERED_PARITY_QUEUE must retain the DR photo-storage capability-gap disclosure.')

go_no_go = go_no_go_path.read_text()
for needle in ['free-tier, D1-only, no R2','4-digit PIN','Photo-file storage: **not provisioned**','seven DR-specific parity/governance guards','all seven DR parity/governance guards pass','LIVE-evidence coverage/accountability guard','Final release-readiness guard','READY_FOR_EXPLICIT_OWNER_REVIEW','NOT_YET_FULLY_VERIFIED']:
    if needle not in go_no_go: errors.append(f'GO_NO_GO is missing current DR deployment rule: {needle}')

runbook = runbook_path.read_text()
for needle in ['free-tier, D1-only, no R2','4-digit PIN','Photo-file storage: not provisioned','runs the LIVE-evidence coverage/accountability guard','STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED','NOT_YET_FULLY_VERIFIED']:
    if needle not in runbook: errors.append(f'INDEPENDENT_DEPLOYMENT is missing current DR deployment rule: {needle}')

batch_audit = batch_audit_path.read_text()
for needle in [
    'The standalone mobile shell V14 is now user-confirmed good after deployment.',
    'Do not modify the V14 header/search/welcome spacing unless the owner explicitly reopens it.',
    'runs seven source/governance parity guards',
    'verify-fire-dr-live-evidence-coverage.py',
    'verify-fire-dr-release-readiness.py',
    'Completed → Create invoice → Invoice created / Send invoice transition.',
    'Scroll/smoothness tuning is frozen',
]:
    if needle not in batch_audit: errors.append(f'LIVE_PARITY_BATCH_AUDIT is missing current state: {needle}')

for working_path in [matrix_path, queue_path, go_no_go_path, runbook_path, batch_audit_path]:
    canonical_path = overlay_dir / working_path.name
    if not canonical_path.exists():
        errors.append(f'missing persistent governance overlay: {canonical_path}')
        continue
    if canonical_path.read_text() != working_path.read_text(): errors.append(f'governance overlay drift: {working_path.name} does not match {canonical_path}')

if errors:
    print('DR_PARITY_LEDGER_CONSISTENCY=FAIL')
    for error in errors: print(f'- {error}')
    raise SystemExit(1)

print('DR_PARITY_LEDGER_CONSISTENCY=PASS')
print(f'Formal states: {len(entries)}; LIVE evidence: {live_captured}; independent evidence: {independent_captured}; verified identical: {verified_identical}; mismatches: {mismatches}; evidence files byte/hash verified: {verified_evidence_files}.')
print('Manifest evidence objects/statuses/files/bytes/SHA256, checklist, release status, current audit, persistent strict matrix, queue status, user-confirmed V14 mobile shell, seven build guards including final release-readiness, LIVE-evidence coverage accountability, scroll freeze, free D1-only/no-R2 runbook, PIN auth documentation, photo capability exception, and persistent governance/audit overlays are consistent.')
