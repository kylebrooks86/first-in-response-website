/** Gate 7: actual customer photo POST + SQLite SQL and in-memory R2.
 * Synthetic data only. No remote network, Cloudflare, Stripe, or filesystem backups.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

const code=ts.transpileModule(readFileSync('app/api/customer-photos/route.ts','utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
let checks=0;
const check=(condition,description)=>{assert.ok(condition,description);checks++;};
const scenarios=['success','ack-missing-change','ack-false','lost-ack','no-insert','read-failure','read-missing','read-wrong-key','bucket-failure'];
for(const mode of scenarios){
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE customers(id TEXT PRIMARY KEY); INSERT INTO customers VALUES ('synthetic-customer'); "+
  "CREATE TABLE customer_photos(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,category TEXT NOT NULL,caption TEXT,filename TEXT,content_type TEXT NOT NULL,size_bytes INTEGER NOT NULL,object_key TEXT NOT NULL,created_at TEXT NOT NULL)");
 const objects=new Map();let deletes=0,writes=0,reads=0,puts=0;
 const env={
  BUCKET:{
   async put(key,stream,options){
    puts++;
    if(mode==='bucket-failure')throw Error('Synthetic R2 failure');
    const bytes=new Uint8Array(await new Response(stream).arrayBuffer());
    objects.set(key,{bytes,contentType:options?.httpMetadata?.contentType});
   },
   async delete(){deletes++;throw Error('Forbidden deletion of uncertain photo bytes')}
  },
  DB:{
   prepare(sql){
    return {bind(...args){
     return {
      async first(){
       if(sql.startsWith('SELECT id FROM customers'))return db.prepare(sql).get(...args)??null;
       reads++;
       if(mode==='read-failure')throw Error('D1 read unavailable');
       if(mode==='read-missing')return null;
       const row=db.prepare(sql).get(...args)??null;
       if(mode==='read-wrong-key'&&row)return {...row,objectKey:'another/customer/other-photo.png'};
       return row;
      },
      async run(){
       writes++;
       if(mode==='no-insert')throw Error('D1 rejected photo insert');
       const result=db.prepare(sql).run(...args);
       if(mode==='lost-ack')throw Error('D1 committed but ACK lost');
       if(mode==='ack-missing-change')return {success:true};
       if(mode==='ack-false')return {success:false,meta:{changes:Number(result.changes)}};
       return {success:true,meta:{changes:Number(result.changes)}};
      }
     };
    }};
   }
  }
 };
 let user={email:'kylebrooks8605@gmail.com'};
 const exports={};
 vm.runInNewContext(code,{
  exports,require(id){
   if(id==='cloudflare:workers')return {env};
   if(id==='../../chatgpt-auth')return {getChatGPTUser:async()=>user};
   throw Error('Unexpected module '+id);
  },
  Request,Response,FormData,File,Date,crypto:webcrypto
 });
 const request=()=>{
  const fd=new FormData();
  fd.set('customerId','synthetic-customer');
  fd.set('category','before');
  fd.set('caption','Synthetic driveway before cleaning');
  fd.set('photo',new File([new Uint8Array([137,80,78,71,1,2,3])],'before.png',{type:'image/png'}));
  return new Request('https://synthetic.invalid/api/customer-photos',{method:'POST',body:fd});
 };
 const response=await exports.POST(request()),payload=await response.json();
 const count=Number(db.prepare('SELECT COUNT(*) AS n FROM customer_photos').get().n);
 const expected=mode==='success';
 check(response.status===(expected?201:mode==='bucket-failure'?500:503),mode+' HTTP status never falsely claims saved');
 if(expected){
  const row=db.prepare('SELECT * FROM customer_photos LIMIT 1').get();
  check(count===1&&objects.size===1&&reads===1&&writes===1&&puts===1,'Acknowledged photo has one verified SQL record and R2 object');
  check(row.customer_id==='synthetic-customer'&&row.object_key.startsWith('customers/synthetic-customer/')
   &&row.size_bytes===7&&row.content_type==='image/png'&&payload.photo.id===row.id,
   'Returned photo identity and stored byte metadata are identical');
  check(response.headers.get('cache-control')==='private, no-store','Verified photo response is never publicly cached');
 }else{
  check(payload.photo===undefined,'Unconfirmed image never receives a success photo receipt');
  if(mode!=='bucket-failure'){
   check(payload.saveUncertain===true,'Database uncertainty explicitly requires customer photo review');
   check(objects.size===1&&deletes===0,'Uncertain database outcome preserves R2 bytes for recovery');
  }else check(objects.size===0&&writes===0,'R2 failure never writes D1');
  if(['lost-ack','ack-missing-change','ack-false','read-failure','read-missing','read-wrong-key'].includes(mode))
   check(count===1,'Real SQLite committed record preserved even when response is uncertain');
  if(mode==='no-insert')check(count===0&&objects.size===1,'Failed SQL insert preserves orphan object for reconciliation');
  if(mode.startsWith('read-'))check(reads===1,'Ambiguous readback attempts exactly one D1 read, not retry loop');
 }
 check(deletes===0,'No R2 deletes from photo upload under any scenario');
 if(mode==='success'){
  // A nonowner/anonymous caller must not reach the private R2/D1 write path.
  const previousWrites=writes,previousPuts=puts;
  for(const email of [null,'other@example.invalid']){
   user=email?{email}:null;
   const denied=await exports.POST(request());
   check(denied.status===401,'Anonymous/nonowner photograph upload denied');
  }
  check(writes===previousWrites&&puts===previousPuts,'Denied photo requests cause zero storage or D1 writes');
 }
 db.close();
}
console.log('PASS '+checks+'/'+checks+' customer photo POST/SQLite/R2 receipt assertions across success, six D1 uncertainties, R2 failure and nonowner denial. No provider calls.');
