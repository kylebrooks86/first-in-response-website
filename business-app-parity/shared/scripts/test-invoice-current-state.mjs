/** Actual invoice/customer GET routes; native SQLite; no status repair writes. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createRouteFixtureLoader} from './route-test-loader.mjs';
import {invoicePaymentState,currentInvoice,invoicePaymentMessage} from '../lib/invoice-state.mjs';
const db=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
let writes=0,owner={email:'kylebrooks8605@gmail.com'};
const env={DB:{prepare(sql){return {sql,values:[],bind(...values){return {...this,values}},async first(){return db.prepare(sql).get(...this.values)??null},async all(){return {results:db.prepare(sql).all(...this.values)}},async run(){writes++;throw Error('Unexpected mutation')}}},async batch(rows){return rows.map(r=>({results:db.prepare(r.sql).all(...r.values)}))}}};
const load=createRouteFixtureLoader(process.cwd(),env,()=>owner),list=load('app/api/invoices/route.ts'),detail=load('app/api/invoices/[id]/route.ts'),customers=load('app/api/customers/route.ts'),history=load('app/api/estimate-history/route.ts');
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
function seed(id,total=24000,status='sent'){db.prepare('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)').run('c-'+id,'Synthetic Invoice '+id,'2026-10-18');db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,'completed',?,?,?,'2026-10-18')").run('e-'+id,'c-'+id,total,total,Math.round(total/2));db.prepare('INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,share_token,created_at) VALUES(?,?,?,?,?,?,?)').run(id,'e-'+id,'c-'+id,status,total,'token-'+id,'2026-10-18');}
function payment(id,key,type,amount,status='paid'){db.prepare('INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,?,?,?,?,?)').run(key,'e-'+id,type,amount,status,'2026-10-18');}
async function state(id,status,paid,balance,review=false){
 const all=await (await list.GET()).json();const a=all.invoices.find(row=>row.id===id);
 const one=await (await detail.GET(new Request('https://synthetic.invalid'),{params:Promise.resolve({id})})).json();
 const data=await (await customers.GET()).json();const c=data.invoices.find(row=>row.id===id);
 for(const row of [a,one.invoice,c]){eq(row.status,status);eq(row.paidCents,paid);eq(row.balanceCents,balance);eq(row.paymentReviewPending,review);}
}
try{
 seed('invoice');seed('other',50000);seed('zero',0);eq((await list.GET()).headers.get('cache-control'),'no-store, private');eq((await detail.GET(new Request('https://synthetic.invalid'),{params:Promise.resolve({id:'invoice'})})).headers.get('cache-control'),'no-store, private');eq((await customers.GET()).headers.get('cache-control'),'no-store, private');await state('invoice','sent',0,24000);await state('zero','paid',0,0);
 payment('invoice','deposit','Cash',12000);await state('invoice','partial',12000,12000);
 payment('invoice','tip','Tip',1200);payment('invoice','tip-refund','Tip Refund',-200);payment('invoice','pending','Cash',500,'pending');payment('invoice','failed','Cash',500,'failed');await state('invoice','partial',12000,12000);
 payment('invoice','final','Venmo',12000);await state('invoice','paid',24000,0);eq(db.prepare('SELECT status FROM invoices WHERE id=?').get('invoice').status,'sent');eq(writes,0);
 payment('invoice','refund','Refund',-5000);await state('invoice','partial',19000,5000);payment('invoice','rest-refund','Refund',-19000);await state('invoice','sent',0,24000);
 db.prepare("INSERT INTO payment_refunds(id,payment_id,estimate_id,amount_cents,mode,status,created_at) VALUES('pending-refund','final','e-invoice',1000,'manual','pending','2026-10-18')").run();await state('invoice','sent',0,24000,true);
 db.prepare("UPDATE payment_refunds SET status='failed' WHERE id='pending-refund'").run();await state('invoice','sent',0,24000);
 db.prepare("INSERT INTO notifications(id,type,title,body,estimate_id,created_at) VALUES('overage','payment_overage','Review','Synthetic review','e-invoice','2026-10-18')").run();await state('invoice','sent',0,24000,true);await state('other','sent',0,50000);
 const base={status:'paid',totalCents:24000,paidCents:24000};eq(invoicePaymentState(base).status,'paid');assert.match(invoicePaymentMessage(invoicePaymentState(base)),/paid in full\. No additional invoice payment is due/);checks++;
 for(const field of ['totalCents','paidCents'])for(const value of [-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1,'24000']){const s=invoicePaymentState({...base,[field]:value});eq(s.safe,false);eq(s.review,true);eq(s.balanceCents,null);assert.match(invoicePaymentMessage(s),/do not send another payment/);checks++;}
 eq(invoicePaymentMessage(invoicePaymentState({...base,paidCents:12000})),null);
 eq(currentInvoice({...base,status:'draft'}).storedStatus,'draft');eq(invoicePaymentState({...base,status:'void'}).review,true);
 // The same mismatched invoice must not appear as valid billing under
 // another homeowner in any owner app screen. No auto-repair or financial
 // mutations are permitted just because the owner opens a record.
 db.prepare("UPDATE invoices SET customer_id='c-other' WHERE id='invoice'").run();
 const beforeCrossReads=writes;
 for(const [screen,read] of [
  ['invoice list',()=>list.GET()],
  ['invoice detail',()=>detail.GET(new Request('https://synthetic.invalid'),{params:Promise.resolve({id:'invoice'})})],
  ['customer records',()=>customers.GET()],
  ['estimate history',()=>history.GET(new Request('https://synthetic.invalid/api/estimate-history?focus=e-invoice'))],
  ['invoice editor',()=>detail.PATCH(new Request('https://synthetic.invalid/api/invoices/invoice',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({items:[]})}),{params:Promise.resolve({id:'invoice'})})]
 ]){
  const denied=await read();
  eq(denied.status,409,screen+' refuses a foreign-customer invoice');
  eq(denied.headers.get('cache-control'),'no-store, private',screen+' returns private no-store review');
  eq((await denied.json()).error.toLowerCase().includes('invoice'),true,screen+' names invoice ownership review');
  eq(writes,beforeCrossReads,screen+' never attempts a financial or customer write');
 }
 // Restore original ownership in disposable memory only. All four owner
 // read paths resume; historical invoice/estimate/payment cents stay intact.
 db.prepare("UPDATE invoices SET customer_id='c-invoice' WHERE id='invoice'").run();
 eq((await list.GET()).status,200,'Repaired association restores invoice directory');
 eq((await detail.GET(new Request('https://synthetic.invalid'),{params:Promise.resolve({id:'invoice'})})).status,200,'Repaired invoice detail available');
 eq((await customers.GET()).status,200,'Repaired association restores customer records');
 eq((await history.GET(new Request('https://synthetic.invalid/api/estimate-history?focus=e-invoice'))).status,200,'Repaired association restores estimate history');
 eq(writes,beforeCrossReads,'All ownership checks are read-only');

 owner=null;eq((await list.GET()).status,401);eq((await detail.GET(new Request('https://synthetic.invalid'),{params:Promise.resolve({id:'invoice'})})).status,401);eq((await customers.GET()).status,401);eq(writes,0);
 console.log(`PASS ${checks}/${checks}: actual list/detail/customer invoice status derives from principal, zero totals, partial/final payments, tips, refunds, review holds and malformed amounts; current state does not rewrite stored invoice/audit status.`);
}finally{db.close()}
