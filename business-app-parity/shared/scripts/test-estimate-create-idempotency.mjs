/** Real deployed-route code on throwaway in-memory SQLite, no hosted writes.
 * Every request ID binds permanently to one quote and its precise financial receipt.
 */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';

let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const uuid=n=>'ccaa0000-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0');
const runtime=stackedRuntime(),db=runtime.db;
const proofKey='fire:estimate-create-request:v1:';
const statusEndpoint=runtime.load('app/api/estimates/create-status/route.ts').GET;
const lookup=async requestId=>{const response=await statusEndpoint(new Request('https://synthetic.invalid/api/estimates/create-status?requestId='+encodeURIComponent(requestId)));return {status:response.status,body:await response.json(),cache:response.headers.get('cache-control')};};
const post=async body=>{const response=await runtime.post(body);return {status:response.status,body:await response.json()};};
const quote={requestId:uuid(1),customer:'Synthetic safe replay',email:'safe-replay@example.invalid',phone:'9185550100',address:'100 Synthetic Tulsa St',items:[{name:'House Wash',description:'Front and rear',quantity:1540,unit:'sq ft',totalCents:38500},{name:'Gutter Cleaning + Flush',description:'One section',quantity:50,unit:'linear ft',totalCents:7500}],appreciationDiscount:false,additionalDiscountType:'percent',additionalDiscountValue:1500,bundleDiscountCents:2500};
const count=table=>Number(db.prepare('SELECT COUNT(*) AS count FROM '+table).get().count);
const financialSnapshot=()=>JSON.stringify(['customers','estimates','estimate_items','message_templates','invoices','payments'].map(name=>db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()));
try{
 const first=await post(quote);
 eq(first.status,201,'First UUID quote creates one estimate');
 eq(first.body.id,quote.requestId,'Persisted ID matches reusable owner operation UUID');
 eq(first.body.requestId,quote.requestId,'Receipt echoes original operation UUID');
 eq(first.body.replayed,false,'First write not labelled replay');
 eq(first.body.totalCents,36600,'15 percent and $25 bundle stack to $366');
 eq(first.body.depositCents,18300,'50 percent scheduling deposit exactly $183');
 eq(count('estimates'),1,'One estimate exists after first POST');
 const proofRaw=db.prepare('SELECT body FROM message_templates WHERE key=?').get(proofKey+quote.requestId)?.body;
 eq(Boolean(proofRaw),true,'Atomic immutable request proof exists alongside quote');
 let found=await lookup(quote.requestId);
 eq(found.status,200,'Owner may perform exact read-only recovery by request UUID');
 eq(found.body.found,true,'Recovered quote exists');
 eq(found.body.recognized,true,'Creation audit proof matches saved quote identity');
 eq(found.body.estimate.id,quote.requestId,'Recovery returns the exact quote, not an arbitrary recent quote');
 eq(found.body.estimate.depositCents,18300,'Recovery displays persisted original deposit');
 eq(found.cache,'private, no-store','Authenticated quote-recovery replies cannot be cached');
 eq((await lookup(uuid(999))).body.found,false,'Missing UUID does not return an unrelated quote');
 eq((await lookup('not-uuid')).status,400,'Malformed exact-lookup ID rejected');
 const proof=JSON.parse(proofRaw);
 eq(proof.requestId,quote.requestId,'Proof is scoped to the exact UUID');
 eq(proof.requestHash.length,64,'Proof contains SHA-256 only, not customer PII');
 eq(proofRaw.includes(quote.email),false,'No raw customer email duplicated into creation proof');
 const before=financialSnapshot(),writes=runtime.counters().writes;
 let replay=await post(quote);
 eq(replay.status,200,'Lost-response replay safely returns existing quote');
 eq(replay.body.replayed,true,'Replay clearly identified');
 eq(replay.body.id,first.body.id,'Replay preserves original estimate identity');
 eq(replay.body.shareToken,first.body.shareToken,'Replay does not generate another public quote token');
 eq(replay.body.totalCents,first.body.totalCents,'Replay preserves exact total');
 eq(replay.body.depositCents,first.body.depositCents,'Replay preserves exact deposit');
 eq(financialSnapshot(),before,'Replay causes zero customer/quote/payment writes');
 eq(runtime.counters().writes,writes,'Replay does not execute a new SQL write');
 for(const bad of [
  {...quote,customer:'Another homeowner'},
  {...quote,items:[{...quote.items[0],description:'Different job expectations'},quote.items[1]]},
  {...quote,bundleDiscountCents:0},
  {...quote,additionalDiscountValue:1450},
  {...quote,address:'Different property'}
 ]){
  const result=await post(bad);
  eq(result.status,409,'Same request UUID cannot be reassigned to altered customer/scope/money');
  eq(financialSnapshot(),before,'Conflicting reuse leaves all rows unchanged');
 }
 const invalid=[null,1,'not-a-uuid','ccaa0000-aaaa-1000-8000-000000000001','ccaa0000-aaaa-4000-0000-000000000001'];
 for(const requestId of invalid){eq((await post({...quote,requestId})).status,400,'Invalid operation UUID is rejected before writes');eq(financialSnapshot(),before,'Invalid operation leaves persisted financial state intact');}
 eq((await post({...quote,requestId:uuid(2),customer:'New customer',email:'other@example.invalid',items:[]})).status,400,'Missing service list safely rejected');
 eq(count('estimates'),1,'Malformed new attempt never adds an estimate');
 // Current catalog eligibility can change after a successful quote: replay is NOT a new quote.
 db.prepare("DELETE FROM message_templates WHERE key='fire:saved-promotions:v1'").run();
 replay=await post(quote);
 eq(replay.status,200,'Catalog removal cannot invalidate an already recorded quote receipt');
 eq(replay.body.totalCents,36600,'Original savings are preserved without reapplying current offers');
 // If the existing draft has been edited, return a conflict rather than an inaccurate receipt.
 db.prepare("UPDATE estimate_items SET description='Manually revised scope' WHERE estimate_id=?").run(quote.requestId);
 eq((await post(quote)).status,409,'Service edits refuse stale duplicate-success receipt');
 db.prepare("UPDATE estimate_items SET description='Front and rear' WHERE estimate_id=? AND name='House Wash'").run(quote.requestId);
 db.prepare("UPDATE estimates SET total_cents=35000 WHERE id=?").run(quote.requestId);
 eq((await post(quote)).status,409,'Changed agreed total refuses stale duplicate-success receipt');
 db.prepare("UPDATE estimates SET total_cents=36600,status='approved' WHERE id=?").run(quote.requestId);
 eq((await post(quote)).status,409,'Signed/approved quote cannot be represented as a fresh draft');
 db.prepare("UPDATE estimates SET status='draft' WHERE id=?").run(quote.requestId);
 db.prepare("UPDATE message_templates SET body='{broken proof}' WHERE key=?").run(proofKey+quote.requestId);
 eq((await post(quote)).status,409,'Corrupted persisted request proof fails closed');
 db.prepare("UPDATE message_templates SET body=? WHERE key=?").run(proofRaw,proofKey+quote.requestId);
 runtime.setOwner(null);
 eq((await lookup(quote.requestId)).status,401,'Unauthenticated exact lookup cannot disclose quotes');
 eq((await post(quote)).status,401,'Unauthenticated owner cannot enumerate UUID receipts');
 runtime.setOwner({email:'other@example.invalid'});
 eq((await lookup(quote.requestId)).status,401,'Nonowner exact lookup refused');
 eq((await post(quote)).status,401,'Nonowner session cannot replay existing quote');
 runtime.setOwner({email:'kylebrooks8605@gmail.com'});
 // When the immutable creation receipt cannot be written, the entire customer/estimate batch rolls back.
 const beforeFailure=financialSnapshot();runtime.failMetadata(true);
 const failure=await post({...quote,requestId:uuid(111),customer:'Synthetic atomic failure',email:'atomic-failure@example.invalid',phone:'9185550888',address:'111 Synthetic Atomic St',additionalDiscountValue:0,bundleDiscountCents:0});
 eq(failure.status,500,'Failed creation proof write makes the attempted quote unconfirmed');
 eq(financialSnapshot(),beforeFailure,'Failed proof cannot leave an orphan customer or estimate');
 runtime.failMetadata(false);
 // Without a request ID, legacy clients still create quotes normally.
 const legacy=await post({...quote,requestId:undefined,customer:'Synthetic legacy customer',email:'legacy-replay@example.invalid',phone:'9185550999',address:'200 Legacy Fixture Rd'});
 eq(legacy.status,201,'Legacy POST with no request ID remains backward compatible');
 eq(legacy.body.requestId,undefined,'Legacy successful response stays compatible');
 eq(count('estimates'),2,'Legacy quote still saves one new record');
 console.log('PASS '+checks+'/'+checks+': server-side immutable estimate UUIDs, lost-response replay, unchanged discount/deposit, conflict and tamper refusal, no-write replay, owner-only auth, legacy compatibility.');
}finally{db.close();}
