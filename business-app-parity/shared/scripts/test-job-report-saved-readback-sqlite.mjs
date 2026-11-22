/** Actual Job Report owner API and disposable SQLite. No hosted writes. */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';

const rt=stackedRuntime(),db=rt.db,route=rt.load('app/api/job-reports/route.ts');
const at='2026-11-04T10:00:00.000Z',customer='synthetic-report-owner';
db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run(customer,'Synthetic Owner Report',at);
for(const id of ['report-job','lost-receipt-job','concurrent-job','retired-race-job','ownership-race-job']){
 db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,?,?,?,?,?)")
  .run(id,customer,'scheduled',20000,20000,10000,at);
}
db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run('other-report-owner','Other synthetic customer',at);
const steps=['Property condition documented','Before photos captured','Plants and fragile areas protected','Service completed as quoted','After photos captured'];
const legacy=Object.fromEntries([...steps,'Customer walkthrough completed'].map(k=>[k,true]));
const absent={...Object.fromEntries(steps.map(k=>[k,true])), 'Customer walkthrough completed':false,
 'Customer absent — completion documented for follow-up':true};
const input={estimateId:'report-job',customerId:customer,checklist:legacy,notes:'Customer met me after work; verified finished property.',airflowBefore:'11',airflowAfter:'20',status:'complete'};
const post=async value=>{const response=await route.POST(new Request('https://fixture.invalid/api/job-reports',{method:'POST',body:JSON.stringify(value)}));assertPrivatePost(response,'owner report POST');return {status:response.status,data:await response.json()};};
const row=(id='report-job')=>db.prepare('SELECT id,estimate_id AS estimateId,customer_id AS customerId,checklist,notes,airflow_before AS airflowBefore,airflow_after AS airflowAfter,status,created_at AS createdAt,completed_at AS completedAt FROM job_reports WHERE estimate_id=?').get(id);
let checks=0;const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};
const assertPrivatePost=(response,label)=>{
 eq(response.headers.get('cache-control'),'private, no-store',label+' blocks shared caching');
 eq(response.headers.get('vary'),'Cookie',label+' distinguishes owner session');
 eq(response.headers.get('x-content-type-options'),'nosniff',label+' rejects content sniffing');
};
const orig=rt.env.DB.prepare;
try{
 // Real owner POST should refuse invalid/oversized streamed input before ANY
 // D1 reads or writes, not merely after buffering request.json().
 const rawRequest=(body,headers={})=>new Request('https://fixture.invalid/api/job-reports',{
  method:'POST',headers,body
 });
 for(const [name,req,expected] of [
  ['declared oversize',rawRequest('{}',{'content-length':'64001'}),413],
  ['actual streamed oversize',rawRequest(' '.repeat(64001)),413],
  ['contradictory declared length',rawRequest('{"x":1}',{'content-length':'2'}),400],
  ['invalid UTF8 body',rawRequest(new Uint8Array([123,34,120,34,58,255,125])),400],
  ['nonobject JSON input',rawRequest('[]'),400],
 ]){
  const before=rt.counters();
  const denied=await route.POST(req);
  eq(denied.status,expected,name+' rejected before report save');
  assertPrivatePost(denied,name+' streamed guard');
  eq(rt.counters(),before,name+' performs no DB reads or writes');
 }
 const saved=await post(input);
 eq(saved.status,201,'New completed legacy report must be inserted');
 eq(saved.data.report?.id,row().id,'Success receipt ID comes from actual saved D1 row');
 eq(saved.data.report?.notes,row().notes,'Success receipt uses stored notes');
 eq(saved.data.report?.checklist,JSON.stringify(legacy),'Six-key historical walkthrough remains valid');
 eq(saved.data.report?.status,'completed','Completed report has actual completed status');
 eq(saved.data.report?.completedAt,row().completedAt,'Completion timestamp is D1-backed');
 const updated=await post({...input,checklist:absent,notes:'Customer absent; after photos and equipment notes documented for later follow-up.'});
 eq(updated.status,200,'Contact-free report updates the existing row, no duplicate');
 eq(updated.data.report?.completedAt,saved.data.report?.completedAt,'Editing a completed report preserves its first completion timestamp');
 eq(updated.data.report?.createdAt,saved.data.report?.createdAt,'Editing preserves original report creation timestamp');
 const demotion=await post({...input,status:'draft',complete:false,notes:'Someone unchecked the completion details.'});
 eq(demotion.status,409,'Completed report cannot silently return to draft');
 eq(row().status,'completed','Rejected demotion preserves historical completion');
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
  if(sql.startsWith('UPDATE job_reports'))return{bind:()=>({run:async()=>({meta:{changes:1}})})};
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
 for(const [name,response] of [['saved report',get]]){
  eq(response.headers.get('cache-control'),'private, no-store',name+' is not cacheable');
  eq(response.headers.get('vary'),'Cookie',name+' varies with private owner session');
  eq(response.headers.get('x-content-type-options'),'nosniff',name+' cannot be content-sniffed');
 }
 // Prevent imported wrong-customer or incomplete history from being
 // represented as a completed job; GET never repairs the underlying row.
 for(const [column,badValue,label] of [
  ['customer_id','other-report-owner','wrong-customer saved report'],
  ['completed_at',null,'completed report without completion date']
 ]){
  const before=row();
  db.prepare('UPDATE job_reports SET '+column+'=? WHERE estimate_id=?').run(badValue,'report-job');
  const inconsistent=await route.GET(new Request('https://fixture.invalid/api/job-reports?estimateId=report-job'));
  eq(inconsistent.status,409,label+' cannot be displayed as complete');
  assertPrivatePost(inconsistent,label+' private integrity conflict');
  eq(row().id,before.id,label+' does not replace the saved row');
  db.prepare('UPDATE job_reports SET '+column+'=? WHERE estimate_id=?')
   .run(column==='customer_id'?before.customerId:before.completedAt,'report-job');
 }
 // A corrupt/imported status with no completion timestamp used to be
 // silently normalized by POST; both QA-master and DR must refuse that edit.
 const corruptedBefore=row();
 db.prepare("UPDATE job_reports SET status='unknown-import',completed_at=NULL WHERE estimate_id=?").run('report-job');
 const badStatusSave=await post({...input,status:'draft',complete:false});
 eq(badStatusSave.status,409,'Unknown saved report state cannot be rewritten as draft');
 eq(row().status,'unknown-import','Rejected invalid-state update keeps original row');
 eq(row().completedAt,null,'Rejected invalid-state update does not invent completion time');
 const badStatusRead=await route.GET(new Request('https://fixture.invalid/api/job-reports?estimateId=report-job'));
 eq(badStatusRead.status,409,'Unknown report status also fails closed during GET');
 assertPrivatePost(badStatusRead,'unknown report status GET');
 db.prepare('UPDATE job_reports SET status=?,completed_at=? WHERE estimate_id=?')
  .run(corruptedBefore.status,corruptedBefore.completedAt,'report-job');
 // A once-completed report cannot be presented as current completion proof
 // after the job is retired; the original historical row is not mutated.
 const retiredBefore=JSON.stringify(row());
 db.prepare("UPDATE estimates SET status='declined' WHERE id=?").run('report-job');
 const retiredGet=await route.GET(new Request('https://fixture.invalid/api/job-reports?estimateId=report-job'));
 eq(retiredGet.status,409,'QA report readback blocks completion of a retired job');
 assertPrivatePost(retiredGet,'QA retired-job report conflict');
 eq(JSON.stringify(row()),retiredBefore,'QA retired-job denial preserves original completed history');
 db.prepare("UPDATE estimates SET status='scheduled' WHERE id=?").run('report-job');
 const originalGetPrepare=rt.env.DB.prepare;
 rt.env.DB.prepare=function(sql){
  if(sql==='SELECT customer_id AS customerId,status FROM estimates WHERE id=?')throw Error('Synthetic report-job identity D1 outage');
  return originalGetPrepare(sql);
 };
 const identityReadOutage=await route.GET(new Request('https://fixture.invalid/api/job-reports?estimateId=report-job'));
 rt.env.DB.prepare=originalGetPrepare;
 eq(identityReadOutage.status,503,'Report identity D1 outage never returns false completion evidence');
 assertPrivatePost(identityReadOutage,'report identity D1 outage');
 rt.setOwner(null);
 const deniedReport=await route.GET(new Request('https://fixture.invalid/api/job-reports?estimateId=report-job'));
 eq(deniedReport.status,401,'Anonymous owner report history denied');
 for(const h of [get,deniedReport])eq(h.headers.get('vary'),'Cookie','Allowed and denied report history both separate owner sessions');
 rt.setOwner({email:'kylebrooks8605@gmail.com'});
 const reportPrepare=rt.env.DB.prepare;
 rt.env.DB.prepare=function(sql){
  if(sql.includes('FROM job_reports WHERE estimate_id=? ORDER BY created_at DESC'))throw Error('synthetic owner report D1 outage');
  return reportPrepare(sql);
 };
 const unavailableReport=await route.GET(new Request('https://fixture.invalid/api/job-reports?estimateId=report-job'));
 rt.env.DB.prepare=reportPrepare;
 eq(unavailableReport.status,503,'D1 outage cannot manufacture a completed report or a generic cacheable error');
 eq(unavailableReport.headers.get('cache-control'),'private, no-store','Report outage is never stored');
 eq(unavailableReport.headers.get('vary'),'Cookie','Report outage is session-specific');
 eq(unavailableReport.headers.get('x-content-type-options'),'nosniff','Report outage is not content-sniffed');

 // Simulate a second iPhone inserting after the first request checked for
 // an existing report but BEFORE its SQL INSERT. The SQL condition must see it.
 rt.env.DB.prepare=function(sql){
  const stmt=orig(sql);
  if(sql.startsWith('INSERT INTO job_reports')&&sql.includes('WHERE NOT EXISTS')){
   return {...stmt,bind(...args){const prepared=stmt.bind(...args);return{...prepared,async run(){
    db.prepare("INSERT INTO job_reports (id,estimate_id,customer_id,checklist,notes,status,created_at,completed_at) VALUES (?,?,?,?,?,'draft',?,NULL)")
     .run('concurrent-winner','concurrent-job',customer,'{}','Other tab saved first',at);
    return prepared.run();
   }};}};
  }
  return stmt;
 };
 const collision=await post({...input,estimateId:'concurrent-job',status:'draft',complete:false});
 eq(collision.status,409,'Atomic first report INSERT prevents a concurrent duplicate');
 eq(db.prepare("SELECT COUNT(*) AS n FROM job_reports WHERE estimate_id='concurrent-job'").get().n,1,'Concurrent insert did not duplicate report');
 eq(db.prepare("SELECT notes FROM job_reports WHERE id='concurrent-winner'").get().notes,'Other tab saved first','Winning report is not overwritten');
 rt.env.DB.prepare=orig;
 // A job can be declined/superseded or reassigned on another device AFTER
 // its initial ownership/status SELECT. The conditional INSERT or UPDATE
 // must check actual estimate state at SQL write time, not only in JS.
 const beforeStatusRace=JSON.stringify(row());
 let injected=false;
 rt.env.DB.prepare=function(sql){
  const stmt=orig(sql);
  if(sql.startsWith('UPDATE job_reports')&&!injected)return {...stmt,bind(...args){
   const bound=stmt.bind(...args);return {...bound,async run(){
    injected=true;
    db.prepare("UPDATE estimates SET status='superseded' WHERE id='report-job'").run();
    return bound.run();
   }};
  }};
  return stmt;
 };
 const changedBeforeWrite=await post({...input,checklist:absent,notes:'Report edit raced a retired job'});
 eq(changedBeforeWrite.status,409,'Completion update rechecks current job status atomically');
 eq(JSON.stringify(row()),beforeStatusRace,'Retired job race cannot overwrite completed report');
 rt.env.DB.prepare=orig;
 db.prepare("UPDATE estimates SET status='scheduled' WHERE id='report-job'").run();
 const preventFirstWrite=async(jobId,mutation,label)=>{
  let fired=false;
  rt.env.DB.prepare=function(sql){
   const stmt=orig(sql);
   if(sql.startsWith('INSERT INTO job_reports')&&sql.includes('WHERE NOT EXISTS')&&!fired)
    return {...stmt,bind(...args){const bound=stmt.bind(...args);return {...bound,async run(){
     fired=true;mutation();
     return bound.run();
    }};}};
   return stmt;
  };
  const result=await post({...input,estimateId:jobId});
  eq(fired,true,label+' race was injected precisely before insert');
  eq(result.status,409,label+' prevents first completed report from being saved');
  eq(db.prepare("SELECT COUNT(*) n FROM job_reports WHERE estimate_id=?").get(jobId).n,0,
   label+' leaves no misleading completed report for final invoicing');
  rt.env.DB.prepare=orig;
 };
 await preventFirstWrite('retired-race-job',
  ()=>db.prepare("UPDATE estimates SET status='declined' WHERE id='retired-race-job'").run(),
  'Declined job');
 await preventFirstWrite('ownership-race-job',
  ()=>db.prepare("UPDATE estimates SET customer_id='other-report-owner' WHERE id='ownership-race-job'").run(),
  'Wrong-customer job');
 db.prepare("UPDATE estimates SET status='scheduled' WHERE id='retired-race-job'").run();
 db.prepare("UPDATE estimates SET customer_id=? WHERE id='ownership-race-job'").run(customer);
 eq((await post({...input,estimateId:'retired-race-job'})).status,201,
  'Repaired scheduled job can save genuine completed report');
 eq((await post({...input,estimateId:'ownership-race-job'})).status,201,
  'Repaired original customer job can save genuine completed report');
 // The legacy schema is not unique; detect historical duplicates and refuse
 // to treat the newest one as unambiguous completion evidence.
 db.prepare("INSERT INTO job_reports (id,estimate_id,customer_id,checklist,notes,status,created_at,completed_at) VALUES (?,?,?,?,?,'draft',?,NULL)")
  .run('historic-duplicate','report-job',customer,'{}','Synthetic older duplicate',at);
 const duplicateRead=await route.GET(new Request('https://fixture.invalid/api/job-reports?estimateId=report-job'));
 eq(duplicateRead.status,409,'Duplicate historical reports must not authorize completed UI');
 eq(duplicateRead.headers.get('cache-control'),'private, no-store','Duplicate conflict remains private');
 eq(duplicateRead.headers.get('vary'),'Cookie','Duplicate report conflict separates owner sessions');
 eq((await post(input)).status,409,'Duplicate historical reports fail closed on owner POST');
 eq(db.prepare("SELECT COUNT(*) AS n FROM job_reports WHERE estimate_id='report-job'").get().n,2,'No duplicated history was silently deleted');
 rt.setOwner(null);
 eq((await post(input)).status,401,'Nonowner cannot modify report');
 eq((await route.GET(new Request('https://fixture.invalid/api/job-reports?estimateId=report-job'))).status,401,'Nonowner cannot read saved report');
 for(const identity of [{},{email:null},{email:42}]){
  rt.setOwner(identity);
  const before=rt.counters();
  const deniedPost=await route.POST(new Request('https://fixture.invalid/api/job-reports',{method:'POST',body:JSON.stringify(input)}));
  assertPrivatePost(deniedPost,'Malformed job-report principal');
  eq(deniedPost.status,401,'Malformed identity cannot save a job report');
  const deniedGet=await route.GET(new Request('https://fixture.invalid/api/job-reports?estimateId=report-job'));
  eq(deniedGet.status,401,'Malformed identity cannot read a job report');
  eq(deniedGet.headers.get('cache-control'),'private, no-store','Malformed report read stays private');
  eq(rt.counters(),before,'Malformed job report principal performs zero D1 calls');
 }
 // A rejected session provider or a throwing principal email getter must be
 // treated like an anonymous 401, never a cacheable unhandled 500 or D1 read.
 for(const scenario of ['rejected session','throwing email getter']){
  const identity=scenario==='rejected session'
   ? Promise.reject(Error('Synthetic session service unavailable'))
   : Object.defineProperty({},'email',{get(){throw Error('Unreadable synthetic session email');}});
  rt.setOwner(identity);
  const before=rt.counters();
  const deniedGet=await route.GET(new Request('https://fixture.invalid/api/job-reports?estimateId=report-job'));
  eq(deniedGet.status,401,scenario+' denies private report GET');
  eq(deniedGet.headers.get('cache-control'),'private, no-store',scenario+' GET is private');
  eq(deniedGet.headers.get('vary'),'Cookie',scenario+' GET varies with owner cookie');
  eq(deniedGet.headers.get('x-content-type-options'),'nosniff',scenario+' GET forbids sniffing');
  const deniedPost=await route.POST(new Request('https://fixture.invalid/api/job-reports',{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)
  }));
  eq(deniedPost.status,401,scenario+' denies report mutation');
  assertPrivatePost(deniedPost,scenario+' POST');
  eq(rt.counters(),before,scenario+' reads and writes no D1 records');
 }
 rt.setOwner({email:'kylebrooks8605@gmail.com'});

 // Run independent DR source fixture only when explicitly pinned by CI.
 // The ordinary staging candidate is materialized outside the repository,
 // so a relative ../../fire-app-dr path would NOT refer to the live PR source.
 if(process.env.FIRE_DR_JOB_REPORT_ROUTE){
 // Exercise the INDEPENDENT DR route, not a synthetic substitute: it must
 // accept the QA-master job-report contract while denying unsafe reads/writes.
 const drRoute=rt.load(process.env.FIRE_DR_JOB_REPORT_ROUTE);
 const drJob='dr-report-parity';
 db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,?,?,?,?,?)")
  .run(drJob,customer,'scheduled',20000,20000,10000,at);
 rt.setOwner({email:'kylebrooks8605@gmail.com'});
 const drPayload={...input,estimateId:drJob,checklist:absent,
  notes:'Synthetic DR customer absent; after photos and completion details retained.'};
 const drSaved=await drRoute.POST(new Request('https://fixture.invalid/api/job-reports',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(drPayload)
 }));
 eq(drSaved.status,201,'Independent DR report follows QA master first-save semantics');
 assertPrivatePost(drSaved,'Independent DR saved report');
 const drData=await drSaved.json();
 const drDb=db.prepare('SELECT id,notes,status,completed_at AS completedAt FROM job_reports WHERE estimate_id=?').get(drJob);
 eq(drData.report?.id,drDb.id,'Independent DR report uses real SQLite persisted identifier');
 eq(drDb.status,'completed','Independent DR accepts documented absent-customer completion');
 eq(drData.report?.completedAt,drDb.completedAt,'DR completion date comes from SQLite');
 const drRead=await drRoute.GET(new Request('https://fixture.invalid/api/job-reports?estimateId='+drJob));
 eq(drRead.status,200,'DR GET reads actual saved report');
 assertPrivatePost(drRead,'Independent DR private GET');
 eq((await drRead.json()).reports[0].id,drDb.id,'DR GET preserves saved identity');
 // The real independent DR route must enforce the same readback integrity.
 db.prepare('UPDATE job_reports SET customer_id=? WHERE estimate_id=?').run('other-report-owner',drJob);
 const drWrong=await drRoute.GET(new Request('https://fixture.invalid/api/job-reports?estimateId='+drJob));
 eq(drWrong.status,409,'DR denies a stale wrong-customer report on read');
 assertPrivatePost(drWrong,'DR wrong-customer integrity conflict');
 db.prepare('UPDATE job_reports SET customer_id=? WHERE estimate_id=?').run(customer,drJob);
 db.prepare('UPDATE job_reports SET completed_at=NULL WHERE estimate_id=?').run(drJob);
 const drBroken=await drRoute.GET(new Request('https://fixture.invalid/api/job-reports?estimateId='+drJob));
 eq(drBroken.status,409,'DR denies completed report without timestamp');
 assertPrivatePost(drBroken,'DR completion-history integrity conflict');
 db.prepare('UPDATE job_reports SET completed_at=? WHERE estimate_id=?').run(drDb.completedAt,drJob);

 // The independent DR worker must not treat a retired job as a current
 // completed service solely because its historical report still exists.
 const drRetiredBefore=JSON.stringify(db.prepare('SELECT * FROM job_reports WHERE estimate_id=?').get(drJob));
 db.prepare("UPDATE estimates SET status='declined' WHERE id=?").run(drJob);
 const drRetiredGet=await drRoute.GET(new Request('https://fixture.invalid/api/job-reports?estimateId='+drJob));
 eq(drRetiredGet.status,409,'Independent DR blocks completed-report proof for retired job');
 assertPrivatePost(drRetiredGet,'Independent DR retired-job report conflict');
 eq(JSON.stringify(db.prepare('SELECT * FROM job_reports WHERE estimate_id=?').get(drJob)),drRetiredBefore,
  'Independent DR refuses retirement without editing report history');
 db.prepare("UPDATE estimates SET status='scheduled' WHERE id=?").run(drJob);

 // DR cannot silently "repair" an invalid imported report state either.
 db.prepare("UPDATE job_reports SET status='unknown-import',completed_at=NULL WHERE estimate_id=?").run(drJob);
 const drBadStatusSave=await drRoute.POST(new Request('https://fixture.invalid/api/job-reports',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({...drPayload,status:'draft',complete:false})
 }));
 eq(drBadStatusSave.status,409,'DR rejects invalid historical status on POST');
 assertPrivatePost(drBadStatusSave,'DR invalid historical status POST');
 eq(db.prepare('SELECT status FROM job_reports WHERE estimate_id=?').get(drJob).status,'unknown-import',
  'DR invalid status remains untouched');
 db.prepare('UPDATE job_reports SET status=?,completed_at=? WHERE estimate_id=?')
  .run('completed',drDb.completedAt,drJob);

 // A soft-failed pre-edit history read must fail before any new report write.
 // A zero-row or absent result collection is not evidence the report vanished.
 const beforeSoftPost=JSON.stringify(db.prepare('SELECT * FROM job_reports WHERE estimate_id=?').get(drJob));
 for(const [label,history] of [
  ['soft-failed pre-edit list',{success:false,results:[]}],
  ['missing pre-edit result rows',{success:true}]
 ]){
  let reportWrites=0;
  rt.env.DB.prepare=function(sql){
   if(sql.includes('FROM job_reports WHERE estimate_id=? ORDER BY created_at DESC LIMIT 2'))
    return {bind(){return {all:async()=>history}}};
   const statement=sql.trimStart().toUpperCase();
   if((statement.startsWith('INSERT')||statement.startsWith('UPDATE')||statement.startsWith('DELETE'))&&sql.includes('job_reports'))
    reportWrites++;
   return originalDrPrepare(sql);
  };
  let refused;
  try{
   refused=await drRoute.POST(new Request('https://fixture.invalid/api/job-reports',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(drPayload)
   }));
  }finally{rt.env.DB.prepare=originalDrPrepare;}
  eq(refused.status,503,'DR '+label+' refuses unverified report edit');
  assertPrivatePost(refused,'DR '+label+' private uncertain receipt');
  eq((await refused.json()).saveUncertain,true,'DR '+label+' reports uncertain history rather than concurrent save');
  eq(reportWrites,0,'DR '+label+' makes zero report writes');
  eq(JSON.stringify(db.prepare('SELECT * FROM job_reports WHERE estimate_id=?').get(drJob)),
   beforeSoftPost,'DR '+label+' preserves actual completed report');
 }

 for(const [label,ownerValue] of [
  ['DR rejected owner provider',Promise.reject(Error('Synthetic independent DR auth outage'))],
  ['DR throwing owner email',Object.defineProperty({},'email',{get(){throw Error('Unreadable DR principal');}})]
 ]){
  rt.setOwner(ownerValue);
  const before=rt.counters();
  const badGet=await drRoute.GET(new Request('https://fixture.invalid/api/job-reports?estimateId='+drJob));
  eq(badGet.status,401,label+' denies GET');
  assertPrivatePost(badGet,label+' private GET');
  const badPost=await drRoute.POST(new Request('https://fixture.invalid/api/job-reports',{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(drPayload)
  }));
  eq(badPost.status,401,label+' denies POST');
  assertPrivatePost(badPost,label+' private POST');
  eq(rt.counters(),before,label+' performs zero D1 operations');
 }
 rt.setOwner({email:'kylebrooks8605@gmail.com'});
 const beforeForeign=rt.counters();
 const foreign=await drRoute.POST(new Request('https://fixture.invalid/api/job-reports',{
  method:'POST',headers:{'origin':'https://outside.invalid','sec-fetch-site':'cross-site','content-type':'application/json'},body:JSON.stringify(drPayload)
 }));
 eq(foreign.status,403,'DR denies foreign-origin owner report write');
 assertPrivatePost(foreign,'DR origin refusal');
 eq(rt.counters(),beforeForeign,'DR foreign-origin denial performs no D1 operation');
 const beforeLarge=rt.counters();
 const oversized=await drRoute.POST(new Request('https://fixture.invalid/api/job-reports',{
  method:'POST',headers:{'content-length':'64001','content-type':'application/json'},body:'{}'
 }));
 eq(oversized.status,413,'DR refuses oversized declared report bytes');
 eq(rt.counters(),beforeLarge,'DR oversize refusal performs no D1 operation');
 const originalDrPrepare=rt.env.DB.prepare;
 rt.env.DB.prepare=function(sql){
  if(sql.includes('FROM job_reports WHERE estimate_id=? ORDER BY created_at DESC'))
   throw Error('Synthetic DR D1 report read outage');
  return originalDrPrepare(sql);
 };
 const drOutage=await drRoute.GET(new Request('https://fixture.invalid/api/job-reports?estimateId='+drJob));
 rt.env.DB.prepare=originalDrPrepare;
 eq(drOutage.status,503,'DR D1 outage fails closed without inventing saved report state');
 assertPrivatePost(drOutage,'DR D1 503');
 // Soft-failed or incomplete D1 .all() responses must not pretend that a
 // previously completed job has no report. Neither response may mutate D1.
 const savedBeforeSoftFailure=JSON.stringify(
  db.prepare('SELECT * FROM job_reports WHERE estimate_id=?').get(drJob));
 for(const [label,result] of [
  ['soft-failed D1 report list',{success:false,results:[]}],
  ['missing D1 report results',{success:true}]
 ]){
  rt.env.DB.prepare=function(sql){
   if(sql.includes('FROM job_reports WHERE estimate_id=? ORDER BY created_at DESC'))
    return {bind(){return {all:async()=>result}}};
   return originalDrPrepare(sql);
  };
  const softRead=await drRoute.GET(new Request('https://fixture.invalid/api/job-reports?estimateId='+drJob));
  rt.env.DB.prepare=originalDrPrepare;
  eq(softRead.status,503,'DR '+label+' must fail closed instead of reporting an empty history');
  assertPrivatePost(softRead,'DR '+label+' response privacy');
  eq(JSON.stringify(db.prepare('SELECT * FROM job_reports WHERE estimate_id=?').get(drJob)),
   savedBeforeSoftFailure,'DR '+label+' leaves the saved job report intact');
 }
 db.prepare("INSERT INTO job_reports(id,estimate_id,customer_id,checklist,notes,status,created_at,completed_at) VALUES(?,?,?,?,?,'draft',?,NULL)")
  .run('dr-report-historical-duplicate',drJob,customer,'{}','Synthetic DR duplicate',at);
 const drDuplicate=await drRoute.GET(new Request('https://fixture.invalid/api/job-reports?estimateId='+drJob));
 eq(drDuplicate.status,409,'DR duplicate historical report does not authorize completion');
 assertPrivatePost(drDuplicate,'DR duplicate report conflict');
 eq((await drRoute.POST(new Request('https://fixture.invalid/api/job-reports',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(drPayload)
 }))).status,409,'DR duplicate report cannot be overwritten');
 eq(db.prepare('SELECT COUNT(*) AS n FROM job_reports WHERE estimate_id=?').get(drJob).n,2,
  'DR duplicate detection never deletes either historical row');
 }
 console.log('PASS '+checks+'/'+checks+' real JobReport API/native SQLite readback, legacy history, contact-free, no-op writes, lost-ack recovery and owner authorization. NO HOSTED WRITES.');
}finally{rt.env.DB.prepare=orig;db.close();}
