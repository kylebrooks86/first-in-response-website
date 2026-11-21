/** Independent DR invoice directory: actual TypeScript GET and disposable native SQLite; no hosted calls. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const path=process.argv[2]; assert.ok(path,'Supply independent DR invoice route path');
// Use the production DR owner JSON/body/origin guard, never a test-only substitute.
const {readOwnerWriteObject:drOwnerJsonGuard}=await import(pathToFileURL(resolve(dirname(path),'../../../lib/customer-write-request-guard.mjs')).href);
const db=new DatabaseSync(':memory:');
db.exec([
 'CREATE TABLE customers(id TEXT PRIMARY KEY,name TEXT,email TEXT,phone TEXT,address TEXT)',
 'CREATE TABLE estimates(id TEXT PRIMARY KEY,customer_id TEXT)',
 'CREATE TABLE invoices(id TEXT PRIMARY KEY,estimate_id TEXT,customer_id TEXT,status TEXT,subtotal_cents INTEGER,discount_cents INTEGER,discount_type TEXT,discount_value INTEGER,total_cents INTEGER,due_at TEXT,share_token TEXT,first_viewed_at TEXT,created_at TEXT)',
 'CREATE TABLE invoice_items(invoice_id TEXT,name TEXT)',
 'CREATE TABLE estimate_items(estimate_id TEXT,description TEXT)',
 'CREATE TABLE payments(estimate_id TEXT,status TEXT,type TEXT,amount_cents INTEGER)',
 'CREATE TABLE notifications(estimate_id TEXT,type TEXT,resolved_at TEXT)',
 'CREATE TABLE payment_refunds(estimate_id TEXT,status TEXT)'
].join(';')+';');
for(const [id,name] of [['c1','Synthetic owner customer'],['c2','Unrelated synthetic customer']])
 db.prepare('INSERT INTO customers(id,name) VALUES (?,?)').run(id,name);
db.prepare('INSERT INTO estimates(id,customer_id) VALUES (?,?)').run('e1','c1');
function add(id,customer,token){
 db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,status,subtotal_cents,discount_cents,discount_type,discount_value,total_cents,share_token,created_at) VALUES (?,?,?,'draft',10000,0,'dollar',0,10000,?,?)")
 .run(id,'e1',customer,token,'2026-11-21T12:00:00Z');
}
add('i1','c1','SAFE-SYNTHETIC-TOKEN');
let principal='owner',mode='',reads=0,writes=0;
const backing={prepare(sql){return {async all(){
 reads++;
 if(mode==='throw')throw Error('Simulated D1 outage');
 if(mode==='soft')return {success:false,results:[]};
 if(mode==='missing')return {success:true};
 if(mode==='null')return null;
 const rows=db.prepare(sql).all();
 if(mode==='corrupt'&&rows[0])rows[0].totalCents=-1;
 return {success:true,results:rows};
 },bind(){writes++;throw Error('GET cannot bind or write');}};}};
const getOwnerUser=async()=>{
 if(principal==='throw')throw Error('Bad session');
 if(principal==='unreadable')return {get email(){throw Error('Unreadable email')}};
 if(principal==='missing')return null;
 if(principal==='numeric')return {email:42};
 if(principal==='foreign')return {email:'foreign@synthetic.invalid'};
 return {email:'kylebrooks8605@gmail.com'};
};
const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const context={exports:{},Response,Request,Headers,Number,String,Array,JSON,require(name){
 if(name==='cloudflare:workers')return {env:{DB:backing}};
 if(name==='../../owner-auth')return {getOwnerUser};
 if(name==='../../../lib/customer-write-request-guard.mjs')return {readOwnerWriteObject:drOwnerJsonGuard};
 throw Error('Unexpected import '+name);
}};
vm.runInNewContext(code,context);
assert.equal(typeof context.exports.GET,'function');
let checks=0;
const eq=(actual,expected,label)=>{assert.equal(actual,expected,label);checks++;};
const priv=(r,label)=>{
 eq(r.headers.get('cache-control'),'private, no-store',label+' no-store');
 eq(r.headers.get('vary'),'Cookie',label+' Cookie variance');
 eq(r.headers.get('x-content-type-options'),'nosniff',label+' nosniff');
};
try{
 for(const p of ['missing','numeric','unreadable','foreign','throw']){
  principal=p;const before=reads;const r=await context.exports.GET();
  eq(r.status,401,p+' denied');priv(r,p);eq(reads,before,p+' no D1 reads');
 }
 principal='owner';
 let r=await context.exports.GET();eq(r.status,200,'valid invoice list');priv(r,'valid');
 let json=await r.json();
 eq(json.invoices.length,1,'real invoice appears');
 eq(json.invoices[0].shareToken,'SAFE-SYNTHETIC-TOKEN','valid bearer token preserved');
 eq('estimateCustomerId' in json.invoices[0],false,'internal ownership probe stripped');
 add('foreign','c2','NEVER-LEAK-FOREIGN-TOKEN');
 r=await context.exports.GET();eq(r.status,409,'customer mismatch denied');priv(r,'wrong customer');
 json=await r.json();eq(JSON.stringify(json).includes('NEVER-LEAK-FOREIGN-TOKEN'),false,'foreign token never emitted');
 db.prepare("DELETE FROM invoices WHERE id='foreign'").run();
 for(const failure of ['soft','missing','null','throw']){
  mode=failure;r=await context.exports.GET();eq(r.status,503,failure+' D1 fail closed');priv(r,failure);
  json=await r.json();eq('invoices' in json,false,failure+' never falsely empty');
 }
 mode='corrupt';r=await context.exports.GET();eq(r.status,409,'corrupt cents refused');priv(r,'corrupt');
 mode='';db.prepare('DELETE FROM invoices').run();
 r=await context.exports.GET();eq(r.status,200,'genuine empty list');priv(r,'empty');
 json=await r.json();eq(json.invoices.length,0,'genuine empty count');
 eq(writes,0,'all GET cases read only');
 // Real DR final-invoice POST must deny invalid sessions/forged browser writes
 // before reading ANY private financial row. The previously unbounded parser
 // allowed cross-origin form bodies and unbounded allocations on this route.
 const validBody=JSON.stringify({estimateId:'synthetic-e1'});
 const validHeaders={'origin':'https://dr.invalid','sec-fetch-site':'same-origin','content-type':'application/json'};
 for(const p of ['missing','numeric','unreadable','foreign','throw']){
   principal=p;const beforeReads=reads,beforeBinds=writes;
   const response=await context.exports.POST(new Request('https://dr.invalid/api/invoices',{
     method:'POST',headers:validHeaders,body:validBody
   }));
   eq(response.status,401,'DR invoice POST '+p+' denied before D1');
   priv(response,'DR invoice POST '+p);
   eq(reads,beforeReads,'DR invoice POST '+p+' no D1 reads');
   eq(writes,beforeBinds,'DR invoice POST '+p+' no D1 binds');
 }
 principal='owner';
 const rejectedWrites=[
   ['foreign origin',{...validHeaders,origin:'https://attacker.invalid','sec-fetch-site':'cross-site'},validBody,403],
   ['sibling origin',{...validHeaders,origin:'https://sibling.dr.invalid','sec-fetch-site':'same-site'},validBody,403],
   ['sibling metadata',{...validHeaders,'sec-fetch-site':'same-site'},validBody,403],
   ['browser form',{...validHeaders,'content-type':'text/plain'},validBody,415],
   ['declared oversized',{...validHeaders,'content-length':'16001'},validBody,413],
   ['actual oversized UTF-8',validHeaders,JSON.stringify({estimateId:'é'.repeat(9000)}),413],
   ['bad length',{...validHeaders,'content-length':'not-a-number'},validBody,400],
   ['malformed JSON',validHeaders,'{',400],
   ['array JSON',validHeaders,'[]',400],
   ['empty JSON',validHeaders,'',400],
 ];
 for(const [label,headers,body,status] of rejectedWrites){
   const beforeReads=reads,beforeBinds=writes;
   const response=await context.exports.POST(new Request('https://dr.invalid/api/invoices',{
     method:'POST',headers,body
   }));
   eq(response.status,status,'DR invoice POST '+label+' strict rejection');
   priv(response,'DR invoice POST '+label);
   eq(reads,beforeReads,'DR invoice POST '+label+' no financial D1 read');
   eq(writes,beforeBinds,'DR invoice POST '+label+' no financial D1 bind');
 }
 // With a syntactically accepted owner request, the synthetic D1 deliberately
 // refuses the first lookup. This is NOT an invoice save and must never
 // return an apparent 201; even uncertainty must remain session-private.
 const validResponse=await context.exports.POST(new Request('https://dr.invalid/api/invoices',{
   method:'POST',headers:validHeaders,body:validBody
 }));
 eq(validResponse.status,503,'DR invoice POST uncertain D1 receipt cannot claim creation');
 priv(validResponse,'DR invoice POST uncertainty');
 eq((await validResponse.json()).saveUncertain,true,'DR invoice receipt warns owner before retry');
 console.log('PASS '+checks+' DR invoice GET + actual POST owner/origin/16KB/private/zero-D1 rejection assertions (NO HOSTED OPERATIONS)');
}finally{db.close();}
