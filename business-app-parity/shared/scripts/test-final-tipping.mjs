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
async function load(path){let source=readFileSync(root+'/'+path,'utf8').replace(/^import .*?;\n/gm,'');source=source.replace(/async function authorized\(\) \{[\s\S]*?\n\}/,'async function authorized(){return true;}');if(path.includes('payments/route'))source=readFileSync(root+'/lib/processing-fees.ts','utf8')+'\n'+source;if(path.includes('refund/route'))source='const finalizeRefund=globalThis.__refundFinalize;const recordRefundUpdate=globalThis.__refundUpdate;\n'+source;if(path.includes('webhook'))source='const recordRefundUpdate=globalThis.__refundUpdate;\n'+source;if(path.includes('webhook'))source='const reconcileStripeCheckout=globalThis.__feeReconcile;\n'+source;source='const env={DB:globalThis.__feeTestDB,STRIPE_WEBHOOK_SECRET:"whsec_test_fixture",STRIPE_RESTRICTED_KEY:"sk_fixture"};const getOwnerUser=async()=>({email:"kylebrooks8605@gmail.com"});const getChatGPTUser=getOwnerUser;\n'+source;const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));}
const refunds=await load('lib/stripe-refunds.ts');globalThis.__refundFinalize=refunds.finalizeRefund;globalThis.__refundUpdate=refunds.recordRefundUpdate;
const route=await load('app/api/payments/route.ts');
const backup=await load('app/api/backup/route.ts');
let n=0;
function job(total=7500,status='completed',deposit=Math.round(total/2)){const id='job-'+(++n),customer='customer-'+n;sql.prepare("INSERT INTO customers (id,name,created_at) VALUES (?,?,'2026-10-07')").run(customer,'Test');sql.prepare("INSERT INTO estimates (id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,share_token,created_at) VALUES (?,?,?,?,0,?,?,?,'2026-10-07')").run(id,customer,status,total,total,deposit,id);sql.prepare("INSERT INTO invoices (id,estimate_id,customer_id,status,total_cents,created_at) VALUES (?,?,?,'sent',?,'2026-10-07')").run('inv-'+n,id,customer,total);return id;}
async function pay(id,amountCents,method='Cash App',processingFeeCents,tipCents=0){return route.POST(new Request('https://test/api/payments',{method:'POST',body:JSON.stringify({estimateId:id,amountCents,method,processingFeeCents,tipCents})}));}
function rows(id){return sql.prepare('SELECT * FROM payments WHERE estimate_id=? ORDER BY rowid').all(id);}
function principal(id){return Number(sql.prepare("SELECT COALESCE(SUM(amount_cents),0) amount FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").get(id).amount);}
const shared=await load('lib/stripe-payments.ts');globalThis.__feeReconcile=shared.reconcileStripeCheckout;
const webhook=await load('app/api/payments/webhook/route.ts');const checkout=await load('app/api/payments/checkout/route.ts');
let nextSession=0,lastForm;const sessions=new Map();let simulateChange=false;
globalThis.fetch=async(url,options={})=>{
 if(String(url)==='https://api.stripe.com/v1/checkout/sessions'){
  lastForm=new URLSearchParams(options.body);const id=`cs_tip_${++nextSession}`;
  const metadata=Object.fromEntries([...lastForm].filter(([key])=>key.startsWith('metadata[')).map(([key,value])=>[key.slice(9,-1),value]));
  const session={id,metadata,client_reference_id:lastForm.get('client_reference_id'),payment_status:'paid',amount_total:Number(metadata.expected_charge_cents)};sessions.set(id,session);
  if(simulateChange)sql.prepare('UPDATE invoices SET total_cents=total_cents+1000 WHERE estimate_id=?').run(metadata.estimate_id);
  return Response.json({id,url:`https://checkout.stripe.com/${id}`});
 }
 const match=String(url).match(/sessions\/(cs_tip_\d+)(\/expire)?$/);
 if(match)return Response.json(match[2]?{status:'expired'}:sessions.get(match[1]));
 throw new Error('Unexpected network call '+url);
};
const request=body=>new Request('https://fixture/api/payments/checkout',{method:'POST',body:JSON.stringify(body)});
async function signed(session,type='checkout.session.completed'){
 const body=JSON.stringify({type,data:{object:session}}),timestamp=Math.floor(Date.now()/1000);
 const signature=createHmac('sha256','whsec_test_fixture').update(`${timestamp}.${body}`).digest('hex');
 return webhook.POST(new Request('https://fixture/api/payments/webhook',{method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${signature}`},body}));
}
// Full invoice $200 with a $100 prior deposit; tips use the full invoice, not remaining balance.
for(const tip of [0,1000,2000,3000,2345]){
 const id=job(20000);await pay(id,10000,'Cash');
 const response=await checkout.POST(request({shareToken:id,paymentType:'balance',tipCents:tip}));assert.equal(response.status,200,await response.text());
 assert.equal(lastForm.get('line_items[0][price_data][unit_amount]'),'10000');assert.equal(lastForm.get('line_items[1][price_data][unit_amount]'),tip?String(tip):null);
 const session=sessions.get(`cs_tip_${nextSession}`);
 assert.equal(sql.prepare('SELECT amount_cents FROM payment_checkout_sessions WHERE id=?').get(session.id).amount_cents,10000+tip);
 // Webhook, async retry and success-page reconciliation share the same ledger.
 assert.equal((await signed(session)).status,200);assert.equal((await signed(session,'checkout.session.async_payment_succeeded')).status,200);
 assert.equal((await shared.recordStripeCheckoutSession(DB,session)).recorded,true);
 assert.equal(principal(id),20000);assert.equal(rows(id).filter(r=>r.provider_id===session.id).length,1);assert.equal(rows(id).filter(r=>r.provider_id===session.id+':tip').length,tip?1:0);
 assert.equal(sql.prepare('SELECT status FROM invoices WHERE estimate_id=?').get(id).status,'paid');
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM notifications WHERE estimate_id=? AND type='payment_overage'").get(id).n,0);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM notifications WHERE estimate_id=? AND type='payment_received' AND id LIKE 'stripe-payment:%'").get(id).n,1);
 if(tip){
  sql.prepare("INSERT INTO payments (id,estimate_id,type,amount_cents,status,created_at) VALUES (?,?,'Tip Refund',?,'paid','2026-10-08')").run('tip-refund-'+id,id,-tip);assert.equal(principal(id),20000);
 }
}
const deposit=job(20000,'approved',10000);
assert.equal((await checkout.POST(request({shareToken:deposit,paymentType:'deposit',tipCents:500}))).status,400);
assert.equal((await checkout.POST(request({shareToken:deposit,paymentType:'deposit',tipCents:0}))).status,200);
const depositSession=sessions.get(`cs_tip_${nextSession}`);assert.equal((await signed(depositSession)).status,200);assert.equal(principal(deposit),10000);assert.equal(rows(deposit).some(r=>r.type==='Tip'),false);
for(const value of [-1,1.2,'100','bad',null,50001])assert.equal((await checkout.POST(request({shareToken:job(100000),paymentType:'balance',tipCents:value}))).status,400);
assert.equal((await checkout.POST(request({shareToken:job(20000,'approved'),paymentType:'balance',tipCents:0}))).status,409);
const expired=job();sql.prepare("INSERT INTO payment_checkout_sessions (id,estimate_id,type,amount_cents,status,created_at) VALUES ('cs_stale',?,'balance',7500,'expired','2026-10-08')").run(expired);
assert.equal((await signed({id:'cs_stale',payment_status:'paid',amount_total:7500,metadata:{estimate_id:expired,payment_type:'balance',expected_amount_cents:'7500'}})).status,400);assert.equal(rows(expired).length,0);
const changed=job(10000);simulateChange=true;assert.equal((await checkout.POST(request({shareToken:changed,paymentType:'balance',tipCents:1000}))).status,409);simulateChange=false;assert.equal(sql.prepare('SELECT COUNT(*) n FROM payment_checkout_sessions WHERE estimate_id=?').get(changed).n,0);
// Atomicity: force tip insertion to fail; no invoice payment can be stranded.
const atomic=job(10000);assert.equal((await checkout.POST(request({shareToken:atomic,paymentType:'balance',tipCents:1000}))).status,200);const atomicSession=sessions.get(`cs_tip_${nextSession}`);
sql.exec("CREATE TRIGGER tip_test_failure BEFORE INSERT ON payments WHEN NEW.type='Tip' BEGIN SELECT RAISE(ABORT,'fixture tip failure'); END;");
await assert.rejects(()=>shared.reconcileStripeCheckout(DB,atomicSession));assert.equal(rows(atomic).length,0);sql.exec('DROP TRIGGER tip_test_failure');
assert.equal((await signed(atomicSession)).status,200);assert.equal(rows(atomic).length,2);
// Recover follow-up failure without duplicating either ledger row.
const recover=job(10000);assert.equal((await checkout.POST(request({shareToken:recover,paymentType:'balance',tipCents:1000}))).status,200);const recoverSession=sessions.get(`cs_tip_${nextSession}`);
sql.exec("CREATE TRIGGER notice_test_failure BEFORE INSERT ON notifications WHEN NEW.type='payment_received' BEGIN SELECT RAISE(ABORT,'fixture notice failure'); END;");
await assert.rejects(()=>shared.reconcileStripeCheckout(DB,recoverSession));assert.equal(rows(recover).length,2);sql.exec('DROP TRIGGER notice_test_failure');
assert.equal((await signed(recoverSession)).status,200);assert.equal(rows(recover).length,2);assert.equal(sql.prepare('SELECT status FROM invoices WHERE estimate_id=?').get(recover).status,'paid');
// Actual customer PATCH: stable id and creation timestamp; financial/signed records unchanged.
const customerRoute=await load('app/api/customers/route.ts');const customerId=sql.prepare('SELECT customer_id FROM estimates WHERE id=?').get(recover).customer_id;
sql.prepare("UPDATE estimates SET signed_name='Original signer',signed_at='2026-10-07',contract_initials='OS' WHERE id=?").run(recover);
const snapshot=()=>JSON.stringify(['estimates','estimate_items','invoices','invoice_items','payments','invoice_revisions'].map(table=>sql.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()));
const before=snapshot(),count=sql.prepare('SELECT COUNT(*) n FROM customers').get().n;
const edit={id:customerId,name:'Edited Owner',email:'edited@fixture.test',phone:'9185551212',address:'123 A & B St, Tulsa, OK',leadSource:'Referral'};
const edited=await customerRoute.PATCH(new Request('https://fixture/api/customers',{method:'PATCH',body:JSON.stringify(edit)}));assert.equal(edited.status,200,await edited.text());
const updated=sql.prepare('SELECT * FROM customers WHERE id=?').get(customerId);assert.equal(updated.name,edit.name);assert.equal(updated.lead_source,'Referral');assert.equal(updated.created_at,'2026-10-07');assert.equal(count,sql.prepare('SELECT COUNT(*) n FROM customers').get().n);assert.equal(snapshot(),before);
assert.equal((await customerRoute.PATCH(new Request('https://fixture/api/customers',{method:'PATCH',body:JSON.stringify({...edit,name:''})}))).status,400);
assert.equal((await customerRoute.PATCH(new Request('https://fixture/api/customers',{method:'PATCH',body:JSON.stringify({...edit,id:'missing'})}))).status,404);
const other=job();assert.equal((await customerRoute.PATCH(new Request('https://fixture/api/customers',{method:'PATCH',body:JSON.stringify({...edit,id:sql.prepare('SELECT customer_id FROM estimates WHERE id=?').get(other).customer_id})}))).status,409);
assert.equal(snapshot().includes('Original signer'),true);
// Exercise the actual customer success-page confirmer, not just its shared recorder.
let confirmSource=readFileSync(root+'/app/estimate/[token]/page.tsx','utf8');confirmSource=confirmSource.slice(confirmSource.indexOf('async function confirmPayment('),confirmSource.indexOf('export default async function'));
const confirmJs=ts.transpileModule('const env={DB:globalThis.__feeTestDB,STRIPE_RESTRICTED_KEY:"sk_fixture"};const retrieveStripeCheckoutSession=globalThis.__tipRetrieve;const recordStripeCheckoutSession=globalThis.__tipRecord;'+confirmSource+'export {confirmPayment};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
globalThis.__tipRetrieve=shared.retrieveStripeCheckoutSession;globalThis.__tipRecord=shared.recordStripeCheckoutSession;
const confirm=await import('data:text/javascript;base64,'+Buffer.from(confirmJs).toString('base64'));
assert.equal(await confirm.confirmPayment(recoverSession.id,{id:recover}),true);assert.equal(rows(recover).length,2);
assert.equal(await confirm.confirmPayment(recoverSession.id,{id:'wrong'}),false);
assert.equal((await signed({...recoverSession,amount_total:11001})).status,400);
const beforeCount=rows(recover).length;
assert.equal((await webhook.POST(new Request('https://fixture/api/payments/webhook',{method:'POST',headers:{'stripe-signature':'t=1,v1=invalid'},body:'{}'}))).status,400);assert.equal(rows(recover).length,beforeCount);
// Concurrent signed completions: hold both requests after their pre-insert reads.
const concurrent=job(44000);await checkout.POST(request({shareToken:concurrent,paymentType:'balance',tipCents:4400}));const concurrentSession=sessions.get(`cs_tip_${nextSession}`);
const originalBatch=DB.batch.bind(DB);let arrivals=0,release;const barrier=new Promise(resolve=>release=resolve);
DB.batch=async statements=>{if(statements[0].query.includes('INSERT INTO payments')&&statements[0].args.includes(concurrentSession.id)){arrivals++;if(arrivals===2)release();await barrier;}return originalBatch(statements);};
const deliveries=await Promise.all([signed(concurrentSession),signed(concurrentSession)]);DB.batch=originalBatch;
assert.equal(arrivals,2);assert.deepEqual(deliveries.map(r=>r.status),[200,200]);assert.equal(rows(concurrent).length,2);assert.equal(principal(concurrent),44000);assert.equal(rows(concurrent).find(r=>r.type==='Tip').amount_cents,4400);
const concurrentSnapshot=JSON.stringify(rows(concurrent));assert.equal((await signed(concurrentSession)).status,200);assert.equal(JSON.stringify(rows(concurrent)),concurrentSnapshot);
// Mismatched pre-existing principal/tip rows reject before any new ledger write.
for(const kind of ['balance','Tip']){
 const mismatch=job(10000);await checkout.POST(request({shareToken:mismatch,paymentType:'balance',tipCents:1000}));const session=sessions.get(`cs_tip_${nextSession}`);
 const provider=session.id+(kind==='Tip'?':tip':'');sql.prepare("INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES (?,?,?,1,'paid',?,'fixture')").run('bad-'+mismatch,mismatch,kind,provider);
 const snapshot=JSON.stringify(rows(mismatch));const result=await signed(session);assert.equal(result.status,400);assert.match((await result.json()).error,/ledger_verification_failed/);assert.equal(JSON.stringify(rows(mismatch)),snapshot);
}
// A corrupt tip inserted after preflight must also prevent principal insertion.
const raced=job(10000);await checkout.POST(request({shareToken:raced,paymentType:'balance',tipCents:1000}));const raceSession=sessions.get(`cs_tip_${nextSession}`);
DB.batch=async statements=>{if(statements[0].query.includes('INSERT INTO payments')&&statements[0].args.includes(raceSession.id))sql.prepare("INSERT INTO payments (id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES (?,?,'Tip',1,'paid',?,'fixture')").run('bad-race',raced,raceSession.id+':tip');return originalBatch(statements);};
assert.equal((await signed(raceSession)).status,400);DB.batch=originalBatch;assert.equal(rows(raced).length,1);assert.equal(principal(raced),0);
const exported=await (await backup.GET()).json();const tipProvider=recoverSession.id+':tip';assert.equal(exported.tables.payments.find(p=>p.provider_id===tipProvider).type,'Tip');
sql.exec('PRAGMA foreign_keys=OFF');for(const table of Object.keys(exported.tables).reverse())sql.exec('DELETE FROM '+table);sql.exec('PRAGMA foreign_keys=ON');
const restored=await backup.POST(new Request('https://fixture/api/backup',{method:'POST',body:JSON.stringify(exported)}));assert.equal(restored.status,200,await restored.text());assert.equal(rows(recover).length,2);assert.equal(principal(recover),10000);assert.equal(rows(recover).find(p=>p.provider_id===tipProvider).amount_cents,1000);
console.log('PASS: checkout No tip/5/10/15/custom; full-invoice tip base; remaining principal; deposit no-tip/rejection; invalid tips; not-complete rejection; stale session; invoice-change invalidation; signed webhook/async retry/return reconciliation; atomic rollback and retry recovery; Tip Refund separation; customer PATCH identity, history, duplicate and validation guards. No real network or live data used.');
