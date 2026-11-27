/** Pure owner input parsing, no network/hosted D1/provider writes. */
import assert from 'node:assert/strict';
import {exactMoneyInputCents} from '../lib/exact-money-input.ts';
import {readFileSync} from 'node:fs';
let checks=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
for(const [value,cents] of [
 ['0',0],['0.00',0],['0.01',1],['1',100],['1.2',120],['1.23',123],
 ['.25',25],['001.01',101],[' 12.35 ',1235],['1000000.05',100000005],
 ['90071992547409.91',Number.MAX_SAFE_INTEGER]
])eq(exactMoneyInputCents(value),cents,'Exact cent arithmetic '+value);
eq(exactMoneyInputCents(''),null,'Required refund amount cannot be blank');
eq(exactMoneyInputCents('',true),0,'Optional tip/remaining payment may be blank zero');
eq(exactMoneyInputCents('   ',true),0,'Whitespace-only optional amount is zero');
for(const invalid of [
 '1.005','1.999','0.001','12.345','1e3','1E3','NaN','Infinity','-1','+1',
 '$1.00','1,000','1 000','1.','.',',50','0x10','1.2.3','1,23',
 '90071992547409.92','9007199254740992','-0.01'
])eq(exactMoneyInputCents(invalid),null,'Reject non-cent or ambiguous money '+invalid);
const dashboard=readFileSync('app/dashboard.tsx','utf8');
const refund=dashboard.slice(dashboard.indexOf('function RefundPayment('),dashboard.indexOf('function ProcessingDetails('));
const payment=dashboard.slice(dashboard.indexOf('function RecordPayment('),dashboard.indexOf('function EditEstimateDialog('));
eq(refund.includes('const amountCents=exactMoneyInputCents(amount);'),true,'Actual refund submit uses exact parser, not rounding');
eq(payment.includes('const amountCents=exactMoneyInputCents(amount,true),tipCents=exactMoneyInputCents(tip,true);'),true,'Actual payment and tip submit use same exact parser');
eq(payment.includes('const enteredFeeCents=feeProvided?exactMoneyInputCents(fee):null;'),true,'Actual Cash App/Venmo processing fee also rejects fractional cents');
eq(payment.includes('const feeValid=!feeProvided||(enteredFeeCents!==null'),true,'Malformed nonempty fee cannot be silently treated as no fee');
console.log('PASS '+checks+'/'+checks+' exact owner USD cents, zero optional fields, Stripe refund, fee and tip guards, no fractional rounding.');
