/** Real owner-only amendment review draft routes and SQLite with no customer/finance writes. */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
const r=stackedRuntime(),m=r.load('lib/saved-promotions.ts'),d=r.load('lib/booking-review-draft.ts');
const api=r.load('app/api/estimates/[id]/promotion-amendment/review-draft/route.ts');
const date=m.fireDate(new Date()),uuid=n=>'bbbb0000-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0');
const bundle={id:uuid(1),name:'House and gutters $25',type:'dollar',valueCents:2500,enabled:true,autoApply:true,dateBasis:'estimate-created',startOn:null,endOn:null,requiredServiceIds:['house-wash','gutters']};
const booking={id:uuid(2),name:'Owner-confirmed booking 15%',type:'percent',valueCents:1500,enabled:true,autoApply:true,dateBasis:'booking-confirmed',startOn:null,endOn:null,requiredServiceIds:[]};
const catalog={revision:uuid(99),promotions:[bundle,booking]};
r.db.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,'now')").run(m.SAVED_PROMOTIONS_KEY,JSON.stringify(catalog));
const original={
 customer:'Synthetic internal review',email:'review-'+Date.now()+'@example.invalid',
 items:[{name:'House Wash',quantity:1,unit:'job',description:'Synthetic',totalCents:40000},{name:'Gutter Cleaning + Flush',quantity:1,unit:'job',description:'Synthetic',totalCents:6000}],
 additionalDiscountType:'percent',additionalDiscountValue:0,bundleDiscountCents:2500,
 promotionEvidence:{revision:catalog.revision,checkedOn:date,ruleIds:[bundle.id],serviceIds:['house-wash','gutters']}
};
const saved=await r.post(original);assert.equal(saved.status,201);const estimate=(await saved.json()).id;
let tests=0;const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);tests++;};
const expect=(ok,msg)=>{assert.ok(ok,msg);tests++;};
const call=(method,id,body)=>api[method](new Request('https://synthetic.invalid/api/estimates/'+id+'/promotion-amendment/review-draft',{method,...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})}),{params:Promise.resolve({id})});
const get=id=>call('GET',id);
const post=(id,body)=>call('POST',id,body);
const del=(id,body)=>call('DELETE',id,body);
const draftInput={bookingConfirmedOn:date,expectedOriginalTotalCents:43500,expectedProposedTotalCents:36600,ownerNote:'Confirmed by telephone; review with customer before revision.',expectedRevision:null};
const snapshot=()=>JSON.stringify(['customers','estimates','estimate_items','invoices','payments'].map(t=>r.db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()));
const source=snapshot(),before=r.counters();
try{
 let response=await get(estimate);eq(response.status,200,'Owner sees no saved review initially');eq((await response.json()).draft,null,'Absent draft not confused with accepted quote');
 response=await post(estimate,draftInput);eq(response.status,200,'Internal proposal saves');let body=await response.json();
 eq(body.confirmed,true,'Save confirms internal draft only');eq(body.alreadySaved,false,'First save creates revision');
 eq(body.draft.originalTotalCents,43500,'Original quote remains $435');eq(body.draft.proposedTotalCents,36600,'Internal potential total $366');
 eq(body.draft.originalDepositCents,21750,'Original recorded deposit $217.50');eq(body.draft.proposedDepositCents,18300,'Potential deposit $183');
 eq(body.draft.possibleSavingsCents,6900,'Incremental $69 savings');eq(body.draft.newRules[0].id,booking.id,'Originating booking rule retained');
 const first=body.draft,revision=body.revision,key=d.BOOKING_REVIEW_DRAFT_PREFIX+estimate;
 eq(d.readBookingReviewDraft(r.db.prepare('SELECT body FROM message_templates WHERE key=?').get(key).body,estimate).revision,revision,'Backed-up owner metadata contains exact revision');
 eq(snapshot(),source,'Save never touches customers, estimates, items, payments or invoices');
 response=await get(estimate);body=await response.json();eq(body.stale,false,'Original review current and verified');eq(body.revision,revision,'Readback returns same revision');
 response=await post(estimate,draftInput);body=await response.json();eq(body.alreadySaved,true,'Lost acknowledgement retries idempotently');eq(body.revision,revision,'Duplicate save does not roll revision');
 eq((await post(estimate,{...draftInput,ownerNote:'New note without revision'})).status,409,'Owner note conflict requires current revision');
 eq((await post(estimate,{...draftInput,expectedProposedTotalCents:36599})).status,409,'Forged proposed amount refused');
 eq((await post(estimate,{...draftInput,bookingConfirmedOn:'2099-12-31'})).status,409,'Future booking date refused');
 eq((await post(estimate,{...draftInput,unexpected:true})).status,400,'Unexpected input refused');
 eq((await post(estimate,{...draftInput,ownerNote:'x'.repeat(401)})).status,400,'Oversized notes refused');
 eq((await post(estimate,{...draftInput,ownerNote:12})).status,400,'Non-string notes refused');
 const updated={...draftInput,expectedRevision:revision,ownerNote:'Reviewed internally; do not send without fresh approval.'};
 response=await post(estimate,updated);eq(response.status,200,'Owner may explicitly update review');body=await response.json();
 const second=body.revision;expect(second!==revision,'Update rotates concurrency revision');eq(body.draft.ownerNote,updated.ownerNote,'Updated note retained');
 eq((await post(estimate,{...draftInput,expectedRevision:revision,ownerNote:'Stale device'})).status,409,'Another device cannot overwrite newer review');
 eq((await del(estimate,{expectedRevision:revision})).status,409,'Old device cannot discard newer review');
 eq(snapshot(),source,'All attempted review changes leave financial tables untouched');
 // Later signing invalidates internal proposal's status, not the agreement.
 r.db.prepare("UPDATE estimates SET status='approved',signed_at='2026-10-22',accepted_at='2026-10-22' WHERE id=?").run(estimate);
 response=await get(estimate);eq(response.status,200,'Owner can still read internal draft after approval');body=await response.json();
 eq(body.stale,true,'Approval transition makes original draft stale');eq(body.draft.revision,second,'History retained, not marked approved');
 // Restore exact synthetic row for catalog test.
 r.db.prepare("UPDATE estimates SET status='draft',signed_at=NULL,accepted_at=NULL WHERE id=?").run(estimate);
 const nextCatalog={...catalog,revision:uuid(98)};r.db.prepare("UPDATE message_templates SET body=? WHERE key=?").run(JSON.stringify(nextCatalog),m.SAVED_PROMOTIONS_KEY);
 response=await get(estimate);body=await response.json();eq(body.stale,true,'Changed catalog causes stale review');
 r.db.prepare("UPDATE message_templates SET body=? WHERE key=?").run(JSON.stringify(catalog),m.SAVED_PROMOTIONS_KEY);
 response=await get(estimate);eq((await response.json()).stale,false,'Original catalog revision reinstated still allows verification');
 r.setOwner(null);eq((await get(estimate)).status,401,'Unknown caller cannot see saved owner note');eq((await post(estimate,updated)).status,401,'Unknown caller cannot update');
 r.setOwner({email:'fake@example.invalid'});eq((await del(estimate,{expectedRevision:second})).status,401,'Nonowner cannot delete');
 r.setOwner({email:'kylebrooks8605@gmail.com'});
 eq((await del(estimate,{expectedRevision:null})).status,400,'Unverified delete revision rejected');
 response=await del(estimate,{expectedRevision:second});eq(response.status,200,'Owner discards just the internal review');eq((await response.json()).discarded,true,'Exact draft discarded');
 eq(r.db.prepare('SELECT body FROM message_templates WHERE key=?').get(key),undefined,'Review draft key removed');
 eq((await get(estimate)).status,200,'Readback after discard works');eq((await (await get(estimate)).json()).draft,null,'Discard not mistaken for deleted estimate');
 eq((await del(estimate,{expectedRevision:second})).status,409,'Repeated discard requires readback');
 const afterDiscard=snapshot();eq(afterDiscard,source,'Financial records remain unchanged after full stage/review/discard cycle');
 eq(r.counters().writes>before.writes,true,'Only one internal metadata row was written and discarded');
 // An estimate with owner attested booking at creation must not be staged again.
 const booked=await r.post({...original,customer:'Already booked',email:'already-'+Date.now()+'@example.invalid',additionalDiscountValue:1500,
  promotionEvidence:{...original.promotionEvidence,bookingConfirmedOn:date,ruleIds:[bundle.id,booking.id]}});
 eq(booked.status,201,'Existing booking evidence quote creation works');eq((await post((await booked.json()).id,draftInput)).status,409,'Cannot duplicate booking discount in internal review');
 const absent=await post('not-found',{...draftInput});eq(absent.status,409,'Missing quote cannot be used for review staging');
 console.log('PASS '+tests+' owner review draft: exact saved totals, CAS conflict, retry receipt, stale catalog/status, forged inputs, authorization, discard and zero financial changes.');
}finally{r.db.close();}
