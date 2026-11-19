/** Synthetic status contract: never turn completed work into an outstanding booking task. */
import assert from 'node:assert/strict';
import {customerJobJourney} from '../lib/customer-job-journey.ts';
const base={id:'synthetic',createdAt:'2026-11-09T12:00:00Z',status:'completed',depositCents:12000,paidCents:24000,invoiceId:'saved-invoice',paymentOverageOpen:0,pendingRefundCount:0,openCheckoutCount:0};
let checks=0;
function check(condition,label){assert.ok(condition,label);checks++;}
const step=(journey,key)=>journey.steps.find(s=>s.key===key);
const finished=customerJobJourney(base,[]);
check(finished.headline==='Job completed · invoice created','Completed invoice is surfaced without suggesting open booking');
check(step(finished,'deposit').state==='done'&&step(finished,'deposit').title==='Deposit (history)','Original covered deposit is historical, not newly collectible');
check(step(finished,'scheduled').state==='verify'&&step(finished,'scheduled').detail.includes('original schedule'),'Completed job without saved schedule does not appear unscheduled for future work');
const noInvoice=customerJobJourney({...base,invoiceId:null},[]);
check(noInvoice.headline==='Job completed · invoice not created','Completed job awaiting a real invoice has a clear next step');
const settledNoDeposit=customerJobJourney({...base,depositCents:0},[]);
check(step(settledNoDeposit,'deposit').state==='done'&&step(settledNoDeposit,'deposit').detail.includes('No upfront deposit'),'No deposit requirement is not portrayed as money owing');
const refundHold=customerJobJourney({...base,pendingRefundCount:1},[]);
check(step(refundHold,'deposit').state==='verify'&&step(refundHold,'deposit').detail.includes('check invoice'),'Refund review never implies a new booking-deposit collection');
const scheduled=customerJobJourney({...base,status:'scheduled',invoiceId:null,paidCents:0,scheduledAt:'2026-11-11T17:00:00Z'},[]);
check(scheduled.headline==='Job scheduled'&&step(scheduled,'scheduled').state==='done','Current scheduled job still uses active scheduling semantics');
const originalDraft=customerJobJourney({...base,status:'draft',invoiceId:null,paidCents:0},[]);
check(originalDraft.headline==='Draft estimate'&&step(originalDraft,'deposit').state==='pending','A draft retains its pre-job pending milestones');
const prior=customerJobJourney({...base,status:'declined',paidCents:0},[]);
check(prior.headline==='Declined · review saved record','Declined estimates remain historical, not completed');
console.log('PASS '+checks+' actual customer journey synthetic state assertions, read only.');
