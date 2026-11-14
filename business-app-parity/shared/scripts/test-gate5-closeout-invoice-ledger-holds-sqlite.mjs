/** New Gate5 negative controls for invoice GET/PATCH and paid-job closeout.
 * Real TypeScript routes + real SQLite metadata, all data strictly synthetic.
 * No Cloudflare connection, Stripe, customer rows or hosted mutation.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const compile=code=>ts.transpileModule(code,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
}}).outputText;
const finance={};
vm.runInNewContext(compile(readFileSync('lib/refund-ledger-readiness.ts','utf8')),{
 exports:finance,Response
});
let n=0;const ok=(v,s)=>{assert.ok(v,s);n++};
function fixture({table=false,indexes=false,unavailable=false}={}){
 const sqlite=new DatabaseSync(':memory:');
 if(table)sqlite.exec('CREATE TABLE payment_refunds(id TEXT,payment_id TEXT,estimate_id TEXT,provider_refund_id TEXT,status TEXT)');
 if(indexes)sqlite.exec([
  'CREATE INDEX idx_payment_refunds_payment_status ON payment_refunds(payment_id,status)',
  'CREATE INDEX idx_payment_refunds_estimate_status ON payment_refunds(estimate_id,status)',
  'CREATE UNIQUE INDEX idx_payment_refunds_provider ON payment_refunds(provider_refund_id)'
 ].join(';')+';');
 const count={meta:0,privateRows:0,write:0,network:0};
 const DB={prepare(query){
  if(/FROM sqlite_master/i.test(query)){count.meta++;return {all:async()=>{
   if(unavailable)throw Error('offline synthetic sqlite_master unavailable');
   return {results:sqlite.prepare(query).all()};
  }};}
  count.privateRows++;
  if(/^\s*(INSERT|UPDATE|DELETE|CREATE|DROP)/i.test(query))count.write++;
  return {bind(){return{first:async()=>null,all:async()=>({results:[]})}},
   first:async()=>null,all:async()=>({results:[]})};
 }};
 return {sqlite,DB,count};
}
function load(path,DB,count,owner=true){
 const exports={};
 const getChatGPTUser=async()=>owner?{email:'kylebrooks8605@gmail.com'}:null;
 const deps={
  'cloudflare:workers':{env:{DB}},
  '../../chatgpt-auth':{getChatGPTUser},
  '../../../chatgpt-auth':{getChatGPTUser},
  '../../../lib/refund-ledger-readiness':finance,
  '../../../../lib/refund-ledger-readiness':finance,
  '../../../lib/payment-closeout-actions':{buildPaymentCloseoutActions:()=>[]},
  '../../../../lib/discount-input':{submittedDiscountCents:()=>0},
  '../../../../lib/invoice-state.mjs':{currentInvoice:()=>null}
 };
 vm.runInNewContext(compile(readFileSync(path,'utf8')),{exports,
  require:name=>{if(!(name in deps))throw Error('Unexpected import: '+name);return deps[name]},
  Response,Request,URL,Date,crypto:globalThis.crypto,
  fetch:async()=>{count.network++;throw Error('No Stripe calls permitted')}
 },{filename:path});
 return exports;
}
const closePath='app/api/payment-closeouts/route.ts';
const invoicePath='app/api/invoices/[id]/route.ts';
const params={params:Promise.resolve({id:'synthetic-invoice'})};
const read=()=>new Request('https://offline.invalid/api/invoices/synthetic-invoice');
const edit=()=>new Request('https://offline.invalid/api/invoices/synthetic-invoice',{
 method:'PATCH',headers:{'content-type':'application/json'},body:'{}'});
for(const scenario of [
 {label:'missing ledger table'},
 {label:'missing ledger indexes',table:true},
 {label:'metadata exception',table:true,indexes:true,unavailable:true}
]){
 const {sqlite,DB,count}=fixture(scenario);
 try{
  const close=load(closePath,DB,count),invoice=load(invoicePath,DB,count);
  const results=[await close.GET(),await invoice.GET(read(),params),await invoice.PATCH(edit(),params)];
  for(const response of results){
   ok(response.status===503,scenario.label+' blocks with 503');
   const data=await response.json();
   ok(data.code==='REFUND_LEDGER_SCHEMA_INCOMPLETE'&&data.retryable===false,
      scenario.label+' returns no-retry reason');
   ok(response.headers.get('cache-control')==='no-store',scenario.label+' cannot cache financial hold');
  }
  ok(count.meta===3,scenario.label+' uses exact one schema read per endpoint');
  ok(count.privateRows===0&&count.write===0&&count.network===0,scenario.label+' no private rows/financial writes/Stripe calls');
 }finally{sqlite.close();}
}
{
 const {sqlite,DB,count}=fixture();
 try{
  const close=load(closePath,DB,count,false),invoice=load(invoicePath,DB,count,false);
  ok((await close.GET()).status===401,'Closeout nonowner denied');
  ok((await invoice.GET(read(),params)).status===401,'Invoice GET nonowner denied');
  ok((await invoice.PATCH(edit(),params)).status===401,'Invoice PATCH nonowner denied');
  ok(count.meta===0&&count.privateRows===0&&count.write===0&&count.network===0,
    'Nonowner denial happens before schema/private reads or Stripe');
 }finally{sqlite.close();}
}
{
 const {sqlite,DB,count}=fixture({table:true,indexes:true});
 try{
  const close=load(closePath,DB,count),invoice=load(invoicePath,DB,count);
  ok((await close.GET()).status===200,'Complete ledger preserves empty review queue');
  ok((await invoice.GET(read(),params)).status===404,'Complete ledger permits absent invoice GET');
  ok((await invoice.PATCH(edit(),params)).status===404,'Complete ledger permits absent invoice PATCH');
  ok(count.meta===3&&count.privateRows===3,'Complete ledger reaches normal data logic');
  ok(count.write===0&&count.network===0,'Synthetic positive cases remain no-write');
 }finally{sqlite.close();}
}
console.log('PASS '+n+' new Gate5 owner finance fail-closed route assertions using disposable SQLite; no provider use.');
