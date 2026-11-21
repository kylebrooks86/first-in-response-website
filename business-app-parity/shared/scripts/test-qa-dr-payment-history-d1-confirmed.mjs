/** QA-master and independent DR payment GET integrity: real TS handlers, no hosted D1 or Stripe. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const [qaPath,drPath]=process.argv.slice(2);
assert.ok(qaPath&&drPath,'Supply QA-master and DR route paths from this PR checkout');
let checks=0;
const eq=(actual,expected,label)=>{assert.equal(actual,expected,label);checks++;};
const payment={id:'synthetic-p1',estimateId:'synthetic-e1',amountCents:12500,refundedCents:0,refundableCents:12500,status:'paid'};
const checkout={id:'synthetic-cs1',estimateId:'synthetic-e1',amountCents:3000};
const privateResponse=(r,label)=>{
  eq(r.headers.get('cache-control'),'private, no-store',label+' private no-store');
  eq(r.headers.get('vary'),'Cookie',label+' session variance');
  eq(r.headers.get('x-content-type-options'),'nosniff',label+' nosniff');
};
for(const [label,file] of [['QA',qaPath],['DR',drPath]]){
  let principal='owner',readMode='',reads=0;
  const env={DB:{prepare(sql){
    return {async all(){
      reads++;
      const isCheckout=sql.includes('payment_checkout_sessions');
      if(readMode==='throwFirst'&&!isCheckout)throw Error('Synthetic D1 payment outage');
      if(readMode==='softFirst'&&!isCheckout)return {success:false,results:[]};
      if(readMode==='missingFirst'&&!isCheckout)return {success:true};
      if(readMode==='throwCheckout'&&isCheckout)throw Error('Synthetic D1 checkout outage');
      if(readMode==='softCheckout'&&isCheckout)return {success:false,results:[]};
      if(readMode==='missingCheckout'&&isCheckout)return {success:true};
      if(isCheckout)return {success:true,results:[checkout]};
      if(readMode==='badFinancial')return {success:true,results:[{...payment,amountCents:'invalid-cents'}]};
      if(readMode==='empty')return {success:true,results:[]};
      return {success:true,results:[payment]};
    }};
  }}};
  const session=async()=>{
    if(principal==='throw')throw Error('Synthetic owner session outage');
    if(principal==='missing')return null;
    if(principal==='numeric')return {email:17};
    if(principal==='unreadable')return {get email(){throw Error('Unreadable session email');}};
    if(principal==='foreign')return {email:'foreign@synthetic.invalid'};
    return {email:'kylebrooks8605@gmail.com'};
  };
  const code=ts.transpileModule(readFileSync(file,'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
  }).outputText;
  const scope={exports:{},Response,Number,Array,String,JSON,
    require(name){
      if(name==='cloudflare:workers')return {env};
      if(name==='../../chatgpt-auth')return {getChatGPTUser:session};
      if(name==='../../owner-auth')return {getOwnerUser:session};
      if(name==='../../../lib/processing-fees')return {processingAmounts:()=>({})};
      if(name==='../../../lib/refund-ledger-readiness')
        return {refundLedgerObjectsPresent:async()=>true,refundLedgerNotReady:()=>Response.json({error:'Not ready'}, {status:503})};
      if(name==='../../../lib/customer-write-request-guard.mjs')return {readOwnerWriteObject:async()=>({value:{}})};
      throw Error('Unexpected payment API dependency '+name);
    }};
  vm.runInNewContext(code,scope);
  assert.equal(typeof scope.exports.GET,'function',label+' actual GET export');
  for(const bad of ['missing','numeric','unreadable','foreign','throw']){
    principal=bad;
    const before=reads;
    const denied=await scope.exports.GET();
    eq(denied.status,401,label+' '+bad+' session denied');
    privateResponse(denied,label+' '+bad);
    eq(reads,before,label+' '+bad+' does not read private D1 payments');
  }
  principal='owner';
  let result=await scope.exports.GET();
  eq(result.status,200,label+' owner sees payment history');
  privateResponse(result,label+' owner');
  let data=await result.json();
  eq(data.payments[0].amountCents,12500,label+' existing cents unchanged');
  eq(data.payments.length,1,label+' one real synthetic payment');
  if(label==='QA')eq(data.checkoutIssues[0].amountCents,3000,'QA checkout reconciliation retained');
  readMode='empty';
  result=await scope.exports.GET();
  eq(result.status,200,label+' confirmed empty ledger is legitimate');
  privateResponse(result,label+' confirmed empty');
  eq((await result.json()).payments.length,0,label+' confirmed empty not fabricated');
  for(const mode of ['throwFirst','softFirst','missingFirst',...(label==='QA'?['throwCheckout','softCheckout','missingCheckout']:[])]){
    readMode=mode;
    result=await scope.exports.GET();
    eq(result.status,503,label+' '+mode+' unconfirmed read -> private 503');
    privateResponse(result,label+' '+mode);
    eq((await result.json()).error.includes('No payment records were changed.'),true,label+' '+mode+' never claims payment write');
  }
  readMode='badFinancial';
  result=await scope.exports.GET();
  eq(result.status,409,label+' corrupt financial cents fail closed');
  privateResponse(result,label+' bad cents');
}
console.log('PASS '+checks+' QA-master + independent DR owner payment history verified D1/read/checkout/authorization/private receipts (actual TS routes, NO HOSTED OPERATIONS)');
