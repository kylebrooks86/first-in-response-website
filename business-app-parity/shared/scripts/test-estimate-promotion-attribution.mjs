/** Actual new-estimate API, frozen promotion audit and draft repricing on disposable D1/SQLite. */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
let checks=0;
const same=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const truth=(a,label)=>{assert.ok(a,label);checks++;};
const id=n=>'caca0000-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0');
const r=stackedRuntime(),model=r.load('lib/saved-promotions.ts'),audit=r.load('lib/estimate-promotion-attribution.ts');
const GET=r.load('app/api/estimates/[id]/promotions/route.ts').GET;
const services=['house-wash','gutters'];
const createdOn=model.fireDate(new Date());
const percent={id:id(1),name:'Always 15% estimate-date special',type:'percent',valueCents:1500,enabled:true,autoApply:true,startOn:null,endOn:null,dateBasis:'estimate-created',requiredServiceIds:[]};
const bundle={id:id(2),name:'House plus gutters $25',type:'dollar',valueCents:2500,enabled:true,autoApply:true,startOn:null,endOn:null,dateBasis:'estimate-created',requiredServiceIds:services};
const booking={id:id(3),name:'October booking special is pending',type:'percent',valueCents:500,enabled:true,autoApply:true,startOn:null,endOn:null,dateBasis:'booking-confirmed',requiredServiceIds:[]};
const catalog={revision:id(99),promotions:[percent,bundle,booking]};
const key=model.SAVED_PROMOTIONS_KEY;
const insertCatalog=value=>r.db.prepare("INSERT INTO message_templates(key,subject,body,updated_at) VALUES (?,'',?,'now') ON CONFLICT(key) DO UPDATE SET body=excluded.body").run(key,JSON.stringify(value));
const quote={
 customer:'Synthetic promotion quote',email:'audit-'+Date.now()+'@example.invalid',address:'Synthetic street',
 items:[{name:'House Wash',description:'Synthetic',quantity:1,unit:'job',totalCents:40000},{name:'Gutter Cleaning + Flush',description:'Synthetic',quantity:1,unit:'job',totalCents:6000}],
 additionalDiscountType:'percent',additionalDiscountValue:1500,bundleDiscountCents:2500,appreciationDiscount:false};
const evidence={revision:catalog.revision,checkedOn:createdOn,serviceIds:services,ruleIds:[percent.id,bundle.id]};
const current=()=>JSON.stringify(['customers','estimates','estimate_items','message_templates','invoices','payments'].map(t=>r.db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()));
const read=id=>GET(new Request('https://synthetic.invalid/api/estimates/'+id+'/promotions'),{params:Promise.resolve({id})});
try{
 insertCatalog(catalog);const initial=current();
 for(const bad of [
  {...evidence,revision:id(88)},
  {...evidence,checkedOn:'2026-01-01'},
  {...evidence,ruleIds:[bundle.id,percent.id]},
  {...evidence,ruleIds:[percent.id,bundle.id,booking.id]},
  {...evidence,serviceIds:['house-wash','invalid-service']},
  {...evidence,serviceIds:['house-wash','house-wash']},
  {...evidence,checkedOn:'2026-02-30'},
  {...evidence,unexpected:true}
 ]){
  const response=await r.post({...quote,promotionEvidence:bad});same(response.status,409,'Tampered/stale attribution is rejected');
  same(current(),initial,'Rejected attribution has no customer/estimate writes');
 }
 same((await r.post({...quote,additionalDiscountValue:1400,promotionEvidence:evidence})).status,409,'Amount does not match selected percent');
 same((await r.post({...quote,bundleDiscountCents:2600,promotionEvidence:evidence})).status,409,'Amount does not match saved bundle');
 same((await r.post({...quote,items:[{...quote.items[0],name:'Edited house title'},quote.items[1]],promotionEvidence:evidence})).status,409,'Renamed service requires a fresh/manual quote');
 same((await r.post({...quote,promotionEvidence:{...evidence,ruleIds:[booking.id]}})).status,409,'Unconfirmed booking cannot be attributed');
 same(current(),initial,'All forged pricing requests remain without writes');
 let response=await r.post({...quote,promotionEvidence:evidence});same(response.status,201,'Actual estimate creation with audited promotions');
 const saved=await response.json();same(saved.totalCents,36600,'15% plus $25 = $366');
 same(saved.depositCents,18300,'Half deposit $183');
 same(saved.promotionAttributionSaved,true,'Receipt confirms atomic rule audit');
 const quoteId=saved.id;
 const row=r.db.prepare('SELECT body FROM message_templates WHERE key=?').get(audit.ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX+quoteId);
 truth(Boolean(row?.body),'Frozen attribution persisted');
 let frozen=JSON.parse(row.body);
 same(frozen.rules.map(x=>x.name),[percent.name,bundle.name],'Exact original rule names retained');
 same(frozen.flatDiscountCents,2500,'Exact bundle cents frozen');
 same(frozen.percentBasisPoints,1500,'Exact percent basis points frozen');
 same(frozen.checkedOn,createdOn,'Tulsa date frozen');
 response=await read(quoteId);same(response.status,200,'Owner may inspect frozen rule history');
 same((await response.json()).attribution.catalogRevision,catalog.revision,'Saved original revision reads back');
 insertCatalog({revision:id(98),promotions:[]});response=await read(quoteId);
 same(response.status,200,'Existing quote survives future offer deletion and revision');
 same((await response.json()).attribution.rules.length,2,'Rule identities not recomputed from edited catalog');
 const quoteBefore=r.db.prepare('SELECT * FROM estimates WHERE id=?').get(quoteId);
 r.db.prepare('UPDATE message_templates SET body=? WHERE key=?').run('{"malformed":true}',audit.ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX+quoteId);
 same((await read(quoteId)).status,409,'Corrupt attribution read fails closed');
 same(r.db.prepare('SELECT * FROM estimates WHERE id=?').get(quoteId),quoteBefore,'Corrupt evidence cannot mutate agreed totals');
 r.db.prepare('UPDATE message_templates SET body=? WHERE key=?').run(row.body,audit.ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX+quoteId);
 response=await r.patch(quoteId,{...quote,items:quote.items.map(item=>({...item,description:'Owner clarified access instructions'}))});
 same(response.status,200,'Description-only edit remains available');
 same(r.db.prepare('SELECT body FROM message_templates WHERE key=?').get(audit.ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX+quoteId).body,row.body,'Description/no-op save preserves original attribution byte for byte despite later catalog deletion');
 same((await read(quoteId)).status,200,'Original rule history still reads after description edit');
 // Plausible-looking but false discount amounts cannot be attached to real totals.
 const falseTerms={...frozen,flatDiscountCents:47000,rules:frozen.rules.map(rule=>rule.type==='dollar'?{...rule,valueCents:47000}:rule)};
 r.db.prepare('UPDATE message_templates SET body=? WHERE key=?').run(JSON.stringify(falseTerms),audit.ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX+quoteId);
 same((await read(quoteId)).status,409,'Corrupt terms with flat savings above subtotal are not presented as historical proof');
 const beforeCorrupt=current();same((await r.patch(quoteId,{...quote,items:quote.items})).status,409);same(current(),beforeCorrupt,'Editing does not erase unverifiable history');
 r.db.prepare('UPDATE message_templates SET body=? WHERE key=?').run(row.body,audit.ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX+quoteId);
 response=await r.patch(quoteId,{...quote,items:quote.items,bundleDiscountCents:2000});
 same(response.status,200,'Owner may reprice unsigned draft');
 same(r.db.prepare('SELECT body FROM message_templates WHERE key=?').get(audit.ESTIMATE_PROMOTION_ATTRIBUTION_PREFIX+quoteId),undefined,'Repriced draft does not claim old promotion rules');
 response=await read(quoteId);same((await response.json()).attribution,null,'Old attribution does not survive draft repricing');
 insertCatalog(catalog);response=await r.post({...quote,customer:'Synthetic signed audit',email:'signed-'+Date.now()+'@example.invalid',promotionEvidence:evidence});
 same(response.status,201);const signed=(await response.json()).id;
 r.db.prepare("UPDATE estimates SET status='approved',signed_at='2026-10-22',accepted_at='2026-10-22' WHERE id=?").run(signed);
 same((await r.patch(signed,{...quote,items:quote.items,bundleDiscountCents:0})).status,409,'Signed approved estimate cannot be repriced');
 same((await read(signed)).status,200,'Signed promotion evidence remains available');
 r.setOwner(null);same((await read(signed)).status,401,'Unauthenticated history read refused');
 r.setOwner({email:'other@example.invalid'});same((await read(signed)).status,401,'Nonowner history read refused');
 r.setOwner({email:'kylebrooks8605@gmail.com'});
 response=await r.post({...quote,customer:'Legacy manual discount',email:'legacy-'+Date.now()+'@example.invalid'});same(response.status,201,'Legacy manual quote remains permitted');
 const legacy=(await response.json()).id;response=await read(legacy);same((await response.json()).attribution,null,'Legacy quote has no invented automatic attribution');
 console.log('PASS '+checks+' real SQLite promotion attribution API: forged dates/services/terms rejected, $366 quote, frozen rule names, catalog edits, corrupt reads, signed holds, legacy/manual compatibility and owner-only audit.');
}finally{r.db.close();}
