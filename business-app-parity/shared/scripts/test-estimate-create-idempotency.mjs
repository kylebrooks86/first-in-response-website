/** Real deployed-route code on throwaway in-memory SQLite, no hosted writes.
 * Every request ID binds permanently to one quote and its precise financial receipt.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
 // The real New Estimate modal must refuse invalid NEW contact details
 // before reserving its single idempotency key; legacy selected contacts
 // are not silently overwritten or screened out.
 const dashboard=readFileSync('app/dashboard.tsx','utf8');
 const start=dashboard.indexOf('const saveEstimate = async () => {');
 const end=dashboard.indexOf('const requestId=createRequestRef.current??crypto.randomUUID();',start);
 const preflight=dashboard.slice(start,end);
 eq(start>=0&&end>start,true,'New Estimate save handler and ID reservation found');
 eq(preflight.includes("if(customerMode==='new'&&!selectedCustomer)"),true,'Client validates only inline new customers');
 eq(preflight.includes("email.trim()&&!usableCustomerEmail(email)"),true,'Inline customer email is checked before save ID');
 eq(preflight.includes("phone.trim()&&!usableCustomerPhone(phone)"),true,'Inline customer phone is checked before save ID');
 eq(preflight.includes('setStep(1);setError("Enter a valid customer email address'),true,'Bad email stays on contact step');
 eq(preflight.includes('setStep(1);setError("Enter a valid 10-digit U.S. customer phone'),true,'Bad phone stays on contact step');
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
 // Read-only recovery must never mark an altered saved quote as verified.
 const savedTotal=first.body.totalCents;
 db.prepare('UPDATE estimates SET total_cents=total_cents+1 WHERE id=?').run(quote.requestId);
 eq((await lookup(quote.requestId)).body.recognized,false,'Read-only recovery refuses a changed total');
 db.prepare('UPDATE estimates SET total_cents=? WHERE id=?').run(savedTotal,quote.requestId);
 db.prepare('UPDATE estimates SET deposit_cents=deposit_cents+1 WHERE id=?').run(quote.requestId);
 eq((await lookup(quote.requestId)).body.recognized,false,'Read-only recovery refuses a changed 50 percent deposit');
 db.prepare('UPDATE estimates SET deposit_cents=? WHERE id=?').run(first.body.depositCents,quote.requestId);
 db.prepare('UPDATE estimate_items SET total_cents=total_cents+1 WHERE estimate_id=? AND name=?').run(quote.requestId,'House Wash');
 eq((await lookup(quote.requestId)).body.recognized,false,'Read-only recovery refuses a changed service subtotal');
 db.prepare('UPDATE estimate_items SET total_cents=total_cents-1 WHERE estimate_id=? AND name=?').run(quote.requestId,'House Wash');
 db.prepare("UPDATE estimates SET status='approved' WHERE id=?").run(quote.requestId);
 eq((await lookup(quote.requestId)).body.recognized,false,'Approved quotes require manual review instead of draft receipt verification');
 db.prepare("UPDATE estimates SET status='draft' WHERE id=?").run(quote.requestId);
 eq((await lookup(quote.requestId)).body.recognized,true,'Exact saved quote becomes verified again after restoring immutable amounts');

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
 // New Estimate has its own inline-customer INSERT path and must not bypass
 // the Add Customer contact rules. Reject before ANY customer or quote write;
 // an older saved customer with an imperfect contact remains selectable.
 const contactBefore=financialSnapshot(),contactWrites=runtime.counters().writes;
 for(const [index,fields] of [
  {email:'missing-at-sign.example.invalid',phone:'9185550222'},
  {email:'invalid@example',phone:'9185550222'},
  {email:'new-good@example.invalid',phone:'(918) 123'},
  {email:'',phone:'text-me-later'},
  {email:'new-good@example.invalid',phone:'+44 20 7946 0958'}
 ].entries()){
   const rejected=await post({...quote,
     requestId:uuid(300+index),customer:'Invalid Inline '+index,
     email:fields.email,phone:fields.phone,address:'New Synthetic Property '+index
   });
   eq(rejected.status,400,'New Estimate inline new customer rejects invalid phone/email');
   eq(rejected.body.error.includes('No customer or estimate created.'),true,
     'Inline contact error explains no record created');
   eq(financialSnapshot(),contactBefore,'Inline contact rejection leaves every customer and financial row unchanged');
   eq(runtime.counters().writes,contactWrites,'Inline validation rejects before any D1 write');
 }

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

 // NEW behavior: when permanent Job # is enabled, a saved quote must be
 // recognized only if it has its genuine immutable same-customer job link.
 db.exec(readFileSync('../job-numbering/job_numbers_v1.sql','utf8'));
 runtime.env.FIRE_JOB_NUMBERS_CANDIDATE='owner-approved-schema-v1';
 const beforeNumbered=financialSnapshot();
 const missingKey=await post({...quote,requestId:undefined,customer:'Synthetic unsafe legacy retry'});
 eq(missingKey.status,409,'Enabled numbering refuses a request without an idempotency UUID');
 eq(financialSnapshot(),beforeNumbered,'Missing numbered request ID writes no financial or customer record');

 const unresolved=await lookup(quote.requestId);
 eq(unresolved.status,200,'Saved quote can still be inspected when Job # is missing');
 eq(unresolved.body.recognized,false,'Unnumbered estimate cannot be confirmed as a recovered success');
 eq(unresolved.body.estimate.jobNumber,null,'No invented permanent Job # for an incomplete historical link');
 const missingReplay=await post(quote);
 eq(missingReplay.status,503,'Idempotent replay with missing Job # refuses inaccurate success');
 eq(missingReplay.body.saveUncertain,true,'Missing number advises reviewing existing quote, not creating a duplicate');
 eq(financialSnapshot(),beforeNumbered,'Missing-number replay writes nothing');

 const originalTime=db.prepare('SELECT created_at FROM estimates WHERE id=?').get(quote.requestId).created_at;
 db.prepare('INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES (?,?)').run(quote.requestId,originalTime);
 db.prepare('INSERT INTO fire_job_estimate_links(estimate_id,job_number) SELECT ?,job_number FROM fire_job_numbers WHERE root_estimate_id=?').run(quote.requestId,quote.requestId);
 const recovered=await lookup(quote.requestId);
 eq(recovered.body.recognized,true,'A genuine same-customer permanent Job # restores read-only recovery');
 eq(recovered.body.estimate.jobNumber,1,'Recovery returns actual saved Job #0001 serial');
 const numberedReplay=await post(quote);
 eq(numberedReplay.status,200,'Idempotent replay succeeds with a valid original Job #');
 eq(numberedReplay.body.jobNumber,1,'Replay returns the original immutable serial, never another number');
 eq(count('estimates'),2,'Verifying Job # creates no duplicate estimate');

 console.log('PASS '+checks+'/'+checks+': immutable estimate UUIDs, safe numbered Job # save/replay/recovery, no-ID refusal, discounts, deposit and legacy compatibility.');
}finally{db.close();}
