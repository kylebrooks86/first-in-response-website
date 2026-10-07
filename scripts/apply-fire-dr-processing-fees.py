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

replace_once(
    dashboard,
    'function RecordPayment({estimate,onRecorded}:{estimate:Pick<EstimateRow,"id"|"customer"|"service"|"totalCents"|"paidCents">&Partial<Pick<EstimateRow,"depositCents"|"status"|"invoiceTotalCents">>;onRecorded?:(paidCents:number)=>void}){',
    '''function ProcessingDetails({payment}:{payment:PaymentRow}) {
  if(payment.grossReceivedCents==null||!["Cash App","Venmo"].includes(payment.processingMethod??""))return null;
  return <small className="payment-handle-note">{payment.bundledTipCents?<>Invoice payment: {money(payment.amountCents)} · Tip: {money(payment.bundledTipCents)}<br/></>:null}Customer payment: {money(payment.grossReceivedCents)}<br/>Processing fee: {payment.processingFeeCents==null?"Not recorded":`−${money(payment.processingFeeCents)}`}<br/>Net received{payment.processingFeeCents==null?" before unrecorded fees":""}: {money(payment.grossReceivedCents-(payment.processingFeeCents??0))}</small>;
}
function ProcessingReport({payments}:{payments:PaymentRow[]}) {
 const fees=payments.reduce((sum,row)=>sum+(row.processingFeeCents??0),0);
 return <details className="business-panel"><summary>Processing fees · {money(fees)} recorded</summary><p>Gross includes tips; fees are expenses. Unrecorded fees are excluded. Refunds remain separate ledger entries; original fees are retained.</p><table style={{width:"100%"}}><thead><tr><th>Method</th><th>Gross</th><th>Fees</th><th>Net</th></tr></thead><tbody>{["Cash App","Venmo"].map(method=>{const totals=summarizeProcessing(payments,method);return <tr key={method}><th>{method}</th><td>{money(totals.gross)}{totals.tips>0&&<small style={{display:"block"}}>Tips {money(totals.tips)}</small>}</td><td>{money(totals.fees)}</td><td>{money(totals.net)}</td></tr>;})}</tbody></table></details>;
}

function RecordPayment({estimate,onRecorded}:{estimate:Pick<EstimateRow,"id"|"customer"|"service"|"totalCents"|"paidCents">&Partial<Pick<EstimateRow,"depositCents"|"status"|"invoiceTotalCents">>;onRecorded?:(paidCents:number)=>void}){''',
    'dashboard processing detail/report helpers',
)

replace_once(
    dashboard,
    '  const [open,setOpen]=useState(false);const [amount,setAmount]=useState("");const [tip,setTip]=useState("");const [method,setMethod]=useState("Wave");const [reference,setReference]=useState("");const [saving,setSaving]=useState(false);const [error,setError]=useState("");',
    '  const [fee,setFee]=useState("");const [feeMode,setFeeMode]=useState<"fee"|"net">("fee");const [feeEstimate,setFeeEstimate]=useState<number|null>(null);const [open,setOpen]=useState(false);const [amount,setAmount]=useState("");const [tip,setTip]=useState("");const [method,setMethod]=useState("Wave");const [reference,setReference]=useState("");const [saving,setSaving]=useState(false);const [error,setError]=useState("");',
    'record payment processing state',
)
replace_once(
    dashboard,
    '  useEffect(()=>{if(open){setAmount(balance>0?(balance/100).toFixed(2):"");setTip("");setError("");}},[open,balance]);',
    '  useEffect(()=>{if(open){setAmount(balance>0?(balance/100).toFixed(2):"");setTip("");setFee("");setFeeEstimate(null);setError("");}},[open,balance]);',
    'record payment reset processing state',
)
replace_once(
    dashboard,
    '  const save=async()=>{const amountCents=Math.round(Number(amount||0)*100);const tipCents=Math.round(Number(tip||0)*100);const maxTipCents=Math.min(normalized.totalCents,50000);if((!Number.isSafeInteger(amountCents)||amountCents<0)||(!Number.isSafeInteger(tipCents)||tipCents<0)||(amountCents<=0&&tipCents<=0)){setError("Enter a payment or tip amount.");return;}if(!Number.isSafeInteger(maxTipCents)||maxTipCents<0){setError("This job\'s tip limit cannot be represented safely.");return;}if(tipCents>maxTipCents){setError("Tip cannot exceed the invoice total or $500.");return;}setSaving(true);setError("");try{const response=await fetch("/api/payments",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({estimateId:estimate.id,amountCents,tipCents,method,reference})});const result=await response.json() as {paidCents?:number;error?:string};if(!response.ok||result.paidCents===undefined)throw new Error(result.error||"The payment could not be recorded.");onRecorded?.(Number(result.paidCents));setOpen(false);}catch(saveError){setError(saveError instanceof Error?saveError.message:"The payment could not be recorded.");}finally{setSaving(false);}};',
    '  const feeMethod=method==="Cash App"||method==="Venmo";\n  const grossCents=Math.round(Number(amount||0)*100)+Math.round(Number(tip||0)*100);\n  const enteredFeeCents=fee===""?null:Math.round(Number(fee)*100);\n  const processingFeeCents=enteredFeeCents==null?null:feeMode==="fee"?enteredFeeCents:grossCents-enteredFeeCents;\n  const feeValid=processingFeeCents==null||Number.isSafeInteger(processingFeeCents)&&processingFeeCents>=0&&processingFeeCents<=grossCents;\n  const save=async()=>{const amountCents=Math.round(Number(amount||0)*100);const tipCents=Math.round(Number(tip||0)*100);const maxTipCents=Math.min(normalized.totalCents,50000);if((!Number.isSafeInteger(amountCents)||amountCents<0)||(!Number.isSafeInteger(tipCents)||tipCents<0)||(amountCents<=0&&tipCents<=0)){setError("Enter a payment or tip amount.");return;}if(!Number.isSafeInteger(maxTipCents)||maxTipCents<0){setError("This job\'s tip limit cannot be represented safely.");return;}if(tipCents>maxTipCents){setError("Tip cannot exceed the invoice total or $500.");return;}if(feeMethod&&!feeValid){setError("Fee and net deposited must be between zero and the customer payment.");return;}setSaving(true);setError("");try{const response=await fetch("/api/payments",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({estimateId:estimate.id,amountCents,tipCents,method,reference,processingFeeCents:feeMethod?processingFeeCents:undefined})});const result=await response.json() as {paidCents?:number;error?:string};if(!response.ok||result.paidCents===undefined)throw new Error(result.error||"The payment could not be recorded.");onRecorded?.(Number(result.paidCents));setOpen(false);}catch(saveError){setError(saveError instanceof Error?saveError.message:"The payment could not be recorded.");}finally{setSaving(false);}};',
    'record payment processing payload',
)
replace_once(
    dashboard,
    '<DialogContent className="sm:max-w-[500px]"><DialogHeader>',
    '<DialogContent className="sm:max-w-[500px] max-h-[90dvh] overflow-y-auto"><DialogHeader>',
    'record payment mobile dialog scroll',
)

replace_once(
    dashboard,
    '<div><Label>Payment method</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["Wave","Cash App","Venmo","Cash","Check","Card","ACH / bank","Other"].map((item)=><SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><small className="payment-handle-note">Cash App {DEFAULT_CASH_APP_HANDLE} · Venmo {DEFAULT_VENMO_HANDLE}</small></div>',
    '<div><Label>Payment method</Label><Select value={method} onValueChange={(value)=>{setMethod(value);setFee("");setFeeEstimate(null);}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["Wave","Cash App","Venmo","Cash","Check","Card","ACH / bank","Other"].map((item)=><SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><small className="payment-handle-note">Cash App {DEFAULT_CASH_APP_HANDLE} · Venmo {DEFAULT_VENMO_HANDLE}</small></div>\n    {feeMethod&&<details><summary>Processing fee (optional)</summary><div className="payment-form"><div><Label>Customer paid (invoice + tip)</Label><Input readOnly value={(grossCents/100).toFixed(2)}/></div><div><Label>Processing fee</Label><Input inputMode="decimal" value={feeMode==="fee"?fee:processingFeeCents==null?"":(processingFeeCents/100).toFixed(2)} placeholder="Not recorded" onChange={event=>{setFeeMode("fee");setFee(event.target.value);}}/></div><div><Label>Net deposited</Label><Input inputMode="decimal" value={feeMode==="net"?fee:processingFeeCents==null?"":((grossCents-processingFeeCents)/100).toFixed(2)} placeholder={(grossCents/100).toFixed(2)} onChange={event=>{setFeeMode("net");setFee(event.target.value);}}/></div><small>Enter the actual fee or net deposit. Invoice credit stays {money(Math.round(Number(amount||0)*100))}.</small>{method==="Venmo"&&<><Button type="button" variant="outline" onClick={()=>setFeeEstimate(Math.round(grossCents*0.019)+10)}>Estimate fee</Button>{feeEstimate!=null&&<div><small>Venmo Business direct-payment estimate: 1.9% + $0.10 = {money(feeEstimate)}. Check the actual transaction; Tap to Pay and rates may differ.</small><Button type="button" variant="outline" onClick={()=>{setFeeMode("fee");setFee((feeEstimate/100).toFixed(2));setFeeEstimate(null);}}>Use this fee</Button></div>}</>}</div></details>}',
    'record payment processing fee UI',
)
