/**
 * FIRE Gate5: financial owner list APIs must refuse an incomplete legacy
 * refund ledger before reading customer, estimate, invoice or payment rows.
 * Explicit one-customer confirmEdit remains usable independent of payment.
 * Real transpiled app routes and real disposable sqlite_master, no cloud IO.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const transpile=source=>ts.transpileModule(source,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
}}).outputText;
const finance={};
vm.runInNewContext(transpile(readFileSync('lib/refund-ledger-readiness.ts','utf8')),{
 exports:finance,require,Response
});
const named=[
  ['app/api/customers/route.ts','customers'],
  ['app/api/estimates/route.ts','estimates'],
  ['app/api/invoices/route.ts','invoices'],
];
const makeDb=({table=false,indexes=false,error=false}={})=>{
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE customers(id TEXT PRIMARY KEY);CREATE TABLE estimates(id TEXT PRIMARY KEY);CREATE TABLE invoices(id TEXT PRIMARY KEY);');
 if(table)db.exec('CREATE TABLE payment_refunds(id TEXT, payment_id TEXT,estimate_id TEXT,provider_refund_id TEXT,status TEXT);');
 if(indexes)db.exec('CREATE INDEX idx_payment_refunds_payment_status ON payment_refunds(payment_id,status);CREATE INDEX idx_payment_refunds_estimate_status ON payment_refunds(estimate_id,status);CREATE INDEX idx_payment_refunds_provider ON payment_refunds(provider_refund_id);');
 let rowQueries=0,metadataQueries=0,confirmQueries=0;
 return {sqlite:db,
  counts:()=>({rowQueries,metadataQueries,confirmQueries}),
  DB:{prepare(sql){
    if(/FROM sqlite_master/i.test(sql)){
      metadataQueries++;
      return {all:async()=>{
        if(error)throw Error('Synthetic metadata read unavailable');
        return {results:db.prepare(sql).all()};
      }};
    }
    if(/FROM customers c WHERE c.id=\? LIMIT 1/i.test(sql)){
      confirmQueries++;
      return {bind:()=>({first:async()=>({id:'customer-a',name:'Synthetic Customer'})})};
    }
    rowQueries++;
    throw Error('A private list row was read before a verified refund schema');
  }}
 };
};
const instantiate=(path,DB,authorized)=>{
 const exports={};
 vm.runInNewContext(transpile(readFileSync(path,'utf8')),{
   exports,
   require:name=>name==='cloudflare:workers'?{env:{DB}}:
     name.includes('refund-ledger-readiness')?finance:
     name.includes('chatgpt-auth')?{getChatGPTUser:async()=>authorized?{email:'kylebrooks8605@gmail.com'}:null}:
     name.includes('customer-numbering')?{customerNumberingReady:async()=>false}: {},
   Response,Request,URL,Date,Intl,crypto:globalThis.crypto,
 },{filename:path});
 assert.equal(typeof exports.GET,'function');
 return exports.GET;
};
let passed=0;
for(const scenario of [
 {label:'legacy missing table'},
 {label:'legacy missing required indexes',table:true},
 {label:'metadata read unavailable',error:true}
]){
 for(const [path,kind] of named){
  const scope=makeDb(scenario);
  const GET=instantiate(path,scope.DB,true);
  const response=kind==='customers'?await GET(new Request('https://fire-qa.invalid/api/customers')):await GET();
  assert.equal(response.status,503,path+' must return a controlled hold, not SQL 500');
  const body=await response.json();
  assert.equal(body.code,'REFUND_LEDGER_SCHEMA_INCOMPLETE');
  assert.equal(body.retryable,false);
  assert.equal(scope.counts().metadataQueries,1);
  assert.equal(scope.counts().rowQueries,0);
  scope.sqlite.close();
  passed++;
 }
}
for(const [path,kind] of named){
 const scope=makeDb();
 const GET=instantiate(path,scope.DB,false);
 const denied=kind==='customers'?await GET(new Request('https://fire-qa.invalid/api/customers')):await GET();
 assert.equal(denied.status,401);
 assert.equal(scope.counts().metadataQueries,0,'Owner auth precedes any schema probing');
 assert.equal(scope.counts().rowQueries,0);
 scope.sqlite.close();
 passed++;
}
{
 const scope=makeDb();
 const GET=instantiate('app/api/customers/route.ts',scope.DB,true);
 const response=await GET(new Request('https://fire-qa.invalid/api/customers?confirmEdit=customer-a'));
 assert.equal(response.status,200,'Unrelated customer save readback must not depend on refund schema');
 const value=await response.json();
 assert.equal(value.customer.id,'customer-a');
 assert.equal(scope.counts().metadataQueries,0);
 assert.equal(scope.counts().confirmQueries,1);
 assert.equal(scope.counts().rowQueries,0);
 scope.sqlite.close();
 passed++;
}
console.log('PASS '+passed+' new Gate5 real owner API missing-ledger and confirmEdit safety cases, disposable SQLite only.');
