import hashlib
import subprocess
import sys
from pathlib import Path

# DR overlays run after every sealed-v138 extraction. They must be idempotent:
# applying them a second time must not keep appending CSS/scripts or otherwise
# mutate the extracted working tree. This protects rebuild stability without
# changing any user-visible behavior.
root = Path('.')
tracked = [
    Path('app/globals.css'),
    Path('app/layout.tsx'),
    Path('app/dashboard.tsx'),
    Path('app/estimate/[token]/accept-button.tsx'),
    Path('app/pay/[id]/page.tsx'),
    Path('scripts/restore-records-backup.mjs'),
    Path('STRICT_PARITY_MATRIX.md'),
]

def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

missing = [str(path) for path in tracked if not path.exists()]
if missing:
    print('DR_OVERLAY_IDEMPOTENCY=FAIL')
    for path in missing:
        print(f'- missing tracked overlay target: {path}')
    raise SystemExit(1)

before = {str(path): digest(path) for path in tracked}

for script_name in [
    'apply-fire-dr-mobile-shell-fix.py',
    'apply-fire-dr-template-parity-fix.py',
    'apply-fire-dr-live-evidence-fixes.py',
]:
    script = Path('..') / 'scripts' / script_name
    subprocess.run([sys.executable, str(script)], check=True)

after = {str(path): digest(path) for path in tracked}
changed = [path for path in before if before[path] != after[path]]
if changed:
    print('DR_OVERLAY_IDEMPOTENCY=FAIL')
    for path in changed:
        print(f'- second overlay application changed {path}')
    raise SystemExit(1)

print('DR_OVERLAY_IDEMPOTENCY=PASS')
print('Mobile-shell V14, Templates parity, LIVE-evidence/payment/refund, restore-audit, and strict-matrix overlays are stable when reapplied.')
