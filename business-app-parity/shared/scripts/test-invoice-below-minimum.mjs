/** Actual FIRE invoice PATCH/GET against disposable SQLite. No hosted or provider writes. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createRouteFixtureLoader} from './route-test-loader.mjs';

const db=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
let owner={email:'kylebrooks8605@gmail.com'},remoteCalls=0,checks=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{remoteCalls++;throw Error('Synthetic invoice test forbids all remote provider requests');};
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const statement=(sql,args=[])=>({sql,args,bind(...p){return statement(sql,p);},
  async first(){return db.prepare(sql).get(...args)??null;},
  async all(){return {results:db.prepare(sql).all(...args)};},
  async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}});
const env={DB:{prepare:statement,async batch(statements){
  db.exec('BEGIN');
  try{const results=statements.map(s=>s.sql.trimStart().startsWith('SELECT')?{results:db.prepare(s.sql).all(...s.args)}:{meta:{changes:Number(db.prepare(s.sql).run(...s.args).changes)}});db.exec('COMMIT');return results;}
  catch(error){db.exec('ROLLBACK');throw error;}
}}};
const loader=createRouteFixtureLoader(process.cwd(),env,()=>owner);
const route=loader('app/api/invoices/[id]/route.ts');
const items=(cents,name='Synthetic service')=>[{name,description:'Owner-selected rate',quantity:1,unit:'job',totalCents:cents}];
const patch=(id,rows,discountType='dollar',discountValue=0)=>route.PATCH(new Request('https://synthetic.invalid/api/invoices/'+id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({items:rows,discountType,discountValue})}),{params:Promise.resolve({id})});
const detail=id=>route.GET(new Request('https://synthetic.invalid/api/invoices/'+id),{params:Promise.resolve({id})});
const invoice=id=>db.prepare('SELECT total_cents AS total,discount_cents AS discount,status FROM invoices WHERE id=?').get(id);
const revisions=id=>db.prepare('SELECT COUNT(*) AS n FROM invoice_revisions WHERE invoice_id=?').get(id).n;
function seed(id){
 db.prepare('INSERT INTO customers (id,name,created_at) VALUES (?,? ,?)').run('c-'+id,'Synthetic '+id,'2026-10-30');
 db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,'completed',20000,20000,10000,'2026-10-30')").run('e-'+id,'c-'+id);
 db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,status,subtotal_cents,discount_cents,total_cents,created_at) VALUES(?,?,?,'draft',20000,0,20000,'2026-10-30')").run(id,'e-'+id,'c-'+id);
 db.prepare('INSERT INTO invoice_items(id,invoice_id,name,description,quantity,unit,total_cents) VALUES(?,?,?,?,?,?,?)').run('item-'+id,id,'Original service','Original',1,'job',20000);
}
try{
 seed('small');let response=await patch('small',items(2500,'Trash bin'));
 eq(response.status,200,'$25 invoice edit accepted');let saved=await response.json();
 eq(saved.invoice.totalCents,2500,'Server saves exact $25');eq(saved.invoice.discountCents,0,'No hidden discount');
 eq(invoice('small').total,2500,'Database has exact $25');eq(revisions('small'),1,'Original invoice retained in revision history');
 response=await detail('small');eq(response.status,200,'Invoice GET readback');eq((await response.json()).invoice.totalCents,2500,'Customer-facing amount source is persisted $25');
 response=await patch('small',items(7500,'Gutter cleaning'));eq(response.status,200,'$75 service saved');
 eq(invoice('small').total,7500,'No automatic floor on gutter charge');
 response=await patch('small',items(7500,'Gutter with approved savings'),'dollar',3625);
 eq(response.status,200,'Owner-entered exact $36.25 savings accepted');
 saved=await response.json();eq(saved.invoice.totalCents,3875,'Invoice $75 less $11.25 and $25 = $38.75');
 eq(saved.invoice.discountCents,3625,'Discount is preserved in exact cents');
 eq(invoice('small').total,3875,'Database matches discounted invoice');eq(revisions('small'),3,'All earlier invoice amounts retained');
 response=await patch('small',items(0,'No-charge correction'));eq(response.status,200,'Zero-priced service accepted');
 eq(invoice('small').total,0,'Free service is not inflated to $150');
 eq((await (await detail('small')).json()).invoice.totalCents,0,'Zero-dollar invoice readback');

 seed('paid');
 db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES('already-paid','e-paid','Deposit',5000,'paid','2026-10-30')").run();
 const before=JSON.stringify(invoice('paid')),previous=revisions('paid');
 response=await patch('paid',items(2500,'Under paid total'));eq(response.status,409,'Cannot lower invoice below collected principal');
 eq(JSON.stringify(invoice('paid')),before,'Payment guard leaves invoice unchanged');eq(revisions('paid'),previous,'Failed edit has no revision');
 response=await patch('paid',items(10000,'Too much discount'),'dollar',10001);eq(response.status,400,'Over-subtotal discount rejected');
 eq(JSON.stringify(invoice('paid')),before,'Invalid discount leaves invoice unchanged');
 owner=null;response=await patch('paid',items(10000));eq(response.status,401,'Owner authentication required');
 eq(remoteCalls,0,'No Stripe or external provider calls');
 console.log('PASS '+checks+' actual invoice PATCH/GET SQLite checks: $25/$75/stacked $38.75/$0, revisions, readback, payment guard and auth; no remote writes.');
}finally{globalThis.fetch=originalFetch;db.close();}
