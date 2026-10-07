from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[1]
patch=root/'scripts/fire-dr-processing-fees.patch'
def run(*args):return subprocess.run(['git','apply',*args,str(patch)],cwd=root,capture_output=True,text=True)
if run('--reverse','--check').returncode==0:
 print('DR_PROCESSING_FEES=ALREADY_APPLIED')
else:
 check=run('--check')
 if check.returncode:raise SystemExit('DR_PROCESSING_FEES=FAIL: baseline differs; inspect patch context.\n'+check.stderr)
 applied=run()
 if applied.returncode:raise SystemExit(applied.stderr)
 print('DR_PROCESSING_FEES=APPLIED')
