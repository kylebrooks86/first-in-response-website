/** Independent DR invoice directory: actual TypeScript GET and disposable native SQLite; no hosted calls. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
const path=process.argv[2]; assert.ok(path,'Supply independent DR invoice route path');
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
const context={exports:{},Response,Number,String,Array,JSON,require(name){
 if(name==='cloudflare:workers')return {env:{DB:backing}};
 if(name==='../../owner-auth')return {getOwnerUser};
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
 console.log('PASS '+checks+' DR invoice owner/private customer isolation, soft D1 read and empty-ledger SQLite assertions (NO HOSTED OPERATIONS)');
}finally{db.close();}
