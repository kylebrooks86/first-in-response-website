/** Only review flags in saved synthetic app records. No network or writes. */
import assert from 'node:assert/strict';
import {estimateAttentionMilestones} from '../lib/estimate-attention-milestones.mjs';
const check=(name,row,expected)=>{
 const actual=estimateAttentionMilestones(row);
 assert.deepEqual(actual,expected,name);
 console.log('PASS: '+name);
};
check('No alerts on ordinary estimate',{},[]);
check('Open customer change request needs attention',{pendingChangeCount:1},['changes-requested']);
check('Multiple changes still show only one badge',{pendingChangeCount:3},['changes-requested']);
check('Resolved change request hides badge',{pendingChangeCount:0},[]);
check('Pending refund calls for payment review',{pendingRefundCount:1},['payment-review']);
check('Unresolved overpayment calls for payment review',{paymentOverageOpen:1},['payment-review']);
check('Both financial issues still show only one review badge',{pendingRefundCount:1,paymentOverageOpen:1},['payment-review']);
check('Both categories can coexist',{pendingChangeCount:1,paymentOverageOpen:1},['changes-requested','payment-review']);
check('An ordinary open checkout is not falsely called a refund/overage',{openCheckoutCount:1},[]);
check('No unsupported negative counts',{pendingChangeCount:-1,pendingRefundCount:-1},[]);
check('No fractional or string counts',{pendingChangeCount:1.5,pendingRefundCount:'1'},[]);
check('Malformed and absent inputs fail closed',null,[]);
console.log('PASS: No customer status, customer communication, Stripe or D1 changes.');
