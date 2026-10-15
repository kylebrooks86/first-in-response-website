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
