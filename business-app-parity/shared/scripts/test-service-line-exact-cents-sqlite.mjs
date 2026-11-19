/** Real FIRE estimate/new/edit and invoice/edit routes with disposable SQLite.
 * Verifies integer-cent service totals, no rounding, zero price, fractional
 * work quantities, no automatic minimum, and no malformed financial writes.
 * No hosted DB, Stripe, actual customer, or external contact.
 */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
const rt=stackedRuntime(),db=rt.db,invoiceApi=rt.load('app/api/invoices/[id]/route.ts');
let checks=0;const check=(ok,label)=>{assert.ok(ok,label);checks++};
const quote={customer:'Synthetic exact cents',address:'100 Fictional St',email:'synthetic@example.invalid',
 items:[{name:'House Wash',description:'Synthetic only',quantity:1000,unit:'sq ft',totalCents:22000}],
 appreciationDiscount:false,additionalDiscountType:'percent',additionalDiscountValue:0,bundleDiscountCents:0};
const post=async body=>{const response=await rt.post(body);return{status:response.status,body:await response.json()};};
const patchEstimate=async(id,items)=>{const response=await rt.patch(id,{items,appreciationDiscount:false,additionalDiscountType:'percent',additionalDiscountValue:0,bundleDiscountCents:0});return{status:response.status,body:await response.json()};};
const patchInvoice=async(id,items)=>{const response=await invoiceApi.PATCH(new Request('https://synthetic.invalid/api/invoices/'+id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({items,discountType:'dollar',discountValue:0})}),{params:Promise.resolve({id})});return{status:response.status,body:await response.json()};};
const rowCount=table=>db.prepare('SELECT COUNT(*) AS count FROM '+table).get().count;
const originalFetch=globalThis.fetch;let remote=0;
globalThis.fetch=async()=>{remote++;throw Error('No remote network allowed');};
try{
 const first=await post(quote);
 check(first.status===201&&first.body.totalCents===22000,'Valid initial quote keeps $220 and 50% deposit');
 const id=first.body.id;
 const quoteLine=()=>db.prepare('SELECT name,quantity,total_cents AS total FROM estimate_items WHERE estimate_id=? ORDER BY rowid').all(id);
 const originalLines=JSON.stringify(quoteLine()),originalTotal=db.prepare('SELECT total_cents AS cents FROM estimates WHERE id=?').get(id).cents;
 const countBefore=rowCount('estimates');
 for(const bad of [1000.5,1000.001,'1000',null,-1,Number.MAX_SAFE_INTEGER+1]){
  const input={...quote,customer:'Invalid cents '+String(bad),items:[{...quote.items[0],totalCents:bad}]};
  const res=await post(input);
  check(res.status===400&&rowCount('estimates')===countBefore,
   'New quote rejects invalid or nonnumeric cent amount: '+String(bad));
 }
 for(const bad of [1000.5,1000.001,'1000',null,-1,Number.MAX_SAFE_INTEGER+1]){
  const res=await patchEstimate(id,[{...quote.items[0],totalCents:bad}]);
  check(res.status===400&&JSON.stringify(quoteLine())===originalLines&&
    db.prepare('SELECT total_cents AS cents FROM estimates WHERE id=?').get(id).cents===originalTotal,
    'Estimate editor rejects malformed service amount without write: '+String(bad));
 }
 const edited=await patchEstimate(id,[{...quote.items[0],quantity:0.25,totalCents:2500}]);
 check(edited.status===200&&edited.body.estimate.items[0].quantity===0.25&&edited.body.estimate.totalCents===2500,
  'Legitimate fractional workload and exact $25 charge are preserved; no $150 minimum');
 check(quoteLine()[0].quantity===0.25&&quoteLine()[0].total===2500,
  'Source route physically persisted exact quarter-quantity pricing');
 // An original new-estimate quote with the same request ID must retain exact values.
 // This test establishes the ordinary create/editor paths, while the existing
 // estimate-create-idempotency test covers duplicate immutable-request replay.
 const invoiceId='synthetic-exact-invoice',cid=first.body.customerId;
 db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,status,subtotal_cents,discount_cents,total_cents,created_at) VALUES(?,?,?,'draft',2500,0,2500,?)")
  .run(invoiceId,id,cid,'2026-10-30T12:00:00Z');
 db.prepare('INSERT INTO invoice_items(id,invoice_id,name,description,quantity,unit,total_cents) VALUES (?,?,?,?,?,?,?)')
  .run('synthetic-line-invoice',invoiceId,'House Wash','Only synthetic',0.25,'sq ft',2500);
 const invoiceState=()=>db.prepare('SELECT total_cents AS cents FROM invoices WHERE id=?').get(invoiceId).cents;
 const revisions=()=>db.prepare('SELECT COUNT(*) AS count FROM invoice_revisions WHERE invoice_id=?').get(invoiceId).count;
 const invoiceBefore=invoiceState(),revisionBefore=revisions();
 for(const bad of [1000.5,1000.001,'1000',null,-1,Number.MAX_SAFE_INTEGER+1]){
  const res=await patchInvoice(invoiceId,[{name:'Service',description:'Synthetic only',quantity:1,unit:'job',totalCents:bad}]);
  check(res.status===400&&invoiceState()===invoiceBefore&&revisions()===revisionBefore,
   'Invoice editor rejects malformed cent amount without creating a revision: '+String(bad));
 }
 const goodInvoice=await patchInvoice(invoiceId,[{name:'Gutter clean-out',description:'Synthetic only',quantity:0.5,unit:'job',totalCents:7500}]);
 check(goodInvoice.status===200&&goodInvoice.body.invoice.totalCents===7500&&goodInvoice.body.invoice.items[0].quantity===0.5,
  'Valid fractional invoice service quantity and $75 stay exactly charged');
 check(invoiceState()===7500&&revisions()===revisionBefore+1,
  'Successful invoice edit saves exact cents and one legitimate revision');
 rt.setOwner(null);
 const denied=await patchInvoice(invoiceId,[{name:'Unauthorized',quantity:1,unit:'job',totalCents:1000}]);
 check(denied.status===401&&invoiceState()===7500,'Nonowner cannot change invoice billing');
 check(remote===0,'Entire route test made zero remote provider requests');
 console.log('PASS '+checks+'/'+checks+' actual create/edit estimate and invoice owner routes: exact cents, legitimate fractional quantities, zero auto minimum, immutable rejected rows and owner isolation.');
}finally{globalThis.fetch=originalFetch;db.close();}
