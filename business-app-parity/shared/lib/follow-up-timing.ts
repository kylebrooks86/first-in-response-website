type FollowUpEstimate = { status: string; createdAt: string; lastEstimateSentAt?: string|null; lastEstimateContactAt?: string|null };
function timestamp(value: string|null|undefined) { const time=value?Date.parse(value):NaN;return Number.isFinite(time)?time:null; }
// Only owner-confirmed estimate communication qualifies as contact. Legacy dates
// fall back transparently; preparation/copy events must never enter these fields.
export function estimateFollowUpTiming(estimate: FollowUpEstimate, now: number) {
  const created=timestamp(estimate.createdAt);
  const confirmed=estimate.status==="sent"?[timestamp(estimate.lastEstimateSentAt),timestamp(estimate.lastEstimateContactAt)].filter((time):time is number=>time!==null):[];
  const anchor=confirmed.length?Math.max(...confirmed):created;
  return { ageDays:anchor===null||!Number.isFinite(now)?0:Math.max(0,Math.floor((now-anchor)/86400000)), confirmedContact:confirmed.length>0 };
}

export type ReminderRecord = {status:string;lastEstimateSentAt?:string|null;firstEstimateSentAt?:string|null;lastEstimateContactAt?:string|null;stage1At?:string|null;stage3At?:string|null;stage7At?:string|null;lastManualContactAt?:string|null;snoozeUntil?:string|null};
export function estimateReminderStage(record:ReminderRecord,now:number):{template:"followUp1"|"followUp3"|"followUp7"|null;reviewReason:string|null} {
  const none={template:null,reviewReason:null};if(record.status!=="sent")return none;
  const first=timestamp(record.firstEstimateSentAt),sent=timestamp(record.lastEstimateSentAt);
  if(first===null||sent===null)return {template:null,reviewReason:"Send date unverified — review saved history before another reminder."};
  const raw=[record.firstEstimateSentAt,record.lastEstimateSentAt,record.lastEstimateContactAt,record.stage1At,record.stage3At,record.stage7At];
  const times=raw.map(timestamp);
  if(raw.some((value,i)=>value&&times[i]===null)||times.some(time=>time!==null&&(time>now||time<first))||sent<first)return {template:null,reviewReason:"Communication dates need review; no reminder is suggested."};
  const stages=[timestamp(record.stage1At),timestamp(record.stage3At),timestamp(record.stage7At)].map(time=>time!==null&&time>=sent?time:null);
  if(stages.some((time,i)=>time!==null&&stages.slice(i+1).some(later=>later!==null&&time>later)))return {template:null,reviewReason:"Reminder order needs review; no reminder is suggested."};
  if(stages[2]!==null)return none;
  const manual=timestamp(record.lastManualContactAt),snooze=timestamp(record.snoozeUntil);
  if((record.lastManualContactAt&&(manual===null||manual>now))||(record.snoozeUntil&&snooze===null))return {template:null,reviewReason:"Follow-up action dates need review; no reminder is suggested."};
  if((manual!==null&&now-manual<86400000)||(snooze!==null&&snooze>now))return none;
  const contact=timestamp(record.lastEstimateContactAt)??sent;
  if(!Number.isFinite(now)||now-Math.max(sent,contact)<86400000)return none;
  const days=(now-sent)/86400000;
  if(days>=7)return {template:"followUp7",reviewReason:null};
  if(stages[1]!==null)return none;
  if(days>=3)return {template:"followUp3",reviewReason:null};
  if(stages[0]!==null)return none;
  return days>=1?{template:"followUp1",reviewReason:null}:none;
}


/** Read-only prioritization. "Past target" is a suggested outreach window,
 * never a contract deadline, an invoice due date, or proof of message delivery. */
export type FollowupUrgencyInput={
  kind:"followup"|"repeat"|"review"|"history";template:string;priority:number;
  dueAt?:string|null;
  estimate:{status:string;firstEstimateSentAt?:string|null;scheduledAt?:string|null;paymentOverageOpen?:number|null};
};
export type FollowupUrgencyBucket="past-target"|"due"|"upcoming"|"review";
export function followupUrgency(item:FollowupUrgencyInput,now:number):{bucket:FollowupUrgencyBucket;label:string;rank:number}{
 const date=(value?:string|null)=>{const n=value?Date.parse(value):NaN;return Number.isFinite(n)?n:null;};
 const day=86400000;
 if(Number(item.estimate.paymentOverageOpen)>0)return {bucket:"review",label:"Billing exception · check saved records",rank:0};
 if(item.template==="appointmentReminder"){
   const at=date(item.estimate.scheduledAt);
   if(at===null||!Number.isFinite(now))return {bucket:"review",label:"Appointment time needs verification",rank:4};
   const hours=Math.max(0,Math.ceil((at-now)/3600000));
   return {bucket:"upcoming",label:`Appointment within ${hours}h`,rank:hours<=24?1:5};
 }
 if(["followUp1","followUp3","followUp7"].includes(item.template)){
   const first=date(item.estimate.firstEstimateSentAt);
   if(first===null||!Number.isFinite(now))return {bucket:"review",label:"Confirm estimate send date first",rank:4};
   const stage=item.template==="followUp7"?7:item.template==="followUp3"?3:1;
   const lag=now-(first+stage*day);
   if(lag>=day)return {bucket:"past-target",label:`Past suggested day ${stage} by ${Math.floor(lag/day)}d`,rank:2};
   return {bucket:"due",label:`Suggested day ${stage} follow-up due`,rank:3};
 }
 if(item.kind==="repeat"){
   const due=date(item.dueAt);
   if(due===null||!Number.isFinite(now))return {bucket:"review",label:"Repeat service date needs verification",rank:6};
   const lag=now-due;
   if(lag>=day)return {bucket:"past-target",label:`Repeat-service target passed by ${Math.floor(lag/day)}d`,rank:2};
   if(lag>=0)return {bucket:"due",label:"Repeat-service target reached",rank:3};
   return {bucket:"upcoming",label:`Repeat-service target in ${Math.ceil(-lag/day)}d`,rank:7};
 }
 if(item.template==="invoiceReminder")return {bucket:"review",label:"Billing review · invoice due date unverified",rank:4};
 if(item.estimate.status==="draft")return {bucket:"review",label:"Unsent estimate draft · review next",rank:5};
 if(item.kind==="history")return {bucket:"review",label:"Saved history needs owner review",rank:4};
 if(item.kind==="review")return {bucket:"review",label:"Review request suggested",rank:6};
 return {bucket:"review",label:"Review next action",rank:6};
}


/** Display-only queue based on existing recommendation records.
 * Repeat recommendations beyond today and review requests remain in the full list. */
export type TodayQueueAction = FollowupUrgencyInput & {
 estimate:FollowupUrgencyInput["estimate"] & {id:string;customerId?:string|null};
};
export type TodayQueueLane = "now"|"verify";
export function todayActionLane(item:TodayQueueAction,now:number):TodayQueueLane|null {
 const urgency=followupUrgency(item,now);
 if(urgency.rank<=3)return "now";
 if(item.kind==="history"||item.template==="invoiceReminder"||item.estimate.status==="draft")return "verify";
 return null;
}
export function todayCustomerQueue<T extends TodayQueueAction>(items:readonly T[],now:number,limit=5) {
 const candidates=items.map(item=>({item,lane:todayActionLane(item,now)})).filter(
   (entry):entry is {item:T;lane:TodayQueueLane}=>entry.lane!==null
 );
 const keyFor=(item:T)=>item.estimate.customerId?.trim()?`customer:${item.estimate.customerId}`:`estimate:${item.estimate.id}`;
 const counts=new Map<string,number>(),seen=new Set<string>();
 for(const entry of candidates){const key=keyFor(entry.item);counts.set(key,(counts.get(key)??0)+1);}
 const queue:{item:T;lane:TodayQueueLane;additionalCustomerActions:number}[]=[];
 for(const entry of candidates){
   const key=keyFor(entry.item);
   if(seen.has(key))continue;
   seen.add(key);
   if(queue.length>=Math.max(0,Math.min(5,limit)))break;
   queue.push({...entry,additionalCustomerActions:(counts.get(key)??1)-1});
 }
 return queue;
}

/** Do not promote a copied/prepared message or contact note into a sent claim. */
export type FollowupContactEvidence={
 lastConfirmedMessageAt?:string|null;lastPreparedAt?:string|null;lastManualContactAt?:string|null;
};
export function followupLatestContact(record:FollowupContactEvidence,now:number){
 const entries=[
   {key:"confirmed" as const,value:record.lastConfirmedMessageAt,label:"Owner-confirmed message · delivery unverified"},
   {key:"prepared" as const,value:record.lastPreparedAt,label:"Prepared/copied · sending unconfirmed"},
   {key:"logged" as const,value:record.lastManualContactAt,label:"Contact logged · no send claimed"}
 ];
 if(!Number.isFinite(now))return {kind:"unverified" as const,at:null,label:"Contact timing could not be checked"};
 const parsed=entries.map((e)=>({...e,at:timestamp(e.value)}));
 if(parsed.some(e=>e.value&&(e.at===null||e.at>now+300000)))return {kind:"unverified" as const,at:null,label:"Contact date needs review"};
 const latest=parsed.filter((e):e is typeof e & {at:number}=>e.at!==null).sort((a,b)=>b.at-a.at)[0];
 return latest?{kind:latest.key,at:new Date(latest.at).toISOString(),label:latest.label}:
   {kind:"unverified" as const,at:null,label:"No confirmed contact status in saved records"};
}
