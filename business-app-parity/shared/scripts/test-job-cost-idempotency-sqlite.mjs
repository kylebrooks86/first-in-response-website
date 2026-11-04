/** Exercise actual owner expenses POST and saved GET against disposable SQLite.
 * No hosted DB, customer contacts, payment provider or Cloudflare writes.
 */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
const rt=stackedRuntime(),db=rt.db;
const api=rt.load('app/api/expenses/route.ts');
const job='job-cost-synthetic',customer='job-cost-customer',now='2026-10-30T14:00:00.000Z';
db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run(customer,'Synthetic owner',now);
db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,?,?,?,?,?)")
 .run(job,customer,'completed',12000,12000,6000,now);
const requestId='1fa10000-0000-4000-8000-000000000111';
const input={estimateId:job,category:'Chemicals',description:'Synthetic SH supplies',amountCents:1234,incurredAt:now,requestId};
const post=async value=>{
 const response=await api.POST(new Request('https://synthetic.invalid/api/expenses',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)}));
 return{status:response.status,data:await response.json()};
};
const saved=()=>db.prepare('SELECT id,estimate_id AS estimateId,category,description,amount_cents AS amountCents,incurred_at AS incurredAt FROM expenses WHERE id=?').get(requestId);
const count=()=>db.prepare('SELECT COUNT(*) AS count FROM expenses WHERE estimate_id=?').get(job).count;
let checks=0;const check=(yes,label)=>{assert.ok(yes,label);checks++};
try{
 const first=await post(input);
 check(first.status===201&&first.data.confirmed===true&&first.data.requestId===requestId,
  'First cost POST accepts the owner-retained request ID');
 check(first.data.expense?.id===requestId&&first.data.expense?.estimateId===job&&
  first.data.expense.amountCents===1234&&first.data.expense.incurredAt===now,
  'Create receipt contains exact saved operation, job, amount and incurred time');
 check(count()===1&&saved()?.amountCents===1234,'One correct durable SQLite job-cost row saved');
 for(let i=0;i<3;i++){
  const again=await post(input);
  check(again.status===200&&again.data.confirmed===true&&again.data.requestId===requestId&&count()===1,
   'Repeated same ID and exact content cannot double-add the cost');
 }
 const modified=await post({...input,amountCents:5678});
 check(modified.status===409&&count()===1&&saved()?.amountCents===1234,
  'Same ID with changed amount refuses instead of silently altering or duplicating');
 const moved=await post({...input,estimateId:'another-job'});
 check(moved.status===404&&count()===1,'Unknown job cannot steal existing expense request ID');
 const newId='1fa10000-0000-4000-8000-000000000112';
 const second=await post({...input,requestId:newId,description:'Second deliberate cost'});
 check(second.status===201&&count()===2,'Deliberate new request ID is a distinct expense');
 const invalid=await post({...input,requestId:'bad-request-id'});
 check(invalid.status===400&&count()===2,'Invalid recovery ID cannot create a new expense');
 const listing=await api.GET(new Request('https://synthetic.invalid/api/expenses'));
 const data=await listing.json();
 check(listing.status===200&&Array.isArray(data.expenses)&&data.expenses.some(row=>
  row.id===requestId&&row.estimateId===job&&Number(row.amountCents)===1234),
 'Independent saved GET can reconcile a lost client acknowledgement by exact opaque ID');
 rt.setOwner(null);
 const denied=await post(input);
 check(denied.status===401&&count()===2,'Nonowner cannot retry or create job expenses');
 console.log('PASS '+checks+'/'+checks+' actual owner expense POST/GET SQLite stable ID retry, exact receipt, conflict, saved recovery and access denial. NO HOSTED WRITES.');
}finally{db.close();}
