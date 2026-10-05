import hashlib
import subprocess
import sys
from pathlib import Path

tracked = [
    Path('app/globals.css'),
    Path('app/layout.tsx'),
    Path('app/dashboard.tsx'),
    Path('app/api/customers/route.ts'),
    Path('app/estimate/[token]/accept-button.tsx'),
    Path('app/pay/[id]/page.tsx'),
    Path('scripts/restore-records-backup.mjs'),
    Path('STRICT_PARITY_MATRIX.md'),
    Path('PARITY_EVIDENCE_MANIFEST.json'),
    Path('RELEASE_STATUS.md'),
    Path('CURRENT_PARITY_AUDIT.md'),
]

def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def evidence_tree_digest() -> str:
    base = Path('evidence/independent')
    h = hashlib.sha256()
    if not base.exists(): return h.hexdigest()
    for path in sorted(p for p in base.rglob('*') if p.is_file()):
        rel = path.relative_to(base).as_posix(); h.update(rel.encode('utf-8')); h.update(b'\0'); h.update(digest(path).encode('ascii')); h.update(b'\n')
    return h.hexdigest()

missing = [str(path) for path in tracked if not path.exists()]
if missing:
    print('DR_OVERLAY_IDEMPOTENCY=FAIL')
    for path in missing: print(f'- missing tracked overlay target: {path}')
    raise SystemExit(1)

before = {str(path): digest(path) for path in tracked}; before_evidence_tree = evidence_tree_digest()
for script_name in ['apply-fire-dr-mobile-shell-fix.py','apply-fire-dr-template-parity-fix.py','apply-fire-dr-live-evidence-fixes.py','apply-fire-dr-customer-edit-flow.py','apply-fire-dr-independent-evidence-overlay.py','apply-fire-dr-comparison-overlay.py','apply-fire-dr-parity-summary-sync.py']:
    subprocess.run([sys.executable, str(Path('..')/'scripts'/script_name)], check=True)
after = {str(path): digest(path) for path in tracked}; after_evidence_tree = evidence_tree_digest()
changed = [path for path in before if before[path] != after[path]]
if before_evidence_tree != after_evidence_tree: changed.append('evidence/independent/**')
if changed:
    print('DR_OVERLAY_IDEMPOTENCY=FAIL')
    for path in changed: print(f'- second overlay application changed {path}')
    raise SystemExit(1)
print('DR_OVERLAY_IDEMPOTENCY=PASS')
print('Mobile-shell V14, Templates parity, LIVE-evidence/payment/refund, customer-edit profile/API, persistent independent evidence, deliberate comparison decisions, parity summary counts, restore-audit, and strict-matrix overlays are stable when reapplied.')
