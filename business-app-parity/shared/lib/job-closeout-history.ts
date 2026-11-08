import {reviewFollowupEligibility} from './customer-activity-flags';
export type CloseoutHistoryState='due'|'waiting'|'snoozed'|'received'|'needs-review';
export type CloseoutHistoryRow={customerId:string;customerName:string;estimateId:string;requestedAt:string|null;reviewReceivedAt:string|null;checkSnoozedAt:string|null;checkSnoozeUntil:string|null;requestSnoozedAt:string|null;requestSnoozeUntil:string|null};
export type CloseoutHistoryItem={customerId:string;customerName:string;estimateId:string;state:CloseoutHistoryState;requestedAt:string|null;reviewReceivedAt:string|null;snoozeUntil:string|null;checkDueAt:string|null};
const time=(value:string|null)=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
/** Present existing customer-level review receipts and manual flags. Never authorizes outreach. */
export function closeoutHistoryItem(row:CloseoutHistoryRow,now=Date.now()):CloseoutHistoryItem{
 const received=time(row.reviewReceivedAt),requested=time(row.requestedAt);
 const base={customerId:row.customerId,customerName:row.customerName,estimateId:row.estimateId,requestedAt:requested!==null&&requested<=now?row.requestedAt:null,reviewReceivedAt:received!==null&&received<=now?row.reviewReceivedAt:null,snoozeUntil:null,checkDueAt:null};
 if(!Number.isFinite(now))return {...base,state:'needs-review'};
 if(row.reviewReceivedAt!==null)return {...base,state:received!==null&&received<=now?'received':'needs-review'};
 if(row.requestedAt!==null){
  if(requested===null||requested>now)return {...base,state:'needs-review'};
  const until=time(row.checkSnoozeUntil),at=time(row.checkSnoozedAt);
  if((row.checkSnoozedAt===null)!==(row.checkSnoozeUntil===null)||row.checkSnoozedAt!==null&&(at===null||until===null||at>now||until<=at))return {...base,state:'needs-review'};
  const checkDueAt=new Date(requested+7*86400000).toISOString();
  if(at!==null&&until!==null&&at>=requested&&until>now)return {...base,state:'snoozed',snoozeUntil:row.checkSnoozeUntil,checkDueAt};
  const state=reviewFollowupEligibility([{status:'completed'}],[{template:'review',channel:'text_confirmed',createdAt:row.requestedAt}],null,now);
  return {...base,state:state.status==='due'?'due':'waiting',checkDueAt};
 }
 const at=time(row.requestSnoozedAt),until=time(row.requestSnoozeUntil);
 if((row.requestSnoozedAt===null)!==(row.requestSnoozeUntil===null)||row.requestSnoozedAt!==null&&(at===null||until===null||at>now||until<=at))return {...base,state:'needs-review'};
 if(at!==null&&until!==null&&until>now)return {...base,state:'snoozed',snoozeUntil:row.requestSnoozeUntil};
 return {...base,state:'needs-review'};
}
export function validCloseoutHistoryItem(value:unknown):value is CloseoutHistoryItem{
 if(!value||typeof value!=='object')return false;
 const x=value as Record<string,unknown>;
 return ['customerId','customerName','estimateId'].every(key=>typeof x[key]==='string'&&!!x[key]&&(x[key] as string).length<=256)&&
  ['due','waiting','snoozed','received','needs-review'].includes(String(x.state))&&
  ['requestedAt','reviewReceivedAt','snoozeUntil','checkDueAt'].every(key=>x[key]===null||typeof x[key]==='string'&&Number.isFinite(Date.parse(x[key] as string)))&&
  (!(x.state==='due'||x.state==='waiting')||typeof x.requestedAt==='string'&&typeof x.checkDueAt==='string')&&
  (x.state!=='received'||typeof x.reviewReceivedAt==='string')&&(x.state!=='snoozed'||typeof x.snoozeUntil==='string');
}
