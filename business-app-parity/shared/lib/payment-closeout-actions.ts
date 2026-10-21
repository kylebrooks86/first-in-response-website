/** Read-only owner closeout queue: no outbound sends or invented review receipts. */
export type CloseoutRow={
 estimateId:string;customerId:string;customerName:string;status:string;
 totalCents:number;paidCents:number;lastPaidAt:string|null;
 reviewPreparedAt:string|null;reviewConfirmedAt:string|null;reviewReceivedAt:string|null;
 pendingRefundCount:number;paymentOverageOpen:number;openCheckoutCount:number;
};
export type CloseoutAction={estimateId:string;customerId:string;customerName:string;totalCents:number;lastPaidAt:string;state:"ready"|"prepared";reviewPreparedAt:string|null};
function parseDate(value:string|null):number|null{
 if(typeof value!=="string"||!value.trim())return null;
 const n=Date.parse(value);return Number.isFinite(n)?n:null;
}
export function buildPaymentCloseoutActions(rows:readonly CloseoutRow[],now=Date.now()):CloseoutAction[]{
 const out:CloseoutAction[]=[],seen=new Set<string>();
 for(const row of rows){
  if(!row||!row.estimateId||!row.customerId||typeof row.customerName!=="string"||!row.customerName.trim()||seen.has(row.estimateId)
   ||row.status!=="completed"||!Number.isSafeInteger(row.totalCents)||row.totalCents<=0
   ||!Number.isSafeInteger(row.paidCents)||row.paidCents!==row.totalCents
   ||![row.pendingRefundCount,row.paymentOverageOpen,row.openCheckoutCount].every(n=>Number.isSafeInteger(n)&&n===0)
   ||row.reviewConfirmedAt!==null||row.reviewReceivedAt!==null)continue;
  const date=parseDate(row.lastPaidAt);
  if(date===null||date>now+60000)continue;
  const prepared=parseDate(row.reviewPreparedAt);
  seen.add(row.estimateId);
  out.push({estimateId:row.estimateId,customerId:row.customerId,customerName:row.customerName,totalCents:row.totalCents,
   lastPaidAt:row.lastPaidAt!,state:prepared===null?"ready":"prepared",reviewPreparedAt:prepared===null?null:row.reviewPreparedAt});
 }
 return out.sort((a,b)=>Date.parse(b.lastPaidAt)-Date.parse(a.lastPaidAt)||a.estimateId.localeCompare(b.estimateId));
}
