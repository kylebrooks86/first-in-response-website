import json
import re
from pathlib import Path

manifest_path = Path('PARITY_EVIDENCE_MANIFEST.json')
release_path = Path('RELEASE_STATUS.md')
audit_path = Path('CURRENT_PARITY_AUDIT.md')

for path in [manifest_path, release_path, audit_path]:
    if not path.is_file():
        raise SystemExit(f'DR_PARITY_SUMMARY_SYNC=FAIL: missing {path}')

manifest = json.loads(manifest_path.read_text())
entries = manifest.get('entries') or []
if not isinstance(entries, list) or len(entries) != 32:
    raise SystemExit(f'DR_PARITY_SUMMARY_SYNC=FAIL: expected 32 formal entries, found {len(entries) if isinstance(entries, list) else "invalid"}')

live = sum(1 for item in entries if isinstance(item, dict) and item.get('live_evidence_status') == 'CAPTURED')
independent = sum(1 for item in entries if isinstance(item, dict) and item.get('independent_evidence_status') == 'CAPTURED')
verified = sum(1 for item in entries if isinstance(item, dict) and item.get('comparison_status') == 'VERIFIED_IDENTICAL')
mismatches = sum(1 for item in entries if isinstance(item, dict) and item.get('comparison_status') in {'MISMATCH','MISMATCHED'})
infrastructure_only = sum(1 for item in entries if isinstance(item, dict) and item.get('comparison_status') == 'INFRASTRUCTURE_ONLY')
pending = len(entries) - verified - mismatches - infrastructure_only
if min(live, independent, verified, mismatches, infrastructure_only, pending) < 0:
    raise SystemExit('DR_PARITY_SUMMARY_SYNC=FAIL: derived parity counts are invalid')

release = release_path.read_text()
release_pattern = r'Evidence:\s*\*\*\d+/\d+ LIVE,\s*\d+/\d+ independent,\s*\d+ verified identical,\s*\d+ mismatches\*\*'
release_replacement = f'Evidence: **{live}/{len(entries)} LIVE, {independent}/{len(entries)} independent, {verified} verified identical, {mismatches} mismatches**'
release, count = re.subn(release_pattern, release_replacement, release, count=1)
if count != 1:
    raise SystemExit('DR_PARITY_SUMMARY_SYNC=FAIL: RELEASE_STATUS evidence summary pattern not found exactly once')
release_path.write_text(release)

audit = audit_path.read_text()
replacements = [
    (r'Evidence entries:\s*\*\*\d+\*\*', f'Evidence entries: **{len(entries)}**'),
    (r'LIVE evidence captured:\s*\*\*\d+/\d+\*\*', f'LIVE evidence captured: **{live}/{len(entries)}**'),
    (r'Independent evidence captured:\s*\*\*\d+/\d+\*\*', f'Independent evidence captured: **{independent}/{len(entries)}**'),
    (r'VERIFIED_IDENTICAL comparisons:\s*\*\*\d+\*\*', f'VERIFIED_IDENTICAL comparisons: **{verified}**'),
    (r'Pending comparisons:\s*\*\*\d+\*\*', f'Pending comparisons: **{pending}**'),
    (r'Mismatches:\s*\*\*\d+\*\*', f'Mismatches: **{mismatches}**'),
]
for pattern, replacement in replacements:
    audit, count = re.subn(pattern, replacement, audit, count=1)
    if count != 1:
        raise SystemExit(f'DR_PARITY_SUMMARY_SYNC=FAIL: CURRENT_PARITY_AUDIT pattern not found exactly once: {pattern}')
audit_path.write_text(audit)

print('DR_PARITY_SUMMARY_SYNC=PASS')
print(f'Formal counts synchronized: LIVE={live}/{len(entries)}, independent={independent}/{len(entries)}, verified={verified}, mismatches={mismatches}, infrastructure_only={infrastructure_only}, pending={pending}.')
