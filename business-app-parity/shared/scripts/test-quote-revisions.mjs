import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
const r=stackedRuntime();let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const q={customer:'Synthetic revision customer',email:'revision@example.invalid',address:'Synthetic Tulsa',items:[{name:'House Wash',description:'Original detailed scope',quantity:1000,unit:'sq ft',totalCents:22000}],additionalDiscountType:'percent',additionalDiscountValue:0,appreciationDiscount:false};
try{
 let response=await r.post({...q,requestId:crypto.randomUUID()});eq(response.status,201);const original=await response.json();
 r.db.prepare("UPDATE estimates SET status='approved',accepted_at='original-acceptance',signed_at='original-signature',signed_name='Original signer',photo_release='no' WHERE id=?").run(original.id);
 const before=r.db.prepare('SELECT * FROM estimates WHERE id=?').get(original.id),beforeItems=JSON.stringify(r.db.prepare('SELECT * FROM estimate_items WHERE estimate_id=?').all(original.id));
 const revision={...q,requestId:crypto.randomUUID(),customerId:original.customerId,revisionOf:original.id,items:[{...q.items[0],description:'Revised larger scope',quantity:1200,totalCents:30000}]};
 response=await r.post(revision);eq(response.status,201,JSON.stringify(await response.clone().json()));const revised=await response.json();eq(revised.totalCents,30000);eq(revised.depositCents,15000);
 const after=r.db.prepare('SELECT * FROM estimates WHERE id=?').get(original.id);eq(after.status,'superseded');eq({...after,status:before.status},{...before},'Only lifecycle status changes on original');eq(JSON.stringify(r.db.prepare('SELECT * FROM estimate_items WHERE estimate_id=?').all(original.id)),beforeItems,'Original item scope and cents retained');
 const fresh=r.db.prepare('SELECT * FROM estimates WHERE id=?').get(revised.id);eq(fresh.status,'draft');eq(fresh.accepted_at,null);eq(fresh.signed_at,null,'New quote requires a new signature');
 const count=r.db.prepare('SELECT COUNT(*) n FROM estimates').get().n;response=await r.post(revision);eq(response.status,200,'Lost response reuses original create receipt');eq(r.db.prepare('SELECT COUNT(*) n FROM estimates').get().n,count);
 response=await r.post({...revision,requestId:crypto.randomUUID()});eq(response.status,409,'Already replaced originals cannot create another live quote');
 const audit=JSON.parse(r.db.prepare('SELECT body FROM message_templates WHERE key=?').get('fire:quote-revision:v1:'+original.id).body);eq(audit.replacementId,revised.id);eq(audit.originalSignedAt,'original-signature');const versions=r.load('app/api/estimates/[id]/versions/route.ts').GET;const history=await versions(new Request('https://synthetic.invalid/versions'),{params:Promise.resolve({id:revised.id})});eq(history.status,200);eq((await history.json()).links[0].originalId,original.id,'Replacement links back to original history');
 const privateReceipt=response=>{eq(response.headers.get('cache-control'),'private, no-store','History receipt stays private');eq(response.headers.get('vary'),'Cookie','History receipt varies by owner session');eq(response.headers.get('x-content-type-options'),'nosniff','History receipt forbids MIME sniffing');};
 privateReceipt(history);
 const historyRequest=()=>new Request('https://synthetic.invalid/api/estimates/'+revised.id+'/versions');
 const versionsFor=id=>versions(historyRequest(),{params:Promise.resolve({id})});
 const beforeInvalid=r.counters().reads;
 const invalidHistory=await versionsFor('wrong/id');eq(invalidHistory.status,400,'Invalid revision ID is refused');privateReceipt(invalidHistory);eq(r.counters().reads,beforeInvalid,'Invalid revision ID never reads D1');
 for(const principal of [null,{}, {email:null},{email:42},{email:'nonowner@example.invalid'}]){
  r.setOwner(principal);
  const beforeDeny=r.counters().reads;
  const denied=await versionsFor(revised.id);eq(denied.status,401,'Nonowner or malformed owner principal denied without throwing');privateReceipt(denied);eq(r.counters().reads,beforeDeny,'Unauthorized version request never reads D1');
 }
 r.setOwner({email:'kylebrooks8605@gmail.com'});
 const auditKey='fire:quote-revision:v1:'+original.id;
 const originalAuditBody=r.db.prepare('SELECT body FROM message_templates WHERE key=?').get(auditKey).body;
 r.db.prepare('UPDATE message_templates SET body=? WHERE key=?').run('{invalid-json',auditKey);
 const uncertainHistory=await versionsFor(revised.id);eq(uncertainHistory.status,503,'Unverifiable D1 revision ledger fails closed');privateReceipt(uncertainHistory);
 r.db.prepare('UPDATE message_templates SET body=? WHERE key=?').run(originalAuditBody,auditKey);
 eq((await versionsFor(revised.id)).status,200,'Valid saved quote history remains accessible after correction');
 eq((await r.patch(original.id,{scheduledAt:'2026-11-05T17:00:00Z'})).status,409,'Historical original cannot be scheduled');
 const accept=r.load('app/api/public/estimates/[token]/accept/route.ts').POST;
 eq((await accept(new Request('https://synthetic.invalid/accept',{method:'POST',headers:{Origin:'https://synthetic.invalid','content-type':'application/json'},body:JSON.stringify({signedName:'Original signer',photoRelease:'no',acceptedTerms:true})}),{params:Promise.resolve({token:original.shareToken})})).status,409,'Old link cannot be accepted again');
 response=await accept(new Request('https://synthetic.invalid/accept',{method:'POST',headers:{Origin:'https://synthetic.invalid','content-type':'application/json'},body:JSON.stringify({signedName:'Latest signer',photoRelease:'no',acceptedTerms:true})}),{params:Promise.resolve({token:revised.shareToken})});eq(response.status,200);eq(r.db.prepare('SELECT signed_name FROM estimates WHERE id=?').get(revised.id).signed_name,'Latest signer');eq(r.db.prepare('SELECT signed_name FROM estimates WHERE id=?').get(original.id).signed_name,'Original signer');
 for(const kind of ['payment','checkout','invoice']){
  const seed=await(await r.post({...q,customer:'Funded '+kind,email:kind+'@example.invalid',address:kind+' synthetic',requestId:crypto.randomUUID()})).json();r.db.prepare("UPDATE estimates SET status='approved',accepted_at='accepted',signed_at='signed' WHERE id=?").run(seed.id);
  if(kind==='payment')r.db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES (?,?,'Cash',10000,'paid','now')").run(crypto.randomUUID(),seed.id);
  if(kind==='checkout')r.db.prepare("INSERT INTO payment_checkout_sessions(id,estimate_id,type,amount_cents,status,created_at) VALUES (?,?,'deposit',10000,'expired','now')").run(crypto.randomUUID(),seed.id);
  if(kind==='invoice')r.db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,total_cents,created_at) VALUES (?,?,?,22000,'now')").run(crypto.randomUUID(),seed.id,seed.customerId);
  const rows=r.db.prepare('SELECT COUNT(*) n FROM estimates').get().n;eq((await r.post({...revision,requestId:crypto.randomUUID(),customerId:seed.customerId,revisionOf:seed.id})).status,409,'Financially active '+kind+' stays on existing record');eq(r.db.prepare('SELECT COUNT(*) n FROM estimates').get().n,rows);
 }
 console.log('PASS '+checks+' real quote-replacement/signature/history/idempotency/financial-hold checks.');
}finally{r.db.close();}
