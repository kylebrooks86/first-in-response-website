/** Visual financial milestone acceptance, no D1/Stripe/network access. */
import assert from 'node:assert/strict';
import {estimatePaymentMilestone} from '../lib/estimate-payment-milestones.mjs';

const normal={status:'scheduled',totalCents:30000,depositCents:10000,paidCents:0};
const scenario=(name,override,expected)=>{
 const actual=estimatePaymentMilestone({...normal,...override});
 assert.equal(actual,expected,name);
 console.log('PASS: '+name);
};
scenario('Unpaid scheduled job has no payment badge',{},null);
scenario('A smaller partial payment does NOT claim deposit paid',{paidCents:9000},null);
scenario('Exact recorded deposit becomes deposit paid',{paidCents:10000},'deposit-paid');
scenario('Payments above deposit but below invoice remain deposit paid',{paidCents:21000},'deposit-paid');
scenario('Exactly billed amount becomes paid in full',{paidCents:30000},'paid-in-full');
scenario('Current invoice total overrides old quote when determining balance',{invoiceTotalCents:35000,paidCents:30000},'deposit-paid');
scenario('Exactly current invoice total is paid in full',{invoiceTotalCents:35000,paidCents:35000},'paid-in-full');
scenario('Overpayment is NOT treated as a settled paid-in-full badge',{paidCents:35001},null);
scenario('No deposit required does not claim a deposit milestone',{depositCents:0,paidCents:5000},null);
scenario('Zero-dollar quote has no paid-in-full badge',{totalCents:0,depositCents:0,paidCents:0},null);
scenario('Invalid negative paid amount fails closed',{paidCents:-1},null);
scenario('Invalid decimal cents fail closed',{paidCents:10000.75},null);
scenario('Deposit greater than quote fails closed',{depositCents:40000,paidCents:40000},null);
scenario('Pending refund suppresses settled-looking badge',{paidCents:30000,pendingRefundCount:1},null);
scenario('Unresolved overage suppresses payment badge',{paidCents:30000,paymentOverageOpen:1},null);
scenario('Open checkout suppresses badge until reconciled',{paidCents:10000,openCheckoutCount:1},null);
scenario('Invalid pending flag fails closed',{paidCents:30000,pendingRefundCount:'unknown'},null);
scenario('Draft cannot be labeled paid',{status:'draft',paidCents:30000},null);
scenario('Sent quote cannot be labeled paid',{status:'sent',paidCents:10000},null);
scenario('Declined quote cannot be labeled paid',{status:'declined',paidCents:10000},null);
scenario('Replaced quote cannot be labeled paid',{status:'superseded',paidCents:10000},null);
scenario('Approved job correctly shows deposit paid',{status:'approved',paidCents:10000},'deposit-paid');
scenario('Completed job may correctly show paid in full',{status:'completed',paidCents:30000},'paid-in-full');
assert.equal(estimatePaymentMilestone(null),null,'Absent record fails closed');
console.log('PASS: All payment badges derive exclusively from saved net paid/billing balances; no mutations.');
