import assert from 'node:assert/strict';
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
console.log('PASS: token-scoped customer display and owner batched lookups');
