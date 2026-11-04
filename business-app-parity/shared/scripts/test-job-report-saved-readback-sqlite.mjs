/** Actual Job Report owner API and disposable SQLite. No hosted writes. */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';

const rt=stackedRuntime(),db=rt.db,route=rt.load('app/api/job-reports/route.ts');
const at='2026-11-04T10:00:00.000Z',customer='synthetic-report-owner';
db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run(customer,'Synthetic Owner Report',at);
for(const id of ['report-job','lost-receipt-job']){
 db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,?,?,?,?,?)")
  .run(id,customer,'scheduled',20000,20000,10000,at);
}
const steps=['Property condition documented','Before photos captured','Plants and fragile areas protected','Service completed as quoted','After photos captured'];
const legacy=Object.fromEntries([...steps,'Customer walkthrough completed'].map(k=>[k,true]));
const absent={...Object.fromEntries(steps.map(k=>[k,true])), 'Customer walkthrough completed':false,
 'Customer absent — completion documented for follow-up':true};
const input={estimateId:'report-job',customerId:customer,checklist:legacy,notes:'Customer met me after work; verified finished property.',airflowBefore:'11',airflowAfter:'20',status:'complete'};
const post=async value=>{const response=await route.POST(new Request('https://fixture.invalid/api/job-reports',{method:'POST',body:JSON.stringify(value)}));return {status:response.status,data:await response.json()};};
const row=(id='report-job')=>db.prepare('SELECT id,estimate_id AS estimateId,customer_id AS customerId,checklist,notes,airflow_before AS airflowBefore,airflow_after AS airflowAfter,status,created_at AS createdAt,completed_at AS completedAt FROM job_reports WHERE estimate_id=?').get(id);
let checks=0;const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};
const orig=rt.env.DB.prepare;
try{
 const saved=await post(input);
 eq(saved.status,201,'New completed legacy report must be inserted');
 eq(saved.data.report?.id,row().id,'Success receipt ID comes from actual saved D1 row');
 eq(saved.data.report?.notes,row().notes,'Success receipt uses stored notes');
 eq(saved.data.report?.checklist,JSON.stringify(legacy),'Six-key historical walkthrough remains valid');
 eq(saved.data.report?.status,'completed','Completed report has actual completed status');
 eq(saved.data.report?.completedAt,row().completedAt,'Completion timestamp is D1-backed');
 const updated=await post({...input,checklist:absent,notes:'Customer absent; after photos and equipment notes documented for later follow-up.'});
 eq(updated.status,200,'Contact-free report updates the existing row, no duplicate');
 eq(updated.data.report?.id,saved.data.report.id,'Report revision retains same record identity');
 eq(row().notes,updated.data.report.notes,'Contact-free notes survive a database readback');
 eq(JSON.parse(row().checklist)['Customer walkthrough completed'],false,'No fictitious owner walkthrough is persisted');
 eq(JSON.parse(row().checklist)['Customer absent — completion documented for follow-up'],true,'Contact-free evidence stored separately');
 eq(db.prepare("SELECT COUNT(*) AS n FROM job_reports WHERE estimate_id='report-job'").get().n,1,'One saved report per job after update');
 const snapshot=JSON.stringify(row());
 for(const [name,payload]of [
  ['no completed steps',{...input,checklist:{},notes:'whatever'}],
  ['no final handoff',{...input,checklist:Object.fromEntries(steps.map(k=>[k,true]))}],
  ['both final claims',{...input,checklist:{...legacy,...absent,'Customer walkthrough completed':true}}],
  ['no notes for absent',{...input,checklist:absent,notes:'   '}]
 ]){
  const rejected=await post(payload);
  eq(rejected.status,409,name+' cannot be saved as completed');
  eq(JSON.stringify(row()),snapshot,name+' leaves existing report unchanged');
 }
 rt.env.DB.prepare=function(sql){
  if(sql.startsWith('UPDATE job_reports SET'))return{bind:()=>({run:async()=>({meta:{changes:1}})})};
  return orig(sql);
 };
 const ignored=await post({...input,checklist:legacy,notes:'A false success SQL callback'});
 eq(ignored.status,503,'Acknowledged but unwritten UPDATE cannot report success');
 eq(ignored.data.saveUncertain,true,'Owner receives explicit uncertain-save guidance');
 rt.env.DB.prepare=orig;
 eq(JSON.stringify(row()),snapshot,'No-op simulated write preserves existing stored report');
 rt.env.DB.prepare=function(sql){
  if(sql.startsWith('SELECT id,estimate_id AS estimateId')&&sql.includes('FROM job_reports WHERE id=?'))
   return{bind:()=>({first:async()=>null})};
  return orig(sql);
 };
 const interrupted=await post({...input,estimateId:'lost-receipt-job',checklist:absent,notes:'Customer was away; job and before/after photos documented for later sharing.'});
 eq(interrupted.status,503,'Missing post-write confirmation fails closed even after committed insert');
 eq(row('lost-receipt-job')?.status,'completed','The synthetic write really may already have committed despite missing receipt');
 rt.env.DB.prepare=orig;
 const recovered=await post({...input,estimateId:'lost-receipt-job',checklist:absent,notes:'Customer was away; job and before/after photos documented for later sharing.'});
 eq(recovered.status,200,'Safe retry updates same existing job report after uncertain prior insert');
 eq(recovered.data.report?.id,row('lost-receipt-job').id,'Recovered response uses original stored report ID');
 eq(db.prepare("SELECT COUNT(*) AS n FROM job_reports WHERE estimate_id='lost-receipt-job'").get().n,1,'Uncertain retry cannot duplicate report rows');
 const get=await route.GET(new Request('https://fixture.invalid/api/job-reports?estimateId=report-job'));
 eq(get.status,200,'Authenticated saved GET retrieves matching job report');
 eq((await get.json()).reports[0].id,row().id,'GET reads same database identity as saved receipt');
 rt.setOwner(null);
 eq((await post(input)).status,401,'Nonowner cannot modify report');
 eq((await route.GET(new Request('https://fixture.invalid/api/job-reports?estimateId=report-job'))).status,401,'Nonowner cannot read saved report');
 console.log('PASS '+checks+'/'+checks+' real JobReport API/native SQLite readback, legacy history, contact-free, no-op writes, lost-ack recovery and owner authorization. NO HOSTED WRITES.');
}finally{rt.env.DB.prepare=orig;db.close();}
