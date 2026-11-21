/** Independent DR owner customer-message POST regression: actual route and disposable native SQLite.
 * Does not send customer communications or modify Cloudflare, Stripe, hosted D1 or payments.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
import {readOwnerWriteObject} from '../lib/customer-write-request-guard.mjs';

const path=process.env.FIRE_DR_CUSTOMER_MESSAGES_ROUTE;
assert.ok(path,'Pin actual independent DR TypeScript source from the PR checkout');
const source=readFileSync(path,'utf8');
const db=new DatabaseSync(':memory:');
db.exec(`
 CREATE TABLE customers(id TEXT PRIMARY KEY,name TEXT,phone TEXT,email TEXT);
 CREATE TABLE estimates(id TEXT PRIMARY KEY,customer_id TEXT,status TEXT,total_cents INTEGER,scheduled_at TEXT);
 CREATE TABLE invoices(id TEXT PRIMARY KEY,estimate_id TEXT,customer_id TEXT,total_cents INTEGER);
 CREATE TABLE payments(id TEXT PRIMARY KEY,estimate_id TEXT,status TEXT,type TEXT,amount_cents INTEGER);
 CREATE TABLE notifications(id TEXT PRIMARY KEY,estimate_id TEXT,type TEXT,resolved_at TEXT);
 CREATE TABLE payment_refunds(id TEXT PRIMARY KEY,estimate_id TEXT,status TEXT);
 CREATE TABLE payment_checkout_sessions(id TEXT PRIMARY KEY,estimate_id TEXT,status TEXT);
 CREATE TABLE customer_messages(id TEXT PRIMARY KEY,customer_id TEXT,estimate_id TEXT,channel TEXT,template TEXT,body TEXT,created_at TEXT);
`);
db.prepare('INSERT INTO customers(id,name) VALUES (?,?)').run('c1','Synthetic DR Customer');
db.prepare('INSERT INTO customers(id,name) VALUES (?,?)').run('c2','Unrelated Synthetic Customer');
db.prepare('INSERT INTO estimates(id,customer_id,status,total_cents) VALUES (?,?,?,?)').run('e1','c1','completed',20000);
db.prepare('INSERT INTO estimates(id,customer_id,status,total_cents) VALUES (?,?,?,?)').run('e2','c2','completed',22000);
db.prepare('INSERT INTO invoices(id,estimate_id,customer_id,total_cents) VALUES (?,?,?,?)').run('inv1','e1','c1',20000);
db.prepare('INSERT INTO payments(id,estimate_id,status,type,amount_cents) VALUES (?,?,?,?,?)').run('p1','e1','paid','Customer payment',20000);

let owner={email:'kylebrooks8605@gmail.com'},reads=0,writes=0,softWriteFailure=false;
let fakeWriteAcknowledged=false,fakeZeroChanges=false,softHistoryFailure=false,malformedHistory=false;
let losePreparedInsertAck=false,changeContactDuringInsert=false;
let refundDuringReviewInsert=false,checkoutDuringReviewInsert=false;
let rescheduleDuringAppointmentInsert=false;
const DB={prepare(sql){return {bind(...args){return {
 async first(){reads++;return db.prepare(sql).get(...args)??null;},
 async all(){reads++;if(softHistoryFailure)return {success:false,results:[]};
   if(malformedHistory)return {success:true,results:null};
   return {success:true,results:db.prepare(sql).all(...args)};},
 async run(){writes++;if(softWriteFailure)return {success:false,meta:{changes:0}};
   if(fakeWriteAcknowledged)return {success:true,meta:{changes:1}};
   if(fakeZeroChanges)return {success:true,meta:{changes:0}};
   // Real native SQLite write/race simulation: the other owner device can
   // change a phone after initial read but before the conditional INSERT.
   if(changeContactDuringInsert&&sql.includes('INSERT OR IGNORE INTO customer_messages')&&sql.includes('SELECT 1 FROM customers')){
     db.prepare('UPDATE customers SET phone=? WHERE id=?').run('918-555-7777','c1');
     changeContactDuringInsert=false;
   }
   // Simulate an independently committed financial hold between the route's
   // initial eligibility SELECT and its review INSERT. Genuine SQLite must
   // reject the review in that same INSERT, not rely on the stale preflight.
   if(sql.includes('FROM estimates e WHERE e.id=?')&&sql.includes('FROM payment_refunds r')){
     if(refundDuringReviewInsert){db.prepare('INSERT INTO payment_refunds(id,estimate_id,status) VALUES (?,?,?)').run('race-refund','e1','pending');refundDuringReviewInsert=false;}
     if(checkoutDuringReviewInsert){db.prepare('INSERT INTO payment_checkout_sessions(id,estimate_id,status) VALUES (?,?,?)').run('race-checkout','e1','open');checkoutDuringReviewInsert=false;}
   }
   // The other owner device can reschedule AFTER the route preflight SELECT.
    if(rescheduleDuringAppointmentInsert&&sql.includes('INSERT OR IGNORE INTO customer_messages')&&sql.includes("e.scheduled_at=?")){
      db.prepare("UPDATE estimates SET scheduled_at=datetime('now','+8 days') WHERE id=?").run('appt-c1');
      rescheduleDuringAppointmentInsert=false;
    }
    const result=db.prepare(sql).run(...args);
   if(losePreparedInsertAck){losePreparedInsertAck=false;throw Error('synthetic lost D1 prepared INSERT acknowledgement');}
   return {success:true,meta:{changes:Number(result.changes)}};
 }
};}};}};
// Simulate D1 batched confirmation commits, including a lost response after
// the true SQLite commit. No hosted resources or customer communications.
let failBatchAfterWrite=false;
DB.batch=async statements=>{
 const results=[];
 for(const statement of statements)results.push(await statement.run());
 if(failBatchAfterWrite){failBatchAfterWrite=false;throw Error('synthetic lost D1 batch acknowledgement');}
 return results;
};
const exports={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
}}).outputText,{exports,Request,Response,Date,URL,crypto:webcrypto,console,
 require(id){
   if(id==='cloudflare:workers')return {env:{DB}};
   if(id==='../../owner-auth')return {getOwnerUser:async()=>owner};
   if(id==='../../../lib/customer-write-request-guard.mjs')return {readOwnerWriteObject};
   throw Error('Unexpected route dependency: '+id);
 }
});
const {POST,GET,PATCH}=exports;
let checks=0;
function eq(actual,expected,label){assert.deepEqual(actual,expected,label);checks++;}
function privacy(response,label){
 eq(response.headers.get('cache-control'),'private, no-store',label+' not publicly cached');
 eq(response.headers.get('vary'),'Cookie',label+' owner session partition');
 eq(response.headers.get('x-content-type-options'),'nosniff',label+' MIME protection');
}
const endpoint='https://dr.synthetic.invalid/api/customer-messages';
async function send(value,headers={}){
 return POST(new Request(endpoint,{method:'POST',headers:{'content-type':'application/json',...headers},
   body:typeof value==='string'?value:JSON.stringify(value)}));
}
const ordinary={customerId:'c1',estimateId:'',channel:'copy',template:'custom',body:'Private synthetic customer note'};
const review={customerId:'c1',estimateId:'e1',channel:'email',template:'review',body:'Synthetic paid-job review invitation'};
const count=()=>db.prepare('SELECT COUNT(*) AS n FROM customer_messages').get().n;
for(const [label,identity] of [
 ['anonymous',null],['different owner',{email:'not-owner@invalid.test'}],
 ['numeric email',{email:42}],['missing email',{}],
 ['throwing email',{get email(){throw Error('bad principal');}}],
 ['rejected session',{then(_resolve,reject){reject(Error('unavailable synthetic session'));}}]
]){
 const before=reads+writes;
 owner=identity;
 const denied=await send(ordinary);
 eq(denied.status,401,label+' denied before D1');privacy(denied,label);
 eq(reads+writes,before,label+' caused no D1 calls');
}
owner={email:'kylebrooks8605@gmail.com'};
for(const [label,value,headers,expected] of [
 ['array body','[]',{},400],
 ['invalid JSON','{',{},400],
 ['oversized UTF-8',{...ordinary,body:'é'.repeat(40_000)},{},413],
 ['foreign Origin',ordinary,{origin:'https://foreign.synthetic.invalid'},403],
 ['sibling Origin',ordinary,{origin:'https://sibling.dr.synthetic.invalid'},403],
 ['cross-site Fetch Metadata',ordinary,{'sec-fetch-site':'cross-site'},403],
 ['declared-byte mismatch',ordinary,{'content-length':'100000'},413],
 ['browser form encoding',ordinary,{origin:'https://dr.synthetic.invalid','content-type':'text/plain'},415]
]){
 const before=reads+writes;
 const denied=await send(value,headers);
 eq(denied.status,expected,label+' refused');privacy(denied,label);
 eq(reads+writes,before,label+' refused before D1');
}
eq(count(),0,'No malformed or unauthorized messages saved');
let receipt=await send(ordinary);
eq(receipt.status,201,'Normal owner copy note still saves');privacy(receipt,'Normal message');
eq(count(),1,'One genuine synthetic communication row exists');
receipt=await send({...ordinary,estimateId:'e2'});
eq(receipt.status,409,'Cross-customer estimate refused');privacy(receipt,'Foreign estimate');
eq(count(),1,'Foreign estimate did not save');
db.prepare('INSERT INTO invoices(id,estimate_id,customer_id,total_cents) VALUES (?,?,?,?)').run('foreign-inv','e1','c2',9999);
receipt=await send(review);eq(receipt.status,409,'Foreign invoice ownership blocks review');privacy(receipt,'Foreign invoice');
db.prepare('DELETE FROM invoices WHERE id=?').run('foreign-inv');
db.prepare('INSERT INTO payment_checkout_sessions(id,estimate_id,status) VALUES (?,?,?)').run('open-checkout','e1','open');
receipt=await send(review);eq(receipt.status,409,'Open checkout blocks review');
db.prepare('DELETE FROM payment_checkout_sessions').run();
db.prepare('INSERT INTO payments(id,estimate_id,status,type,amount_cents) VALUES (?,?,?,?,?)').run('overpay','e1','paid','Additional payment',100);
receipt=await send(review);eq(receipt.status,409,'Overpayment blocks review');
db.prepare('DELETE FROM payments WHERE id=?').run('overpay');
db.prepare('INSERT INTO payments(id,estimate_id,status,type,amount_cents) VALUES (?,?,?,?,?)').run('tip','e1','paid','Tip',500);
receipt=await send(review);eq(receipt.status,201,'Exact paid job with separate tip can save review');privacy(receipt,'Eligible review');
eq(count(),2,'One reviewed communication saved, no incorrect drafts');
receipt=await send(review);eq(receipt.status,200,'Rapid duplicate review safely reuses existing record');privacy(receipt,'Duplicate review');
eq((await receipt.json()).duplicate,true,'Duplicate receipt explicit');
eq(count(),2,'Duplicate did not add a second row');
// A falsely successful D1 INSERT acknowledgement must not authorize a
// customer-message saved receipt without exact committed row readback.
fakeWriteAcknowledged=true;
receipt=await send({...ordinary,body:'Synthetic false-success D1 customer communication'});
eq(receipt.status,503,'Fake successful D1 INSERT without committed row returns uncertain');
privacy(receipt,'False successful INSERT');
eq((await receipt.json()).saveUncertain,true,'False success explicitly requires owner review');
eq(count(),2,'False successful D1 acknowledgement did not add a message');
fakeWriteAcknowledged=false;
// A zero-change review INSERT may mean a fresh deduplicated message, but an
// old review from hours ago is not a valid duplicate of a new attempt.
db.prepare("UPDATE customer_messages SET created_at=datetime('now','-2 hours') WHERE template='review'").run();
fakeZeroChanges=true;
receipt=await send(review);
eq(receipt.status,409,'Old saved review does not masquerade as fresh duplicate');
privacy(receipt,'Old review cannot be duplicated');
eq(count(),2,'Unconfirmed zero-change review creates no message');
fakeZeroChanges=false;
softWriteFailure=true;
receipt=await send({...ordinary,body:'Unacknowledged synthetic insert'});
eq(receipt.status,503,'Soft failed D1 write never returns false success');privacy(receipt,'Uncertain write');
eq((await receipt.json()).saveUncertain,true,'Owner prompted to refresh after uncertain write');
eq(count(),2,'Soft failed write created no row');
softWriteFailure=false;

// Recovery in DR is read-only and matches the QA-master pending-message
// channel/scope/cursor contract, including real SQLite terminal-history filters.
for(let i=0;i<14;i++){
  const id='drpending-'+String(i).padStart(2,'0');
  db.prepare('INSERT INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id,'c1',null,'text_prepared','custom','Synthetic unsent draft '+i,
      new Date(Date.UTC(2026,10,21,12,i,0)).toISOString());
}
db.prepare('INSERT INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at) VALUES (?,?,?,?,?,?,?)')
  .run('drpending-01:owner-confirmed','c1',null,'text_confirmed','custom','owner sent','2026-11-21T13:00:00.000Z');
db.prepare('INSERT INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at) VALUES (?,?,?,?,?,?,?)')
  .run('drpending-02:owner-cancelled','c1',null,'send_cancelled','custom','owner not sent','2026-11-21T13:01:00.000Z');
db.prepare('INSERT INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at) VALUES (?,?,?,?,?,?,?)')
  .run('drjob-pending','c1','e1','email_prepared','estimate','Synthetic job draft','2026-11-21T16:00:00.000Z');
db.prepare('INSERT INTO customer_messages (id,customer_id,estimate_id,channel,template,body,created_at) VALUES (?,?,?,?,?,?,?)')
  .run('foreign-pending','c2',null,'email_prepared','custom','Unrelated customer draft','2026-11-21T17:00:00.000Z');
async function history(query){return GET(new Request(endpoint+query));}
let pageResponse=await history('?customerId=c1');
eq(pageResponse.status,200,'DR prepared history returns owner private 200');privacy(pageResponse,'DR pending history');
let page=await pageResponse.json();
eq(page.pending.length,10,'DR pending history first page bounded to 10');
eq(page.mayHaveMore,true,'DR pending history indicates next page');
eq(typeof page.nextCursor,'string','DR pending page provides validated opaque cursor');
eq(page.pending.some(row=>row.id==='drpending-01'||row.id==='drpending-02'),false,
  'Confirmed and cancelled messages do not return as pending');
const firstIds=page.pending.map(row=>row.id);
pageResponse=await history('?customerId=c1&cursor='+encodeURIComponent(page.nextCursor));
eq(pageResponse.status,200,'DR prepared history next page 200');privacy(pageResponse,'DR cursor history');
page=await pageResponse.json();
eq(page.pending.length,2,'DR prepared history final page contains remaining two');
eq(page.mayHaveMore,false,'DR prepared history last page has no more');
eq(page.nextCursor,null,'DR final page no cursor');
eq(page.pending.some(row=>firstIds.includes(row.id)),false,'DR pagination has no duplicates');
pageResponse=await history('?customerId=c1&estimateId=e1');
eq(pageResponse.status,200,'DR job-specific draft read allowed');
eq((await pageResponse.json()).pending.map(row=>row.id),['drjob-pending'],
  'DR job pending excludes general and other customer drafts');
pageResponse=await history('?customerId=c1&estimateId=e2');
eq(pageResponse.status,409,'DR wrong-customer job refuses history');
privacy(pageResponse,'DR foreign job history');
pageResponse=await history('?customerId=c2');
eq(pageResponse.status,200,'DR other owner-owned customer scoped history read allowed');
eq((await pageResponse.json()).pending.map(row=>row.id),['foreign-pending'],
  'DR unrelated customer does not see first customer drafts');
for(const query of ['','?customerId=c1&cursor=bad','?customerId='+('z'.repeat(129))]){
  const before=reads+writes;
  pageResponse=await history(query);
  eq(pageResponse.status,400,'DR invalid history request rejected');
  privacy(pageResponse,'DR invalid history');
  eq(reads+writes,before,'DR invalid history rejected before database');
}
owner=null;
let beforeHistory=reads+writes;
pageResponse=await history('?customerId=c1');
eq(pageResponse.status,401,'DR anonymous pending history denied');privacy(pageResponse,'DR denied pending');
eq(reads+writes,beforeHistory,'DR anonymous GET never reaches database');
owner={email:42};
pageResponse=await history('?customerId=c1');
eq(pageResponse.status,401,'DR malformed principal pending history denied');
owner={email:'kylebrooks8605@gmail.com'};
softHistoryFailure=true;
pageResponse=await history('?customerId=c1');
eq(pageResponse.status,503,'DR D1 soft-failed pending history is not false empty');
privacy(pageResponse,'DR failed history');
eq((await pageResponse.json()).pending,undefined,'DR soft-failed pending history contains no empty list');
softHistoryFailure=false;
malformedHistory=true;
pageResponse=await history('?customerId=c1');
eq(pageResponse.status,503,'DR D1 malformed history result is not false empty');
malformedHistory=false;

// DR now shares QA's owner-only immutable prepare-decision endpoint.
// This is a saved human decision, NOT a real SMS/email delivery.
async function decision(id,customerId='c1',intent={ownerConfirmedNotSent:true},headers={}){
 return PATCH(new Request(endpoint,{method:'PATCH',headers:{'content-type':'application/json',...headers},
   body:JSON.stringify({preparedMessageId:id,customerId,...intent})}));
}
const receiptCount=id=>db.prepare('SELECT COUNT(*) AS n FROM customer_messages WHERE id=?').get(id).n;
let d=await decision('drpending-04','c2');
eq(d.status,409,'Unrelated customer cannot discard another customer draft');
privacy(d,'DR unrelated-customer decision');
eq(receiptCount('drpending-04:owner-cancelled'),0,'Foreign decision created no receipt');
for(const [label,id,c,flags,expected] of [
 ['missing intent','drpending-04','c1',{},400],
 ['contradictory intents','drpending-04','c1',{ownerConfirmedSent:true,ownerConfirmedNotSent:true},400],
 ['unknown prepared record','not-a-draft','c1',{ownerConfirmedSent:true},409],
 ['terminal non-draft record','drpending-01:owner-confirmed','c1',{ownerConfirmedSent:true},409]
]){
 d=await decision(id,c,flags);
 eq(d.status,expected,'DR '+label+' refused');privacy(d,'DR '+label);
}
let beforeDecision=reads+writes;
owner=null;
d=await decision('drpending-04');
eq(d.status,401,'Unauthenticated DR confirmation rejected');
privacy(d,'DR anonymous PATCH');
eq(reads+writes,beforeDecision,'DR anonymous PATCH avoided all D1 reads/writes');
owner={email:'kylebrooks8605@gmail.com'};
beforeDecision=reads+writes;
d=await decision('drpending-04','c1',{ownerConfirmedNotSent:true},{origin:'https://foreign.synthetic.invalid'});
eq(d.status,403,'Foreign-origin DR owner decision rejected');
privacy(d,'DR wrong-origin PATCH');
eq(reads+writes,beforeDecision,'Foreign-origin PATCH denied before D1');

d=await decision('drpending-04');
eq(d.status,200,'DR owner cancellation appends audit receipt');
privacy(d,'DR cancelled PATCH');
let decisionBody=await d.json();
eq(decisionBody.cancelled,true,'DR cancellation response identifies not-sent intent');
eq(decisionBody.deliveryConfirmed,false,'DR cancellation never claims delivery');
eq(decisionBody.message.id,'drpending-04:owner-cancelled','DR cancel uses stable linked receipt ID');
eq(decisionBody.message.channel,'send_cancelled','DR cancellation channel matches QA');
eq(receiptCount('drpending-04'),1,'Original prepared text preserved immutably');
eq(receiptCount('drpending-04:owner-cancelled'),1,'One cancellation receipt persisted');
d=await decision('drpending-04');
eq(d.status,200,'Repeated DR cancellation idempotent');privacy(d,'DR idempotent cancel');
eq(receiptCount('drpending-04:owner-cancelled'),1,'Repeated cancellation writes no duplicate');
d=await decision('drpending-04','c1',{ownerConfirmedSent:true});
eq(d.status,409,'Cancelled DR message cannot later become confirmed sent');
eq(receiptCount('drpending-04:owner-confirmed'),0,'No contradictory send receipt');

db.prepare('INSERT INTO estimates(id,customer_id,status,total_cents) VALUES (?,?,?,?)')
 .run('dr-draft','c1','draft',12000);
db.prepare('INSERT INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at) VALUES (?,?,?,?,?,?,?)')
 .run('dr-estimate-prep','c1','dr-draft','email_prepared','estimate','Synthetic estimate handoff','2026-11-21T17:10:00.000Z');
d=await decision('dr-estimate-prep','c1',{ownerConfirmedSent:true});
eq(d.status,200,'DR owner confirms previously prepared estimate handoff');
privacy(d,'DR confirmed estimate PATCH');
decisionBody=await d.json();
eq(decisionBody.ownerConfirmedSent,true,'DR explicit owner-confirmed sent status');
eq(decisionBody.deliveryConfirmed,false,'DR confirmation cannot claim external delivery');
eq(decisionBody.confirmationSource,'owner','DR confirmation provenance is owner intent');
eq(decisionBody.message.id,'dr-estimate-prep:owner-confirmed','DR confirmation exact immutable receipt ID');
eq(decisionBody.message.channel,'email_confirmed','DR confirmation distinguishes sent email');
eq(decisionBody.estimateStatus,'sent','DR estimate handoff advances matching draft to sent');
eq(db.prepare('SELECT status FROM estimates WHERE id=?').get('dr-draft').status,'sent',
 'DR SQLite estimate now sent after owner affirmation');
d=await decision('dr-estimate-prep','c1',{ownerConfirmedSent:true});
eq(d.status,200,'DR same confirmation can safely be retried');
eq(receiptCount('dr-estimate-prep:owner-confirmed'),1,'Repeated DR sent-confirmation no duplicate');
d=await decision('dr-estimate-prep');
eq(d.status,409,'Confirmed DR message cannot be marked not sent afterward');
eq(receiptCount('dr-estimate-prep:owner-cancelled'),0,'No conflicting not-sent audit after confirmed send');

db.prepare('INSERT INTO estimates(id,customer_id,status,total_cents) VALUES (?,?,?,?)')
 .run('dr-lost-ack','c1','draft',11000);
db.prepare('INSERT INTO customer_messages(id,customer_id,estimate_id,channel,template,body,created_at) VALUES (?,?,?,?,?,?,?)')
 .run('dr-lost-prep','c1','dr-lost-ack','text_prepared','estimate','Synthetic interrupted confirmation','2026-11-21T17:11:00.000Z');
failBatchAfterWrite=true;
d=await decision('dr-lost-prep','c1',{ownerConfirmedSent:true});
eq(d.status,200,'DR recovers exact confirmed receipt after lost batch acknowledgement');
privacy(d,'DR recovered confirmation');
decisionBody=await d.json();
eq(decisionBody.recoveredAfterUncertainConfirmation,true,'DR recovery explicitly shows uncertain acknowledgement');
eq(decisionBody.deliveryConfirmed,false,'Recovered confirmation does not infer SMS delivery');
eq(receiptCount('dr-lost-prep:owner-confirmed'),1,'Lost acknowledgement created exactly one immutable receipt');

softWriteFailure=true;
d=await decision('drpending-05');
eq(d.status,409,'D1 soft-failed cancellation cannot be reported as completed');
privacy(d,'DR noncommitted cancellation');
eq(receiptCount('drpending-05:owner-cancelled'),0,'D1 failed write added no cancellation audit');
softWriteFailure=false;

pageResponse=await history('?customerId=c1');
eq((await pageResponse.json()).pending.some(row=>row.id==='drpending-04'),false,
 'DR GET no longer shows owner-cancelled prepared message');
// Newly implemented QA-compatible DR prepared handoffs must use the actual
// saved contact; manual Text/Email is not sent by this route.
const prepText={customerId:'c1',estimateId:'',channel:'text_prepared',template:'custom',
 body:'Synthetic prepared Google Voice handoff'};
const prepEmail={...prepText,channel:'email_prepared',body:'Synthetic prepared email handoff'};
let prepared=await send(prepText);
eq(prepared.status,409,'No saved phone blocks DR text preparation');
privacy(prepared,'Missing saved text recipient');
prepared=await send(prepEmail);
eq(prepared.status,409,'No saved email blocks DR email preparation');
privacy(prepared,'Missing saved email recipient');
const prepCount=count();
db.prepare('UPDATE customers SET phone=?,email=? WHERE id=?')
 .run('918-555-0102','synthetic@example.invalid','c1');
prepared=await send({...prepText,recipientSnapshot:42});
eq(prepared.status,400,'Nonstring recipient snapshot cannot prepare a text');
privacy(prepared,'Invalid snapshot');
prepared=await send({...prepText,recipientSnapshot:'918-555-9999'});
eq(prepared.status,409,'Changed customer phone blocks stale owner draft');
privacy(prepared,'Changed phone');
prepared=await send({...prepEmail,recipientSnapshot:'stale@example.invalid'});
eq(prepared.status,409,'Changed customer email blocks stale owner draft');
privacy(prepared,'Changed email');
eq(count(),prepCount,'Rejected prepared attempts made no messages');
prepared=await send({...prepText,recipientSnapshot:'918-555-0102'});
eq(prepared.status,201,'Matching saved phone permits manual text preparation');
privacy(prepared,'Prepared text');
const savedText=(await prepared.json()).message;
eq(savedText.channel,'text_prepared','DR saves QA-compatible prepared text channel');
eq(receiptCount(savedText.id),1,'Prepared text persisted exactly once');
prepared=await send({...prepEmail,recipientSnapshot:'synthetic@example.invalid'});
eq(prepared.status,201,'Matching saved email permits manual email preparation');
privacy(prepared,'Prepared email');
const savedEmail=(await prepared.json()).message;
eq(savedEmail.channel,'email_prepared','DR saves QA-compatible prepared email channel');
eq(receiptCount(savedEmail.id),1,'Prepared email persisted exactly once');
prepared=await decision(savedText.id,'c1',{ownerConfirmedSent:true});
eq(prepared.status,200,'Fresh DR text preparation can be owner-confirmed');
privacy(prepared,'Owner confirmed new text');
eq((await prepared.json()).deliveryConfirmed,false,'New text confirms intent, not delivery');
prepared=await decision(savedEmail.id);
eq(prepared.status,200,'Fresh DR email preparation can be cancelled');
privacy(prepared,'Owner cancelled new email');
eq((await prepared.json()).ownerConfirmedSent,false,'New email cancellation does not claim send');
eq(receiptCount(savedText.id+':owner-confirmed'),1,'Text confirmation saved exact linked row');
eq(receiptCount(savedEmail.id+':owner-cancelled'),1,'Email cancellation saved exact linked row');
db.prepare('UPDATE customers SET phone=?,email=? WHERE id=?')
 .run('bad phone','invalid','c1');
prepared=await send(prepText);
eq(prepared.status,409,'Malformed saved phone cannot create prepared text');
privacy(prepared,'Malformed phone');
prepared=await send(prepEmail);
eq(prepared.status,409,'Malformed saved email cannot create prepared email');
privacy(prepared,'Malformed email');
// Stable QA preparation request IDs prevent duplicate external handoffs on
// impatient taps, while exact D1 readback recovers an interrupted response.
db.prepare('UPDATE customers SET phone=?,email=? WHERE id=?')
  .run('918-555-0102','synthetic@example.invalid','c1');
const stableId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const stablePayload={...prepText,requestId:stableId,recipientSnapshot:'918-555-0102'};
let stable=await send({...stablePayload,requestId:'invalid-id'});
eq(stable.status,400,'Malformed preparation UUID rejected');
privacy(stable,'Malformed retry identifier');
const initialCount=count();
stable=await send(stablePayload);
eq(stable.status,201,'DR stable first prepared text saved');
privacy(stable,'Stable text prepared');
const stableReceipt=(await stable.json()).message;
eq(stableReceipt.id,'owner-message-prep:'+stableId,'DR prepared ID matches QA stable operation');
eq(count(),initialCount+1,'One new stable prepared row persisted');
stable=await send(stablePayload);
eq(stable.status,200,'Same prepared request safely reuses exact saved row');
privacy(stable,'Stable retry');
eq((await stable.json()).duplicate,true,'Repeated prepared handoff explicitly identified');
eq(count(),initialCount+1,'Stable retry does not duplicate prepared text');
stable=await send({...stablePayload,body:'Different synthetic handoff body'});
eq(stable.status,409,'Stable operation ID cannot be reused for different content');
privacy(stable,'Conflicting operation');
eq(count(),initialCount+1,'Conflicting stable ID does not save second handoff');
stable=await decision(stableReceipt.id,'c1',{ownerConfirmedSent:true});
eq(stable.status,200,'Stable prepared message can be owner-confirmed');
stable=await send(stablePayload);
eq(stable.status,409,'Confirmed prepared message cannot be reopened via retry');
privacy(stable,'Closed stable operation');
eq(count(),initialCount+2,'Only exact owner confirmation event added');

const lostId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
losePreparedInsertAck=true;
stable=await send({...stablePayload,requestId:lostId,body:'Synthetic lost response after saved preparation'});
eq(stable.status,200,'Interrupted exact prepared INSERT recovers committed row');
privacy(stable,'Lost prepared acknowledgement');
let recovered=await stable.json();
eq(recovered.recoveredAfterUncertainPreparation,true,'Recovered preparation carries uncertain-ack provenance');
eq(recovered.deliveryConfirmed,false,'Recovered prepared message never claims delivery');
eq(receiptCount('owner-message-prep:'+lostId),1,'Lost response did not create duplicate D1 row');

const raceId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
changeContactDuringInsert=true;
const beforeRace=count();
stable=await send({...stablePayload,requestId:raceId,body:'No stale contact may be prepared'});
eq(stable.status,503,'Changed saved phone during INSERT cannot claim saved handoff');
privacy(stable,'Concurrent contact mutation');
eq(receiptCount('owner-message-prep:'+raceId),0,'Contact race persisted no stale prepared row');
eq(count(),beforeRace,'Contact race did not create any extra messages');
db.prepare('UPDATE customers SET phone=? WHERE id=?').run('918-555-0102','c1');
stable=await send({...stablePayload,requestId:raceId,body:'No stale contact may be prepared'});
eq(stable.status,201,'Owner retry after restoring saved phone can prepare safely');
privacy(stable,'Contact corrected');
eq(receiptCount('owner-message-prep:'+raceId),1,'Corrected contact created exact one prepared row');

// A concurrently pending refund or checkout appearing AFTER the paid-job
// preflight must fail the same-statement financial review gate. Native SQLite
// applies the route's real conditional INSERT against the injected change.
const atomicReview={...review,channel:'text',body:'Synthetic atomic paid-job review request'};
const beforeAtomic=count();
refundDuringReviewInsert=true;
let atomic=await send(atomicReview);
eq(atomic.status,409,'New pending refund during DR INSERT denies paid review');
privacy(atomic,'Atomic refund hold');
eq(count(),beforeAtomic,'Concurrent refund created no customer review message');
db.prepare('DELETE FROM payment_refunds WHERE id=?').run('race-refund');
checkoutDuringReviewInsert=true;
atomic=await send(atomicReview);
eq(atomic.status,409,'New open checkout during DR INSERT denies paid review');
privacy(atomic,'Atomic checkout hold');
eq(count(),beforeAtomic,'Concurrent checkout created no customer review message');
db.prepare('DELETE FROM payment_checkout_sessions WHERE id=?').run('race-checkout');
atomic=await send(atomicReview);
eq(atomic.status,201,'Reconciled exact payment permits new DR review after holds clear');
privacy(atomic,'Atomic reviewed success');
eq(count(),beforeAtomic+1,'Exactly one valid review message persisted after holds cleared');
// QA-master scheduled-message parity: verify persisted future appointment,
// Tulsa-local tomorrow reminder and the same-statement reschedule race.
const tulsaDayKey=value=>{
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',
    year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  const find=key=>parts.find(part=>part.type===key)?.value??'';
  return find('year')+'-'+find('month')+'-'+find('day');
};
const now=Date.now(),today=tulsaDayKey(now);
let startTomorrow=0;
for(let hours=1;hours<=49;hours++){
  const candidate=now+hours*3600_000;
  if(tulsaDayKey(candidate)!==today){startTomorrow=candidate;break;}
}
assert.ok(startTomorrow>now,'Found next Tulsa calendar day');
const tomorrowTime=new Date(startTomorrow+4*3600_000).toISOString();
const farFuture=new Date(now+7*24*3600_000).toISOString();
db.prepare('INSERT INTO estimates(id,customer_id,status,total_cents,scheduled_at) VALUES (?,?,?,?,?)')
  .run('appt-c1','c1','scheduled',0,farFuture);
const appointment={...prepText,estimateId:'appt-c1',template:'appointment',
  body:'Synthetic confirmed appointment'};
const reminder={...appointment,template:'appointmentReminder',
  body:'Synthetic tomorrow appointment reminder'};
const beforeAppointment=count();
let appt=await send({...appointment,appointmentScheduledAt:''});
eq(appt.status,409,'Appointment without exact saved timestamp is rejected');
privacy(appt,'Missing appointment concurrency token');
appt=await send({...appointment,appointmentScheduledAt:'2020-01-01T00:00:00.000Z'});
eq(appt.status,409,'Old previewed date cannot prepare a new scheduled message');
privacy(appt,'Outdated appointment date');
appt=await send({...reminder,appointmentScheduledAt:farFuture});
eq(appt.status,409,'Seven-day appointment cannot be called a 24-hour Tulsa reminder');
privacy(appt,'Premature 24-hour reminder');
eq(count(),beforeAppointment,'Invalid appointment/reminder requests save no messages');
appt=await send({...appointment,appointmentScheduledAt:farFuture});
eq(appt.status,201,'Matching saved future appointment can prepare a confirmation');
privacy(appt,'Confirmed scheduled job preparation');
eq(count(),beforeAppointment+1,'One truthful scheduled confirmation saved');
db.prepare('UPDATE estimates SET status=? WHERE id=?').run('completed','appt-c1');
appt=await send({...appointment,appointmentScheduledAt:farFuture});
eq(appt.status,409,'Completed job cannot prepare stale appointment after status change');
privacy(appt,'Job no longer scheduled');
db.prepare('UPDATE estimates SET status=?,scheduled_at=? WHERE id=?')
  .run('scheduled',tomorrowTime,'appt-c1');
appt=await send({...reminder,appointmentScheduledAt:tomorrowTime});
eq(appt.status,201,'Tomorrow in Tulsa permits prepared 24-hour reminder');
privacy(appt,'Valid Tulsa reminder');
eq(count(),beforeAppointment+2,'One saved 24-hour reminder row added');
const pastTime=new Date(now-3600_000).toISOString();
db.prepare('UPDATE estimates SET scheduled_at=? WHERE id=?').run(pastTime,'appt-c1');
appt=await send({...appointment,appointmentScheduledAt:pastTime});
eq(appt.status,409,'Past appointment refuses prepared confirmation despite scheduled status');
privacy(appt,'Past scheduled clock');
db.prepare('UPDATE estimates SET scheduled_at=? WHERE id=?').run(farFuture,'appt-c1');
const raceAppointmentId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
rescheduleDuringAppointmentInsert=true;
appt=await send({...appointment,requestId:raceAppointmentId,
  appointmentScheduledAt:farFuture,body:'Synthetic concurrent appointment reschedule'});
eq(appt.status,409,'Atomic D1 scheduled timestamp check refuses concurrent reschedule');
privacy(appt,'Concurrent appointment edit');
eq(receiptCount('owner-message-prep:'+raceAppointmentId),0,
  'Rescheduling race creates no stale prepared appointment');
eq(count(),beforeAppointment+2,'No stale appointment row added by concurrent owner edit');
db.prepare('UPDATE estimates SET scheduled_at=? WHERE id=?').run(farFuture,'appt-c1');
appt=await send({...appointment,requestId:raceAppointmentId,
  appointmentScheduledAt:farFuture,body:'Synthetic concurrent appointment reschedule'});
eq(appt.status,201,'Corrected saved schedule allows exact prepared retry');
privacy(appt,'Corrected appointment retry');
eq(receiptCount('owner-message-prep:'+raceAppointmentId),1,
  'Corrected appointment wrote exactly one eligible prepared handoff');
eq(count(),beforeAppointment+3,'Appointment tests add only three verified saved messages');

console.log('PASS '+checks+' independent DR owner customer-message actual-route privacy/payment/pending-history/confirmation/SQLite assertions');
