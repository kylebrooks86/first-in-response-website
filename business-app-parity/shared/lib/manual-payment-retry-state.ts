// Preserve the operation ID and original financial inputs BEFORE sending a
// manual payment. A lost D1 acknowledgement must not become a second payment.
export type ManualPaymentAttempt={
 requestId:string;amountCents:number;tipCents:number;method:string;reference:string;processingFeeCents:number|null;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key=(estimateId:string)=>`fire:manual-payment-attempt:${estimateId}`;
function valid(a:ManualPaymentAttempt){
 return Boolean(a&&typeof a.requestId==='string'&&uuid.test(a.requestId)&&Number.isSafeInteger(a.amountCents)&&a.amountCents>=0&&Number.isSafeInteger(a.tipCents)&&a.tipCents>=0&&(a.amountCents>0||a.tipCents>0)&&typeof a.method==='string'&&a.method.length>0&&a.method.length<=80&&typeof a.reference==='string'&&a.reference.length<=1000&&(a.processingFeeCents===null||Number.isSafeInteger(a.processingFeeCents)&&a.processingFeeCents>=0));
}
export function loadManualPaymentRetry(storage:Pick<Storage,'getItem'>|undefined,estimateId:string):ManualPaymentAttempt|null{
 try{
  const raw=storage?.getItem(key(estimateId));if(!raw)return null;
  const data=JSON.parse(raw) as {version?:number;attempt?:ManualPaymentAttempt};
  return data?.version===1&&data.attempt&&valid(data.attempt)?data.attempt:null;
 }catch{return null;}
}
export function saveManualPaymentRetry(storage:Pick<Storage,'setItem'>|undefined,estimateId:string,a:ManualPaymentAttempt){
 if(!estimateId||!valid(a))return false;
 try{storage?.setItem(key(estimateId),JSON.stringify({version:1,attempt:a}));return Boolean(storage);}catch{return false;}
}
export function clearManualPaymentRetry(storage:Pick<Storage,'removeItem'>|undefined,estimateId:string){try{storage?.removeItem(key(estimateId));}catch{/* old attempt preserved in memory as a fallback */}}

// Validate the authoritative stored rows, not just a success-shaped HTTP body.
export function confirmedManualPayment(value:unknown,estimateId:string,attempt:ManualPaymentAttempt):number|null{
 if(!value||typeof value!=='object')return null;
 const r=value as Record<string,unknown>;
 if(r.confirmed!==true||r.estimateId!==estimateId||r.requestId!==attempt.requestId||!Number.isSafeInteger(r.paidCents)||Number(r.paidCents)<0||!Array.isArray(r.records))return null;
 const rows=r.records as Record<string,unknown>[],id='manual-'+attempt.requestId;
 if(rows.length!==(attempt.amountCents>0?1:0)+(attempt.tipCents>0?1:0))return null;
 const principal=rows.find(row=>row.id===id),tip=rows.find(row=>row.id===id+'-tip');
 const method=attempt.method.trim(),reference=attempt.reference.trim()||null;
 const basic=(row:Record<string,unknown>|undefined,type:string,amount:number,ref:string|null)=>Boolean(row&&row.estimateId===estimateId&&row.status==='paid'&&row.type===type&&row.amountCents===amount&&row.reference===ref);
 const accounting=(row:Record<string,unknown>|undefined)=>Boolean(row&&row.processingFeeCents===attempt.processingFeeCents&&row.grossReceivedCents===attempt.amountCents+attempt.tipCents&&row.processingMethod===method);
 if(attempt.amountCents>0&&(!basic(principal,method,attempt.amountCents,reference)||!accounting(principal)||principal?.bundledTipCents!==attempt.tipCents))return null;
 if(attempt.amountCents===0&&principal)return null;
 if(attempt.tipCents>0){
  if(!basic(tip,'Tip',attempt.tipCents,[method,reference].filter(Boolean).join(' · ')))return null;
  if(attempt.amountCents>0){if(tip?.processingFeeCents!==null||tip?.grossReceivedCents!==null)return null;}
  else if(!accounting(tip))return null;
 }else if(tip)return null;
 return r.paidCents as number;
}
