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
 badAck=true;
 response=await r.patch(id,request([{...payload.items[0],totalCents:15500}]));
 eq(response.status,503,'Incomplete D1 batch ACK refuses success');
 eq((await response.json()).saveUncertain,true,'Incomplete ACK is not mistaken for saved success');
 r.setOwner(null);
 response=await r.patch(id,request([payload.items[0]]));
 eq(response.status,401,'Nonowner cannot edit estimate');
 eq(remote,0,'No network or Stripe call');
 console.log('PASS '+checks+'/'+checks+': real estimate PATCH SQLite confirms persisted generated service IDs, existing IDs, exact pricing, replay, no-write ACK, post-commit line/header mismatch and owner-only access.');
} finally{globalThis.fetch=originalFetch;r.db.close();}
