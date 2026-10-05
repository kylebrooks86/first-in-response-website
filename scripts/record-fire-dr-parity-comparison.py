import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

repo_root = Path(__file__).resolve().parent.parent
app_dir = repo_root / 'fire-app-dr'
manifest_path = app_dir / 'PARITY_EVIDENCE_MANIFEST.json'
overlay_path = repo_root / 'dr-parity-evidence' / 'COMPARISON_OVERLAY.json'

parser = argparse.ArgumentParser(description='Record a deliberate LIVE-vs-DR parity comparison tied to exact registered evidence hashes.')
parser.add_argument('--entry-id', required=True)
parser.add_argument('--result', required=True, choices=['identical','mismatch'])
parser.add_argument('--notes', required=True)
parser.add_argument('--replace', action='store_true')
parser.add_argument('--visual-review-complete', action='store_true')
parser.add_argument('--functional-review-complete', action='store_true')
args = parser.parse_args()

if not manifest_path.is_file(): raise SystemExit('DR_PARITY_COMPARISON_RECORD=FAIL: formal parity manifest missing; run governed prepare first')
if not overlay_path.is_file(): raise SystemExit('DR_PARITY_COMPARISON_RECORD=FAIL: persistent comparison overlay missing')
notes = args.notes.strip()
if not notes: raise SystemExit('DR_PARITY_COMPARISON_RECORD=FAIL: notes must not be blank')

manifest = json.loads(manifest_path.read_text())
entry = next((item for item in manifest.get('entries', []) if isinstance(item, dict) and item.get('id') == args.entry_id), None)
if entry is None: raise SystemExit(f'DR_PARITY_COMPARISON_RECORD=FAIL: unknown formal parity id: {args.entry_id}')
if entry.get('live_evidence_status') != 'CAPTURED': raise SystemExit('DR_PARITY_COMPARISON_RECORD=FAIL: LIVE evidence must be CAPTURED first')
if entry.get('independent_evidence_status') != 'CAPTURED': raise SystemExit('DR_PARITY_COMPARISON_RECORD=FAIL: independent DR evidence must be CAPTURED first')
live = next((item for item in entry.get('evidence', []) if isinstance(item, dict) and item.get('side') == 'live'), None)
independent = next((item for item in entry.get('evidence', []) if isinstance(item, dict) and item.get('side') == 'independent'), None)
if not live or not independent: raise SystemExit('DR_PARITY_COMPARISON_RECORD=FAIL: both registered evidence objects are required')
if not live.get('sha256') or not independent.get('sha256'): raise SystemExit('DR_PARITY_COMPARISON_RECORD=FAIL: both evidence objects require SHA-256 fingerprints')

result = 'VERIFIED_IDENTICAL' if args.result == 'identical' else 'MISMATCH'
if result == 'VERIFIED_IDENTICAL':
    if independent.get('profile_matches_registered_live') is not True: raise SystemExit('DR_PARITY_COMPARISON_RECORD=FAIL: identical result requires a DR capture profile matching registered LIVE evidence')
    if not args.visual_review_complete or not args.functional_review_complete: raise SystemExit('DR_PARITY_COMPARISON_RECORD=FAIL: identical result requires both --visual-review-complete and --functional-review-complete')

now = datetime.now(timezone.utc).isoformat(); overlay = json.loads(overlay_path.read_text())
if overlay.get('schema_version') != 1 or not isinstance(overlay.get('entries'), list): raise SystemExit('DR_PARITY_COMPARISON_RECORD=FAIL: comparison overlay malformed')
entries = overlay['entries']; existing_index = next((i for i,item in enumerate(entries) if isinstance(item,dict) and item.get('id') == args.entry_id), None)
if existing_index is not None and not args.replace: raise SystemExit(f'DR_PARITY_COMPARISON_RECORD=FAIL: {args.entry_id} already has a comparison decision; use --replace only after deliberate re-review')

decision = {'id':args.entry_id,'result':result,'reviewed_at':now,'notes':notes,'live_sha256':live['sha256'],'independent_sha256':independent['sha256'],'visual_review_complete':bool(args.visual_review_complete),'functional_review_complete':bool(args.functional_review_complete)}
if existing_index is None: entries.append(decision)
else: entries[existing_index] = decision
overlay_path.write_text(json.dumps(overlay, indent=2) + '\n')

subprocess.run([sys.executable, '../scripts/apply-fire-dr-comparison-overlay.py'], cwd=app_dir, check=True)
subprocess.run([sys.executable, '../scripts/apply-fire-dr-parity-summary-sync.py'], cwd=app_dir, check=True)
subprocess.run([sys.executable, '../scripts/verify-fire-dr-comparison-integrity.py'], cwd=app_dir, check=True)
subprocess.run([sys.executable, '../scripts/verify-fire-dr-parity-ledger-consistency.py'], cwd=app_dir, check=True)
updated = json.loads(manifest_path.read_text()); updated_entry = next(item for item in updated.get('entries',[]) if isinstance(item,dict) and item.get('id') == args.entry_id)
if updated_entry.get('comparison_status') != result: raise SystemExit('DR_PARITY_COMPARISON_RECORD=FAIL: formal manifest did not receive deliberate comparison decision')

print('DR_PARITY_COMPARISON_RECORD=PASS')
print(f'{args.entry_id}: {result}')
print(f'LIVE_SHA256={live["sha256"]}')
print(f'DR_SHA256={independent["sha256"]}')
print('Decision persisted separately from evidence registration, passed comparison-integrity verification, and parity summaries/ledger were synchronized to this exact evidence pair.')
