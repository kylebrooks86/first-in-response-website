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
async function load(path){let source=readFileSync(root+'/'+path,'utf8').replace(/^import .*?;\n/gm,'');source=source.replace(/async function authorized\(\) \{[\s\S]*?\n\}/,'async function authorized(){return true;}');if(path.includes('payments/route'))source=readFileSync(root+'/lib/processing-fees.ts','utf8')+'\n'+source;if(path.includes('refund/route'))source='const finalizeRefund=globalThis.__refundFinalize;const recordRefundUpdate=globalThis.__refundUpdate;\n'+source;if(path.includes('webhook'))source='const recordRefundUpdate=globalThis.__refundUpdate;\n'+source;if(path.includes('webhook'))source='const reconcileStripeCheckout=globalThis.__feeReconcile;\n'+source;source='const env={DB:globalThis.__feeTestDB,STRIPE_WEBHOOK_SECRET:"whsec_test_fixture"};const getOwnerUser=async()=>({email:"kylebrooks8605@gmail.com"});const getChatGPTUser=getOwnerUser;\n'+source;const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));}
const refunds=await load('lib/stripe-refunds.ts');globalThis.__refundFinalize=refunds.finalizeRefund;globalThis.__refundUpdate=refunds.recordRefundUpdate;
const route=await load('app/api/payments/route.ts');
const backup=await load('app/api/backup/route.ts');
let n=0;
function job(total=7500,status='completed',deposit=Math.round(total/2)){const id='job-'+(++n),customer='customer-'+n;sql.prepare("INSERT INTO customers (id,name,created_at) VALUES (?,?,'2026-10-07')").run(customer,'Test');sql.prepare("INSERT INTO estimates (id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,share_token,created_at) VALUES (?,?,?,?,0,?,?,?,'2026-10-07')").run(id,customer,status,total,total,deposit,id);sql.prepare("INSERT INTO invoices (id,estimate_id,customer_id,status,total_cents,created_at) VALUES (?,?,?,'sent',?,'2026-10-07')").run('inv-'+n,id,customer,total);return id;}
async function pay(id,amountCents,method='Cash App',processingFeeCents,tipCents=0){return route.POST(new Request('https://test/api/payments',{method:'POST',body:JSON.stringify({estimateId:id,amountCents,method,processingFeeCents,tipCents})}));}
function rows(id){return sql.prepare('SELECT * FROM payments WHERE estimate_id=? ORDER BY rowid').all(id);}
function principal(id){return Number(sql.prepare("SELECT COALESCE(SUM(amount_cents),0) amount FROM payments WHERE estimate_id=? AND status='paid' AND type NOT IN ('Tip','Tip Refund')").get(id).amount);}
const a=job();assert.equal((await pay(a,7500,'Cash App',210)).status,201);assert.equal(principal(a),7500);assert.equal(rows(a)[0].gross_received_cents-rows(a)[0].processing_fee_cents,7290);
const b=job(10000);assert.equal((await pay(b,10000,'Venmo',200)).status,201);assert.equal(principal(b),10000);assert.equal(rows(b)[0].gross_received_cents-rows(b)[0].processing_fee_cents,9800);
const c=job();assert.equal((await pay(c,7500)).status,201);assert.equal(rows(c)[0].processing_fee_cents,null);
const d=job(10000);assert.equal((await pay(d,4000,'Cash App',100)).status,201);assert.equal(principal(d),4000);assert.equal(sql.prepare('SELECT status FROM invoices WHERE estimate_id=?').get(d).status,'partial');
const e=job(10000);assert.equal((await pay(e,10000,'Cash App',300,1000)).status,201);assert.equal(principal(e),10000);assert.equal(rows(e).find(r=>r.type==='Tip').amount_cents,1000);assert.equal(rows(e)[0].gross_received_cents,11000);assert.equal(rows(e)[0].gross_received_cents-rows(e)[0].processing_fee_cents,10700);
const f=job(15000,'approved',7500);assert.equal((await pay(f,7500,'Cash App',210)).status,201);assert.equal(principal(f),7500);assert.equal((await pay(f,0,'Cash App',0,100)).status,409);
const g=job(7500);assert.equal((await pay(g,8000,'Cash App',500)).status,400);assert.equal(rows(g).length,0);
// Exercise the existing DR refund endpoint when present; no processor request is made.
if(readdirSync(root+'/app/api/payments').includes('refund')) {
 const refundRoute=await load('app/api/payments/refund/route.ts');
 const response=await refundRoute.POST(new Request('https://test/api/payments/refund',{method:'POST',body:JSON.stringify({paymentId:rows(b)[0].id,requestId:'fee-refund',amountCents:2000,externalRefundConfirmed:true})}));
 assert.equal(response.status,200,await response.text());assert.equal(principal(b),8000);assert.equal(rows(b)[0].processing_fee_cents,200);
}
// Refund ledger remains principal only; processor expense remains original, not assumed returned.
sql.prepare("INSERT INTO payments (id,estimate_id,type,amount_cents,status,created_at) VALUES ('refund',?,'Refund',-2500,'paid','2026-10-07')").run(a);assert.equal(principal(a),5000);assert.equal(rows(a)[0].processing_fee_cents,210);
const invoiceRoute=await load('app/api/invoices/[id]/route.ts');
const invoice=sql.prepare('SELECT id FROM invoices WHERE estimate_id=?').get(d);
const revisionResponse=await invoiceRoute.PATCH(new Request('https://test/api/invoices/x',{method:'PATCH',body:JSON.stringify({items:[{name:'Test service',quantity:1,unit:'job',totalCents:15000}],discountType:'dollar',discountValue:0})}),{params:Promise.resolve({id:invoice.id})});
assert.equal(revisionResponse.status,200,await revisionResponse.text());assert.equal(rows(d)[0].processing_fee_cents,100);assert.equal(sql.prepare('SELECT COUNT(*) n FROM invoice_revisions WHERE invoice_id=?').get(invoice.id).n,1);
// Invoice revision changes only balance, not gross or fee records.
sql.prepare('UPDATE invoices SET total_cents=9000 WHERE estimate_id=?').run(a);assert.equal(principal(a),5000);assert.equal(rows(a)[0].gross_received_cents,7500);
assert.equal((await pay(job(),7500,'Cash App',7501)).status,400);assert.equal((await pay(job(),7500,'Cash',210)).status,400);
// Signed Stripe event + retry retain idempotency, ignore manual tips in principal math.
const stripeJob=job(10000);await pay(stripeJob,0,'Cash App',10,500);
sql.prepare("INSERT INTO payment_checkout_sessions (id,estimate_id,type,amount_cents,status,created_at) VALUES ('cs_fee_test',?,'balance',10000,'open','2026-10-07')").run(stripeJob);
globalThis.__feeReconcile=(await load('lib/stripe-payments.ts')).reconcileStripeCheckout;
const webhook=await load('app/api/payments/webhook/route.ts');
const event=JSON.stringify({type:'checkout.session.completed',data:{object:{id:'cs_fee_test',payment_status:'paid',amount_total:10000,metadata:{estimate_id:stripeJob,payment_type:'balance',expected_amount_cents:'10000',expected_tip_cents:'0'}}}});
const timestamp=Math.floor(Date.now()/1000);const signature=createHmac('sha256','whsec_test_fixture').update(timestamp+'.'+event).digest('hex');
for(let i=0;i<2;i++){const response=await webhook.POST(new Request('https://test/api/payments/webhook',{method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${signature}`},body:event}));assert.equal(response.status,200,await response.text());}
assert.equal(principal(stripeJob),10000);assert.equal(rows(stripeJob).filter(r=>r.provider_id==='cs_fee_test').length,1);assert.equal(sql.prepare("SELECT status FROM payment_checkout_sessions WHERE id='cs_fee_test'").get().status,'paid');assert.equal(sql.prepare("SELECT COUNT(*) n FROM notifications WHERE estimate_id=? AND type='payment_overage'").get(stripeJob).n,0);
const exported=await (await backup.GET()).json();assert.equal(exported.tables.payments.find(r=>r.estimate_id===e&&r.type==='Cash App').processing_fee_cents,300);
// Restore in an empty database, preserving all three accounting dimensions.
sql.exec('PRAGMA foreign_keys=OFF');for(const table of Object.keys(exported.tables).reverse()){sql.exec('DELETE FROM '+table);}sql.exec('PRAGMA foreign_keys=ON');
const restored=await backup.POST(new Request('https://test/api/backup',{method:'POST',body:JSON.stringify(exported)}));assert.equal(restored.status,200,await restored.text());assert.equal(rows(e)[0].processing_fee_cents,300);assert.equal(rows(e)[0].gross_received_cents,11000);assert.equal(principal(e),10000);
const legacy=structuredClone(exported);for(const r of legacy.tables.payments){delete r.processing_fee_cents;delete r.gross_received_cents;delete r.bundled_tip_cents;delete r.processing_method;}const legacyResponse=await backup.POST(new Request('https://test/api/backup',{method:'POST',body:JSON.stringify(legacy)}));assert.equal(legacyResponse.status,200,await legacyResponse.text());
// Malformed relationships/conflicting saved financial values reject before writes.
const beforeInvalid=JSON.stringify((await (await backup.GET()).json()).tables);
for(const [mutate,status] of [
 [x=>x.tables.estimates.push({...x.tables.estimates[0],id:'orphan-estimate',customer_id:'missing-customer',share_token:'orphan-token'}),400],
 [x=>x.tables.payments.push({...x.tables.payments[0],id:'orphan-payment',estimate_id:'missing-estimate',provider_id:null}),400],
 [x=>{x.tables.payments[0].amount_cents+=1;x.tables.payments[0].gross_received_cents=null;x.tables.payments[0].processing_fee_cents=null;},409],
 [x=>{x.tables.customers[0].name='Conflicting name';},409],
]){
 const invalid=structuredClone((await (await backup.GET()).json()));mutate(invalid);
 const response=await backup.POST(new Request('https://test/api/backup',{method:'POST',body:JSON.stringify(invalid)}));
 assert.equal(response.status,status,await response.text());
 assert.equal(JSON.stringify((await (await backup.GET()).json()).tables),beforeInvalid);
}
console.log('PASS: Cash App, Venmo, no fee, partial, tip + fee, deposit, overpayment rejection, refund ledger, invoice revision, backup/restore, legacy backup, invalid fees, orphan relationships and target conflicts rejected without writes.');
