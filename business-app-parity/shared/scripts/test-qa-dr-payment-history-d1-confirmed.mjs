/** QA-master and independent DR payment GET integrity: real TS handlers, no hosted D1 or Stripe. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const [qaPath,drPath]=process.argv.slice(2);
assert.ok(qaPath&&drPath,'Supply QA-master and DR route paths from this PR checkout');
// Exercise the actual shared owner-stream guard used by the DR payment route.
const {readOwnerWriteObject:drOwnerJsonGuard}=await import(pathToFileURL(resolve(dirname(drPath),'../../../lib/customer-write-request-guard.mjs')).href);
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
      if(name==='../../../lib/customer-write-request-guard.mjs')return {readOwnerWriteObject:drOwnerJsonGuard};
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
  if(label==='DR'){
    // Exercise the actual DR POST export (not a copied helper). Untrusted and
    // disabled-TEST requests must not read or mutate any payment D1 rows.
    for(const [who,expected] of [['foreign',401],['missing',401],['throw',401],['owner',503]]){
      principal=who;
      const before=reads;
      const response=await scope.exports.POST(new Request('https://dr.invalid/api/payments',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({estimateId:'synthetic-e1',amountCents:100})
      }));
      eq(response.status,expected,'DR payment POST '+who+' guarded');
      privateResponse(response,'DR payment POST '+who);
      eq(reads,before,'DR payment POST '+who+' zero D1 reads/writes');
      if(who==='owner'){
        eq((await response.json()).error.includes('disabled'),true,'DR no provider payment without TEST approval');
      }
    }
    // The previously unbounded DR POST parser accepted cross-site forms and
    // silently rounded fractional cents if DR TEST mode was enabled.
    // Verify the REAL exported handler + REAL guard now reject these BEFORE
    // touching any payment D1 rows; DR stays disabled outside this fixture.
    principal='owner';
    env.FIRE_STRIPE_MODE='test';
    const good={estimateId:'synthetic-e1',amountCents:100,tipCents:0,method:'Cash'};
    const jsonHeaders={'origin':'https://dr.invalid','sec-fetch-site':'same-origin','content-type':'application/json'};
    const badWrites=[
      ['cross-site browser',{...jsonHeaders,origin:'https://evil.invalid','sec-fetch-site':'cross-site'},JSON.stringify(good),403],
      ['sibling browser',{...jsonHeaders,origin:'https://sibling.dr.invalid','sec-fetch-site':'same-site'},JSON.stringify(good),403],
      ['form encoding',{...jsonHeaders,'content-type':'text/plain'},JSON.stringify(good),415],
      ['oversized declared UTF-8',{...jsonHeaders,'content-length':'16001'},JSON.stringify(good),413],
      ['fractional cents',jsonHeaders,JSON.stringify({...good,amountCents:100.6}),400],
      ['string cents',jsonHeaders,JSON.stringify({...good,amountCents:'100'}),400],
      ['null tip',jsonHeaders,JSON.stringify({...good,tipCents:null}),400],
      ['check payment',jsonHeaders,JSON.stringify({...good,method:'Paper check'}),400],
      ['nonobject body',jsonHeaders,'[]',400],
      ['malformed JSON',jsonHeaders,'{',400],
    ];
    for(const [label,headers,body,expected] of badWrites){
      const before=reads;
      const response=await scope.exports.POST(new Request('https://dr.invalid/api/payments',{
        method:'POST',headers,body
      }));
      eq(response.status,expected,'DR payment POST '+label+' denied before D1');
      privateResponse(response,'DR payment POST '+label);
      eq(reads,before,'DR payment POST '+label+' no D1 or Stripe action');
    }
    env.FIRE_STRIPE_MODE='disabled';
  }
}

const refundPath=drPath.replace(/\\/g,'/').replace(/\/payments\/route\.ts$/,'/payments/refund/route.ts');
assert.notEqual(refundPath,drPath,'DR refund route located next to DR payment route');
let refundPrincipal='owner',refundReads=0;
const refundEnv={FIRE_STRIPE_MODE:'disabled',DB:{prepare(){refundReads++;throw Error('DR refund must not reach D1');}}};
const refundSession=async()=>{
  if(refundPrincipal==='throw')throw Error('Unresolvable DR refund session');
  if(refundPrincipal==='foreign')return {email:'foreign@synthetic.invalid'};
  if(refundPrincipal==='missing')return null;
  return {email:'kylebrooks8605@gmail.com'};
};
const refundCode=ts.transpileModule(readFileSync(refundPath,'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
const refundScope={exports:{},Response,Date,Intl,Number,String,Array,JSON,
  require(name){
    if(name==='cloudflare:workers')return {env:refundEnv};
    if(name==='../../../owner-auth')return {getOwnerUser:refundSession};
    throw Error('Unexpected DR refund dependency '+name);
  }};
vm.runInNewContext(refundCode,refundScope);
eq(typeof refundScope.exports.POST,'function','actual DR refund POST export');
for(const [who,expected] of [['foreign',401],['missing',401],['owner',503]]){
  refundPrincipal=who;
  const before=refundReads;
  const result=await refundScope.exports.POST(new Request('https://dr.invalid/api/payments/refund',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({paymentId:'synthetic-p1',amountCents:100,requestId:'synthetic-r1'})
  }));
  eq(result.status,expected,'DR refund POST '+who+' guarded');
  privateResponse(result,'DR refund POST '+who);
  eq(refundReads,before,'DR refund POST '+who+' no D1 touch');
  if(who==='owner')eq((await result.json()).error.includes('disabled'),true,'DR refund TEST/provider remains disabled');
}
refundPrincipal='throw';
const uncertain=await refundScope.exports.POST(new Request('https://dr.invalid/api/payments/refund',{
  method:'POST',headers:{'content-type':'application/json'},body:'{}'
}));
eq(uncertain.status,503,'unreadable refund session private uncertainty');
privateResponse(uncertain,'unreadable DR refund session');
eq((await uncertain.json()).saveUncertain,true,'DR refund uncertainty never encourages duplicate provider write');


const qaRefundPath=qaPath.replace(/\\/g,'/').replace(/\/payments\/route\.ts$/,'/payments/refund/route.ts');
assert.notEqual(qaRefundPath,qaPath,'QA-master shared refund route found');
let qaRefundD1Reads=0,qaRefundAuthCalls=0;
const qaRefundEnv={DB:{prepare(){qaRefundD1Reads++;throw Error('QA synthetic refund must not read D1');}}};
const qaRefundCode=ts.transpileModule(readFileSync(qaRefundPath,'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
const qaRefundScope={exports:{},Response,Date,Intl,Number,String,Array,JSON,
  require(name){
    if(name==='cloudflare:workers')return {env:qaRefundEnv};
    if(name==='../../../local-customer-deployment')return {LOCAL_CUSTOMER_DEPLOYMENT:'qa'};
    if(name==='../../../chatgpt-auth')return {getChatGPTUser:async()=>{qaRefundAuthCalls++;return {email:'kylebrooks8605@gmail.com'};}};
    if(name==='../../../../lib/stripe-refunds')return {finalizeRefund:()=>{throw Error('QA no refunds');},recordRefundUpdate:()=>{throw Error('QA no refunds');}};
    if(name==='../../../../lib/refund-ledger-readiness')return {refundLedgerObjectsPresent:()=>{throw Error('QA no refund ledger read');},refundLedgerNotReady:()=>{throw Error('QA no refund');}};
    if(name==='../../../../lib/customer-write-request-guard.mjs')return {readOwnerWriteObject:()=>{throw Error('QA no refund body');}};
    throw Error('Unexpected QA refund dependency '+name);
  }};
vm.runInNewContext(qaRefundCode,qaRefundScope);
eq(typeof qaRefundScope.exports.POST,'function','actual QA-master refund route export');
const qaRefundDenied=await qaRefundScope.exports.POST(new Request('https://qa.invalid/api/payments/refund',{
  method:'POST',headers:{'content-type':'application/json'},body:'{}'
}));
eq(qaRefundDenied.status,503,'QA synthetic refund remains disabled');
privateResponse(qaRefundDenied,'QA synthetic refund denied');
eq((await qaRefundDenied.json()).error.includes('Synthetic QA disables'),true,'QA Stripe refund hard stop retained');
eq(qaRefundD1Reads,0,'QA synthetic refund makes no D1 reads or writes');
eq(qaRefundAuthCalls,0,'QA synthetic refund denies before authorization as before');

console.log('PASS '+checks+' QA-master + independent DR owner payment history verified D1/read/checkout/authorization/private receipts (actual TS routes, NO HOSTED OPERATIONS)');
