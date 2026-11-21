/** Actual independent DR estimate POST/PATCH, disposable SQLite, no providers. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
const require=createRequire(import.meta.url),ts=require('typescript');
const root=resolve(process.env.GITHUB_WORKSPACE??resolve(process.cwd(),'../..'));
const {readOwnerWriteObject:drOwnerJsonGuard}=await import(pathToFileURL(resolve(root,'fire-app-dr/lib/customer-write-request-guard.mjs')).href);
let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;console.log('PASS: '+message);};
const source=relative=>readFileSync(resolve(root,relative),'utf8');
const compile=(path,loader)=>{
 const m={exports:{}},js=ts.transpileModule(source(path),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','module','exports','Request','Response','crypto',js)(loader,m,m.exports,Request,Response,webcrypto);
 return m.exports;
};
const discounts=compile('fire-app-dr/lib/discount-input.ts',()=>{throw Error('Unexpected discount import');});
const financeKeys=['submittedDiscountCents','quoteDiscounts','discountSnapshot','verifiedSavedDiscounts','DISCOUNT_SNAPSHOT_PREFIX'];
check(financeKeys.every(k=>Object.hasOwn(discounts,k)),'DR pricing helper matches the established quote contract');
let user={email:'kylebrooks8605@gmail.com'},batchMode='normal',db,prepareCount=0;
const setup=()=>{
 db?.close();db=new DatabaseSync(':memory:');
 db.exec(`
 CREATE TABLE customers(id TEXT PRIMARY KEY,name TEXT,email TEXT,phone TEXT,address TEXT,created_at TEXT);
 CREATE TABLE estimates(id TEXT PRIMARY KEY,customer_id TEXT,status TEXT,subtotal_cents INTEGER,discount_cents INTEGER,
  appreciation_discount INTEGER,additional_discount_type TEXT,additional_discount_value INTEGER,total_cents INTEGER,
  deposit_cents INTEGER,share_token TEXT,created_at TEXT,scheduled_at TEXT,accepted_at TEXT,signed_at TEXT,
  first_viewed_at TEXT,signed_name TEXT,contract_initials TEXT,photo_release INTEGER);
 CREATE TABLE estimate_items(id TEXT PRIMARY KEY,estimate_id TEXT,name TEXT,description TEXT,quantity REAL,unit TEXT,total_cents INTEGER);
 CREATE TABLE message_templates(key TEXT PRIMARY KEY,subject TEXT,body TEXT,updated_at TEXT);
 CREATE TABLE payments(estimate_id TEXT,status TEXT,type TEXT,amount_cents INTEGER);
 CREATE TABLE invoices(id TEXT PRIMARY KEY,estimate_id TEXT,customer_id TEXT,share_token TEXT,total_cents INTEGER);
 CREATE TABLE job_reports(estimate_id TEXT,created_at TEXT,status TEXT);
 CREATE TABLE estimate_change_requests(estimate_id TEXT,status TEXT,message TEXT,created_at TEXT);
 CREATE TABLE customer_messages(estimate_id TEXT,template TEXT,channel TEXT,created_at TEXT);
 CREATE TABLE notifications(estimate_id TEXT,type TEXT,resolved_at TEXT);
 CREATE TABLE payment_refunds(estimate_id TEXT,status TEXT);
 `);
 batchMode='normal';
};
const events=[];
const DB={
 prepare(sql){
  prepareCount++;
  const bind=(...args)=>({
   async first(){return db.prepare(sql).get(...args)??null;},
   async all(){return {results:db.prepare(sql).all(...args)};},
   async run(){let result=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}};},
  });
  return {bind,queryText:sql,async first(){return db.prepare(sql).get()??null;},
    async all(){return {results:db.prepare(sql).all()};}};
 },
 async batch(statements){
  events.push('batch:'+batchMode);
  if(batchMode==='drop-ack')return [];
  if(statements.length===2&&statements.every(s=>/^\s*SELECT\b/i.test(s.queryText??''))){
    if(batchMode==='read-soft')return [{success:false,results:[]},{success:true,results:[]}];
    if(batchMode==='read-missing')return [{success:true,results:[]},{success:true}];
    if(batchMode==='read-short')return [{success:true,results:[]}];
    if(batchMode==='read-throw')throw Error('Synthetic unconfirmed D1 owner estimate read');
  }
  if(batchMode==='accepted-before-write')db.prepare("UPDATE estimates SET accepted_at='2026-11-11T00:00:00Z' WHERE id=?").run(currentId);
  if(batchMode==='schedule-before-write')db.prepare("UPDATE estimates SET scheduled_at='2026-11-15T08:00:00.000Z' WHERE id=?").run(currentId);
  if(batchMode==='payment-before-write')db.prepare("INSERT INTO payments VALUES(?,'paid','deposit',2500)").run(currentId);
  db.exec('BEGIN');
  try{let output=[];for(const stmt of statements)
    output.push(/^\s*SELECT\b/i.test(stmt.queryText??'')?await stmt.all():await stmt.run());
    db.exec('COMMIT');return output;}
  catch(e){db.exec('ROLLBACK');throw e;}
 }
};
const env={DB};
const imports=id=>{
 if(id==='cloudflare:workers')return {env};
 if(id.endsWith('owner-auth'))return {getOwnerUser:async()=>user};
 if(id.endsWith('lib/discount-input'))return discounts;
 if(id.endsWith('lib/customer-write-request-guard.mjs'))return {readOwnerWriteObject:drOwnerJsonGuard};
 throw Error('Unexpected DR import '+id);
};
const api=compile('fire-app-dr/app/api/estimates/route.ts',imports);
const detail=compile('fire-app-dr/app/api/estimates/[id]/route.ts',imports);
const request=(body,method='POST')=>new Request('https://synthetic.invalid/api/estimates',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const posted=async(body)=>{const r=await api.POST(request(body)),data=await r.json();return {status:r.status,data};};
const patched=async(id,body)=>{const r=await detail.PATCH(request(body,'PATCH'),{params:Promise.resolve({id})});return {status:r.status,data:await r.json()};};
const item=(cents,name='Synthetic photo windows')=>({name,description:'Synthetic custom-service',quantity:1,unit:'job',totalCents:cents});
const base=cents=>({customer:'Synthetic FIRE Customer',email:'none@example.invalid',phone:'9185550131',address:'123 QA Lane',items:[item(cents)]});
const one=()=>db.prepare('SELECT * FROM estimates LIMIT 1').get();
const lines=id=>db.prepare('SELECT * FROM estimate_items WHERE estimate_id=? ORDER BY rowid').all(id);
const snapshot=id=>db.prepare('SELECT body FROM message_templates WHERE key=?').get(discounts.DISCOUNT_SNAPSHOT_PREFIX+id);
setup();
let currentId=null;
{
 const created=await posted(base(2500));
 check(created.status===201&&created.data.totalCents===2500&&created.data.depositCents===1250,
  'DR quote creates $25 custom-service job; never fabricates a $150 minimum');
 currentId=created.data.id;
 check(one().total_cents===2500&&lines(currentId)[0].total_cents===2500,
  'DR created total and line are independently stored as exact 2500 cents');
 const edit=await patched(currentId,{items:[item(3500)],additionalDiscountType:'percent',additionalDiscountValue:500,bundleDiscountCents:200});
 const expected=discounts.quoteDiscounts(3500,false,'percent',500,200);
 check(edit.status===200&&edit.data.estimate.totalCents===expected.total&&
       one().total_cents===expected.total&&one().deposit_cents===expected.deposit,
   'DR edit stacks 5% and bundle cents exactly, without minimum or rounding');
 check(lines(currentId)[0].total_cents===3500&&JSON.parse(snapshot(currentId).body).bundleDiscountCents===200,
   'DR persisted real line and original bundle-discount provenance');
 const omitted=await patched(currentId,{items:[item(3000)]});
 check(omitted.status===409&&one().total_cents===expected.total,
   'DR refuses to erase saved bundle terms when older client omits them');
 const changed=await patched(currentId,{items:[item(4000)],additionalDiscountType:'dollar',additionalDiscountValue:100,bundleDiscountCents:250});
 check(changed.status===200&&one().total_cents===3650&&
  JSON.parse(snapshot(currentId).body).bundleDiscountCents===250,
  'DR preserves stacked dollar and bundle discounts during legitimate revision');
}
setup();
{
 const stacked=await posted({...base(2500),appreciationDiscount:true,additionalDiscountType:'percent',
  additionalDiscountValue:1000,bundleDiscountCents:250});
 const expected=discounts.quoteDiscounts(2500,true,'percent',1000,250);
 check(stacked.status===201&&stacked.data.totalCents===expected.total&&
   stacked.data.depositCents===expected.deposit&&
   JSON.parse(snapshot(stacked.data.id).body).appliedDiscount===expected.appliedDiscount,
  'DR new quotes stack appreciation, percent and bundle discounts at exact cents');
}
for(const [label,changes] of [
 ['fractional-service',{items:[item(2500.5)]}],
 ['fractional-discount',{additionalDiscountValue:1.5}],
 ['negative-discount',{additionalDiscountValue:-1}],
 ['excess-percent',{additionalDiscountValue:7000}],
 ['fractional-bundle',{bundleDiscountCents:19.5}],
 ['negative-bundle',{bundleDiscountCents:-10}],
]){
 setup();
 const result=await posted({...base(2500),...changes});
 check(result.status===400&&db.prepare('SELECT COUNT(*) AS n FROM estimates').get().n===0,
  'DR rejects '+label+' instead of rounding/creating a wrong-price job');
}
setup();
{
 const c=await posted(base(2500));currentId=c.data.id;
 db.prepare("UPDATE estimates SET signed_at='2026-11-11T00:00:00Z' WHERE id=?").run(currentId);
 const denied=await patched(currentId,{items:[item(6500)]});
 check(denied.status===409&&one().total_cents===2500&&lines(currentId)[0].total_cents===2500,
   'Signed customer quote cannot be silently re-priced in DR');
}
setup();
{
 const c=await posted(base(2500));currentId=c.data.id;
 batchMode='accepted-before-write';
 const raced=await patched(currentId,{items:[item(5500)]});
 check(raced.status===503&&raced.data.saveUncertain===true&&one().total_cents===2500&&
   lines(currentId)[0].total_cents===2500,
   'DR SQL-time guard keeps old estimate and lines intact if accepted during edit');
}
setup();
{
 batchMode='drop-ack';
 const bad=await posted(base(2500));
 check(bad.status===503&&bad.data.saveUncertain===true&&db.prepare('SELECT COUNT(*) AS n FROM estimates').get().n===0,
  'DR cannot report created customer quote when batch success is fabricated');
}
// Gate 6/8 recovery workflow: a full job must never be advanced based on
// an older UI snapshot, conflicting completion reports, or forged bulk resolve.
setup();
{
 const c=await posted(base(2500));currentId=c.data.id;
 db.prepare("UPDATE estimates SET status='approved',accepted_at='2026-11-11T12:00:00Z',signed_at='2026-11-11T12:00:00Z' WHERE id=?").run(currentId);
 const scheduled=await patched(currentId,{status:'scheduled',scheduledAt:'2026-11-12T10:00:00.000Z'});
 check(scheduled.status===200&&one().status==='scheduled'&&
       one().scheduled_at==='2026-11-12T10:00:00.000Z',
       'DR schedules a genuinely signed/approved job with a verified saved timestamp');
 const missingReport=await patched(currentId,{status:'completed'});
 check(missingReport.status===409&&one().status==='scheduled',
       'DR does not close a scheduled job without a saved completion report');
 db.prepare("INSERT INTO job_reports VALUES(?,'2026-11-11T13:00:00Z','completed')").run(currentId);
 db.prepare("INSERT INTO job_reports VALUES(?,'2026-11-11T13:01:00Z','completed')").run(currentId);
 const duplicate=await patched(currentId,{status:'completed'});
 check(duplicate.status===409&&one().status==='scheduled',
       'DR does not close a job with conflicting duplicate completion reports');
 db.prepare("DELETE FROM job_reports WHERE created_at='2026-11-11T13:01:00Z'").run();
 const closed=await patched(currentId,{status:'completed'});
 check(closed.status===200&&one().status==='completed',
       'DR closes a job only after exactly one completed service report');
 const bulk=await patched(currentId,{resolveChangeRequests:true});
 check(bulk.status===409&&bulk.data.error.includes('specific'),
       'DR refuses silent mass resolution of customer change requests');
}
setup();
{
 const c=await posted(base(2500));currentId=c.data.id;
 db.prepare("UPDATE estimates SET status='approved',accepted_at='2026-11-11T12:00:00Z',signed_at='2026-11-11T12:00:00Z' WHERE id=?").run(currentId);
 batchMode='schedule-before-write';
 const raced=await patched(currentId,{status:'scheduled',scheduledAt:'2026-11-12T10:00:00.000Z'});
 check(raced.status===409&&raced.data.saveUncertain===true&&one().status==='approved'&&
       one().scheduled_at==='2026-11-15T08:00:00.000Z',
       'DR cannot overwrite a newer schedule changed between owner read and D1 write');
}
setup();
{
 const c=await posted(base(2500));currentId=c.data.id;
 db.prepare("UPDATE estimates SET status='approved',accepted_at='2026-11-11T12:00:00Z',signed_at='2026-11-11T12:00:00Z' WHERE id=?").run(currentId);
 batchMode='payment-before-write';
 const raced=await patched(currentId,{status:'scheduled',scheduledAt:'2026-11-12T10:00:00.000Z'});
 check(raced.status===409&&one().status==='approved',
       'DR blocks a scheduling change when new payment activity appears during save');
}
setup();
{
 const c=await posted(base(2500));currentId=c.data.id;
 const attempted=await patched(currentId,{status:'approved'});
 check(attempted.status===409&&one().status==='draft',
       'Owner cannot fabricate a signed customer approval from status controls');
}
// Owner-facing estimate history must never show an invoice/share link from
// another customer's record (especially in an emergency DR recovery).
setup();
{
 const created=await posted(base(2500));const id=created.data.id,customerId=created.data.customerId;
 db.prepare("INSERT INTO invoices VALUES('invoice-1',?,?,?,?)")
   .run(id,customerId,'synthetic-invoice-token',2500);
 const good=await api.GET();
 const goodBody=await good.json();
 check(good.status===200&&goodBody.estimates?.length===1&&
       goodBody.estimates[0].invoiceId==='invoice-1'&&
       goodBody.estimates[0].invoiceShareToken==='synthetic-invoice-token'&&
       !Object.hasOwn(goodBody.estimates[0],'invoiceOwnershipMismatch'),
   'Actual DR estimate list preserves same-customer invoice and omits internal ownership checks');
 db.prepare("UPDATE invoices SET customer_id='foreign-customer' WHERE id='invoice-1'").run();
 const foreign=await api.GET();const wrong=await foreign.json();
 check(foreign.status===409&&typeof wrong.error==='string'&&!wrong.estimates,
   'Actual DR estimate list refuses crossed-customer invoice totals and public share tokens');
}
// DR owner estimate history: a successful empty list is different from D1 failure.
setup();
{
 user={email:'kylebrooks8605@gmail.com'};
 const headers=(r)=>r.headers.get('cache-control')==='private, no-store'&&
   r.headers.get('vary')==='Cookie'&&r.headers.get('x-content-type-options')==='nosniff';
 const actualEmpty=await api.GET();
 check(actualEmpty.status===200&&headers(actualEmpty)&&(await actualEmpty.json()).estimates.length===0,
   'Independent DR confirmed genuinely empty estimates render owner-private 200');
 for(const [mode,label] of [['read-soft','nonthrowing unsuccessful estimate query'],['read-missing','missing service-line result array'],['read-short','truncated D1 batch'],['read-throw','throwing D1 owner read']]){
  batchMode=mode;
  const failed=await api.GET();const body=await failed.json();
  check(failed.status===503&&headers(failed)&&body.estimates?.length===0&&body.message?.includes('unavailable'),
    'Independent DR '+label+' cannot become a successful empty list');
 }
 batchMode='normal';
 for(const [label,p] of [['missing email',{}],['numeric email',{email:42}],['unreadable email',{get email(){throw Error('Synthetic unreadable session')}}],['foreign email',{email:'other@synthetic.invalid'}]]){
  user=p;
  const before=events.length;
  const denied=await api.GET();
  check(denied.status===401&&headers(denied)&&events.length===before,
    'Independent DR '+label+' is denied with private headers before D1');
 }
 user={email:'kylebrooks8605@gmail.com'};
}
// Changed DR estimate PATCH must refuse forged browser writes, malformed JSON
// and unbounded UTF-8 BEFORE any estimate, customer or financial D1 statement.
setup();user={email:'kylebrooks8605@gmail.com'};
const strictHeaders={'origin':'https://synthetic.invalid','sec-fetch-site':'same-origin','content-type':'application/json'};
const goodEdit=JSON.stringify({status:'sent'});
const editRequest=(headers,body)=>new Request('https://synthetic.invalid/api/estimates/synthetic-only',{
 method:'PATCH',headers,body
});
const editContext={params:Promise.resolve({id:'synthetic-only'})};
const privateEdit=(response)=>response.headers.get('cache-control')==='private, no-store'&&
 response.headers.get('vary')==='Cookie'&&response.headers.get('x-content-type-options')==='nosniff';
for(const [label,identity] of [
 ['no owner',null],['foreign owner',{email:'wrong@synthetic.invalid'}],
 ['numeric owner',{email:8}],['unreadable owner',{get email(){throw Error('unreadable owner')}}]
]){
 user=identity;const before=prepareCount;
 const response=await detail.PATCH(editRequest(strictHeaders,goodEdit),editContext);
 check(response.status===401&&privateEdit(response)&&prepareCount===before,
   'Actual DR estimate PATCH '+label+' is private 401 before D1');
}
user={email:'kylebrooks8605@gmail.com'};
for(const [label,headers,body,status] of [
 ['cross-origin',{...strictHeaders,origin:'https://attacker.invalid','sec-fetch-site':'cross-site'},goodEdit,403],
 ['sibling-origin',{...strictHeaders,origin:'https://sibling.synthetic.invalid','sec-fetch-site':'same-site'},goodEdit,403],
 ['same-site metadata',{...strictHeaders,'sec-fetch-site':'same-site'},goodEdit,403],
 ['browser form',{...strictHeaders,'content-type':'text/plain'},goodEdit,415],
 ['declared over 256 KiB',{...strictHeaders,'content-length':'262145'},goodEdit,413],
 ['actual oversized UTF-8',strictHeaders,JSON.stringify({notes:'é'.repeat(132000)}),413],
 ['invalid declared length',{...strictHeaders,'content-length':'invalid'},goodEdit,400],
 ['malformed JSON',strictHeaders,'{',400],
 ['array JSON',strictHeaders,'[]',400],
 ['empty JSON',strictHeaders,'',400],
 ]){
 const before=prepareCount;
 const response=await detail.PATCH(editRequest(headers,body),editContext);
 check(response.status===status&&privateEdit(response)&&prepareCount===before,
   'Actual DR estimate PATCH '+label+' denied privately before ALL D1 operations');
}
user={email:'kylebrooks8605@gmail.com'};
db.close();
console.log('PASS '+checks+'/'+checks+' DR quote pricing, lifecycle and actual PATCH owner/256KiB/origin/private/zero-D1 negative tests (no hosted calls).');
