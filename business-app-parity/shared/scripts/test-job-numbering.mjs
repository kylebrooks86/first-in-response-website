import assert from 'node:assert/strict';
import {
  jobNumberLabel,newJobStatements,replacementJobStatement,
  completedJobCount,JOB_NUMBER_FOR_ESTIMATE_SQL,
  JOB_REFERENCE_BY_INVOICE_SQL,COMPLETED_JOB_COUNT_SQL,
} from '../lib/job-numbering.mjs';

assert.equal(jobNumberLabel(1),'Job #0001');
assert.equal(jobNumberLabel(42),'Job #0042');
assert.equal(jobNumberLabel(10001),'Job #10001');
assert.equal(jobNumberLabel('25'),'Job #0025');
for (const bad of [null,undefined,0,-1,1.5,NaN,Infinity,'', '001','abc','1;DROP TABLE', Number.MAX_SAFE_INTEGER+1]) {
  assert.equal(jobNumberLabel(bad),null,String(bad));
}
assert.equal(completedJobCount({completedJobs:0}),0);
assert.equal(completedJobCount({completedJobs:10}),10);
assert.equal(completedJobCount({completedJobs:-1}),null);
assert.equal(completedJobCount({completedJobs:'10'}),null);
assert.match(JOB_NUMBER_FOR_ESTIMATE_SQL,/WHERE estimate_id=\?/);
assert.match(JOB_REFERENCE_BY_INVOICE_SQL,/inv.id=\?/);
assert.match(COMPLETED_JOB_COUNT_SQL,/COUNT\(DISTINCT links.job_number\)/);

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
