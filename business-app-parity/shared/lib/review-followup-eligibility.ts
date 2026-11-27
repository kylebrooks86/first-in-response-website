/** Owner-side review reminders must match the verified paid-closeout safety gates.
 * This is a read-only display predicate: it never sends messages or edits ledgers.
 * Unknown financial flags block a review prompt rather than assuming all-clear.
 */
export type ReviewFollowupRecord={
 status:string;billingTotalCents:number;paidCents:number;paymentOverageOpen?:number;
 pendingRefundCount?:number;openCheckoutCount?:number;
 lastReviewRequestAt?:string|null;reviewReceivedAt?:string|null;reviewSnoozeUntil?:string|null;
};
export function reviewFollowupEligible(row:ReviewFollowupRecord,serviceAgeDays:number,now=Date.now()):boolean{
 if(!row||row.status!=="completed"||!Number.isSafeInteger(row.billingTotalCents)||row.billingTotalCents<=0||
   !Number.isSafeInteger(row.paidCents)||row.paidCents!==row.billingTotalCents||
   row.paymentOverageOpen!==0||row.pendingRefundCount!==0||row.openCheckoutCount!==0||
   row.lastReviewRequestAt!=null||row.reviewReceivedAt!=null||
   !Number.isFinite(serviceAgeDays)||serviceAgeDays<0||serviceAgeDays>30)return false;
 if(row.reviewSnoozeUntil!=null){
   const until=Date.parse(row.reviewSnoozeUntil);
   if(!Number.isFinite(until)||until>now)return false;
 }
 return true;
}
