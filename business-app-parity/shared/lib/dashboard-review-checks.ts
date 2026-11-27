import {reviewFollowupEligibility} from "./customer-activity-flags";
export type ReviewRequestRow={customerId:string;customerName:string;requestedAt:string|null;reviewReceivedAt:string|null;snoozedAt?:string|null;snoozeUntil?:string|null};
export type DashboardReviewCheck={customerId:string;customerName:string;requestedAt:string;elapsedDays:number};
export function dueReviewChecks(rows:readonly ReviewRequestRow[],now:number=Date.now()):DashboardReviewCheck[]{
 const results:DashboardReviewCheck[]=[];
 const seen=new Set<string>();
 for(const row of rows){
  if(!row||typeof row.customerId!=="string"||!row.customerId||typeof row.customerName!=="string"||typeof row.requestedAt!=="string"||seen.has(row.customerId))continue;
  seen.add(row.customerId);
  const assessment=reviewFollowupEligibility([{status:"completed"}],[{template:"review",channel:"text_confirmed",createdAt:row.requestedAt}],row.reviewReceivedAt,now);
  if(assessment.status!=="due"||!assessment.requestedAt)continue;
  const snoozedAt=typeof row.snoozedAt==="string"?Date.parse(row.snoozedAt):NaN;
  const snoozeUntil=typeof row.snoozeUntil==="string"?Date.parse(row.snoozeUntil):NaN;
  if(Number.isFinite(snoozedAt)&&Number.isFinite(snoozeUntil)&&
    snoozedAt>=Date.parse(assessment.requestedAt)&&snoozedAt<=now&&snoozeUntil>now)continue;
  results.push({customerId:row.customerId,customerName:row.customerName,requestedAt:assessment.requestedAt,elapsedDays:assessment.elapsedDays});
 }
 return results.sort((a,b)=>b.elapsedDays-a.elapsedDays||a.customerName.localeCompare(b.customerName)||a.customerId.localeCompare(b.customerId));
}
