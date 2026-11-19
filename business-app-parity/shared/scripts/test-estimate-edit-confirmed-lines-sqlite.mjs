/** Actual owner PATCH /api/estimates/:id against disposable native SQLite.
 * No Cloudflare credentials, hosted DB, real customer or Stripe requests.
 */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
const r=stackedRuntime();let checks=0,remote=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{remote++;throw Error('No remote calls permitted');};
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const quote={customer:'Synthetic estimate edit',email:'estimate-edit@example.invalid',
  items:[{name:'Initial 1st floor',description:'Synthetic original',quantity:1,unit:'job',totalCents:22000}],
  appreciationDiscount:false,additionalDiscountType:'percent',additionalDiscountValue:0,bundleDiscountCents:0};
const lines=id=>r.db.prepare('SELECT id,name,description,quantity,unit,total_cents AS totalCents FROM estimate_items WHERE estimate_id=? ORDER BY rowid').all(id);
const request=items=>({...quote,items});
const originalBatch=r.env.DB.batch;
let skipBatch=false,corruptLines=false,corruptHeader=false,badAck=false;
r.env.DB.batch=async statements=>{
  if(skipBatch){skipBatch=false;return statements.map(()=>({success:true,meta:{changes:0}}));}
  const value=await originalBatch(statements);
  if(corruptLines){corruptLines=false;r.db.prepare("UPDATE estimate_items SET name='Not requested' WHERE id=(SELECT id FROM estimate_items ORDER BY rowid DESC LIMIT 1)").run();}
  if(corruptHeader){corruptHeader=false;r.db.prepare('UPDATE estimates SET total_cents=total_cents+1 WHERE id=(SELECT estimate_id FROM estimate_items ORDER BY rowid DESC LIMIT 1)').run();}
  if(badAck){badAck=false;return value.slice(1);}
  return value;
};
try{
 let response=await r.post(quote);eq(response.status,201,'Create disposable estimate');const made=await response.json(),id=made.id;
 const originalLine=lines(id)[0];
 response=await r.patch(id,request([
   {id:originalLine.id,name:'Initial 1st floor',description:'Kept existing ID',quantity:1,unit:'job',totalCents:22000},
   {name:'Gutters',description:'Added one actual new service',quantity:50,unit:'linear ft',totalCents:7500}
 ]));
 eq(response.status,200,'Additional estimate service saved');
 let payload=(await response.json()).estimate;
 eq(payload.totalCents,29500,'No silent $150 floor');
 eq(payload.depositCents,14750,'Deposit exact half');
 eq(payload.items.length,2,'Returned all persisted rows');
 eq(payload.items[0].id,originalLine.id,'Existing ID retained');
 const stored=lines(id);
 eq(payload.items.map(i=>i.id),stored.map(i=>i.id),'Response IDs are exact saved D1 keys');
 eq(payload.items.map(i=>i.totalCents),stored.map(i=>i.totalCents),'Response cents are exactly saved');
 eq(payload.items[1].id.length>20,true,'Real generated item UUID, no temp new-N ID');
 response=await r.patch(id,request(payload.items.map(x=>({...x,description:'Updated '+x.description}))));
 eq(response.status,200,'Second editor save with saved line IDs succeeds');
 payload=(await response.json()).estimate;
 eq(payload.items.map(x=>x.id),stored.map(x=>x.id),'Editing again reuses both genuine D1 keys');
 eq(payload.items.map(x=>x.description),lines(id).map(x=>x.description),'Second save truly persisted edits');
 const beforeNoop=JSON.stringify(lines(id));
 skipBatch=true;
 response=await r.patch(id,request([{...payload.items[0],totalCents:10000}]));
 eq(response.status,503,'Nonthrowing but skipped batch must NOT report saved quote');
 eq((await response.json()).saveUncertain,true,'Uncertain response explicitly flagged');
 eq(JSON.stringify(lines(id)),beforeNoop,'Silent batch no-write did not change original D1 rows');
 corruptLines=true;
 response=await r.patch(id,request([{...payload.items[0],description:'Queued different service line'}]));
 eq(response.status,503,'Post-commit line mismatch blocks successful receipt');
 eq((await response.json()).saveUncertain,true,'Committed-but-corrupt line is flagged uncertain');
 corruptHeader=true;
 response=await r.patch(id,request([{...payload.items[0],totalCents:12500}]));
 eq(response.status,503,'Post-commit total mismatch blocks successful receipt');
 // Restore ONLY the synthetic corruption; the next scenario must test the
 // incomplete batch ACK, not fail an unrelated prior-history integrity guard.
 r.db.prepare('UPDATE estimates SET total_cents=? WHERE id=?').run(12500,id);
 badAck=true;
 response=await r.patch(id,request([{...payload.items[0],totalCents:15500}]));
 eq(response.status,503,'Incomplete D1 batch ACK refuses success: '+JSON.stringify(await response.clone().json()));
 eq((await response.json()).saveUncertain,true,'Incomplete ACK is not mistaken for saved success');
 // Same quote opened in TWO owner tabs: the later save must not be undone
 // by an older unsent editor (even when no payment/invoice yet exists).
 const sourceSnapshot=()=>{
   const header=r.db.prepare(`SELECT status,subtotal_cents AS subtotalCents,discount_cents AS discountCents,
     total_cents AS totalCents,deposit_cents AS depositCents,
     appreciation_discount AS appreciationDiscount,additional_discount_type AS additionalDiscountType,
     additional_discount_value AS additionalDiscountValue FROM estimates WHERE id=?`).get(id);
   return {...header,items:lines(id)};
 };
 const opened=sourceSnapshot();
 response=await r.patch(id,{...request([{...opened.items[0],description:'Newer owner reviewed service'}]),expectedSaved:opened});
 eq(response.status,200,'Current quote editor source snapshot permits a real saved edit');
 eq(lines(id)[0].description,'Newer owner reviewed service','Current owner service saved');
 response=await r.patch(id,{...request([{...opened.items[0],description:'Older stale owner edit'}]),expectedSaved:opened});
 eq(response.status,409,'Concurrent stale quote preflight rejects older owner editor');
 eq((await response.json()).staleEstimate,true,'Stale quote error names a conflicting source');
 eq(lines(id)[0].description,'Newer owner reviewed service','Older tab could not replace newer service');
 const newest=sourceSnapshot();
 // A race AFTER the source-read preflight must be defeated at the SQLite
 // transaction boundary, not only by a read before the batch.
 const priorBatch=r.env.DB.batch;
 let injectCompetingLine=true;
 r.env.DB.batch=async statements=>{
   if(injectCompetingLine){
     injectCompetingLine=false;
     r.db.prepare('UPDATE estimate_items SET description=? WHERE id=?').run('Other tab won before write',newest.items[0].id);
   }
   return priorBatch(statements);
 };
 response=await r.patch(id,{...request([{...newest.items[0],description:'Old tab tries to replace winner'}]),expectedSaved:newest});
 eq(response.status,503,'Atomic SQL guard aborts a write-boundary stale quote race');
 eq((await response.json()).saveUncertain,true,'Rejected race never reports saved services');
 eq(lines(id)[0].description,'Other tab won before write','Failed atomic quote batch preserved other tab service');
 r.env.DB.batch=priorBatch;
 const reviewed=sourceSnapshot();
 response=await r.patch(id,{...request([{...reviewed.items[0],description:'Owner consciously reviewed newest'}]),expectedSaved:reviewed});
 eq(response.status,200,'Fresh deliberate source version can save after stale edit');
 eq(lines(id)[0].description,'Owner consciously reviewed newest','Refreshed owner edit saved without lost updates');
 // Gate6: exercise the ACTUAL estimate PATCH handler with browser metadata.
 // These are forged authenticated-owner browser requests, not nonowner tests.
 // They must never parse/consult D1, and must not change the saved quote.
 const ownerPatch=r.load('app/api/estimates/[id]/route.ts').PATCH;
 const forgedCases=[
  [{origin:'https://other.invalid','content-type':'application/json'},403,'foreign Origin'],
  [{origin:'https://sibling.synthetic.invalid','sec-fetch-site':'same-site','content-type':'application/json'},403,'sibling host'],
  [{origin:'https://synthetic.invalid','sec-fetch-site':'cross-site','content-type':'application/json'},403,'cross-site metadata'],
  [{origin:'null','content-type':'application/json'},403,'null Origin'],
  [{'sec-fetch-site':'none','content-type':'application/json'},403,'browser none metadata'],
  [{origin:'https://synthetic.invalid','sec-fetch-site':'same-origin','content-type':'text/plain'},415,'form-compatible body']
 ];
 for(const [headers,expected,label] of forgedCases){
  const before=r.counters(),saved=lines(id);
  const reply=await ownerPatch(new Request('https://synthetic.invalid/api/estimates/'+id,
   {method:'PATCH',headers,body:JSON.stringify({status:'declined'})}),{params:Promise.resolve({id})});
  eq(reply.status,expected,'Authenticated owner estimate PATCH refuses '+label);
  eq(r.counters(),before,label+' is rejected before any D1 reads/writes');
  eq(lines(id),saved,label+' preserves original estimate service lines');
 }
 const sameOrigin=await ownerPatch(new Request('https://synthetic.invalid/api/estimates/'+id,
  {method:'PATCH',headers:{origin:'https://synthetic.invalid','sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify({status:'draft'})}),
  {params:Promise.resolve({id})});
 eq(sameOrigin.status,200,'Legitimate same-origin JSON owner estimate PATCH remains functional');
 r.setOwner(null);
 response=await r.patch(id,request([payload.items[0]]));
 eq(response.status,401,'Nonowner cannot edit estimate');
 eq(remote,0,'No network or Stripe call');
 console.log('PASS '+checks+'/'+checks+': real estimate PATCH SQLite confirms persisted generated service IDs, existing IDs, exact pricing, replay, no-write ACK, post-commit line/header mismatch and owner-only access.');
} finally{globalThis.fetch=originalFetch;r.db.close();}
