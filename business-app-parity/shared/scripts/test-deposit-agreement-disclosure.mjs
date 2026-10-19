/** Six-mode customer deposit amendment disclosure and corruption refusal. No mutation or payment. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describeRevisedDepositTerms} from '../lib/deposit-agreement-revision.mjs';
let n=0;const eq=(a,b)=>{assert.deepEqual(a,b);n++},reject=(v,re)=>{assert.throws(()=>describeRevisedDepositTerms(v),new RegExp(re));n++};
const audit={id:'event',estimate_id:'estimate',confirmation_id:'confirm',actor_email:'synthetic-owner',mode:'waive',previous_total_cents:18001,previous_deposit_cents:9001,new_deposit_cents:0,paid_principal_cents:0,percent_basis_points:null,schedule_before_collection:0,previous_contract_version:null,updated_contract_version:null,previous_signed_at:null,requires_customer_reapproval:0,reason:null,created_at:'2026-10-19T15:00:00Z'};
const estimate={id:'estimate',status:'draft',totalCents:18001,depositCents:0,acceptedAt:null,signedAt:null};
const base={estimate,latestEvent:audit,eventCount:1,paymentCount:0,invoiceCount:0,openCheckoutCount:0,pendingRefundCount:0};
const original=JSON.stringify(base);
for(const [mode,deposit,basis,defer] of [['waive',0,null,0],['percentage',4500,2500,0],['fixed',7000,null,0],['schedule-before-deposit',9001,null,1],['standard',9001,null,0],['restore-standard',9001,null,0]]){
 const event={...audit,mode,new_deposit_cents:deposit,percent_basis_points:basis,schedule_before_collection:defer};
 const v=describeRevisedDepositTerms({...base,estimate:{...estimate,depositCents:deposit},latestEvent:event});
 eq([v.totalCents,v.depositCents,v.balanceAfterDepositCents],[18001,deposit,18001-deposit]);
 eq([v.signatureEnabled,v.paymentEnabled,v.canSchedule,v.previewOnly],[false,false,false,true]);
 eq([v.mode,v.percent,v.version],[mode,mode==='percentage'?25:null,'deposit-exception-v1:event']);
 eq(v.notice.includes('not yet signed'),true);
 eq(v.totalDisplay,'$180.01');
}
eq(JSON.stringify(base),original);
const mutate=fn=>{const x=structuredClone(base);fn(x);return x;};
for(const [fn,re] of [
 [x=>x.estimate.totalCents=20000,'matches'],[x=>x.estimate.depositCents=100,'matches'],
 [x=>x.estimate.status='approved','Signed'],[x=>x.estimate.signedAt='now','Signed'],[x=>x.estimate.acceptedAt='now','Signed'],
 [x=>x.latestEvent.estimate_id='wrong','missing estimate'],[x=>x.latestEvent.new_deposit_cents=100,'matches'],
 [x=>x.latestEvent.paid_principal_cents=100,'matches'],[x=>x.latestEvent.requires_customer_reapproval=1,'matches'],
 [x=>x.latestEvent.mode='unknown','unknown mode'],[x=>x.latestEvent.confirmation_id='','confirmation'],
 [x=>x.latestEvent.created_at='wrong','timestamp'],[x=>x.latestEvent.reason='X'.repeat(501),'oversized'],
 [x=>x.paymentCount=1,'Financial'],[x=>x.invoiceCount=1,'Financial'],[x=>x.pendingRefundCount=1,'Financial'],
 [x=>x.openCheckoutCount=1,'Financial'],[x=>x.eventCount=101,'incomplete audit']
])reject(mutate(fn),re);
const extreme={...audit,mode:'percentage',new_deposit_cents:2251799813685248,previous_total_cents:Number.MAX_SAFE_INTEGER,previous_deposit_cents:4503599627370496,percent_basis_points:2500};
eq(describeRevisedDepositTerms({...base,estimate:{...estimate,totalCents:Number.MAX_SAFE_INTEGER,depositCents:extreme.new_deposit_cents},latestEvent:extreme}).totalDisplay,'$90071992547409.91');
const page=readFileSync('app/estimate/[token]/page.tsx','utf8');
eq(page.includes('describeRevisedDepositTerms')&&page.includes('Revision reference:'),true);
eq(page.indexOf('if(held)return')<page.indexOf('confirmPayment(sessionId'),true);
eq(page.includes('Approval, scheduling, and payments are unavailable until revised terms are formally issued and signed.'),true);
console.log('PASS '+n+'/'+n+': versioned six-mode customer deposit terms, exact cents, unchanged principal, signed/payment/refund/history refusals. Read-only; no checkout.');
