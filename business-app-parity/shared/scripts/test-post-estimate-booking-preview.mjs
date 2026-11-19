/** Read-only booking-amendment what-if for real estimate DB routes and disposable SQLite. */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
const r=stackedRuntime(),m=r.load('lib/saved-promotions.ts');
const PREVIEW=r.load('app/api/estimates/[id]/promotion-amendment/route.ts').POST;
let tests=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);tests++;};
const ok=(v,label)=>{assert.ok(v,label);tests++;};
const id=n=>'dada0000-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0');
const bookDate=m.fireDate(new Date()),stamp=Date.now();
const bundle={id:id(1),name:'Original FIRE $25 service bundle',type:'dollar',valueCents:2500,enabled:true,autoApply:true,startOn:null,endOn:null,dateBasis:'estimate-created',requiredServiceIds:['house-wash','gutters']};
const booking={id:id(2),name:'15% confirmed-booking offer',type:'percent',valueCents:1500,enabled:true,autoApply:true,startOn:null,endOn:null,dateBasis:'booking-confirmed',requiredServiceIds:[]};
const catalog={revision:id(99),promotions:[bundle,booking]};
const store=updated=>r.db.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,'now') ON CONFLICT(key) DO UPDATE SET body=excluded.body").run(m.SAVED_PROMOTIONS_KEY,JSON.stringify(updated));
const quote={
 customer:'Booking proposal synthetic',address:'123 Synthetic avenue',email:'offer-'+stamp+'@example.invalid',
 items:[{name:'House Wash',quantity:1,unit:'job',description:'Test',totalCents:40000},{name:'Gutter Cleaning + Flush',quantity:1,unit:'job',description:'Test',totalCents:6000}],
 additionalDiscountType:'percent',additionalDiscountValue:0,bundleDiscountCents:2500,appreciationDiscount:false,
 promotionEvidence:{revision:catalog.revision,checkedOn:bookDate,ruleIds:[bundle.id],serviceIds:['house-wash','gutters']}
};
const invoke=(quoteId,bookingConfirmedOn)=>PREVIEW(new Request('https://synthetic.invalid/api/estimates/'+quoteId+'/promotion-amendment',{method:'POST',body:JSON.stringify({bookingConfirmedOn})}),{params:Promise.resolve({id:quoteId})});
const direct=(quoteId,body)=>PREVIEW(new Request('https://synthetic.invalid/api/estimates/'+quoteId+'/promotion-amendment',{method:'POST',body:typeof body==='string'?body:JSON.stringify(body)}),{params:Promise.resolve({id:quoteId})});
const snapshot=()=>JSON.stringify(['customers','estimates','estimate_items','message_templates','invoices','payments'].map(t=>r.db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()));
try{
 store(catalog);
 const created=await r.post(quote);eq(created.status,201,'Original estimate saved with verified service bundle');const saved=await created.json();
 const estimateId=saved.id;eq(saved.totalCents,43500,'Old quote is $435 before confirmed booking');eq(saved.depositCents,21750,'Original deposit $217.50');
 const before=snapshot(),counts=r.counters();
 let response=await invoke(estimateId,bookDate);eq(response.status,200,'Owner gets safe read-only calculation');let data=await response.json();
 eq(data.estimateId,estimateId,'Response bound to original estimate');
 eq(data.current.totalCents,43500,'Original agreed quote remains $435');
 eq(data.current.depositCents,21750,'Original half-deposit preserved');
 eq(data.proposed.totalCents,36600,'Proposed October-style 15% plus $25 gives $366');
 eq(data.proposed.depositCents,18300,'Proposed future deposit $183');
 eq(data.possibleSavingsCents,6900,'Preview explains additional $69 savings');
 eq(data.newlyEligible.map(r=>r.name),[booking.name],'Only newly eligible booking rule listed');
 eq(data.requiresReviewedAmendment,true,'Owner review required');
 eq(data.changesSavedEstimate,false,'Never claims quote changed');
 eq(data.customerAlreadyAccepted,false,'Unsigned draft not represented as signed');
 eq(data.hasFinancialActivity,false,'No payment/invoice falsely inferred');
 eq(snapshot(),before,'Preview never changes price, audit, original terms, or any related tables');
 eq(r.counters().writes,counts.writes,'Preview performs zero SQL writes');
 for(const invalid of [
  {bookingConfirmedOn:'2099-12-31'},{bookingConfirmedOn:'2026-02-30'},{bookingConfirmedOn:null},
  {bookingConfirmedOn:false},{bookingConfirmedOn:''},{bookingConfirmedOn:bookDate,extra:'forged'},{}
 ]){
  response=await direct(estimateId,invalid);eq(response.status,400,'Only a single authentic-looking nonfuture date is accepted');
  eq(snapshot(),before,'Malformed booking date does not mutate data');
 }
 // Date outside the window does not add a late-promotion discount.
 const laterStart={...booking,startOn:'2027-01-01'};
 store({...catalog,promotions:[bundle,laterStart]});response=await invoke(estimateId,bookDate);
 eq(response.status,200,'Valid date outside saved campaign is a normal preview');
 data=await response.json();eq(data.newlyEligible.length,0,'Future-starting booking offer not credited');
 eq(data.possibleSavingsCents,0,'Out-of-window booking does not invent savings');
 store({...catalog,revision:id(98)});eq((await invoke(estimateId,bookDate)).status,409,'Current catalog revision mismatch forces manual review');
 store(catalog);
 r.db.prepare('UPDATE estimate_items SET name=? WHERE estimate_id=? AND name=?').run('Custom edited service title',estimateId,'House Wash');
 eq((await invoke(estimateId,bookDate)).status,409,'Changed qualifying service forces manual review');
 r.db.prepare('UPDATE estimate_items SET name=? WHERE estimate_id=? AND name=?').run('House Wash',estimateId,'Custom edited service title');
 const metaKey='fire:estimate-promotion-attribution:v1:'+estimateId;
 const savedMeta=r.db.prepare('SELECT body FROM message_templates WHERE key=?').get(metaKey).body;
 r.db.prepare('UPDATE message_templates SET body=? WHERE key=?').run('{"tampered":true}',metaKey);
 eq((await invoke(estimateId,bookDate)).status,409,'Corrupt original saved terms cannot be repriced');
 r.db.prepare('UPDATE message_templates SET body=? WHERE key=?').run(savedMeta,metaKey);
 r.db.prepare("UPDATE estimates SET status='approved',accepted_at=?,signed_at=? WHERE id=?").run('2026-10-22','2026-10-22',estimateId);
 const acceptedSnapshot=snapshot();response=await invoke(estimateId,bookDate);eq(response.status,200,'Signed customer terms can be reviewed without mutation');data=await response.json();
 eq(data.customerAlreadyAccepted,true,'Preview warns quote already accepted');eq(snapshot(),acceptedSnapshot,'Signed amount and signature unchanged');
 r.setOwner(null);eq((await invoke(estimateId,bookDate)).status,401,'Unauthorized preview rejected');
 r.setOwner({email:'fake@example.invalid'});eq((await invoke(estimateId,bookDate)).status,401,'Nonowner refused');
 r.setOwner({email:'kylebrooks8605@gmail.com'});
 const existingBooked=await r.post({...quote,customer:'Already booked synthetic',email:'booked-'+stamp+'@example.invalid',
 additionalDiscountValue:1500,promotionEvidence:{...quote.promotionEvidence,bookingConfirmedOn:bookDate,ruleIds:[bundle.id,booking.id]}});
 eq(existingBooked.status,201,'New estimate with attested booking stored');const booked=await existingBooked.json();
 eq((await invoke(booked.id,bookDate)).status,409,'Cannot reapply already booked promotion');
 const legacy=await r.post({...quote,customer:'Old manual synthetic',email:'legacy-'+stamp+'@example.invalid',promotionEvidence:undefined});
 eq(legacy.status,201,'Legacy manual discount remains allowed');
 eq((await invoke((await legacy.json()).id,bookDate)).status,409,'No automatic amendment when provenance is missing');
 eq((await invoke('missing-id',bookDate)).status,404,'Unknown estimate returns not found');
 console.log('PASS '+tests+' owner-only synthetic read-only booking amendment preview: exact $435 to $366, $69 incremental savings, nonfuture dates, campaigns, forged inputs, ledger immutability, signed protection and legacy refusal.');
}finally{r.db.close();}
