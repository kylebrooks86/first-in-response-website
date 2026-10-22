/** Real API handlers + disposable SQLite, prove owner-only worksheet never changes a signed quote or ledger. */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';

const rt=stackedRuntime(),promo=rt.load('lib/saved-promotions.ts');
const review=rt.load('app/api/estimates/[id]/promotion-amendment/review-draft/route.ts');
const packet=rt.load('app/api/estimates/[id]/promotion-amendment/handoff/route.ts').GET;
const date=promo.fireDate(new Date()),uid=n=>'dede0000-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0');
const bundle={id:uid(1),name:'Gutter+house multi-service $25',type:'dollar',valueCents:2500,enabled:true,autoApply:true,dateBasis:'estimate-created',startOn:null,endOn:null,requiredServiceIds:['house-wash','gutters']};
const booked={id:uid(2),name:'15% booked by deadline',type:'percent',valueCents:1500,enabled:true,autoApply:true,dateBasis:'booking-confirmed',startOn:null,endOn:null,requiredServiceIds:[]};
const catalog={revision:uid(99),promotions:[bundle,booked]};
const saveCatalog=x=>rt.db.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,'now') ON CONFLICT(key) DO UPDATE SET body=excluded.body").run(promo.SAVED_PROMOTIONS_KEY,JSON.stringify(x));
saveCatalog(catalog);
const quote={
 customer:'Private worksheet synthetic',email:'worksheet-'+Date.now()+'@example.invalid',
 items:[{name:'House Wash',quantity:1,unit:'job',description:'Original scope',totalCents:40000},{name:'Gutter Cleaning + Flush',quantity:1,unit:'job',description:'Original gutters',totalCents:6000}],
 additionalDiscountType:'percent',additionalDiscountValue:0,bundleDiscountCents:2500,
 promotionEvidence:{revision:catalog.revision,checkedOn:date,ruleIds:[bundle.id],serviceIds:['house-wash','gutters']}
};
const created=await rt.post(quote);assert.equal(created.status,201,'original 435 quote saved');
const id=(await created.json()).id;
const ctx=x=>({params:Promise.resolve({id:x})});
const get=(id)=>packet(new Request('https://synthetic.invalid/api/estimates/'+id+'/promotion-amendment/handoff'),ctx(id));
const doReview=(id,body)=>review.POST(new Request('https://synthetic.invalid/api/estimates/'+id+'/promotion-amendment/review-draft',{method:'POST',body:JSON.stringify(body)}),ctx(id));
const baseline=()=>JSON.stringify(['customers','estimates','estimate_items','invoices','payments'].map(t=>rt.db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()));
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
try{
 eq((await get(id)).status,409,'No saved owner review cannot create worksheet');
 eq((await get('not-an-id')).status,400,'Bad estimate ID fails closed');
 const request={bookingConfirmedOn:date,expectedOriginalTotalCents:43500,expectedProposedTotalCents:36600,expectedRevision:null,ownerNote:'Private: customer called to confirm date'};
 const stage=await doReview(id,request);eq(stage.status,200,'Owner review staged');
 let draft=(await stage.json()).draft;
 const original=baseline(),counts=rt.counters();
 let result=await get(id);eq(result.status,200,'Owner-only reviewed worksheet available');
 const body=await result.json();
 eq(body.format,'fire-internal-amendment-worksheet-v1','Versioned typed response');
 eq(body.readyToSend,false,'Review is not approved for sending');
 eq(body.changesSavedEstimate,false,'Never changes existing quote');
 eq(body.requiresCustomerReapproval,true,'Revised terms still require approval');
 eq(body.requiresFinancialReview,false,'Unaccepted, unbilled quote has no existing financial commitment');
 eq(body.reviewRevision,draft.revision,'Bound to actual owner saved review version');
 eq(body.original.subtotalCents,46000,'Line item subtotal retained');
 eq(body.original.totalCents,43500,'Actual original agreed quote retained');
 eq(body.original.depositCents,21750,'Actual originally recorded 50% deposit retained');
 eq(body.proposed.totalCents,36600,'Potential 15% + bundle price $366');
 eq(body.proposed.depositCents,18300,'Potential half deposit $183');
 eq(body.possibleSavingsCents,6900,'Additional $69 savings in cents');
 eq(body.newRules.map(p=>p.id),[booked.id],'Only newly qualifying rule included');
 eq(body.serviceLines.map(i=>i.name),['House Wash','Gutter Cleaning + Flush'],'Original actual line items retained');
 assert.match(body.worksheetText,/NOT A CUSTOMER AGREEMENT/);checks++;
 assert.match(body.worksheetText,/Owner-attested booking date:/);checks++;
 assert.match(body.worksheetText,/NO PAYMENT, REFUND, SCHEDULE CHANGE OR MESSAGE/);checks++;
 eq(body.worksheetText.includes('Private: customer called to confirm date'),false,'Private owner note never appears in export text');
 eq(baseline(),original,'Worksheet does not alter estimates, line items or financial tables');
 eq(rt.counters().writes,counts.writes,'Read-only worksheet never runs a DB write');
 // New owner review revision causes a revalidated packet, not stale reuse.
 const updated={...request,expectedRevision:draft.revision,ownerNote:'New private note'};
 const amended=await doReview(id,updated);eq(amended.status,200,'Review owner can rotate revision');
 const latest=(await amended.json()).draft;
 eq((await (await get(id)).json()).reviewRevision,latest.revision,'Packet always uses current owner review');
 rt.db.prepare("UPDATE estimate_items SET total_cents=40001 WHERE estimate_id=? AND name='House Wash'").run(id);
 eq((await get(id)).status,409,'Unbalanced changed line item rejected without updating quote');
 rt.db.prepare("UPDATE estimate_items SET total_cents=40000 WHERE estimate_id=? AND name='House Wash'").run(id);
 rt.db.prepare("UPDATE estimates SET status='approved',signed_at='2026-10-22',accepted_at='2026-10-22' WHERE id=?").run(id);
 eq((await get(id)).status,409,'Signed quote invalidates previously unsigned worksheet');
 const approved=await doReview(id,{...request,expectedRevision:latest.revision,ownerNote:'Signed quote needs separate reviewed amendment'});
 eq(approved.status,200,'Owner can explicitly re-review revised customer acceptance status');
 result=await get(id);eq(result.status,200,'Existing signed terms can be summarized internally after fresh review');
 eq((await result.json()).requiresFinancialReview,true,'Accepted quote triggers mandatory financial/legal hold');
 const acceptedSnapshot=baseline();eq((await get(id)).status,200,'Signed worksheet can be read again');eq(baseline(),acceptedSnapshot,'Signed agreement remains unchanged');
 saveCatalog({...catalog,revision:uid(98)});
 eq((await get(id)).status,409,'Catalog change marks review stale and packet blocked');
 saveCatalog(catalog);
 rt.setOwner(null);eq((await get(id)).status,401,'Unauthenticated cannot read proposal');
 rt.setOwner({email:'other@example.invalid'});eq((await get(id)).status,401,'Different account cannot access owner review');
 rt.setOwner({email:'kylebrooks8605@gmail.com'});
 eq((await get(id)).status,200,'Owner can recover after restored rules');
 console.log('PASS '+checks+' verified owner worksheet cases on disposable SQLite; authenticated, version-bound, $435→$366, agreement holds, rule drift, no financial writes.');
}finally{rt.db.close();}
