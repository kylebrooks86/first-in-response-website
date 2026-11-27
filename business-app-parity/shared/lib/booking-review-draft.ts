/** Internal only: no customer-facing agreement, estimate, invoice or payment mutation. */
export const BOOKING_REVIEW_DRAFT_PREFIX='fire:booking-amendment-review:v1:';
export type BookingReviewDraft={
 format:'fire-booking-review-v1';estimateId:string;revision:string;ownerNote:string;originalScopeSha256:string;
 bookingConfirmedOn:string;savedOn:string;catalogRevision:string|null;
 originalStatus:string;customerAlreadyAccepted:boolean;hasFinancialActivity:boolean;
 originalTotalCents:number;originalDepositCents:number;
 proposedTotalCents:number;proposedDepositCents:number;
 possibleSavingsCents:number;newRules:{id:string;name:string;type:'percent'|'dollar';valueCents:number}[];
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safe=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
export function readBookingReviewDraft(raw:string|null,estimateId:string):BookingReviewDraft|null{
 if(raw===null)return null;
 if(raw.length>9500)throw Error('Saved proposal is too large to verify.');
 const parsed=JSON.parse(raw) as unknown;
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Unverified proposal.');
 const p=parsed as Record<string,unknown>;
 const keys=['format','estimateId','revision','ownerNote','originalScopeSha256','bookingConfirmedOn','savedOn','catalogRevision','originalStatus','customerAlreadyAccepted','hasFinancialActivity','originalTotalCents','originalDepositCents','proposedTotalCents','proposedDepositCents','possibleSavingsCents','newRules'];
 if(Object.keys(p).sort().join(',')!==keys.sort().join(',')||
  p.format!=='fire-booking-review-v1'||p.estimateId!==estimateId||
  typeof p.revision!=='string'||!uuid.test(p.revision)||
  typeof p.ownerNote!=='string'||p.ownerNote.length>400||
  typeof p.originalScopeSha256!=='string'||!/^[0-9a-f]{64}$/.test(p.originalScopeSha256)||
  !date(p.bookingConfirmedOn)||typeof p.savedOn!=='string'||Number.isNaN(Date.parse(p.savedOn))||
  !(p.catalogRevision===null||typeof p.catalogRevision==='string'&&uuid.test(p.catalogRevision))||
  typeof p.originalStatus!=='string'||p.originalStatus.length>30||
  typeof p.customerAlreadyAccepted!=='boolean'||typeof p.hasFinancialActivity!=='boolean'||
  !safe(p.originalTotalCents)||!safe(p.originalDepositCents)||
  !safe(p.proposedTotalCents)||!safe(p.proposedDepositCents)||!safe(p.possibleSavingsCents)||
  p.originalTotalCents-p.proposedTotalCents!==p.possibleSavingsCents||
  p.possibleSavingsCents===0||
  !Array.isArray(p.newRules)||p.newRules.length===0||p.newRules.length>40||
  !p.newRules.every(rule=>rule&&typeof rule==='object'&&!Array.isArray(rule)&&
   Object.keys(rule).sort().join(',')==='id,name,type,valueCents'&&
   typeof rule.id==='string'&&uuid.test(rule.id)&&
   typeof rule.name==='string'&&rule.name.length>0&&rule.name.length<=80&&
   (rule.type==='percent'||rule.type==='dollar')&&safe(rule.valueCents))||
  new Set(p.newRules.map(rule=>rule.id)).size!==p.newRules.length)
  throw Error('Saved booking review requires manual reconciliation.');
 return p as BookingReviewDraft;
}
