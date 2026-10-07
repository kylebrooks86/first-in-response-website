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


def replace_once(path: Path, old: str, new: str, label: str):
    if not path.exists():
        raise SystemExit(f'DR_PROCESSING_FEES=FAIL: {path} not found')
    source=path.read_text()
    if new in source:
        return
    if old not in source:
        raise SystemExit(f'DR_PROCESSING_FEES=FAIL: {label} source fragment not found')
    path.write_text(source.replace(old,new,1))

dashboard=root/'fire-app-dr/app/dashboard.tsx'
replace_once(
    dashboard,
    '"use client";\n',
    '"use client";\nimport { summarizeProcessing } from "../lib/processing-fees";\n',
    'dashboard processing import',
)
replace_once(
    dashboard,
    'type PaymentRow = { id:string; estimateId:string; customerId?:string; customer?:string; service?:string; type:string; amountCents:number; status:string; reference?:string|null; refundedCents?:number; refundableCents?:number; stripePayment?:number; createdAt:string };',
    'type PaymentRow = { processingFeeCents?:number|null; grossReceivedCents?:number|null; bundledTipCents?:number|null; processingMethod?:string|null; id:string; estimateId:string; customerId?:string; customer?:string; service?:string; type:string; amountCents:number; status:string; reference?:string|null; refundedCents?:number; refundableCents?:number; stripePayment?:number; createdAt:string };',
    'dashboard payment accounting fields',
)
