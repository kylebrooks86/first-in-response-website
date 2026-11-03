/** Actual FIRE invoice PATCH/GET against disposable SQLite. No hosted or provider writes. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createRouteFixtureLoader} from './route-test-loader.mjs';

const db=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
let owner={email:'kylebrooks8605@gmail.com'},remoteCalls=0,checks=0;
let skipNextBatch=false,loseNextInvoiceRead=false,distortNextInvoiceRead=false,distortNextLineRead=false,hideNextRevision=false,postBatchRead=false;
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{remoteCalls++;throw Error('Synthetic invoice test forbids all remote provider requests');};
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const statement=(sql,args=[])=>({sql,args,bind(...p){return statement(sql,p);},
  async first(){
    if(sql.startsWith('SELECT id,estimate_id AS estimateId,status,first_viewed_at'))postBatchRead=false;
    if(sql.startsWith('SELECT id,subtotal_cents AS subtotalCents')){
      if(loseNextInvoiceRead){loseNextInvoiceRead=false;throw Error('Synthetic lost invoice readback');}
      const row=db.prepare(sql).get(...args)??null;
      if(distortNextInvoiceRead&&row){distortNextInvoiceRead=false;return {...row,totalCents:999999};}
      return row;
    }
    if(sql.startsWith('SELECT id FROM invoice_revisions')&&hideNextRevision){hideNextRevision=false;return null;}
    return db.prepare(sql).get(...args)??null;
  },
  async all(){
    const rows=db.prepare(sql).all(...args);
    if(postBatchRead&&sql.startsWith('SELECT id,name,description,quantity,unit,total_cents AS totalCents FROM invoice_items')&&distortNextLineRead&&rows.length){
      distortNextLineRead=false;return {results:[{...rows[0],name:'Not actual stored line'},...rows.slice(1)]};
    }
    return {results:rows};
  },
  async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}});
const env={DB:{prepare:statement,async batch(statements){
  if(skipNextBatch){skipNextBatch=false;return statements.map(()=>({success:true,meta:{changes:0}}));}
  db.exec('BEGIN');
  try{const results=statements.map(s=>s.sql.trimStart().startsWith('SELECT')?{results:db.prepare(s.sql).all(...s.args)}:{meta:{changes:Number(db.prepare(s.sql).run(...s.args).changes)}});db.exec('COMMIT');postBatchRead=true;return results;}
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
 // Invoice details must be returned from persisted D1, not echoed from the
 // submitted PATCH. Unedited due date and newly allocated line IDs are
 // essential for correct iPhone re-edit and customer invoice details.
 seed('due');
 const oldDue='2026-11-20T12:00:00.000Z';
 db.prepare('UPDATE invoices SET due_at=? WHERE id=?').run(oldDue,'due');
 response=await patch('due',items(7600,'Saved due-date line'));
 eq(response.status,200,'No-due-date-change invoice edit succeeded');
 saved=await response.json();
 eq(saved.invoice.dueAt,oldDue,'Original D1 due date retained in PATCH receipt');
 const savedId=db.prepare('SELECT id FROM invoice_items WHERE invoice_id=? LIMIT 1').get('due').id;
 eq(saved.invoice.items[0].id,savedId,'Response exposes the actual saved generated line ID');
 eq(saved.invoice.items[0].totalCents,7600,'Response line reflects exact saved cents');
 eq(response.headers.get('cache-control'),'no-store, private','Financial receipt is private and not cached');
 // If D1 returns without throwing but writes nothing, the old invoice must
 // not be reported as saved. Its persisted value remains unchanged.
 skipNextBatch=true;
 response=await patch('due',items(9900,'Never persisted'));
 eq(response.status,503,'Nonthrowing silent D1 batch failure is not a successful edit');
 eq((await response.json()).saveUncertain,true,'Silent batch outcome marked uncertain');
 eq(invoice('due').total,7600,'Silent no-op did not alter D1 invoice');
 // These synthetic failures happen AFTER the transaction was committed.
 // PATCH must fail closed, never invent saved figures or resend the batch.
 loseNextInvoiceRead=true;
 response=await patch('due',items(10100,'Lost readback'));
 eq(response.status,503,'Lost header readback blocks success');
 eq(invoice('due').total,10100,'Committed invoice remains intact despite 503');
 distortNextInvoiceRead=true;
 response=await patch('due',items(11200,'Stale readback'));
 eq(response.status,503,'Misleading header readback blocks false success');
 eq(invoice('due').total,11200,'Committed price remains intact after stale receipt');
 distortNextLineRead=true;
 response=await patch('due',items(12500,'Stale line readback'));
 eq(response.status,503,'Wrong service line readback blocks false success');
 eq(invoice('due').total,12500,'Committed service update retained');
 hideNextRevision=true;
 response=await patch('due',items(12900,'Missing revision receipt'));
 eq(response.status,503,'Unconfirmed revision audit blocks success');
 eq(invoice('due').total,12900,'Latest amount committed even though revision receipt missing');
 response=await detail('due');
 eq(response.status,200,'Independent invoice GET recovers the current persisted state');
 eq((await response.json()).invoice.totalCents,12900,'GET reports latest DB amount after uncertain PATCH');
 owner=null;response=await patch('paid',items(10000));eq(response.status,401,'Owner authentication required');
 eq(remoteCalls,0,'No Stripe or external provider calls');
 console.log('PASS '+checks+' actual invoice PATCH/GET SQLite checks: exact $25/$75/$38.75/$0 pricing, stable line IDs, persisted due date, revisions, false-ACK and stale/missing readback refusal, payment guard and owner auth; no remote writes.');
}finally{globalThis.fetch=originalFetch;db.close();}
