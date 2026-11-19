/** Actual customer routes, SQLite primary-key/identity guards, and browser ID state. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createRouteFixtureLoader} from './route-test-loader.mjs';
import {loadCustomerCreateRequest,saveCustomerCreateRequest,clearCustomerCreateRequest,loadCustomerEstimateHandoff,saveCustomerEstimateHandoff,clearCustomerEstimateHandoff,confirmedCreatedCustomer,sameCustomerCreateInput} from '../lib/customer-create-retry.ts';
const db=new DatabaseSync(':memory:');for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+name,'utf8'));
let owner={email:'kylebrooks8605@gmail.com'},writes=0,failAfterInsert=false,failRead=false,beforeInsert=null;
function prep(sql){return {sql,values:[],bind(...values){return {...this,values}},async first(){if(failRead&&/^SELECT/.test(sql))throw Error('Synthetic read unavailable');if(sql.startsWith('INSERT INTO customers')){if(beforeInsert){const fn=beforeInsert;beforeInsert=null;fn()}writes++;const row=db.prepare(sql).get(...this.values);if(failAfterInsert){failAfterInsert=false;throw Error('Synthetic lost acknowledgement')}return row??null;}return db.prepare(sql).get(...this.values)??null},async all(){return {results:db.prepare(sql).all(...this.values)}},async run(){writes++;return {meta:{changes:Number(db.prepare(sql).run(...this.values).changes)}}}};}
const env={DB:{prepare:prep,async batch(rows){db.exec('BEGIN');try{const result=rows.map(r=>({results:db.prepare(r.sql).all(...r.values)}));db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}}};
const load=createRouteFixtureLoader(process.cwd(),env,()=>owner),customers=load('app/api/customers/route.ts'),confirmation=load('app/api/customers/confirmation/route.ts');
const post=body=>customers.POST(new Request('https://synthetic.invalid/api/customers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
const get=id=>confirmation.GET(new Request('https://synthetic.invalid/api/customers/confirmation?requestId='+encodeURIComponent(id)));
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const original={requestId:randomUUID(),name:'Synthetic Name Only',email:'',phone:'',address:'',leadSource:'Referral'};
try{
 // Actual POST must refuse a NEW LIVE customer if the permanent
 // Customer # schema was not explicitly approved, even on an empty DB.
 env.FIRE_NEW_LIVE_CLEAN_START='required';
 const preGuardWrites=writes;
 const unnumbered=await post(original);
 eq(unnumbered.status,503);
 eq((await unnumbered.json()).error,'NEW LIVE customer numbering is not enabled. No customer was created.');
 eq(writes,preGuardWrites);
 eq(db.prepare('SELECT COUNT(*) AS n FROM customers').get().n,0);
 delete env.FIRE_NEW_LIVE_CLEAN_START;
 owner=null;eq((await get(original.requestId)).status,401);eq((await post(original)).status,401);owner={email:'other@example.invalid'};eq((await get(original.requestId)).status,401);owner={email:'kylebrooks8605@gmail.com'};
 for(const requestId of ['bad',null,42,'A'.repeat(36)])eq((await post({...original,requestId})).status,400);
 eq((await get('bad')).status,400);let response=await get(original.requestId);eq(response.headers.get('cache-control'),'no-store, private');eq((await response.json()).confirmed,false);eq(writes,0);
 // Creating a customer must not save contact details that the same app's
 // later edit or Voice/email handoff would refuse. All failures are pre-write.
 for(const input of [
  {email:'not-an-email',phone:''},
  {email:'',phone:'not-a-phone'},
  {email:'',phone:'918-123'},
  {email:'bad@example',phone:'9185550100'}
 ]){
  const beforeWrites=writes;
  const denied=await post({...original,requestId:randomUUID(),...input});
  eq(denied.status,400);
  eq(denied.headers.get('cache-control'),'no-store, private');
  eq(writes,beforeWrites);
 }
 
 // Invalid JSON and non-object bodies cannot be confused with uncertain database writes.
 for(const [method,handler] of [['POST',customers.POST],['PATCH',customers.PATCH]]){
  for(const raw of ['null','[]','"synthetic"','42','{malformed','']){
   const beforeWrites=writes;
   const request=new Request('https://synthetic.invalid/api/customers',{method,headers:{'content-type':'application/json'},body:raw});
   const response=await handler(request);
   eq(response.status,400);
   eq(writes,beforeWrites);
  }
 }

 // The actual owner CREATE and EDIT route must reject unbounded, truncated,
 // forged Content-Length and malformed UTF8 before any D1 customer mutation.
 const customerRequest=(method,body,headers={})=>new Request('https://synthetic.invalid/api/customers',{
  method,headers:{'content-type':'application/json',...headers},body,duplex:'half'
 });
 // G6: customer POST/PATCH used a separate bounded parser, so both routes
 // must independently apply the real browser same-origin/JSON boundary.
 // A forged browser write must reach ZERO D1 operations or customer rows.
 for(const method of ['POST','PATCH']){
  const handler=customers[method],beforeWrites=writes;
  const fields=method==='POST'?{requestId:randomUUID(),name:'Forged synthetic customer'}:
   {id:'synthetic-customer',name:'Forged synthetic edit'};
  for(const [headers,expected] of [
   [{'origin':'https://attacker.invalid'},403],
   [{'origin':'https://sibling.synthetic.invalid','sec-fetch-site':'same-site'},403],
   [{'sec-fetch-site':'cross-site'},403],
   [{'sec-fetch-site':'same-site'},403],
   [{'sec-fetch-site':'none'},403],
   [{'origin':'null'},403],
   [{'origin':'https://synthetic.invalid','sec-fetch-site':'same-origin','content-type':'text/plain'},415],
  ]){
   const denied=await handler(customerRequest(method,JSON.stringify(fields),headers));
   eq(denied.status,expected);eq(writes,beforeWrites);
   eq(db.prepare('SELECT COUNT(*) AS n FROM customers').get().n,0);
  }
  const validBrowser=await handler(customerRequest(method,'{}',{
   'origin':'https://synthetic.invalid','sec-fetch-site':'same-origin'
  }));
  eq(validBrowser.status,400);eq(writes,beforeWrites);
 }
 for(const method of ['POST','PATCH']){
  const handler=customers[method],beforeWrites=writes;
  for(const [raw,headers] of [
   ['{"name":"'+('x'.repeat(64_100))+'"}',{}],
   ['{"name":"Tiny"}',{'content-length':'64001'}],
   ['{"name":"Tiny"}',{'content-length':'abc'}],
   ['{"name":"Tiny"}',{'content-length':'999'}],
   ['{"name":"Tiny"}',{'content-length':'1'}],
  ]){
   const result=await handler(customerRequest(method,raw,headers));
   eq(result.status,400);eq(writes,beforeWrites);
  }
  const invalidUtf8=await handler(customerRequest(method,new Uint8Array([0xff,0xfe])));
  eq(invalidUtf8.status,400);eq(writes,beforeWrites);
 }
 failAfterInsert=true;const recovered=await post(original);
 eq(recovered.status,200);
 const recoveredBody=await recovered.json();
 eq(recoveredBody.recoveredAfterUncertainSave,true);
 eq(recoveredBody.duplicate,true);
 eq(recoveredBody.customer.id,original.requestId);
 let receipt=await (await get(original.requestId)).json();const customer=confirmedCreatedCustomer(receipt,original.requestId);assert.ok(customer);checks++;eq(customer.name,original.name);eq(customer.estimateCount,0);eq(db.prepare('SELECT COUNT(*) AS n FROM customers').get().n,1);
 const snapshot=JSON.stringify(db.prepare('SELECT * FROM customers').all());response=await post(original);eq(response.status,200);eq((await response.json()).customer.id,original.requestId);eq(db.prepare('SELECT COUNT(*) AS n FROM customers').get().n,1);
 for(const field of ['name','email','phone','address','leadSource'])eq((await post({...original,[field]:'Different '+field})).status,409);eq(JSON.stringify(db.prepare('SELECT * FROM customers').all()),snapshot);
 // Replays use current authoritative history counts, not invented zero totals.
 db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES('history',?,'approved',20000,20000,10000,'2026-10-18')").run(original.requestId);
 db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES('paid','history','Cash',10000,'paid','2026-10-18')").run();
 response=await post(original);const replay=(await response.json()).customer;eq([replay.estimateCount,replay.estimateTotal,replay.paidTotal],[1,20000,10000]);
 db.prepare('UPDATE customers SET name=? WHERE id=?').run('Updated Synthetic Name',original.requestId);eq((await post(original)).status,409);receipt=await (await get(original.requestId)).json();eq(confirmedCreatedCustomer(receipt,original.requestId).name,'Updated Synthetic Name');eq(sameCustomerCreateInput(receipt.customer,original),false);
 const contact={requestId:randomUUID(),name:'Synthetic Contact',email:'contact@example.invalid',phone:'(918) 555-0188',address:'123 Synthetic Lane',leadSource:'Google'};eq((await post(contact)).status,201);eq((await post({...contact,requestId:randomUUID(),email:'CONTACT@example.invalid'})).status,409);eq((await post({...contact,requestId:randomUUID(),email:'',phone:'+1 918-555-0188'})).status,409);
 const concurrent={...original,requestId:randomUUID(),name:'Concurrent Synthetic Name'};beforeInsert=()=>db.prepare('INSERT INTO customers(id,name,lead_source,created_at) VALUES(?,?,?,?)').run(concurrent.requestId,concurrent.name,concurrent.leadSource,'2026-10-18T00:00:00Z');eq((await post(concurrent)).status,200);eq(db.prepare('SELECT COUNT(*) AS n FROM customers WHERE id=?').get(concurrent.requestId).n,1);
 const legacy=await post({name:'Legacy Synthetic Name'});eq(legacy.status,201);assert.match((await legacy.json()).customer.id,/^[0-9a-f-]{36}$/);checks++;
 const savedWrites=writes;failRead=true;eq((await get(original.requestId)).status,503);failRead=false;await get(original.requestId);eq(writes,savedWrites);
 for(const patch of [{requestId:randomUUID()},{confirmed:false},{customer:null},{customer:{...receipt.customer,id:randomUUID()}},{customer:{...receipt.customer,estimateCount:NaN}},{customer:{...receipt.customer,createdAt:'bad'}},{customer:{...receipt.customer,email:null}}])eq(confirmedCreatedCustomer({...receipt,...patch},original.requestId),null);
 const rows=new Map(),storage={getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,v),removeItem:k=>rows.delete(k)};
 eq(loadCustomerCreateRequest(storage),null);eq(saveCustomerCreateRequest(storage,original.requestId),true);eq([...rows.values()],[original.requestId]);eq(loadCustomerCreateRequest(storage),original.requestId);
 eq(loadCustomerEstimateHandoff(storage,original.requestId),false);eq(saveCustomerEstimateHandoff(storage,randomUUID()),false);eq(saveCustomerEstimateHandoff(storage,original.requestId),true);
 eq(loadCustomerEstimateHandoff(storage,original.requestId),true);eq(loadCustomerEstimateHandoff(storage,randomUUID()),false);
 clearCustomerEstimateHandoff(storage,'wrong');eq(loadCustomerEstimateHandoff(storage,original.requestId),true);
 eq(saveCustomerCreateRequest(storage,randomUUID()),false);clearCustomerCreateRequest(storage,'wrong');eq(loadCustomerCreateRequest(storage),original.requestId);
 clearCustomerCreateRequest(storage,original.requestId);eq(loadCustomerCreateRequest(storage),null);eq(loadCustomerEstimateHandoff(storage,original.requestId),false);
 clearCustomerEstimateHandoff(storage,original.requestId);eq([...rows.values()],[]);
 eq(saveCustomerEstimateHandoff(undefined,original.requestId),false);
 eq(saveCustomerCreateRequest(undefined,original.requestId),false);eq(saveCustomerCreateRequest({getItem(){throw Error('denied')},setItem(){}},original.requestId),false);eq(saveCustomerCreateRequest(storage,'bad'),false);

 // Valid customer names containing multibyte Unicode remain supported even
 // when the JSON HTTP stream divides the emoji across separate chunks.
 const emojiCustomer={requestId:randomUUID(),name:'Synthetic 🔥 Customer',email:'',phone:'',address:'',leadSource:'Referral'};
 const emojiBytes=new TextEncoder().encode(JSON.stringify(emojiCustomer));
 const emojiAt=emojiBytes.indexOf(0xf0);assert.ok(emojiAt>0);checks++;
 const chunks=[emojiBytes.slice(0,emojiAt+2),emojiBytes.slice(emojiAt+2,emojiAt+3),emojiBytes.slice(emojiAt+3)];
 let chunkIndex=0;
 const stream=new ReadableStream({pull(controller){
  if(chunkIndex===chunks.length)controller.close();else controller.enqueue(chunks[chunkIndex++]);
 }});
 const validSplit=await customers.POST(customerRequest('POST',stream,{'content-length':String(emojiBytes.length)}));
 eq(validSplit.status,201);
 eq((await validSplit.json()).customer.name,emojiCustomer.name);
 eq(db.prepare('SELECT name FROM customers WHERE id=?').get(emojiCustomer.requestId).name,emojiCustomer.name);

 console.log(`PASS ${checks}/${checks}: real customer creation primary-key replay, name-only lost acknowledgement, atomic race, conflicting details, identity duplicate guards, current history totals, owner auth, read-only confirmation, strict receipts and ID-only recovery storage.`);
}finally{db.close()}
