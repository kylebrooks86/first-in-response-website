/** Real FIRE owner POST /api/estimates and idempotent replay with native,
 * disposable SQLite. Verifies actual D1-shaped service IDs and lost ACK safety.
 * Synthetic customers and no hosted/API/network requests.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
const r=stackedRuntime(),eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
let checks=0,network=0,skipBatch=false,corruptLine=false,badAck=false;
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{network++;throw Error('No remote requests');};
const originalBatch=r.env.DB.batch;
r.env.DB.batch=async statements=>{
 if(skipBatch){skipBatch=false;return statements.map(()=>({success:true,meta:{changes:0}}));}
 const value=await originalBatch(statements);
 if(corruptLine){corruptLine=false;r.db.prepare("UPDATE estimate_items SET name='Unexpected synthetic line' WHERE rowid=(SELECT MAX(rowid) FROM estimate_items)").run();}
 if(badAck){badAck=false;return value.slice(1);}
 return value;
};
const quote=(requestId=randomUUID())=>({requestId,customer:'Synthetic new estimate '+requestId.slice(0,7),
 email:requestId.slice(0,7)+'@example.invalid',address:'Synthetic Tulsa 74101',
 items:[
  {name:'House wash',description:'Owner-selected 0.22 starting rate',quantity:1000,unit:'sq ft',totalCents:22000},
  {name:'Gutters',description:'50 ft exact current rate',quantity:50,unit:'linear ft',totalCents:7500}
 ],appreciationDiscount:false,additionalDiscountType:'percent',additionalDiscountValue:0,bundleDiscountCents:0});
const itemRows=id=>r.db.prepare('SELECT id,name,description,quantity,unit,total_cents AS totalCents FROM estimate_items WHERE estimate_id=? ORDER BY rowid').all(id);
try{
 const input=quote();let response=await r.post(input);
 eq(response.status,201,'New estimate success');const created=await response.json();
 eq(created.id,input.requestId,'Operation UUID is actual estimate ID');
 eq(created.totalCents,29500,'Exact starting price plus gutter total');
 eq(created.depositCents,14750,'Exact half deposit');
 eq(created.items.length,2,'Both service rows present on server receipt');
 const rows=itemRows(created.id);
 eq(created.items.map(x=>x.id),rows.map(x=>x.id),'IDs match actual SQLite rows');
 eq(created.items.every(x=>typeof x.id==='string'&&x.id.length>20&&!x.id.startsWith('new-')),true,
   'All IDs are persisted UUIDs, never temporary placeholders');
 eq(created.items.map(x=>x.totalCents),rows.map(x=>x.totalCents),'Each exact cent matches real saved row');
 response=await r.post(input);
 eq(response.status,200,'Idempotent same-request replay');
 const replay=await response.json();
 eq(replay.replayed,true,'Replay does not create another estimate');
 eq(replay.items.map(x=>x.id),created.items.map(x=>x.id),'Replay uses original immutable saved UUIDs');
 eq(r.db.prepare('SELECT COUNT(*) AS n FROM estimates WHERE id=?').get(input.requestId).n,1,'No duplicate estimate');
 eq(r.db.prepare('SELECT COUNT(*) AS n FROM estimate_items WHERE estimate_id=?').get(input.requestId).n,2,'No duplicate service rows');
 skipBatch=true;
 const skipped=quote();response=await r.post(skipped);
 eq(response.status,503,'Nonthrowing fake batch acknowledgment must not claim a saved estimate');
 eq((await response.json()).saveUncertain,true,'Failed save exposes uncertain receipt');
 eq(r.db.prepare('SELECT COUNT(*) AS n FROM estimates WHERE id=?').get(skipped.requestId).n,0,'Skipped batch contains no estimate row');
 corruptLine=true;
 const corrupted=quote();response=await r.post(corrupted);
 eq(response.status,503,'Post-commit mismatched service row refuses successful receipt');
 eq((await response.json()).saveUncertain,true,'Persisted-but-mismatched line requires recheck');
 eq(r.db.prepare('SELECT COUNT(*) AS n FROM estimates WHERE id=?').get(corrupted.requestId).n,1,'Bad readback does not delete committed estimate');
 badAck=true;
 const lost=quote();response=await r.post(lost);
 eq(response.status,503,'Incomplete batch ACK must not look like success');
 const uncertain=await response.json();eq(uncertain.saveUncertain,true,'Incomplete ACK flagged');
 const committed=itemRows(lost.requestId);
 eq(committed.length,2,'Incomplete ACK may occur after a truly committed transaction');
 response=await r.post(lost);
 eq(response.status,200,'Owner safely reuses same ID for recovery');
 const restored=await response.json();
 eq(restored.items.map(i=>i.id),committed.map(i=>i.id),'Recovered receipt reuses saved original service IDs');
 eq(r.db.prepare('SELECT COUNT(*) AS n FROM estimates WHERE id=?').get(lost.requestId).n,1,'Same request ID does not duplicate');
 r.setOwner(null);eq((await r.post(quote())).status,401,'Nonowner cannot POST');
 eq(network,0,'No Stripe/provider/network operation');
 console.log('PASS '+checks+'/'+checks+': real New Estimate POST/replay on disposable SQLite returns durable service UUIDs, exact pricing, avoids silent/no-write success, and safely recovers lost acknowledgments.');
} finally{globalThis.fetch=originalFetch;r.db.close();}
