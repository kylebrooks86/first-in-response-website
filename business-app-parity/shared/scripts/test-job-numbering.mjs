import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  jobNumberLabel,parseJobNumberQuery,matchesJobNumberQuery,newJobStatements,replacementJobStatement,
  completedJobCount,jobNumberLabelForEstimate,attachedJobNumbers,JOB_NUMBER_FOR_ESTIMATE_SQL,
  JOB_REFERENCE_BY_INVOICE_SQL,COMPLETED_JOB_COUNT_SQL,
} from '../lib/job-numbering.mjs';

assert.equal(jobNumberLabel(1),'Job #0001');
assert.equal(jobNumberLabel(42),'Job #0042');
assert.equal(jobNumberLabel(10001),'Job #10001');
assert.equal(jobNumberLabel('25'),'Job #0025');
for (const bad of [null,undefined,0,-1,1.5,NaN,Infinity,'', '001','abc','1;DROP TABLE', Number.MAX_SAFE_INTEGER+1]) {
  assert.equal(jobNumberLabel(bad),null,String(bad));
}
for(const q of ['Job #0007','job 7','#7','0007','JOB#7','  job   #  0007  ']){
  assert.equal(parseJobNumberQuery(q),7,'Recognize explicit/padded Job #: '+q);
  assert.equal(matchesJobNumberQuery(7,q),true,'Match saved Job # from owner search: '+q);
}
for(const q of ['7','007','0','0000','job 0','job #','job 7A','house 7','7th street','Job #999999999999999999999','Job #7 OR 1=1','',null,undefined,{},'a'.repeat(129)]){
  assert.equal(parseJobNumberQuery(q),null,'Refuse ambiguous or unsafe Job #: '+String(q));
  assert.equal(matchesJobNumberQuery(7,q),false,'No mistaken Job # lookup: '+String(q));
}
assert.equal(matchesJobNumberQuery(null,'Job #0007'),false);
assert.equal(matchesJobNumberQuery(8,'Job #0007'),false);
assert.equal(matchesJobNumberQuery(10001,'Job #10001'),true);
assert.equal(completedJobCount({completedJobs:0}),0);
assert.equal(completedJobCount({completedJobs:10}),10);
assert.equal(completedJobCount({completedJobs:-1}),null);
assert.equal(completedJobCount({completedJobs:'10'}),null);
assert.match(JOB_NUMBER_FOR_ESTIMATE_SQL,/WHERE l\.estimate_id=\?/);
assert.match(JOB_NUMBER_FOR_ESTIMATE_SQL,/e\.customer_id=root\.customer_id/);
assert.match(JOB_NUMBER_FOR_ESTIMATE_SQL,/origin\.estimate_id=root\.id/);
assert.match(JOB_REFERENCE_BY_INVOICE_SQL,/inv\.id=\?/);
assert.match(JOB_REFERENCE_BY_INVOICE_SQL,/inv\.customer_id=e\.customer_id/);
assert.match(COMPLETED_JOB_COUNT_SQL,/COUNT\(DISTINCT links.job_number\)/);
assert.match(COMPLETED_JOB_COUNT_SQL,/e\.customer_id=root\.customer_id/);

const calls=[];
const fakeDb={prepare(sql){return {bind(...values){const statement={sql,values};calls.push(statement);return statement;}}}};
const first='11111111-1111-4111-8111-111111111111';
const second='22222222-2222-4222-8222-222222222222';
const statements=newJobStatements(fakeDb,first,'2026-10-29T14:00:00Z');
assert.equal(statements.length,2);
assert.deepEqual(statements[0].values,[first,'2026-10-29T14:00:00Z']);
assert.deepEqual(statements[1].values,[first,first]);
assert.match(statements[0].sql,/INSERT INTO fire_job_numbers/);
const revision=replacementJobStatement(fakeDb,second,first);
assert.deepEqual(revision.values,[second,first]);
assert.ok(!revision.sql.includes('INSERT INTO fire_job_numbers'),
  'A revision must never allocate a new job number');
for(const bad of ['abc','',null,undefined,'1);DROP TABLE estimates;--']){
  assert.throws(()=>newJobStatements(fakeDb,bad,'2026-10-29T14:00:00Z'),TypeError);
}
assert.throws(()=>replacementJobStatement(fakeDb,first,first),TypeError);
assert.throws(()=>newJobStatements(fakeDb,first,'not-a-date'),TypeError);
console.log('PASS: Job # labels, safe SQL bindings, revision preservation, completed count');

// Public pages may only display a DB-backed reference after resolving a token.
const noSchema={
  prepare(sql){
    assert.match(sql,/sqlite_master/);
    return {first:async()=>null};
  }
};
assert.equal(await jobNumberLabelForEstimate(noSchema,first),null);
assert.equal((await attachedJobNumbers(noSchema,[first,second])).size,0);

let lastBound=[];
const populated={
  prepare(sql){
    if(sql.includes('sqlite_master'))return {first:async()=>({name:'fire_job_estimate_links'})};
    return {
      bind(...ids){
        lastBound=ids;
        return {
          first:async()=>({jobNumber:42}),
          all:async()=>({results:ids.map((id,index)=>({estimateId:id,jobNumber:index+1}))})
        };
      }
    };
  }
};
assert.equal(await jobNumberLabelForEstimate(populated,first),'Job #0042');
const numbers=await attachedJobNumbers(populated,[first,first,second]);
assert.deepEqual(lastBound,[first,second]);
assert.equal(numbers.get(first),1);
assert.equal(numbers.get(second),2);
assert.equal(numbers.size,2);
assert.equal((await attachedJobNumbers(populated,[])).size,0);
// The Schedule's approved-job picker must display and search the saved
// immutable Job #, instead of requiring the owner to remember a customer name.
// UI source contract only: no hosted D1, Cloudflare, customer or browser writes.
const scheduleSource=readFileSync('app/dashboard.tsx','utf8');
const approvedPickerStart=scheduleSource.indexOf('const readyToBook=rows.filter(');
const approvedPickerEnd=scheduleSource.indexOf('className="schedule-board"',approvedPickerStart);
assert.ok(approvedPickerStart>=0&&approvedPickerEnd>approvedPickerStart,
  'Locate the real approved-job booking picker in the Schedule UI');
const approvedPicker=scheduleSource.slice(approvedPickerStart,approvedPickerEnd);
assert.ok(approvedPicker.includes('matchesJobNumberQuery(job.jobNumber,bookingSearch)'),
  'An approved job must be searchable by its permanent Job #');
assert.ok(approvedPicker.includes('placeholder="Job #, customer, service or address"'),
  'Schedule search should tell the owner that Job # queries work');
assert.ok(approvedPicker.includes('{jobNumberLabel(job.jobNumber)&&<>{jobNumberLabel(job.jobNumber)} · </>}'),
  'Show the DB-backed Job # alongside the customer and service in booking choices');
console.log('PASS: Schedule approved-job picker has permanent Job # display and search without inventing numbers');

// Customer history contains scoped, owner-verified Job # values and can
// search them directly without parsing internal UUIDs or disclosing numbers
// to a different customer record.
const customerSearchStart=scheduleSource.indexOf('const matchingEstimates=customerEstimates.filter(');
const customerSearchEnd=scheduleSource.indexOf('const matchingPayments=customerPayments.filter(',customerSearchStart);
assert.ok(customerSearchStart>=0&&customerSearchEnd>customerSearchStart,'Locate Customer history filters');
const customerSearch=scheduleSource.slice(customerSearchStart,customerSearchEnd);
assert.ok(customerSearch.includes('matchesJobNumberQuery(row.jobNumber,recordSearch)'),
  'Customer estimate and invoice history must accept the original permanent Job #');
assert.equal(customerSearch.split('matchesJobNumberQuery(row.jobNumber,recordSearch)').length-1,2,
  'Both customer estimate and invoice tabs must match Job # searches');

// Unpaid balances, review follow-ups and payment history must use the
// feature-gated job number already attached to their saved estimate.
// Do not manufacture numbers from invoice/payment IDs or query D1 again.
const paymentSearchStart=scheduleSource.indexOf('function PaymentsView(');
assert.ok(paymentSearchStart>=0,'Locate actual owner Payments workspace');
const paymentView=scheduleSource.slice(paymentSearchStart);
assert.ok(paymentView.includes('const paymentJobNumbers=new Map(estimates.map(job=>[job.id,job.jobNumber] as const))'),
  'Paid review follow-ups must resolve the original attached Job #');
assert.ok(paymentView.includes('matchesJobNumberQuery(paymentJobNumbers.get(item.estimateId),reviewCloseoutSearch)'),
  'Review follow-up search must recognize explicit Job # input');
assert.ok(paymentView.includes('matchesJobNumberQuery(item.jobNumber,searchQuery)'),
  'Global payment balance search must recognize explicit Job # input');
assert.ok(paymentView.includes('placeholder="Job #, customer, service or address"'),
  'The balance search should advertise Job # lookup');
assert.ok(paymentView.includes('placeholder="Customer, Job # or saved ID"'),
  'The paid review follow-up search should advertise Job # lookup');
assert.ok(paymentView.includes('{jobNumberLabel(paymentJobNumbers.get(item.estimateId))&&<small>'),
  'Paid review follow-up card must display only a verified existing Job #');
assert.ok(paymentView.includes('<strong>{estimate.customer}</strong>{jobNumberLabel(estimate.jobNumber)&&<small>'),
  'Unpaid job card must display its immutable reference');
console.log('PASS: Customer history, unpaid balances and paid review follow-ups display and search verified Job # references');

console.log('PASS: token-scoped customer display and owner batched lookups');
