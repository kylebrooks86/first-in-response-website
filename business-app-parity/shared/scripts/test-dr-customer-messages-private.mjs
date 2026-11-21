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
 CREATE TABLE customers(id TEXT PRIMARY KEY,name TEXT);
 CREATE TABLE estimates(id TEXT PRIMARY KEY,customer_id TEXT,status TEXT,total_cents INTEGER);
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
const DB={prepare(sql){return {bind(...args){return {
 async first(){reads++;return db.prepare(sql).get(...args)??null;},
 async run(){writes++;if(softWriteFailure)return {success:false,meta:{changes:0}};
   const result=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}};
 }
};}};}};
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
const {POST}=exports;
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
 ['rejected session',Promise.reject(Error('unavailable synthetic session'))]
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
db.prepare('DELETE FROM payment_checkout_sessions');
db.prepare('INSERT INTO payments(id,estimate_id,status,type,amount_cents) VALUES (?,?,?,?,?)').run('overpay','e1','paid','Additional payment',100);
receipt=await send(review);eq(receipt.status,409,'Overpayment blocks review');
db.prepare('DELETE FROM payments WHERE id=?').run('overpay');
db.prepare('INSERT INTO payments(id,estimate_id,status,type,amount_cents) VALUES (?,?,?,?,?)').run('tip','e1','paid','Tip',500);
receipt=await send(review);eq(receipt.status,201,'Exact paid job with separate tip can save review');privacy(receipt,'Eligible review');
eq(count(),2,'One reviewed communication saved, no incorrect drafts');
receipt=await send(review);eq(receipt.status,200,'Rapid duplicate review safely reuses existing record');privacy(receipt,'Duplicate review');
eq((await receipt.json()).duplicate,true,'Duplicate receipt explicit');
eq(count(),2,'Duplicate did not add a second row');
softWriteFailure=true;
receipt=await send({...ordinary,body:'Unacknowledged synthetic insert'});
eq(receipt.status,503,'Soft failed D1 write never returns false success');privacy(receipt,'Uncertain write');
eq((await receipt.json()).saveUncertain,true,'Owner prompted to refresh after uncertain write');
eq(count(),2,'Soft failed write created no row');
softWriteFailure=false;
console.log('PASS '+checks+' independent DR owner customer-message actual-route privacy/payment/SQLite assertions');
