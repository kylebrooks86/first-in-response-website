// Persist only the Stripe/manual refund operation identity, never credentials.
// Local recovery is advisory; the authoritative ledger remains the D1 database.
export type RefundRetryAttempt = { requestId:string; amountCents:number };
const key=(paymentId:string)=>`fire:refund-attempt:${paymentId}`;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function loadRefundRetry(storage:Pick<Storage,'getItem'>|undefined,paymentId:string):RefundRetryAttempt|null{
  try{
    if(!storage||!paymentId)return null;
    const raw=storage.getItem(key(paymentId));if(!raw)return null;
    const parsed=JSON.parse(raw) as Partial<RefundRetryAttempt>;
    if(!parsed||typeof parsed.requestId!=='string'||!uuid.test(parsed.requestId)||typeof parsed.amountCents!=='number'||!Number.isSafeInteger(parsed.amountCents)||parsed.amountCents<=0)return null;
    return {requestId:parsed.requestId,amountCents:parsed.amountCents};
  }catch{return null;}
}
export function saveRefundRetry(storage:Pick<Storage,'setItem'>|undefined,paymentId:string,attempt:RefundRetryAttempt){
  if(!paymentId||!uuid.test(attempt.requestId)||!Number.isSafeInteger(attempt.amountCents)||attempt.amountCents<=0)return false;
  try{storage?.setItem(key(paymentId),JSON.stringify(attempt));return Boolean(storage);}catch{return false;}
}
export function clearRefundRetry(storage:Pick<Storage,'removeItem'>|undefined,paymentId:string){
  try{storage?.removeItem(key(paymentId));}catch{/* keep server as authority */}
}
