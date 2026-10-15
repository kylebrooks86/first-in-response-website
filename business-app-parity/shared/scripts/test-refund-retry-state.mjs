import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadRefundRetry,saveRefundRetry,clearRefundRetry} from '../lib/refund-retry-state.ts';
let count=0;function check(actual,expected,why){assert.deepEqual(actual,expected,why);count++;console.log('PASS: '+why);}
const rows=new Map(),storage={
  getItem(key){return rows.get(key)??null;},
  setItem(key,val){rows.set(key,val);},
  removeItem(key){rows.delete(key);}
};
const original={requestId:'11111111-2222-4333-8444-555555555555',amountCents:2500};
check(loadRefundRetry(storage,'payment-A'),null,'No prior refund is not misidentified as an existing attempt');
check(saveRefundRetry(storage,'payment-A',original),true,'Save original request ID and exact cents before network');
check(loadRefundRetry(storage,'payment-A'),original,'Lost response / full restart recovers SAME refund identity and amount');
check(loadRefundRetry(storage,'payment-B'),null,'A separate customer payment cannot reuse another refund request ID');
const another={requestId:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',amountCents:4500};
check(saveRefundRetry(storage,'payment-B',another),true,'Second payment maintains separate original idempotency key');
check(loadRefundRetry(storage,'payment-B'),another,'Second payment amount is preserved');
check(loadRefundRetry(storage,'payment-A'),original,'Second payment cannot overwrite the first retry');
check(saveRefundRetry(storage,'payment-A',{requestId:'not-a-uuid',amountCents:2500}),false,'Invalid request ID cannot replace persisted retry');
check(loadRefundRetry(storage,'payment-A'),original,'Rejected invalid request preserves original retry');
check(saveRefundRetry(storage,'payment-A',{...another,amountCents:0}),false,'Non-positive refund cannot replace original');
check(saveRefundRetry(storage,'payment-A',{...another,amountCents:1.23}),false,'Fractional cents cannot replace original');
check(loadRefundRetry(storage,'payment-A'),original,'Rejected amount leaves persisted operation intact');
rows.set('fire:refund-attempt:payment-C','{broken-json');
check(loadRefundRetry(storage,'payment-C'),null,'Corrupt local storage is never treated as valid payment evidence');
rows.set('fire:refund-attempt:payment-C',JSON.stringify({requestId:original.requestId,amountCents:NaN}));
check(loadRefundRetry(storage,'payment-C'),null,'Invalid numeric persistence fails closed');
const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};
check(loadRefundRetry(blocked,'payment-A'),null,'Browser storage disabled does not crash refund UI');
check(saveRefundRetry(blocked,'payment-A',original),false,'Blocked storage reports inability to persist');
clearRefundRetry(blocked,'payment-A');count++;console.log('PASS: storage clearance exceptions are safe');
clearRefundRetry(storage,'payment-A');
check(loadRefundRetry(storage,'payment-A'),null,'Verified completion clears only its original retry');
check(loadRefundRetry(storage,'payment-B'),another,'Completed refund cannot erase another job refund attempt');
// Make sure the real RefundPayment component, not merely this helper, uses the
// state machine before the network and clears it only after confirmed success.
const ui=readFileSync(new URL('../app/dashboard.tsx',import.meta.url),'utf8');
const refund=ui.slice(ui.indexOf('function RefundPayment('),ui.indexOf('function ProcessingDetails('));
check(refund.includes('activeRefund.current=attempt')&&refund.includes('saveRefundRetry(storage(),payment.id,attempt)'),true,'Actual owner form preserves its request ID before API call');
check(refund.indexOf('saveRefundRetry(storage(),payment.id,attempt)')<refund.indexOf('fetch("/api/payments/refund"'),true,'Actual owner form persists BEFORE Stripe network attempt');
check(refund.indexOf('if(!result.ok)throw')<refund.indexOf('clearRefundRetry(storage(),payment.id)'),true,'Actual owner form clears retry only after confirmed successful reconciliation');
check(refund.includes('payment.pendingRefundId')&&refund.includes('loadRefundRetry(storage(),payment.id)'),true,'Actual owner form reopens an existing D1 or local refund attempt');
console.log('PASS '+count+'/'+count+' persisted refund idempotency and actual owner workflow assertions.');
