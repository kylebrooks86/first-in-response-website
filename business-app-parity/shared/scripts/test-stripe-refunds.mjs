import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
import ts from 'typescript';
const root=resolve(process.argv[2]||'.');
const sql=new DatabaseSync(':memory:');
for(const file of readdirSync(root+'/drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(root+'/drizzle/'+file,'utf8'));
const DB={prepare(query){return {args:[],bind(...args){this.args=args;return this;},async first(){return sql.prepare(query).get(...this.args)||null;},async all(){return {results:sql.prepare(query).all(...this.args)};},async run(){return {meta:{changes:Number(sql.prepare(query).run(...this.args).changes)}}},query};},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements){const stmt=sql.prepare(s.query);results.push(/^\s*SELECT/i.test(s.query)?{results:stmt.all(...s.args)}:{meta:{changes:Number(stmt.run(...s.args).changes)}});}sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
globalThis.__feeTestDB=DB;
async function load(path){let source=readFileSync(root+'/'+path,'utf8').replace(/^import .*?;\n/gm,'');source=source.replace(/async function authorized\(\) \{[\s\S]*?\n\}/,'async function authorized(){return true;}');if(path.includes('payments/route'))source=readFileSync(root+'/lib/processing-fees.ts','utf8')+'\n'+source;if(path.includes('refund/route'))source='const finalizeRefund=globalThis.__refundFinalize;const recordRefundUpdate=globalThis.__refundUpdate;\n'+source;if(path.includes('webhook'))source='const recordRefundUpdate=globalThis.__refundUpdate;\n'+source;if(path.includes('webhook'))source='const reconcileStripeCheckout=globalThis.__feeReconcile;\n'+source;source='const env={DB:globalThis.__feeTestDB,STRIPE_WEBHOOK_SECRET:"whsec_test_fixture",STRIPE_RESTRICTED_KEY:"sk_test_fixture"};const getOwnerUser=async()=>globalThis.__unauthorized?null:({email:"kylebrooks8605@gmail.com"});const getChatGPTUser=getOwnerUser;\n'+source;const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));}
const refunds=await load('lib/stripe-refunds.ts');globalThis.__refundFinalize=refunds.finalizeRefund;globalThis.__refundUpdate=refunds.recordRefundUpdate;

const route=await load('app/api/payments/refund/route.ts');
const webhook=await load('app/api/payments/webhook/route.ts');
const backup=await load('app/api/backup/route.ts');
let count=0,posts=0,failOnce=false,pending=false,networkOnce=false;
const remote=new Map(),sessions=new Map();
globalThis.fetch=async(url,opts={})=>{
 if(url.includes('/checkout/sessions?'))return Response.json({data:[{id:'cs_external'}]});
 if(url.includes('/checkout/sessions/'))return Response.json({id:url.split('/').at(-1),livemode:false,payment_intent:'pi_fixture'});
 if(url.includes('/refunds/')){const x=[...remote.values()].find(v=>v.id===url.split('/').at(-1));return Response.json(x||{error:'missing'},{status:x?200:404});}
 assert.equal(url,'https://api.stripe.com/v1/refunds');posts++;
 const key=opts.headers['idempotency-key'],body=new URLSearchParams(opts.body);
 let result=remote.get(key);if(!result){result={id:'re_'+(++count),amount:Number(body.get('amount')),status:pending?'pending':'succeeded',payment_intent:'pi_fixture',metadata:{fire_refund_id:body.get('metadata[fire_refund_id]'),fire_payment_id:body.get('metadata[fire_payment_id]')}};remote.set(key,result);}
 if(networkOnce){networkOnce=false;throw new Error('transport lost after Stripe accepted');}
 if(failOnce){failOnce=false;return Response.json({error:{message:'temporarily unavailable'}},{status:500});}
 return Response.json(result);
};
let n=0;
function fixture(amount=10000,tip=1000,provider){const id='job-'+(++n);sql.prepare("INSERT INTO customers(id,name,created_at) VALUES (?, 'Synthetic QA','2026-10-08')").run(id);sql.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES (?,?,'completed',?,?,?,'2026-10-08')").run(id,id,amount,amount,Math.round(amount/2));sql.prepare("INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,created_at) VALUES (?,?,?,'paid',?,'2026-10-08')").run(id,id,id,amount);sql.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES (?,?,'balance',?,'paid',?,'2026-10-08')").run('p-'+id,id,amount,provider||'cs_'+id);if(tip)sql.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES (?,?,'Tip',?,'paid',?,'2026-10-08')").run('t-'+id,id,tip,(provider||'cs_'+id)+':tip');return id;}
const principal=id=>Number(sql.prepare("SELECT SUM(amount_cents) a FROM payments WHERE estimate_id=? AND type NOT IN ('Tip','Tip Refund')").get(id).a);
const tipTotal=id=>Number(sql.prepare("SELECT COALESCE(SUM(amount_cents),0) a FROM payments WHERE estimate_id=? AND type IN ('Tip','Tip Refund')").get(id).a);
const refund=(paymentId,requestId,amountCents,more={})=>route.POST(new Request('https://test/api/payments/refund',{method:'POST',body:JSON.stringify({paymentId,requestId,amountCents,...more})}));
async function event(object,type='refund.updated'){const body=JSON.stringify({type,livemode:false,data:{object}}),t=Math.floor(Date.now()/1000);const h=createHmac('sha256','whsec_test_fixture').update(t+'.'+body).digest('hex');return webhook.POST(new Request('https://test/api/payments/webhook',{method:'POST',headers:{'stripe-signature':`t=${t},v1=${h}`},body}));}
const id=fixture();const r=await refund('p-'+id,'partial',2500);assert.equal(r.status,200,await r.text());assert.equal(principal(id),7500);assert.equal(tipTotal(id),1000);assert.equal(sql.prepare('SELECT status FROM invoices WHERE id=?').get(id).status,'partial');
const stripe=remote.get('fire-refund-partial');const sent=posts;
assert.equal((await refund('p-'+id,'partial',2500)).status,200);assert.equal(posts,sent);
for(let i=0;i<3;i++)assert.equal((await event(stripe)).status,200);assert.equal(principal(id),7500);assert.equal(sql.prepare("SELECT COUNT(*) n FROM payments WHERE provider_id='refund:p-job-1:partial'").get().n,1);
assert.equal((await refund('p-'+id,'partial',2501)).status,409);
assert.equal((await refund('p-'+id,'limit',7501)).status,409);assert.equal(posts,sent);
assert.equal((await event({...stripe,amount:2501})).status,409);assert.equal((await event({...stripe,id:'re_other'})).status,409);assert.equal(principal(id),7500);
assert.equal((await refund('t-'+id,'tip-only',500)).status,200);assert.equal(principal(id),7500);assert.equal(tipTotal(id),500);
assert.equal((await refund('t-'+id,'tip-limit',501)).status,409);
const retry=fixture(7500,0);failOnce=true;assert.equal((await refund('p-'+retry,'retry',2100)).status,503);assert.equal(principal(retry),7500);assert.equal(sql.prepare("SELECT status FROM payment_refunds WHERE id='retry'").get().status,'pending');assert.equal((await refund('p-'+retry,'too-much',6000)).status,409);
assert.equal((await refund('p-'+retry,'retry',2100)).status,200);assert.equal(principal(retry),5400);assert.equal([...remote.keys()].filter(k=>k==='fire-refund-retry').length,1);
const lost=fixture(5000,0);networkOnce=true;assert.equal((await refund('p-'+lost,'lost',1000)).status,500);assert.equal((await refund('p-'+lost,'lost',1000)).status,200);assert.equal(principal(lost),4000);
const pend=fixture(9000,0);pending=true;assert.equal((await refund('p-'+pend,'pending',2000)).status,202);assert.equal(principal(pend),9000);pending=false;remote.get('fire-refund-pending').status='succeeded';assert.equal((await event(remote.get('fire-refund-pending'))).status,200);assert.equal((await refund('p-'+pend,'pending',2000)).status,200);assert.equal(principal(pend),7000);
const rollback=fixture(10000,0);sql.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON payments WHEN NEW.type='Refund' BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");assert.equal((await refund('p-'+rollback,'rollback',1000)).status,500);assert.equal(principal(rollback),10000);sql.exec('DROP TRIGGER fixture_failure');assert.equal((await event(remote.get('fire-refund-rollback'))).status,200);assert.equal(principal(rollback),9000);
const manual=fixture(7500,0,'cash-app-reference');sql.prepare("UPDATE payments SET type='Cash App',processing_fee_cents=210,gross_received_cents=7500,bundled_tip_cents=0,processing_method='Cash App' WHERE id=?").run('p-'+manual);assert.equal((await refund('p-'+manual,'manual',2000)).status,409);const beforePosts=posts;assert.equal((await refund('p-'+manual,'manual',2000,{externalRefundConfirmed:true})).status,200);assert.equal(principal(manual),5500);assert.equal(posts,beforePosts);assert.equal(sql.prepare('SELECT processing_fee_cents f FROM payments WHERE id=?').get('p-'+manual).f,210);
const external=fixture(10000,1000,'cs_external');assert.equal((await event({id:'re_external',amount:2000,status:'succeeded',payment_intent:'pi_fixture'})).status,200);assert.equal((await event({id:'re_external',amount:2000,status:'succeeded',payment_intent:'pi_fixture'})).status,200);assert.equal(principal(external),8000);assert.equal(tipTotal(external),1000);assert.equal((await event({id:'re_ambiguous',amount:8500,status:'succeeded',payment_intent:'pi_fixture'})).status,409);
// Concurrent API attempts reserve the same original payment budget atomically.
const concurrent=fixture(5000,0);const pair=await Promise.all([refund('p-'+concurrent,'c1',4000),refund('p-'+concurrent,'c2',4000)]);assert.deepEqual(pair.map(x=>x.status).sort(),[200,409]);assert.equal(principal(concurrent),1000);
for(const invalid of [0,-1,1.1,'100',null])assert.equal((await refund('p-'+id,'bad-'+String(invalid),invalid)).status,400);
const legacy=fixture(10000,0);sql.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES ('legacy-refund',?,'Refund',-9000,'paid','2026-10-08')").run(legacy);assert.equal((await refund('p-'+legacy,'legacy-limit',1001)).status,409);
const stale=fixture(5000,0);sql.prepare("INSERT INTO payment_refunds(id,payment_id,estimate_id,amount_cents,mode,status,created_at) VALUES ('stale',?,?,1000,'stripe','pending','2026-01-01')").run('p-'+stale,stale);const stalePosts=posts;assert.equal((await refund('p-'+stale,'stale',1000)).status,409);assert.equal(posts,stalePosts);
assert.equal((await webhook.POST(new Request('https://test/api/payments/webhook',{method:'POST',headers:{'stripe-signature':'t=1,v1=invalid'},body:'{}'}))).status,400);
globalThis.__unauthorized=true;assert.equal((await refund('p-'+id,'unauthorized',100)).status,401);globalThis.__unauthorized=false;
// A succeeded replay repairs a missing acknowledgement, but rejects a wrong ledger/job.
const repaired=fixture(5000,0);assert.equal((await refund('p-'+repaired,'repair',1000)).status,200);
const repairEvent=remote.get('fire-refund-repair');
sql.prepare("DELETE FROM payments WHERE provider_id=?").run('refund:p-'+repaired+':repair');
assert.equal((await event(repairEvent)).status,200);assert.equal(principal(repaired),4000);
sql.prepare("UPDATE payments SET estimate_id=? WHERE provider_id=?").run(id,'refund:p-'+repaired+':repair');
assert.equal((await event(repairEvent)).status,409);
sql.prepare("UPDATE payments SET estimate_id=? WHERE provider_id=?").run(repaired,'refund:p-'+repaired+':repair');
assert.equal((await event({...repairEvent,status:'pending'})).status,200);
assert.equal((await event({...repairEvent,status:'failed'})).status,200);
assert.equal(sql.prepare("SELECT status FROM payment_refunds WHERE id='repair'").get().status,'succeeded');
assert.equal(principal(repaired),4000);
for(const [column,value,original] of [['type','Tip Refund','Refund'],['amount_cents',-999,-1000],['status','pending','paid']]){
 sql.prepare(`UPDATE payments SET ${column}=? WHERE provider_id=?`).run(value,'refund:p-'+repaired+':repair');
 const snapshot=JSON.stringify(sql.prepare('SELECT * FROM payments ORDER BY id').all());
 assert.equal((await event(repairEvent)).status,409);
 assert.equal(JSON.stringify(sql.prepare('SELECT * FROM payments ORDER BY id').all()),snapshot);
 sql.prepare(`UPDATE payments SET ${column}=? WHERE provider_id=?`).run(original,'refund:p-'+repaired+':repair');
}
// Exercise historical duplicate detection without the new index in this disposable DB.
const providerIndexes=sql.prepare("SELECT name,sql FROM sqlite_master WHERE type='index' AND tbl_name='payments' AND sql LIKE '%provider_id%' AND sql LIKE '%UNIQUE%'").all();
for(const index of providerIndexes)sql.exec(`DROP INDEX "${index.name}"`);
sql.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES('duplicate-ledger',?,'Refund',-1000,'paid',?,'now')").run(repaired,'refund:p-'+repaired+':repair');
assert.equal((await event(repairEvent)).status,409);
assert.equal(sql.prepare("SELECT COUNT(*) n FROM payments WHERE provider_id=?").get('refund:p-'+repaired+':repair').n,2);
sql.prepare("DELETE FROM payments WHERE id='duplicate-ledger'").run();
for(const index of providerIndexes)sql.exec(index.sql);
const linked=fixture(5000,0);sql.prepare("INSERT INTO payment_refunds(id,payment_id,estimate_id,amount_cents,mode,status,provider_refund_id,created_at) VALUES ('wrong-job',?,?,1000,'stripe','succeeded','re_wrong_job','now')").run('p-'+linked,id);
assert.equal((await refunds.finalizeRefund(DB,'wrong-job','re_wrong_job')).ok,false);
sql.prepare("DELETE FROM payment_refunds WHERE id='wrong-job'").run();
const exported=await (await backup.GET()).json();assert.ok(exported.tables.payment_refunds.length>0);const ledgerSnapshot=JSON.stringify(sql.prepare('SELECT * FROM payments ORDER BY id').all());const requestsSnapshot=JSON.stringify(sql.prepare('SELECT * FROM payment_refunds ORDER BY id').all());
sql.exec('DELETE FROM payment_refunds;DELETE FROM payments;');const restored=await backup.POST(new Request('https://test/api/backup',{method:'POST',body:JSON.stringify(exported)}));assert.equal(restored.status,200,await restored.text());assert.equal(JSON.stringify(sql.prepare('SELECT * FROM payments ORDER BY id').all()),ledgerSnapshot);assert.equal(JSON.stringify(sql.prepare('SELECT * FROM payment_refunds ORDER BY id').all()),requestsSnapshot);
delete exported.tables.payment_refunds;assert.equal((await backup.POST(new Request('https://test/api/backup',{method:'POST',body:JSON.stringify(exported)}))).status,200);
console.log('PASS: partial per-payment Stripe refunds; repeat API requests; duplicate/signed webhooks; altered amount/provider rejection; pending-to-success reconciliation; Stripe 500 and lost-response retries reuse idempotency key; atomic rollback/recovery; concurrent limits; tip separation; manual refund confirmation and fee preservation; imported external refunds; backup/restore and legacy backup compatibility. Only in-memory SQLite and mocked Stripe used.');
