/** Read-only review invitation: completed work, exact full payment, no account hold.
 * A review link does not send a message, create a flag, or verify an external review.
 * Keep this URL in sync with the existing @review_link message template.
 */
export const FIRE_CUSTOMER_REVIEW_URL = "https://firstinresponseexteriors.com/review";

/** @param {{status?:string|null,totalCents?:number|null,paidCents?:number|null,paymentReviewPending?:boolean}} input */
export function shouldOfferReviewAfterPayment(input) {
  return input?.status === "completed" &&
    Number.isSafeInteger(input.totalCents) && input.totalCents > 0 &&
    Number.isSafeInteger(input.paidCents) && input.paidCents === input.totalCents &&
    input.paymentReviewPending !== true;
}
