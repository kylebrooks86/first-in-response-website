import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
import ts from 'typescript';
import { propertyBackupError, hasPropertyBackup } from '../lib/property-backup.mjs';
import { serviceLocationManifest, serviceLocationBackupError } from '../lib/service-location-backup.mjs';
const root=resolve(process.argv[2]||'.');
const sql=new DatabaseSync(':memory:');
for(const file of readdirSync(root+'/drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(root+'/drizzle/'+file,'utf8'));
const DB={prepare(query){return {args:[],bind(...args){this.args=args;return this;},async first(){return sql.prepare(query).get(...this.args)||null;},async all(){return {results:sql.prepare(query).all(...this.args)};},async run(){return {meta:{changes:Number(sql.prepare(query).run(...this.args).changes)}}},query};},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements){const stmt=sql.prepare(s.query);results.push(/^\s*SELECT/i.test(s.query)?{results:stmt.all(...s.args)}:{meta:{changes:Number(stmt.run(...s.args).changes)}});}sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
globalThis.__feeTestDB=DB;
// Exercise the real legacy-backup validators; only the candidate-only
// property/service feature flags remain disabled for this financial fixture.
globalThis.__feeBackupHelpers = {
  propertyBackupError, hasPropertyBackup, serviceLocationManifest, serviceLocationBackupError,
};
async function load(path){let source=readFileSync(root+'/'+path,'utf8').replace(/^import .*?;\n/gm,'');source=source.replace(/async function authorized\(\) \{[\s\S]*?\n\}/,'async function authorized(){return true;}');if(path.includes('payments/route'))source=readFileSync(root+'/lib/processing-fees.ts','utf8')+'\n'+source;if(path==='app/api/backup/route.ts'){
  source=`const serviceLocationsEnabled=(e)=>e.FIRE_SERVICE_LOCATIONS_CANDIDATE==='synthetic-only';
const customerPropertiesEnabled=(e)=>serviceLocationsEnabled(e)&&e.FIRE_CUSTOMER_PROPERTIES_CANDIDATE==='synthetic-only';
const propertyRecoveryTestEnabled=(e)=>customerPropertiesEnabled(e)&&e.FIRE_PROPERTY_RECOVERY_CANDIDATE==='synthetic-tests-only';
const {propertyBackupError,hasPropertyBackup,serviceLocationManifest,serviceLocationBackupError}=globalThis.__feeBackupHelpers;
`+source;
}if(path.includes('refund/route'))source='const finalizeRefund=globalThis.__refundFinalize;const recordRefundUpdate=globalThis.__refundUpdate;\n'+source;if(path.includes('webhook'))source='const recordRefundUpdate=globalThis.__refundUpdate;\n'+source;if(path.includes('webhook'))source='const reconcileStripeCheckout=globalThis.__feeReconcile;\n'+source;source='const LOCAL_CUSTOMER_DEPLOYMENT="'+(path.includes('webhook')?'doomsday':'live')+'";\n'+source;source='const env={DB:globalThis.__feeTestDB,STRIPE_WEBHOOK_SECRET:"whsec_test_fixture"};const getOwnerUser=async()=>({email:"kylebrooks8605@gmail.com"});const getChatGPTUser=getOwnerUser;\n'+source;const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));}
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
// A job with an open or unresolved Stripe Checkout must not accept another
// manual charge: the customer might complete that already-created card link.
const stripeLocked=job(10000);
const reserveStripe=(estimateId,id)=>sql.prepare("INSERT INTO payment_checkout_sessions(id,estimate_id,type,amount_cents,status,created_at) VALUES (?,?,'balance',10000,'open','now')").run(id,estimateId);
reserveStripe(stripeLocked,'cs_test_open_manual_block');
const blockedCash=await pay(stripeLocked,2000,'Cash');
assert.equal(blockedCash.status,409);
assert.equal(rows(stripeLocked).length,0);
const blockedTip=await pay(stripeLocked,0,'Venmo',20,250);
assert.equal(blockedTip.status,409);
assert.equal(rows(stripeLocked).length,0);
const blockedCombo=await pay(stripeLocked,2000,'Venmo',30,100);
assert.equal(blockedCombo.status,409);
assert.equal(rows(stripeLocked).length,0);
// Race injection: the preflight looked clean, but a Stripe reservation was
// inserted before the money INSERT. The SQL itself must reject the payment.
const unguardedPrepare=DB.prepare.bind(DB);
let racingCheckoutPreflight=true;
DB.prepare=(query)=>{
 const stmt=unguardedPrepare(query);
 if(racingCheckoutPreflight&&query.includes("SELECT id FROM payment_checkout_sessions WHERE estimate_id=? AND status='open' LIMIT 1"))stmt.first=async()=>null;
 return stmt;
};
try{
 const cashRace=await pay(stripeLocked,2000,'Cash');
 assert.equal(cashRace.status,409);
 assert.equal(rows(stripeLocked).length,0);
 const tipRace=await pay(stripeLocked,0,'Cash App',20,250);
 assert.equal(tipRace.status,409);
 assert.equal(rows(stripeLocked).length,0);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM notifications WHERE estimate_id=? AND type='tip_received'").get(stripeLocked).n,0);
 const comboRace=await pay(stripeLocked,2000,'Cash App',30,250);
 assert.equal(comboRace.status,409);
 assert.equal(rows(stripeLocked).length,0);
}finally{racingCheckoutPreflight=false;DB.prepare=unguardedPrepare;}
sql.prepare("UPDATE payment_checkout_sessions SET status='expired' WHERE estimate_id=?").run(stripeLocked);
assert.equal((await pay(stripeLocked,2000,'Cash')).status,201);
assert.equal(principal(stripeLocked),2000);

// Client-generated manual payment requests must be replay-safe, even when a
// previous D1 INSERT was committed before its acknowledgement was lost.
const keyedJob=job(10000),paymentRequestId='11111111-1111-4111-8111-111111111111';
const keyedBody={estimateId:keyedJob,requestId:paymentRequestId,amountCents:4000,tipCents:300,method:'Cash App',reference:'synthetic-receipt',processingFeeCents:100};
const sendKeyed=(body)=>route.POST(new Request('https://test/api/payments',{method:'POST',body:JSON.stringify(body)}));
const firstKeyed=await sendKeyed(keyedBody);assert.equal(firstKeyed.status,201,await firstKeyed.text());
assert.equal(rows(keyedJob).length,2);assert.equal(principal(keyedJob),4000);
const repeatKeyed=await sendKeyed(keyedBody);assert.equal(repeatKeyed.status,200,await repeatKeyed.clone().text());
assert.equal((await repeatKeyed.json()).duplicate,true);
assert.equal(rows(keyedJob).length,2);assert.equal(principal(keyedJob),4000);
// A lost acknowledgement may be replayed while Stripe checkout is open. It
// must RETURN the original payment and never write any new money.
reserveStripe(keyedJob,'cs_test_open_after_previous_manual');
const duplicateWithCheckout=await sendKeyed(keyedBody);
assert.equal(duplicateWithCheckout.status,200);
assert.equal((await duplicateWithCheckout.json()).duplicate,true);
assert.equal(rows(keyedJob).length,2);
sql.prepare("UPDATE payment_checkout_sessions SET status='expired' WHERE estimate_id=?").run(keyedJob);
assert.equal((await sendKeyed({...keyedBody,amountCents:5000})).status,409);
assert.equal((await sendKeyed({...keyedBody,estimateId:job(10000)})).status,409);
assert.equal((await sendKeyed({...keyedBody,requestId:'bad-token'})).status,400);
assert.equal(rows(keyedJob).length,2);
const tipJob=job(10000),tipBody={estimateId:tipJob,requestId:'22222222-2222-4222-8222-222222222222',amountCents:0,tipCents:500,method:'Venmo',reference:'synthetic-tip',processingFeeCents:15};
assert.equal((await sendKeyed(tipBody)).status,201);
assert.equal((await sendKeyed(tipBody)).status,200);
assert.equal(rows(tipJob).filter(x=>x.type==='Tip').length,1);
const principalJob=job(10000),principalBody={estimateId:principalJob,requestId:'33333333-3333-4333-8333-333333333333',amountCents:6000,tipCents:0,method:'Cash',reference:'synthetic-cash'};
assert.equal((await sendKeyed(principalBody)).status,201);
assert.equal((await sendKeyed(principalBody)).status,200);
assert.equal(principal(principalJob),6000);
assert.equal(rows(principalJob).length,1);
// A payment INSERT can commit, then its derived invoice status update can
// fail. The same request ID must safely repair status without new money rows.
const statusJob=job(10000),statusBody={estimateId:statusJob,requestId:'55555555-5555-4555-8555-555555555555',amountCents:10000,tipCents:0,method:'Check',reference:'status-repair'};
const realPrepare=DB.prepare.bind(DB);
let failStatusOnce=true;
DB.prepare=(query)=>{
  const statement=realPrepare(query);
  if(failStatusOnce && query.includes('UPDATE invoices SET status=CASE')) {
    const originalRun=statement.run.bind(statement);
    statement.run=async()=>{if(failStatusOnce){failStatusOnce=false;throw Error('Synthetic invoice status update lost');}return originalRun();};
  }
  return statement;
};
try {
 const uncertain=await sendKeyed(statusBody);
 assert.equal(uncertain.status,503);
 assert.equal(principal(statusJob),10000);
 assert.equal(sql.prepare('SELECT status FROM invoices WHERE estimate_id=?').get(statusJob).status,'sent');
 const replay=await sendKeyed(statusBody);
 assert.equal(replay.status,200,await replay.clone().text());
 assert.equal((await replay.json()).duplicate,true);
 assert.equal(principal(statusJob),10000);
 assert.equal(rows(statusJob).length,1);
 assert.equal(sql.prepare('SELECT status FROM invoices WHERE estimate_id=?').get(statusJob).status,'paid');
} finally {DB.prepare=realPrepare;}
const originalPrepare=DB.prepare.bind(DB);
let lostAck=true;
DB.prepare=(query)=>{
  const statement=originalPrepare(query);
  if(lostAck && query.includes('INSERT INTO payments') && query.includes('WHERE ? <= (')){
    const normalRun=statement.run.bind(statement);
    statement.run=async()=>{const result=await normalRun();lostAck=false;throw Error('Synthetic lost D1 acknowledgement after committing payment');};
  }
  return statement;
};
const lostJob=job(10000),lostBody={estimateId:lostJob,requestId:'44444444-4444-4444-8444-444444444444',amountCents:4000,tipCents:0,method:'Cash',reference:'ack-lost'};
try{
 const lostResponse=await sendKeyed(lostBody);assert.equal(lostResponse.status,503);
 assert.equal((await lostResponse.json()).saveUncertain,true);
 assert.equal(principal(lostJob),4000);
 const recoveredResponse=await sendKeyed(lostBody);assert.equal(recoveredResponse.status,200);
 assert.equal((await recoveredResponse.json()).duplicate,true);
 assert.equal(principal(lostJob),4000);assert.equal(rows(lostJob).length,1);
}finally{DB.prepare=originalPrepare;}

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
sql.prepare("INSERT INTO payment_checkout_sessions (id,estimate_id,type,amount_cents,status,created_at) VALUES ('fire-creating:11111111-2222-4333-8444-555555555555',?,'balance',10000,'open','2026-10-07')").run(stripeJob);
globalThis.__feeReconcile=(await load('lib/stripe-payments.ts')).reconcileStripeCheckout;
const webhook=await load('app/api/payments/webhook/route.ts');
const event=JSON.stringify({type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_test_feetest',livemode:false,payment_status:'paid',amount_total:10000,metadata:{estimate_id:stripeJob,payment_type:'balance',expected_amount_cents:'10000',expected_tip_cents:'0',fire_checkout_reservation_id:'fire-creating:11111111-2222-4333-8444-555555555555'}}}});
const timestamp=Math.floor(Date.now()/1000);const signature=createHmac('sha256','whsec_test_fixture').update(timestamp+'.'+event).digest('hex');
for(let i=0;i<2;i++){const response=await webhook.POST(new Request('https://test/api/payments/webhook',{method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${signature}`},body:event}));assert.equal(response.status,200,await response.text());}
assert.equal(principal(stripeJob),10000);assert.equal(sql.prepare("SELECT COUNT(*) n FROM payment_checkout_sessions WHERE id LIKE 'fire-creating:%' AND estimate_id=?").get(stripeJob).n,0);assert.equal(rows(stripeJob).filter(r=>r.provider_id==='cs_test_feetest').length,1);assert.equal(sql.prepare("SELECT status FROM payment_checkout_sessions WHERE id='cs_test_feetest'").get().status,'paid');assert.equal(sql.prepare("SELECT COUNT(*) n FROM notifications WHERE estimate_id=? AND type='payment_overage'").get(stripeJob).n,0);
// A forged/incorrect reservation cannot attach a paid session to another job.
const wrongReservationJob=job(10000);
sql.prepare("INSERT INTO payment_checkout_sessions (id,estimate_id,type,amount_cents,status,created_at) VALUES ('fire-creating:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',?,'balance',10000,'open','2026-10-07')").run(wrongReservationJob);
const badReservation={id:'cs_wrong_reservation',payment_status:'paid',amount_total:10000,metadata:{estimate_id:stripeJob,payment_type:'balance',expected_amount_cents:'10000',fire_checkout_reservation_id:'fire-creating:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'}};
assert.equal((await globalThis.__feeReconcile(DB,badReservation)).reason,'checkout_reservation_mismatch');
assert.equal(sql.prepare("SELECT status FROM payment_checkout_sessions WHERE id='fire-creating:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'").get().status,'open');
assert.equal(rows(stripeJob).filter(r=>r.provider_id==='cs_wrong_reservation').length,0);
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
