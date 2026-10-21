/** Read-only, owner-side candidate reminders from the same saved follow-up history.
 * These are suggestions, never proof of message delivery or automatic writes.
 */
import {estimateReminderStage} from "./follow-up-timing";
export type AttentionEstimate={
 id:string;customer:string;status:string;createdAt:string;
 scheduledAt?:string|null;address?:string|null;phone?:string|null;email?:string|null;
 totalCents?:number|null;invoiceTotalCents?:number|null;paidCents?:number|null;
 invoiceId?:string|null;paymentOverageOpen?:number|null;
 firstEstimateSentAt?:string|null;lastEstimateSentAt?:string|null;lastEstimateContactAt?:string|null;
 stage1At?:string|null;stage3At?:string|null;stage7At?:string|null;lastManualContactAt?:string|null;snoozeUntil?:string|null;
 lastReviewRequestAt?:string|null;
};
export type AttentionEstimateItem={
 key:string;kind:"followup"|"draft"|"invoice"|"appointment"|"review-request";
 title:string;detail:string;estimateId:string;invoiceId?:string;urgent:boolean;
};
const day=86400000;
const date=(s?:string|null)=>s?Date.parse(s):NaN;
function usableContact(e:AttentionEstimate){
 const p=e.phone?.trim()??"",digits=/^[+0-9().\s-]+$/.test(p)?p.replace(/\D/g,""):"";
 return digits.length===10||(digits.length===11&&digits.startsWith("1"))||/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(e.email?.trim()??"");
}
export function estimateAttentionItems(estimates:readonly AttentionEstimate[],now:number):AttentionEstimateItem[]{
 if(!Number.isFinite(now))return [];
 const items:AttentionEstimateItem[]=[];
 for(const e of estimates){
  if(!e||typeof e.id!=="string"||!e.id||typeof e.customer!=="string"||!e.customer.trim())continue;
  const add=(kind:AttentionEstimateItem["kind"],detail:string,urgent=false,invoiceId?:string)=>{
   items.push({key:kind+":"+e.id,kind,title:e.customer.trim(),detail,urgent,estimateId:e.id,...(invoiceId?{invoiceId}:{})});
  };
  const total=Number(e.invoiceTotalCents??e.totalCents),paid=Number(e.paidCents);
  if(Number(e.paymentOverageOpen)>0)add("invoice","Payment overage needs owner reconciliation",true,e.invoiceId??undefined);
  else if(e.invoiceId&&Number.isFinite(total)&&Number.isFinite(paid)&&total>paid&&total>=0&&paid>=0)
   add("invoice","Invoice balance open · review before contacting",false,e.invoiceId);
  if(e.status==="sent"){
   const stage=estimateReminderStage(e,now);
   if(stage.reviewReason)add("followup","Estimate history needs manual review");
   else if(stage.template)add("followup",stage.template==="followUp7"?"7-day estimate follow-up ready":stage.template==="followUp3"?"3-day estimate follow-up ready":"1-day estimate follow-up ready",stage.template==="followUp7");
  }else if(e.status==="draft"){
   const created=date(e.createdAt);
   if(Number.isFinite(created)&&created<=now-day)add("draft","Unsent estimate draft · review before sending");
  }else if(e.status==="scheduled"){
   const scheduled=date(e.scheduledAt);
   if(Number.isFinite(scheduled)&&scheduled>=now&&scheduled<=now+36*3600000){
    const addressMissing=!(e.address?.trim()),contactMissing=!usableContact(e);
    if(addressMissing||contactMissing)add("appointment","Job within 36h · "+[addressMissing?"check service address":null,contactMissing?"check contact details":null].filter(Boolean).join(" and "),true);
   }
  }else if(e.status==="completed"){
   const finished=date(e.scheduledAt??e.createdAt);
   if(Number(e.paymentOverageOpen??0)===0&&!e.lastReviewRequestAt&&Number.isFinite(finished)&&finished<=now&&now-finished<=30*day&&Number.isFinite(total)&&Number.isFinite(paid)&&total>0&&paid>=total)
    add("review-request","Completed and paid · review request not recorded");
  }
 }
 return items;
}
