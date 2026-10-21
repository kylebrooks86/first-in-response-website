/** Payment-closeout review invitation contracts — no live payments or customer writes. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FIRE_CUSTOMER_REVIEW_URL, shouldOfferReviewAfterPayment } from "../lib/customer-review-invite.mjs";

const offer = (overrides={}) => shouldOfferReviewAfterPayment({
  status:"completed",totalCents:25000,paidCents:25000,paymentReviewPending:false,...overrides
});
assert.equal(FIRE_CUSTOMER_REVIEW_URL,"https://firstinresponseexteriors.com/review");
assert.equal(offer(),true,"Completed and fully paid job can ask for an honest review");
for (const [name,input] of Object.entries({
  deposit:{status:"approved",paidCents:12500},
  scheduled:{status:"scheduled"},
  unfinished:{status:"sent"},
  overpayment:{paidCents:26000},
  partial:{paidCents:10000},
  zeroTotal:{totalCents:0,paidCents:0},
  negativePaid:{paidCents:-1},
  missingPaid:{paidCents:undefined},
  fractionalPaid:{paidCents:24999.5},
  invalidTotal:{totalCents:NaN},
  unknownStatus:{status:undefined},
  held:{paymentReviewPending:true}
})) assert.equal(offer(input),false,name+" cannot receive premature review request");
const estimate=readFileSync("app/estimate/[token]/page.tsx","utf8");
const invoice=readFileSync("app/invoice/[token]/page.tsx","utf8");
const component=readFileSync("components/customer-review-invitation.tsx","utf8");
for (const [name,source] of [["estimate",estimate],["invoice",invoice]]) {
  assert.ok(source.includes("shouldOfferReviewAfterPayment("),name+" gates the invitation with saved payment state");
  assert.ok(source.includes("{showReviewInvitation&&<CustomerReviewInvitation/>}"),name+" displays only gated invitation");
  assert.ok(source.includes("paymentReviewPending"),name+" recognizes account review holds");
}
assert.ok(estimate.includes("paymentConfirmed") && estimate.includes("balance===0"),"Stripe success uses its existing verified checkout flow");
assert.ok(invoice.includes("invoicePaymentState(row)") && invoice.includes("row.estimateStatus"),"Invoice uses existing validated ledger and job state");
assert.ok(component.includes("FIRE_CUSTOMER_REVIEW_URL") && component.includes("honest experience"),"Non-incentivized review request uses existing hub");
assert.ok(component.includes('target="_blank"') && component.includes('noopener noreferrer'),"External navigation is customer-initiated and safe");
assert.ok(!/fetch\(|auto.?send|window\.location/.test(component),"Review UI never performs message/payment operations");
console.log("PASS review-after-payment: 13 eligibility cases, Stripe confirmation, verified invoice state and optional no-write link (source contracts only).");
