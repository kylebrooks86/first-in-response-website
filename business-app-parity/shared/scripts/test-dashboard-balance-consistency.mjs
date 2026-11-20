import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
const db=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
const env={DB:{prepare(sql){return {sql,async first(){return db.prepare(sql).get()??null;}};},async batch(queries){return queries.map(({sql})=>({results:db.prepare(sql).all()}));}}};
function load(path,imports){const exports={};const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext(code,{exports,require:name=>{if(!(name in imports))throw Error('Unexpected import '+name);return imports[name];},Response,process:{env:{NODE_ENV:'production'}}});return exports;}
let user={email:'kylebrooks8605@gmail.com',fullName:'Kyle Brooks'};
const auth={getChatGPTUser:async()=>user,requireChatGPTUser:async()=>user,chatGPTSignOutPath:()=>'/logout'};
const location=load('lib/service-location.ts',{});
const data=load('lib/dashboard-data.ts',{'./service-location':location});
const jobs=await import('../lib/job-numbering.mjs');
const home=load('app/page.tsx',{'../lib/dashboard-data':data,'../lib/job-numbering.mjs':jobs,'cloudflare:workers':{env},'./chatgpt-auth':auth,'./dashboard':{Dashboard:'Dashboard'},'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}});
const api=load('app/api/dashboard-summary/route.ts',{'../../../lib/dashboard-data':data,'../../../lib/job-numbering.mjs':jobs,'cloudflare:workers':{env},'../../chatgpt-auth':auth});
const qaPage=readFileSync('app/page.tsx','utf8').includes('FIRE_QA_SYNTHETIC_ONLY');
if(qaPage)env.FIRE_QA_SYNTHETIC_ONLY='enabled';
// QA wraps the actual Dashboard in a test-data banner. Read its real props,
// rather than accidentally testing the wrapping Fragment or disabled notice.
function dashboardFrom(node){
 if(node?.props?.metrics&&node?.props?.estimates)return node;
 const children=node?.props?.children;
 const items=Array.isArray(children)?children:[children];
 const views=items.filter(x=>x?.props?.metrics&&x?.props?.estimates);
 assert.equal(views.length,1,'Expected exactly one real Dashboard under QA banner');
 return views[0];
}
let checks=0;
function equal(actual,expected){assert.equal(actual,expected);checks++;}
function assertPrivateMetricsResponse(response,label){
 equal(response.headers.get('cache-control'),'private, no-store');
 equal(response.headers.get('vary'),'Cookie');
 equal(response.headers.get('x-content-type-options'),'nosniff');
 equal(response.status,label==='unauthorized'?401:200);
}
function seed({status='completed',invoice=null,payments=[],total=10000,deposit=5000}){
 db.exec('DELETE FROM payments; DELETE FROM invoices; DELETE FROM estimate_items; DELETE FROM estimates; DELETE FROM customers;');
 db.prepare("INSERT INTO customers(id,name,created_at) VALUES('c','Synthetic QA','now')").run();
 db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES('e','c',?,?,?,?, 'now')").run(status,total,total,deposit);
 if(invoice!==null)db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,created_at) VALUES('i','e','c','sent',?,'now')").run(invoice);
 payments.forEach(([type,amount,paymentStatus='paid'],index)=>db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,'e',?,?,?,'now')").run('p'+index,type,amount,paymentStatus));
}
try {
 const fixtures=[
  [{status:'draft'},0,10000],
  [{status:'sent'},0,10000],
  [{status:'declined'},0,0],
  [{status:'approved'},5000,0],
  [{status:'scheduled',payments:[['deposit',2000],['Tip',3000]]},3000,0],
  [{status:'approved',invoice:8000,payments:[['deposit',2000]]},3000,0],
  [{},10000,0],
  [{invoice:8000,payments:[['balance',6000],['Tip',3000],['Refund',-1000],['Tip Refund',-500]]},3000,0],
  [{payments:[['balance',15000]]},0,0],
  [{payments:[['balance',10000,'pending'],['balance',10000,'failed']]},10000,0],
  [{payments:[['balance',10000],['Refund',-10000]]},10000,0],
 ];
 for(const [fixture,outstanding,openValue] of fixtures){
  seed(fixture);const rendered=dashboardFrom(await home.default());const refreshed=await (await api.GET()).json();
  if(fixture.status==='draft')assertPrivateMetricsResponse(await api.GET(),'owner');
  equal(rendered.props.metrics.outstanding,outstanding);equal(refreshed.outstanding,outstanding);equal(rendered.props.metrics.openValue,openValue);equal(refreshed.openValue,openValue);equal(rendered.props.metrics.estimates,refreshed.estimates);
  const completed=fixture.status===undefined||fixture.status==='completed'?1:0;
  equal(rendered.props.metrics.completedJobs,completed);
  equal(refreshed.completedJobs,completed);
  equal(rendered.props.estimates[0].paidCents,refreshed.recent[0].paidCents);
 }
 // A physically valid but mis-owned legacy invoice must NEVER override
 // another homeowner's balance or expose its share link on dashboard cards.
 // This intentionally exercises the REAL dashboard SQL on disposable SQLite.
 seed({status:'completed'});
 db.prepare("INSERT INTO customers(id,name,created_at) VALUES('other','Unrelated Synthetic Owner','now')").run();
 db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,share_token,created_at) VALUES('foreign','e','other','sent',99000,'foreign-private-token','now')").run();
 const mismatchedHome=dashboardFrom(await home.default()),mismatchedApi=await (await api.GET()).json();
 equal(mismatchedHome.props.metrics.outstanding,10000);
 equal(mismatchedApi.outstanding,10000);
 equal(mismatchedHome.props.estimates[0].invoiceId,null);
 equal(mismatchedApi.recent[0].invoiceId,null);
 equal(mismatchedApi.recent[0].invoiceTotalCents,null);
 equal(mismatchedApi.recent[0].invoiceShareToken,null);
 // Reuse the SAME invalid legacy association for a future scheduled job.
 // The upcoming shortcut must not acquire another customer's bearer URL.
 db.prepare("UPDATE estimates SET status='scheduled', scheduled_at='2099-12-01T14:00:00Z', created_at='2026-11-19T12:00:00Z' WHERE id='e'").run();
 const scheduledMismatch=await (await api.GET()).json();
 equal(scheduledMismatch.upcomingJobs.length,1);
 equal(scheduledMismatch.upcomingJobs[0].id,'e');
 equal(scheduledMismatch.upcomingJobs[0].invoiceId,null);
 equal(scheduledMismatch.upcomingJobs[0].invoiceShareToken,null);
 equal(scheduledMismatch.upcomingJobs[0].invoiceTotalCents,null);
 // Network/database outages must remain explicit 503, never an all-clear
 // zero-dollar dashboard or an HTML 500 that the PWA cannot interpret.
 const normalBatch=env.DB.batch;
 env.DB.batch=async()=>{throw Error('Injected disposable D1 read failure');};
 try{
  const unavailable=await api.GET();
  equal(unavailable.status,503);
  equal(unavailable.headers.get('cache-control'),'private, no-store');
  equal(unavailable.headers.get('vary'),'Cookie');
  equal(unavailable.headers.get('x-content-type-options'),'nosniff');
  equal((await unavailable.json()).error,'Dashboard could not be verified. Retry when records are available.');
 }finally{env.DB.batch=normalBatch;}
 // The dashboard only renders eight recent jobs. The completed count must
 // still include every completed database record rather than those eight.
 seed({status:'completed'});
 for(let i=0;i<12;i++)db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,'c','completed',10000,10000,5000,?)").run('older-'+i,'2026-10-'+String(i+1).padStart(2,'0'));
 const completedHome=dashboardFrom(await home.default()),completedSummary=await (await api.GET()).json();
 equal(completedHome.props.metrics.completedJobs,13);
 equal(completedSummary.completedJobs,13);
 equal(completedSummary.recent.length,8);
 equal(completedHome.props.estimates.length,8);
 // Once permanent numbers are approved, two completed quote revisions are
 // still one completed JOB in BOTH the server-rendered Home and refreshed API.
 // This is a disposable in-memory fixture; no hosted migration is applied.
 // The real immutable Job-number read joins BOTH root rows and links,
 // including exact root.created_at. The old fixture created only links and
 // falsely failed before exercising the current production route.
 db.exec("CREATE TABLE fire_job_numbers(job_number INTEGER PRIMARY KEY,root_estimate_id TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL)");
 db.exec("CREATE TABLE fire_job_estimate_links(estimate_id TEXT PRIMARY KEY,job_number INTEGER NOT NULL)");
 db.exec(`CREATE TRIGGER fire_job_numbers_no_update BEFORE UPDATE ON fire_job_numbers BEGIN SELECT RAISE(ABORT,'immutable'); END;
   CREATE TRIGGER fire_job_numbers_no_delete BEFORE DELETE ON fire_job_numbers BEGIN SELECT RAISE(ABORT,'immutable'); END;
   CREATE TRIGGER fire_job_estimate_links_no_update BEFORE UPDATE ON fire_job_estimate_links BEGIN SELECT RAISE(ABORT,'immutable'); END;
   CREATE TRIGGER fire_job_estimate_links_no_delete BEFORE DELETE ON fire_job_estimate_links BEGIN SELECT RAISE(ABORT,'immutable'); END;`);
 db.prepare("INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) SELECT 1,id,created_at FROM estimates WHERE id='e'").run();
 db.prepare("INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES('e',1)").run();
 db.prepare("INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES('older-0',1)").run();
 for(let i=1;i<12;i++){
  const root='older-'+i;
  db.prepare("INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) SELECT ?,id,created_at FROM estimates WHERE id=?").run(i+1,root);
  db.prepare("INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES(?,?)").run(root,i+1);
 }
 env.FIRE_JOB_NUMBERS_CANDIDATE='owner-approved-schema-v1';
 const enabledHome=dashboardFrom(await home.default()),enabledSummary=await (await api.GET()).json();
 equal(enabledHome.props.metrics.completedJobs,12);
 equal(enabledSummary.completedJobs,12);
 assertPrivateMetricsResponse(await api.GET(),'owner');
 // Feature disabled: full historical completed estimate count is still correct.
 env.FIRE_JOB_NUMBERS_CANDIDATE=undefined;
 equal(dashboardFrom(await home.default()).props.metrics.completedJobs,13);
 equal((await (await api.GET()).json()).completedJobs,13);
 // A long-running business can have many older quotes booked in the future:
 // only eight newest quotes are shown as recent, but every future booking counts
 // and the earliest is the Next Job. No invented dates or hosted changes.
 seed({status:'completed'});
 for(let i=0;i<31;i++){
  const id='future-'+String(i).padStart(2,'0'),day=String(i+1).padStart(2,'0');
  db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,scheduled_at,created_at) VALUES(?,'c','scheduled',2500,2500,1250,?,?)")
    .run(id,'2099-12-'+day+'T14:00:00Z','2026-09-'+String(i%28+1).padStart(2,'0'));
 }
 const futureHome=dashboardFrom(await home.default()),futureApi=await (await api.GET()).json();
 equal(futureHome.props.metrics.upcomingCount,31);
 equal(futureApi.upcomingCount,31);
 equal(futureHome.props.metrics.upcomingJobs.length,25);
 equal(futureApi.upcomingJobs.length,25);
 equal(futureApi.upcomingJobs[0].id,'future-00');
 equal(futureHome.props.metrics.upcomingJobs[0].id,'future-00');
 equal(futureApi.recent.length,8);
 equal(futureHome.props.estimates.length,8);
 user=null;assertPrivateMetricsResponse(await api.GET(),'unauthorized');user={email:'other@example.test',fullName:'Other'};assertPrivateMetricsResponse(await api.GET(),'unauthorized');equal((await home.default()).type,'main');
 console.log(`PASS ${checks}/${checks}: initial page and refreshed API agree for draft/sent/declined, deposit due, revised invoice, principal/tip/refund, overpayment, pending/failed payment and full refund; whole-database completed counts beyond the eight displayed cards; owner access preserved. Synthetic SQLite only.`);
}finally{db.close();}
