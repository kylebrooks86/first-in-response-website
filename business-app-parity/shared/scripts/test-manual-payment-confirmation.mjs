/** Actual manual-payment routes and transactional native SQLite. Synthetic only. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {confirmedManualPayment} from '../lib/manual-payment-retry-state.ts';
import {createRouteFixtureLoader} from './route-test-loader.mjs';
const db=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
let writes=0,failRead=false,failAfterCommit=false,beforePaymentInsert=null,owner={email:'kylebrooks8605@gmail.com'};
function statement(sql){return {sql,values:[],bind(...values){return {...this,values}},async first(){return db.prepare(sql).get(...this.values)??null},async all(){return {results:db.prepare(sql).all(...this.values)}},async run(){writes++;if(sql.trim().startsWith('INSERT INTO payments')&&beforePaymentInsert){
 const mutation=beforePaymentInsert;beforePaymentInsert=null;mutation();
}const changes=Number(db.prepare(sql).run(...this.values).changes);if(failAfterCommit&&sql.trim().startsWith('INSERT INTO payments')){failAfterCommit=false;throw Error('Synthetic lost acknowledgement after insert')}return {meta:{changes}}}};}
const env={DB:{prepare:statement,async batch(rows){if(failRead&&rows.every(r=>/^SELECT/.test(r.sql)))throw Error('Synthetic offline confirmation');
if(beforePaymentInsert&&rows.some(r=>r.sql.trim().startsWith('INSERT INTO payments'))){
 const mutation=beforePaymentInsert;beforePaymentInsert=null;mutation();
}
db.exec('BEGIN');try{const result=rows.map(r=>/^SELECT/.test(r.sql)?{results:db.prepare(r.sql).all(...r.values)}:(writes++,{meta:{changes:Number(db.prepare(r.sql).run(...r.values).changes)}}));db.exec('COMMIT');if(failAfterCommit){failAfterCommit=false;throw Error('Synthetic lost acknowledgement after commit')}return result}catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error}}}};
const load=createRouteFixtureLoader(process.cwd(),env,()=>owner),pay=load('app/api/payments/route.ts'),confirm=load('app/api/payments/confirmation/route.ts');
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const get=(id,requestId)=>confirm.GET(new Request('https://synthetic.invalid/api/payments/confirmation?'+new URLSearchParams({estimateId:id,requestId})));
const post=(id,a)=>pay.POST(new Request('https://synthetic.invalid/api/payments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({estimateId:id,...a})}));
function seed(id,status='approved'){db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run('c-'+id,'Synthetic Payment '+id,'2026-10-18');db.prepare('INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,?,20000,20000,10000,?)').run(id,'c-'+id,status,'2026-10-18');}
const attempt={requestId:randomUUID(),amountCents:10000,tipCents:0,method:'Cash',reference:'synthetic',processingFeeCents:null};
try{
 seed('a');seed('b');seed('tip','completed');
 owner=null;eq((await get('a',attempt.requestId)).status,401);owner={email:'customer@example.invalid'};eq((await get('a',attempt.requestId)).status,401);owner={email:'kylebrooks8605@gmail.com'};
 eq((await get('a','bad')).status,400);eq((await get('missing',attempt.requestId)).status,404);
 let response=await get('a',attempt.requestId);eq(response.status,200);eq(response.headers.get('cache-control'),'no-store, private');eq((await response.json()).confirmed,false);eq(writes,0);
 // Exact-cents validation must happen at the actual API boundary, even when a
 // malformed client bypasses the mobile form. Reject without any D1 mutation.
 for(const [caseName,patch]of [
  ['fractional principal',{amountCents:10000.5}],['fractional tip',{tipCents:0.5}],
  ['decimal-string principal',{amountCents:'10000'}],['decimal-string tip',{tipCents:'100'}],
  ['null principal',{amountCents:null}],['null tip',{tipCents:null}],
  ['boolean principal',{amountCents:true}],['boolean tip',{tipCents:false}],
  ['array amount',{amountCents:[10000]}],['object tip',{tipCents:{value:0}}],
  ['negative principal',{amountCents:-1}],['negative tip',{tipCents:-1}],
  ['nonfinite principal',{amountCents:Infinity}],['nonfinite tip',{tipCents:NaN}],
  ['unsafe principal',{amountCents:Number.MAX_SAFE_INTEGER+1}],
  ['aggregate overflow',{amountCents:Number.MAX_SAFE_INTEGER,tipCents:1}],
  ['absent principal',{amountCents:undefined}],
 ]){
  eq((await post('b',{...attempt,requestId:randomUUID(),...patch})).status,400,caseName);
  eq(writes,0,caseName+' must not write');
 }

 // A committed principal must be discoverable even when the write acknowledgement failed.
 failAfterCommit=true;eq((await post('a',attempt)).status,503);const receipt=await (await get('a',attempt.requestId)).json();eq(receipt.confirmed,true);eq(confirmedManualPayment(receipt,'a',attempt),10000);const savedWrites=writes;
 eq((await get('b',attempt.requestId)).status,409);eq(confirmedManualPayment(receipt,'b',attempt),null);
 for(const patch of [{amountCents:9999},{method:'Venmo'},{reference:'different'},{tipCents:100},{processingFeeCents:1},{requestId:randomUUID()}])eq(confirmedManualPayment(receipt,'a',{...attempt,...patch}),null);
 for(const patch of [{confirmed:false},{paidCents:'10000'},{paidCents:NaN},{paidCents:-1},{requestId:randomUUID()},{records:[]},{records:[...receipt.records,...receipt.records]}])eq(confirmedManualPayment({...receipt,...patch},'a',attempt),null);
 for(const patch of [{status:'pending'},{estimateId:'b'},{amountCents:10001},{processingFeeCents:3},{grossReceivedCents:1},{bundledTipCents:5},{processingMethod:'Other'}])eq(confirmedManualPayment({...receipt,records:[{...receipt.records[0],...patch}]},'a',attempt),null);
 eq(writes,savedWrites);failRead=true;eq((await get('a',attempt.requestId)).status,503);failRead=false;eq(writes,savedWrites);
 // Explicit same-ID replay never creates another payment, after deposit is already fully paid.
 eq((await post('a',attempt)).status,200);eq(db.prepare("SELECT COUNT(*) AS n FROM payments WHERE estimate_id='a'").get().n,1);
 const combined={...attempt,requestId:randomUUID(),amountCents:20000,tipCents:1200,method:'Venmo',processingFeeCents:450};eq((await post('tip',combined)).status,201);const bundle=await (await get('tip',combined.requestId)).json();eq(confirmedManualPayment(bundle,'tip',combined),20000);eq(bundle.records.length,2);eq(confirmedManualPayment({...bundle,records:bundle.records.slice(0,1)},'tip',combined),null);
 const only={...attempt,requestId:randomUUID(),amountCents:0,tipCents:500,method:'Cash App',processingFeeCents:25};eq((await post('tip',only)).status,201);const tip=await (await get('tip',only.requestId)).json();eq(confirmedManualPayment(tip,'tip',only),20000);eq(tip.records.length,1);
 eq(db.prepare("SELECT COUNT(*) AS n FROM payments WHERE estimate_id='b'").get().n,0);
 // Preserve the historical optional omission of tipCents on a whole-cent payment.
 const optionalTip={...attempt,requestId:randomUUID(),amountCents:1000};delete optionalTip.tipCents;
 eq((await post('b',optionalTip)).status,201);
 eq(db.prepare("SELECT amount_cents AS amount FROM payments WHERE id=?").get('manual-'+optionalTip.requestId).amount,1000);

 // Checkout already isolates customer/invoice ownership. The manual Cash,
 // Venmo and tip paths must refuse the SAME cross-customer invoice corruption.
 const invoice=(id,customerId,total=20000)=>db.prepare(
   "INSERT INTO invoices(id,estimate_id,customer_id,total_cents,status,created_at) VALUES (?,?,?,?,'sent',?)"
 ).run('invoice-'+id,id,customerId,total,'2026-10-18');
 const paymentsFor=id=>Number(db.prepare('SELECT COUNT(*) AS n FROM payments WHERE estimate_id=?').get(id).n);
 seed('foreign','completed');invoice('foreign','c-a',90000);
 const foreign={...attempt,requestId:randomUUID(),amountCents:1000};
 const beforeWrongWrites=writes;
 let denied=await post('foreign',foreign);
 eq(denied.status,409);
 eq((await denied.json()).error.includes('Invoice ownership'),true);
 eq(paymentsFor('foreign'),0);
 eq(db.prepare("SELECT status FROM invoices WHERE id='invoice-foreign'").get().status,'sent');
 eq(writes,beforeWrongWrites);
 // Owner fixes the wrong association; the legitimate invoice amount and job
 // owner can then be used. Never modify/approve the other homeowner's invoice.
 db.prepare("UPDATE invoices SET customer_id='c-foreign',total_cents=20000 WHERE id='invoice-foreign'").run();
 eq((await post('foreign',foreign)).status,201);
 eq(paymentsFor('foreign'),1);
 eq(db.prepare("SELECT status FROM invoices WHERE id='invoice-foreign'").get().status,'partial');
 db.prepare("UPDATE invoices SET customer_id='c-a' WHERE id='invoice-foreign'").run();
 const earlier=writes;
 eq((await post('foreign',foreign)).status,409); // same requestId must NOT repair foreign invoice
 eq(paymentsFor('foreign'),1);
 eq(writes,earlier);
 db.prepare("UPDATE invoices SET customer_id='c-foreign' WHERE id='invoice-foreign'").run();
 eq((await post('foreign',foreign)).status,200);
 eq(paymentsFor('foreign'),1);

 // Simulate a different connection modifying invoice ownership *after* the
 // route has read and validated the job, but BEFORE its atomic INSERT.
 seed('race','completed');invoice('race','c-race');
 beforePaymentInsert=()=>db.prepare("UPDATE invoices SET customer_id='c-a' WHERE id='invoice-race'").run();
 const race={...attempt,requestId:randomUUID(),amountCents:1500};
 eq((await post('race',race)).status,409);
 eq(paymentsFor('race'),0);
 db.prepare("UPDATE invoices SET customer_id='c-race' WHERE id='invoice-race'").run();
 eq((await post('race',race)).status,201);
 eq(paymentsFor('race'),1);

 // Same SQL-time guard covers tip-only records, and a job that becomes
 // unfinished between the first read and its tip INSERT.
 seed('tipRace','completed');invoice('tipRace','c-tipRace');
 const justTip={...attempt,requestId:randomUUID(),amountCents:0,tipCents:500,method:'Venmo'};
 beforePaymentInsert=()=>db.prepare("UPDATE invoices SET customer_id='c-a' WHERE id='invoice-tipRace'").run();
 eq((await post('tipRace',justTip)).status,409);
 eq(paymentsFor('tipRace'),0);
 db.prepare("UPDATE invoices SET customer_id='c-tipRace' WHERE id='invoice-tipRace'").run();
 beforePaymentInsert=()=>db.prepare("UPDATE estimates SET status='approved' WHERE id='tipRace'").run();
 eq((await post('tipRace',justTip)).status,409);
 eq(paymentsFor('tipRace'),0);
 db.prepare("UPDATE estimates SET status='completed' WHERE id='tipRace'").run();
 eq((await post('tipRace',justTip)).status,201);
 eq(paymentsFor('tipRace'),1);


 // Read-only confirmation is part of the actual money workflow, not a source
 // of authorization to collect again. Even a valid saved payment cannot
 // certify an invoice that is now linked to a different customer.
 db.prepare("UPDATE invoices SET customer_id='c-a' WHERE id='invoice-foreign'").run();
 const ownerReadWrites=writes;
 let review=await get('foreign',foreign.requestId);
 eq(review.status,409,'Read-only manual confirmation refuses a foreign-customer invoice');
 eq(review.headers.get('cache-control'),'no-store, private');
 eq(paymentsFor('foreign'),1,'The original paid ledger remains untouched');
 eq(writes,ownerReadWrites,'Wrong-customer confirmation never writes or auto-repairs billing');
 db.prepare("UPDATE invoices SET customer_id='c-foreign' WHERE id='invoice-foreign'").run();
 review=await get('foreign',foreign.requestId);
 eq(review.status,200,'Same original payment can be confirmed after correct invoice association');
 eq(confirmedManualPayment(await review.json(),'foreign',foreign),1000,'Repaired readback verifies original saved financial request');

 // Source-of-truth receipt rows must be PAID, positive exact integer cents,
 // and represent the expected manual principal/tip types. Previously a
 // pending/corrupt single matching row could set confirmed=true on the API.
 seed('uncertain-receipt','completed');
 const suspiciousId=randomUUID(),principalId='manual-'+suspiciousId,readWrites=writes;
 db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,'Cash',1000,'pending',?)")
   .run(principalId,'uncertain-receipt','2026-11-11');
 review=await get('uncertain-receipt',suspiciousId);
 eq(review.status,409,'Pending payment receipt cannot claim confirmed success');
 eq(writes,readWrites,'Pending read-only receipt does not write');
 db.prepare("UPDATE payments SET status='paid' WHERE id=?").run(principalId);
 review=await get('uncertain-receipt',suspiciousId);
 eq(review.status,200,'Proper paid source row can be read');
 eq((await review.json()).confirmed,true,'Paid principal receipt eligible for client exact-details verification');
 db.prepare("UPDATE payments SET type='Refund' WHERE id=?").run(principalId);
 eq((await get('uncertain-receipt',suspiciousId)).status,409,'Refund ledger cannot masquerade as a principal receipt');
 db.prepare("UPDATE payments SET type='Cash', amount_cents=0 WHERE id=?").run(principalId);
 eq((await get('uncertain-receipt',suspiciousId)).status,409,'Zero-value record cannot masquerade as a paid principal');
 db.prepare("UPDATE payments SET amount_cents=1000 WHERE id=?").run(principalId);
 eq((await get('uncertain-receipt',suspiciousId)).status,200,'Restored positive principal can be read without creating a new payment');
 db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,'Cash',250,'paid',?)")
   .run(principalId+'-tip','uncertain-receipt','2026-11-11');
 eq((await get('uncertain-receipt',suspiciousId)).status,409,'Tip ID containing wrong type must not be confirmed');
 db.prepare("UPDATE payments SET type='Tip' WHERE id=?").run(principalId+'-tip');
 eq((await get('uncertain-receipt',suspiciousId)).status,200,'Valid separated tip receipt remains readable');
 eq(writes,readWrites,'Every confirmation scenario performed zero hosted or local API writes');

 console.log(`PASS ${checks}/${checks}: scoped owner-only read confirmation, lost commit acknowledgement, exact principal/tip/fee receipts, malformed and conflicting receipt refusal, no extra financial writes and same-ID replay.`);
}finally{db.close()}
