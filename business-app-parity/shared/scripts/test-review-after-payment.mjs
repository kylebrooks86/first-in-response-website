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
const paymentPage=readFileSync("app/pay/[id]/page.tsx","utf8");
for(const [name,source] of [["estimate",estimate],["invoice",invoice],["legacy payment",paymentPage]]){
  assert.ok(source.includes("payment_checkout_sessions")&&source.includes("openCheckoutCount"),name+" verifies unresolved Stripe checkouts");
  // After a verified Stripe return the estimate page rechecks the live
  // checkout count; invoice and legacy pay read their current row directly.
  const openCheckoutGate=name==="estimate"
    ? "Number(checkedOpenCheckout?.count??row.openCheckoutCount??0)>0"
    : "Number(row.openCheckoutCount??0)>0";
  assert.ok(source.includes(openCheckoutGate),name+" blocks reviews while any checkout remains unresolved");
}
for (const [name,source] of [["estimate",estimate],["invoice",invoice]]) {
  assert.ok(source.includes("shouldOfferReviewAfterPayment("),name+" gates the invitation with saved payment state");
  assert.ok(source.includes("{showReviewInvitation&&<CustomerReviewInvitation/>}"),name+" displays only gated invitation");
  assert.ok(source.includes("paymentReviewPending"),name+" recognizes account review holds");
}
assert.ok(estimate.includes("paymentConfirmed") && estimate.includes("balance===0"),"Stripe success uses its existing verified checkout flow");
assert.ok(estimate.includes("!paymentExceptionsPending?await confirmPayment(sessionId,{id:row.id})"),"Valid Stripe return is verified even when tracked checkout was still open");
assert.ok(estimate.includes("const checkedOpenCheckout=paymentConfirmed?await env.DB.prepare("),"After verification, recheck remaining open Stripe sessions before a review invite");
assert.ok(estimate.includes("const paymentReviewPending=paymentExceptionsPending||Number(checkedOpenCheckout?.count??row.openCheckoutCount??0)>0"),"Remaining unresolved checkouts still block review and new payment");
assert.ok(invoice.includes("invoicePaymentState(row)") && invoice.includes("row.estimateStatus"),"Invoice uses existing validated ledger and job state");
assert.ok(component.includes("FIRE_CUSTOMER_REVIEW_URL") && component.includes("honest experience"),"Non-incentivized review request uses existing hub");
assert.ok(component.includes('target="_blank"') && component.includes('noopener noreferrer'),"External navigation is customer-initiated and safe");
assert.ok(!/fetch\(|auto.?send|window\.location/.test(component),"Review UI never performs message/payment operations");
assert.ok(paymentPage.includes("shouldOfferReviewAfterPayment("),"Legacy customer payment path reuses the verified closeout rule");
assert.ok(paymentPage.includes("showRecordedSuccess=paid===\"1\"&&showReviewInvitation"),"Paid query parameter alone never implies success");
assert.ok(!paymentPage.includes('paid === "1" ?'),"Legacy unguarded paid-state branch is eliminated");
assert.ok(paymentPage.includes("payment_refunds r")&&paymentPage.includes("pendingRefundCount"),"Pending refund blocks premature customer review and checkout");
assert.ok(paymentPage.includes("billingNumbersSafe&&!paymentReviewPending&&dueNow>0"),"Invalid amounts and active payment holds hide card checkout");
assert.ok(paymentPage.includes("<CustomerReviewInvitation/>"),"Paid-in-full customer page offers existing review link");
assert.ok(paymentPage.includes('payment or refund')||paymentPage.includes('Payment or refund'),"Active account review receives a clear hold message");
const dashboard=readFileSync("app/dashboard.tsx","utf8");
const confirmed=dashboard.slice(dashboard.indexOf("const finishConfirmed=(paid:number)"),dashboard.indexOf("const reviewPending=async()=>",dashboard.indexOf("const finishConfirmed=(paid:number)")));
assert.ok(confirmed.startsWith("const finishConfirmed=(paid:number)"),"Ledger confirmation handler exists");
assert.ok(confirmed.includes('window.dispatchEvent(new Event("fire:attention-saved"))'),"Confirmed manual payments immediately refresh owner review and bell attention");
assert.ok(confirmed.indexOf('fire:attention-saved')<confirmed.indexOf("onRecorded?.(paid)"),"Refresh is dispatched as part of the confirmed receipt before UI callback");
assert.ok(!/fetch\(|POST|manualRequestId\.current\s*=\s*crypto/.test(confirmed),"Notification refresh never creates another financial write");
console.log("PASS review-after-payment: 13 eligibility cases, payment page holds, manual receipt attention refresh and optional no-write link (source contracts only).");
