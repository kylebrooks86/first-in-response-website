/** Independent DR customer-note POST exercised against real TypeScript and real owner write guard.
 * Synthetic D1 native SQLite only. No hosted credentials, provider calls or customer records.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const routePath=process.argv[2],guardPath=process.argv[3];
assert.ok(routePath&&guardPath,'Pass current PR DR route and DR write-guard paths');
const {readOwnerWriteObject}=await import(pathToFileURL(resolve(guardPath)).href);
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE customers(id TEXT PRIMARY KEY,name TEXT);CREATE TABLE customer_notes(id TEXT PRIMARY KEY,customer_id TEXT,body TEXT,created_at TEXT)');
db.prepare('INSERT INTO customers(id,name) VALUES (?,?)').run('a','Synthetic owner A');
db.prepare('INSERT INTO customers(id,name) VALUES (?,?)').run('b','Synthetic owner B');
let principal='owner',prepared=0,writes=0,lostAck=false,lostReadback=false,fakeAck=false;
const env={DB:{prepare(sql){
 prepared++;
 return {bind(...params){return {
  async first(){
   if(lostReadback&&sql.includes('FROM customer_notes WHERE id=')){
    lostReadback=false;throw Error('Synthetic committed note lost SELECT acknowledgement');
   }
   return db.prepare(sql).get(...params)??null;
  },
  async run(){
   writes++;
   if(fakeAck&&sql.includes('INSERT OR IGNORE INTO customer_notes')){
    fakeAck=false;return {meta:{changes:1}};
   }
   const result=db.prepare(sql).run(...params);
   if(lostAck&&sql.includes('INSERT OR IGNORE INTO customer_notes')){
    lostAck=false;throw Error('Synthetic committed note lost INSERT acknowledgement');
   }
   return {meta:{changes:Number(result.changes)}};
  }
 };}};
}}};
const getOwnerUser=async()=>{
 if(principal==='throw')throw Error('Synthetic unavailable owner session');
 if(principal==='unreadable')return {get email(){throw Error('Unreadable owner email')}};
 if(principal==='missing')return null;
 if(principal==='numeric')return {email:12};
 if(principal==='foreign')return {email:'foreign@synthetic.invalid'};
 return {email:'kylebrooks8605@gmail.com'};
};
const compiled=ts.transpileModule(readFileSync(routePath,'utf8'),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
const context={exports:{},Response,Headers,URL,crypto:globalThis.crypto,require(name){
 if(name==='cloudflare:workers')return {env};
 if(name==='../../owner-auth')return {getOwnerUser};
 if(name==='../../../lib/customer-write-request-guard.mjs')return {readOwnerWriteObject};
 throw Error('Unexpected DR note route dependency: '+name);
}};
vm.runInNewContext(compiled,context,{filename:routePath});
const {POST}=context.exports;
assert.equal(typeof POST,'function','load real independent DR note POST');
const endpoint='https://dr.synthetic.invalid/api/customer-notes';
const post=(body,headers={})=>POST(new Request(endpoint,{method:'POST',
 headers,body:JSON.stringify(body)}));
const rows=()=>db.prepare('SELECT * FROM customer_notes ORDER BY id').all();
let assertions=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);assertions++;};
const privacy=response=>{
 eq(response.headers.get('cache-control'),'private, no-store','owner note private/no-store');
 eq(response.headers.get('vary'),'Cookie','owner note varies on session');
 eq(response.headers.get('x-content-type-options'),'nosniff','owner note nosniff');
};
const denied=async(request,status,label)=>{
 const beforeRows=rows(),beforePrepares=prepared,beforeWrites=writes;
 const response=await POST(request);eq(response.status,status,label);privacy(response);
 eq(rows(),beforeRows,label+' preserves notes');
 eq(prepared,beforePrepares,label+' makes zero D1 reads');
 eq(writes,beforeWrites,label+' makes zero D1 writes');
};
try{
 const body={customerId:'a',body:'  Synthetic gate instructions\nKeep the side gate closed. ',requestId:randomUUID()};
 let response=await post(body);eq(response.status,201,'first save');privacy(response);
 const first=await response.json();
 eq(first.confirmed,true,'confirmed inserted save');
 eq(first.note.id,body.requestId,'immutable request identity');
 eq(first.note.body,body.body.trim(),'multiline note retained');
 response=await post(body);eq(response.status,200,'idempotent same-request retry');privacy(response);
 eq(await response.json(),first,'replay retains created timestamp and content');
 eq(rows().length,1,'no duplicate note after retry');
 for(const change of [{...body,customerId:'b'},{...body,body:'Changed'}]){
  response=await post(change);eq(response.status,409,'conflicting request ID');
  privacy(response);eq(rows().length,1,'conflict leaves original note unchanged');
 }
 response=await post({...body,customerId:'unknown',requestId:randomUUID()});
 eq(response.status,404,'no nonexistent customer');privacy(response);
 // If a committed INSERT acknowledgement disappears, independent readback recovers the save.
 const ackBody={...body,requestId:randomUUID()};
 lostAck=true;response=await post(ackBody);eq(response.status,200,'lost INSERT ACK recovered');
 privacy(response);eq((await response.json()).confirmed,true,'saved content independently confirmed');
 eq(rows().filter(r=>r.id===ackBody.requestId).length,1,'one durable saved note');
 // A fake success from D1 is NOT proof of a saved note.
 fakeAck=true;const fakeBody={...body,requestId:randomUUID()};
 response=await post(fakeBody);eq(response.status,503,'false write acknowledgement refused');
 privacy(response);eq((await response.json()).saveUncertain,true,'uncertain receipt shown');
 eq(rows().some(r=>r.id===fakeBody.requestId),false,'no false saved note');
 // A lost read acknowledgement after a commit must not claim success.
 const lostBody={...body,requestId:randomUUID()};lostReadback=true;
 response=await post(lostBody);eq(response.status,503,'lost SELECT acknowledgment');
 privacy(response);eq((await response.json()).requestId,lostBody.requestId,'retry ID retained');
 response=await post(lostBody);eq(response.status,200,'safe retry confirms original note');
 privacy(response);eq(rows().filter(r=>r.id===lostBody.requestId).length,1,'no duplicate after read loss');
 response=await post({customerId:'b',body:'Legacy request without ID'});
 eq(response.status,201,'legitimate legacy add-note supported');privacy(response);

 for(const name of ['missing','numeric','unreadable','foreign','throw']){
  principal=name;
  await denied(new Request(endpoint,{method:'POST',body:JSON.stringify(body)}),401,
   name+' session fails closed before D1');
 }
 principal='owner';
 for(const [value,label] of [[null,'null'],[[],'array'],[{},'empty object'],
   [{customerId:'a',body:{}},'non-string body'],
   [{customerId:'a',body:'x'.repeat(5001)},'overlong note'],
   [{...body,requestId:'not-a-uuid'},'malformed request ID']]){
  const before=rows();
  response=await post(value);eq(response.status,400,label);privacy(response);
  eq(rows(),before,label+' cannot save a note');
 }
 await denied(new Request(endpoint,{method:'POST',body:'x'.repeat(32_001)}),413,'bounded request bytes');
 await denied(new Request(endpoint,{method:'POST',headers:{'content-length':'32001'},body:'{}'}),413,'bounded declared length');
 await denied(new Request(endpoint,{method:'POST',headers:{'content-length':'1'},body:'{}'}),400,'mismatched declared length');
 await denied(new Request(endpoint,{method:'POST',body:'{broken'}),400,'malformed JSON');
 await denied(new Request(endpoint,{method:'POST',headers:{origin:'https://evil.synthetic.invalid','content-type':'application/json'},body:JSON.stringify(body)}),403,'foreign browser origin');
 await denied(new Request(endpoint,{method:'POST',headers:{origin:'https://sibling.dr.synthetic.invalid','content-type':'application/json'},body:JSON.stringify(body)}),403,'sibling browser origin');
 await denied(new Request(endpoint,{method:'POST',headers:{'sec-fetch-site':'cross-site','content-type':'application/json'},body:JSON.stringify(body)}),403,'cross-site metadata');
 await denied(new Request(endpoint,{method:'POST',headers:{origin:'https://dr.synthetic.invalid','content-type':'text/plain'},body:JSON.stringify(body)}),415,'browser non-JSON request');
 response=await post({...body,requestId:randomUUID()},
  {origin:'https://dr.synthetic.invalid','content-type':'application/json','sec-fetch-site':'same-origin'});
 eq(response.status,201,'legitimate same-origin owner JSON still saves');
 privacy(response);
 console.log('PASS '+assertions+' actual independent DR customer note owner/privacy, bounded-origin, D1 lost-ack, idempotent retry and synthetic SQLite checks (NO HOSTED OPERATIONS)');
}finally{db.close();}
