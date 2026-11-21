/**
 * FIRE Gate 5: no refund-ledger DDL/indexes must yield a customer-safe
 * portal hold, before a single invoice/estimate/customer SELECT is made.
 *
 * Real app page functions are transpiled from current source and invoked
 * against disposable native SQLite. Existing valid-schema page workflows
 * are intentionally not repeated by this focused test.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const runtime={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'};
const transpile=(source,jsx=false)=>ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  ...(jsx?{jsx:ts.JsxEmit.ReactJSX}:{})
}}).outputText;
const ledgerExports={};
vm.runInNewContext(transpile(readFileSync('lib/refund-ledger-readiness.ts','utf8')),{
  exports:ledgerExports,require,Response
});
const finance=ledgerExports.refundLedgerObjectsPresent;
assert.equal(typeof finance,'function');

function localDb({refundTable=false,indexes=false,error=false}={}){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec("CREATE TABLE customers (id TEXT PRIMARY KEY); CREATE TABLE estimates (id TEXT PRIMARY KEY); CREATE TABLE invoices (id TEXT PRIMARY KEY);");
  if(refundTable)sqlite.exec("CREATE TABLE payment_refunds (id TEXT, payment_id TEXT, estimate_id TEXT, provider_refund_id TEXT, status TEXT)");
  if(indexes){
    sqlite.exec("CREATE INDEX idx_payment_refunds_payment_status ON payment_refunds(payment_id,status)");
    sqlite.exec("CREATE INDEX idx_payment_refunds_estimate_status ON payment_refunds(estimate_id,status)");
    sqlite.exec("CREATE INDEX idx_payment_refunds_provider ON payment_refunds(provider_refund_id)");
  }
  let sqlCount=0;
  return {sqlite,get sqlCount(){return sqlCount;},
    DB:{prepare(sql){
      sqlCount++;
      assert.match(sql,/FROM sqlite_master/i,'No customer, payment, or estimate row read permitted while refund schema is missing');
      return {all:async()=>{
        if(error)throw Error('synthetic D1 unavailable');
        return {results:sqlite.prepare(sql).all()};
      }};
    }}
  };
}

function routeFor(path,DB){
  const exports={};
  vm.runInNewContext(transpile(readFileSync(path,'utf8'),true),{
    exports,require:name=>name==='cloudflare:workers'?{env:{DB}}:
      name==='react/jsx-runtime'?runtime:
      name.includes('refund-ledger-readiness')?ledgerExports:
      name.includes('chatgpt-auth')?{getChatGPTUser:async()=>null}: {},
    Response,Request,URL,Intl,Date,crypto:globalThis.crypto,
  },{filename:path});
  assert.equal(typeof exports.default,'function');
  return exports.default;
}
const paths=[
  ['app/estimate/[token]/page.tsx','Estimate temporarily unavailable',{params:Promise.resolve({token:'synthetic-private-token'}),searchParams:Promise.resolve({})}],
  ['app/invoice/[token]/page.tsx','Invoice temporarily unavailable',{params:Promise.resolve({token:'synthetic-private-token'}),searchParams:Promise.resolve({})}],
  ['app/pay/[id]/page.tsx','Payment temporarily unavailable',{params:Promise.resolve({id:'synthetic-private-token'}),searchParams:Promise.resolve({})}],
];
let verified=0;
for(const scenario of [{label:'missing ledger table'}, {label:'missing ledger indexes',refundTable:true}, {label:'schema read failed',error:true}]){
  for(const [path,heading,args] of paths){
    const handle=localDb(scenario);
    const page=routeFor(path,handle.DB);
    const result=await page(args);
    const rendered=JSON.stringify(result);
    assert.ok(rendered.includes(heading),path+' must display generic refund schema hold');
    assert.ok(rendered.includes('First In Response Exteriors'),path+' must give customer a contact path');
    assert.ok(!rendered.includes('synthetic-private-token'),'No bearer share token disclosed');
    assert.ok(!rendered.includes('Cash App')&&!rendered.includes('Venmo')&&!rendered.includes('PayButton'),'No payment action on unverified schema');
    assert.equal(handle.sqlCount,1,'Only sqlite_master metadata can be read');
    handle.sqlite.close();
    verified++;
  }
}
const positive=localDb({refundTable:true,indexes:true});
assert.equal(await finance(positive.DB),true,'Complete canonical refund table/index set is recognized');
assert.equal(positive.sqlCount,1);
positive.sqlite.close();
verified++;
console.log('PASS '+verified+' new Gate5 missing-ledger portal safeguards, real TSX pages + disposable SQLite; no provider/hosted writes.');
