/** Execute actual RecordPayment.save() and RefundPayment.submit() handlers.
 * No mocked app rewrite: extract each TS AST initializer from dashboard.tsx.
 * Only synthetic browser storage, no server/database/Stripe/customer requests.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {loadManualPaymentRetry,saveManualPaymentRetry,clearManualPaymentRetry} from '../lib/manual-payment-retry-state.ts';
import {loadRefundRetry,saveRefundRetry,clearRefundRetry} from '../lib/refund-retry-state.ts';
import {exactMoneyInputCents} from '../lib/exact-money-input.ts';
const file=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',file,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function handler(component,name){
 const fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===component);
 assert.ok(fn,'Actual owner component '+component+' exists');
 for(const statement of fn.body.statements){
  if(!ts.isVariableStatement(statement))continue;
  const d=statement.declarationList.declarations.find(x=>x.name.getText(ast)===name);
  if(d)return d.initializer.getText(ast);
 }
 throw Error('Actual owner '+component+'.'+name+' handler not found');
}
const compiled={
 pay:ts.transpileModule('exports.execute='+handler('RecordPayment','save')+';',{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 }).outputText,
 refund:ts.transpileModule('exports.execute='+handler('RefundPayment','submit')+';',{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 }).outputText
};
const id='12345678-abcd-4def-8123-123456789abc';
const makeStorage=(mode,kind)=>{
 const values=new Map();
 const prefix=kind==='pay'?'fire:manual-payment-attempt:estimate-synthetic':'fire:refund-attempt:payment-synthetic';
 const store={
  getItem(key){if(mode==='throw-read')throw Error('Synthetic iPhone storage read blocked');
   if(mode==='corrupt'&&key===prefix)return '{invalid';
   return values.get(key)??null;},
  setItem(key,value){if(mode==='throw-write')throw Error('Synthetic iPhone storage quota exceeded');if(mode!=='drop-write')values.set(key,value);},
  removeItem(key){values.delete(key)}
 };
 if(mode==='old-id'){
  const old=kind==='pay'
   ?JSON.stringify({version:1,attempt:{requestId:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',amountCents:7500,tipCents:0,method:'Cash',reference:'',processingFeeCents:null}})
   :JSON.stringify({requestId:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',amountCents:7500});
  values.set(prefix,old);
 }
 return {store,values,prefix};
};
function fixture(kind,mode){
 const {store,values,prefix}=makeStorage(mode,kind),calls=[],messages=[],saved=[],events=[];
 const context={exports:{},Math,Number,String,JSON,Boolean,money:c=>String(c),crypto:{randomUUID:()=>id},
  saveManualPaymentRetry,loadManualPaymentRetry,clearManualPaymentRetry,
  saveRefundRetry,loadRefundRetry,clearRefundRetry,exactMoneyInputCents,
  storage:()=>mode==='missing'?undefined:store,
  fetch:async(path,opts)=>{
   const snapshot=values.get(prefix)??null;
   calls.push({path,body:opts.body,snapshot});
   if(!snapshot)throw Error('POST was sent without its durable browser receipt');
   if(kind==='pay')return{ok:true,status:201,json:async()=>({ok:true})};
   return{ok:true,status:200,json:async()=>({ok:true,pending:false})};
  },
  setError:value=>messages.push(value),
  setMessage:value=>messages.push(value),
  setSaving:value=>events.push(['saving',value]),
  setSubmitted:value=>events.push(['submitted',value]),
  setRetryPending:value=>events.push(['retry',value]),
  setReviewedMissing:value=>events.push(['review',value]),
  setRetryConfirmed:value=>events.push(['confirmed',value]),
  paymentLock:{current:false},refundLock:{current:false},
  activeManual:{current:null},manualRequestId:{current:null},
  activeRefund:{current:null},
  retryPending:false,reviewedMissing:false,retryConfirmed:false,
  amount:kind==='pay'?'100.00':'25.00',tip:'',estimate:{id:'estimate-synthetic'},normalized:{totalCents:20000},tipChoice:'0',
  method:'Cash',reference:'',processingFeeCents:null,feeMethod:false,feeValid:true,
  attempt:null,mounted:{current:true},setOpen:()=>{},setOpenSafe:()=>{},
  finishConfirmed:amount=>saved.push(amount),
  checkStored:async()=>10000,
  refundable:10000,stripe:kind==='refund',confirmed:true,requestId:id,note:'',
  payment:{id:'payment-synthetic'},onRefunded:()=>saved.push('refund'),
  window:{dispatchEvent:()=>{},setTimeout:()=>{}},Event:function(){}
 };
 vm.runInNewContext(compiled[kind],context);
 return {run:()=>context.exports.execute(),calls,messages,saved,events,values,prefix,context,store};
}
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++};
for(const kind of ['pay','refund']){
 for(const mode of ['missing','throw-read','throw-write','drop-write','corrupt','old-id']){
  const f=fixture(kind,mode);
  await f.run();
  eq(f.calls.length,0,kind+' '+mode+': no POST to finance endpoint before durable identity');
  eq(f.messages.some(message=>message.includes(kind==='pay'?'Payment not submitted':'Refund not submitted')),true,kind+' '+mode+': clear concise owner explanation');
  eq(f.context.paymentLock.current,false,kind+' '+mode+': no pending payment lock');
  eq(f.context.refundLock.current,false,kind+' '+mode+': no pending refund lock');
  if(mode==='old-id')eq(f.values.has(f.prefix),true,kind+' original unresolved request remains for recovery');
 }
 const healthy=fixture(kind,'normal');
 await healthy.run();
 eq(healthy.calls.length,1,kind+' healthy storage permits one deliberate financial POST');
 eq(typeof healthy.calls[0].snapshot,'string',kind+' exact original request persisted before POST');
 if(kind==='pay'){
  const savedAttempt=JSON.parse(healthy.calls[0].snapshot).attempt;
  eq(savedAttempt.requestId,id,'Manual payment POST uses durable same ID');
  eq(JSON.parse(healthy.calls[0].body).requestId,savedAttempt.requestId,'Manual POST equals durable saved ID');
  eq(healthy.saved[0],10000,'Confirmed manual ledger calls existing completion handler');
 }else{
  const savedAttempt=JSON.parse(healthy.calls[0].snapshot);
  eq(savedAttempt.requestId,id,'Refund POST uses durable same idempotency key');
  eq(JSON.parse(healthy.calls[0].body).requestId,savedAttempt.requestId,'Refund POST equals durable saved ID');
  eq(healthy.saved.includes('refund'),true,'Existing confirmed refund callback remains active');
 }
 const storage=healthy.store;
 const path=healthy.prefix;
 if(kind==='pay')eq(typeof storage.getItem(path),'string','Harness stubs finishConfirmed so saved ID is retained; real finishConfirmed release is covered by existing retry regression');
 else eq(storage.getItem(path),null,'Refund actual confirmed handler clears only the verified durable retry receipt');
}
// A string with fractional cents or exponent notation must never be rounded
// into money silently, even when an otherwise valid durable retry ID exists.
for(const kind of ['pay','refund']){
 for(const invalid of ['10.005','1e2','-1.00','NaN','Infinity','10,50','9.999','$25','1.2.3']){
  const f=fixture(kind,'normal');
  f.context.amount=invalid;
  await f.run();
  eq(f.calls.length,0,kind+' '+invalid+' cannot create a financial POST by rounding input');
  eq(f.messages.some(x=>x.includes('two decimal places')),true,kind+' '+invalid+' displays precise money guidance');
  eq(f.values.size,0,kind+' '+invalid+' does not even reserve a financial request ID');
 }
 const valid=fixture(kind,'normal');
 valid.context.amount='12.35';
 await valid.run();
 eq(valid.calls.length,1,kind+' exact two decimal amount posts once');
 eq(JSON.parse(valid.calls[0].body).amountCents,1235,kind+' exact $12.35 becomes 1235 cents');
}
for(const badTip of ['3.005','2e2','-1']){
 const f=fixture('pay','normal');f.context.tip=badTip;await f.run();
 eq(f.calls.length,0,'Bad tip '+badTip+' cannot silently round or submit');
}
console.log('PASS '+checks+'/'+checks+': actual owner manual payment and refund handlers block 6 storage/recovery failures each and reject fractional cents before durable same-ID financial POSTs. Zero provider/network calls.');
+(c/100).toFixed(2),crypto:{randomUUID:()=>id},
  saveManualPaymentRetry,loadManualPaymentRetry,clearManualPaymentRetry,
  saveRefundRetry,loadRefundRetry,clearRefundRetry,exactMoneyInputCents,
  storage:()=>mode==='missing'?undefined:store,
  fetch:async(path,opts)=>{
   const snapshot=values.get(prefix)??null;
   calls.push({path,body:opts.body,snapshot});
   if(!snapshot)throw Error('POST was sent without its durable browser receipt');
   if(kind==='pay')return{ok:true,status:201,json:async()=>({ok:true})};
   return{ok:true,status:200,json:async()=>({ok:true,pending:false})};
  },
  setError:value=>messages.push(value),
  setMessage:value=>messages.push(value),
  setSaving:value=>events.push(['saving',value]),
  setSubmitted:value=>events.push(['submitted',value]),
  setRetryPending:value=>events.push(['retry',value]),
  setReviewedMissing:value=>events.push(['review',value]),
  setRetryConfirmed:value=>events.push(['confirmed',value]),
  paymentLock:{current:false},refundLock:{current:false},
  activeManual:{current:null},manualRequestId:{current:null},
  activeRefund:{current:null},
  retryPending:false,reviewedMissing:false,retryConfirmed:false,
  amount:kind==='pay'?'100.00':'25.00',tip:'',estimate:{id:'estimate-synthetic'},normalized:{totalCents:20000},tipChoice:'0',
  method:'Cash',reference:'',processingFeeCents:null,feeMethod:false,feeValid:true,
  attempt:null,mounted:{current:true},setOpen:()=>{},setOpenSafe:()=>{},
  finishConfirmed:amount=>saved.push(amount),
  checkStored:async()=>10000,
  refundable:10000,stripe:kind==='refund',confirmed:true,requestId:id,note:'',
  payment:{id:'payment-synthetic'},onRefunded:()=>saved.push('refund'),
  window:{dispatchEvent:()=>{},setTimeout:()=>{}},Event:function(){}
 };
 vm.runInNewContext(compiled[kind],context);
 return {run:()=>context.exports.execute(),calls,messages,saved,events,values,prefix,context,store};
}
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++};
for(const kind of ['pay','refund']){
 for(const mode of ['missing','throw-read','throw-write','drop-write','corrupt','old-id']){
  const f=fixture(kind,mode);
  await f.run();
  eq(f.calls.length,0,kind+' '+mode+': no POST to finance endpoint before durable identity');
  eq(f.messages.some(message=>message.includes(kind==='pay'?'Payment not submitted':'Refund not submitted')),true,kind+' '+mode+': clear concise owner explanation');
  eq(f.context.paymentLock.current,false,kind+' '+mode+': no pending payment lock');
  eq(f.context.refundLock.current,false,kind+' '+mode+': no pending refund lock');
  if(mode==='old-id')eq(f.values.has(f.prefix),true,kind+' original unresolved request remains for recovery');
 }
 const healthy=fixture(kind,'normal');
 await healthy.run();
 eq(healthy.calls.length,1,kind+' healthy storage permits one deliberate financial POST');
 eq(typeof healthy.calls[0].snapshot,'string',kind+' exact original request persisted before POST');
 if(kind==='pay'){
  const savedAttempt=JSON.parse(healthy.calls[0].snapshot).attempt;
  eq(savedAttempt.requestId,id,'Manual payment POST uses durable same ID');
  eq(JSON.parse(healthy.calls[0].body).requestId,savedAttempt.requestId,'Manual POST equals durable saved ID');
  eq(healthy.saved[0],10000,'Confirmed manual ledger calls existing completion handler');
 }else{
  const savedAttempt=JSON.parse(healthy.calls[0].snapshot);
  eq(savedAttempt.requestId,id,'Refund POST uses durable same idempotency key');
  eq(JSON.parse(healthy.calls[0].body).requestId,savedAttempt.requestId,'Refund POST equals durable saved ID');
  eq(healthy.saved.includes('refund'),true,'Existing confirmed refund callback remains active');
 }
 const storage=healthy.store;
 const path=healthy.prefix;
 if(kind==='pay')eq(typeof storage.getItem(path),'string','Harness stubs finishConfirmed so saved ID is retained; real finishConfirmed release is covered by existing retry regression');
 else eq(storage.getItem(path),null,'Refund actual confirmed handler clears only the verified durable retry receipt');
}
// A string with fractional cents or exponent notation must never be rounded
// into money silently, even when an otherwise valid durable retry ID exists.
for(const kind of ['pay','refund']){
 for(const invalid of ['10.005','1e2','-1.00','NaN','Infinity','10,50','9.999','$25','1.2.3']){
  const f=fixture(kind,'normal');
  f.context.amount=invalid;
  await f.run();
  eq(f.calls.length,0,kind+' '+invalid+' cannot create a financial POST by rounding input');
  eq(f.messages.some(x=>x.includes('two decimal places')),true,kind+' '+invalid+' displays precise money guidance');
  eq(f.values.size,0,kind+' '+invalid+' does not even reserve a financial request ID');
 }
 const valid=fixture(kind,'normal');
 valid.context.amount='12.35';
 await valid.run();
 eq(valid.calls.length,1,kind+' exact two decimal amount posts once');
 eq(JSON.parse(valid.calls[0].body).amountCents,1235,kind+' exact $12.35 becomes 1235 cents');
}
for(const badTip of ['3.005','2e2','-1']){
 const f=fixture('pay','normal');f.context.tip=badTip;await f.run();
 eq(f.calls.length,0,'Bad tip '+badTip+' cannot silently round or submit');
}
console.log('PASS '+checks+'/'+checks+': actual owner manual payment and refund handlers block 6 storage/recovery failures each and reject fractional cents before durable same-ID financial POSTs. Zero provider/network calls.');
