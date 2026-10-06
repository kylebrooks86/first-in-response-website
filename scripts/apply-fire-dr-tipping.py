import subprocess
from pathlib import Path

repo_root=Path(__file__).resolve().parent.parent
patch=repo_root/'scripts/fire-dr-tipping.patch'
if not patch.is_file():
    raise SystemExit('DR_TIPPING_APPLY=FAIL: governed tipping patch is missing')

def run(*args):
    return subprocess.run(
        ['git','apply',*args,str(patch)],
        cwd=repo_root,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

check=run('--check')
if check.returncode==0:
    applied=run()
    if applied.returncode!=0:
        raise SystemExit('DR_TIPPING_APPLY=FAIL: '+(applied.stderr.strip() or 'git apply failed'))
    print('DR_TIPPING_APPLY=PASS')
    print('Applied optional final-payment tipping patch.')
else:
    reverse=run('--reverse','--check')
    if reverse.returncode!=0:
        detail=check.stderr.strip() or reverse.stderr.strip() or 'patch neither applies nor reverses cleanly'
        raise SystemExit('DR_TIPPING_APPLY=FAIL: '+detail)
    print('DR_TIPPING_APPLY=PASS')
    print('Optional final-payment tipping patch already applied; no changes made.')
