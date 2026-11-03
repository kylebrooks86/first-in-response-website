/** Exercise real EditEstimateDialog Save and Check saved estimate handlers.
 * Synthetic fetch responses only. Never resend a possibly committed quote edit.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=ast.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text==='EditEstimateDialog');
assert.ok(fn,'Actual owner estimate edit UI must exist');
const helpers={};
function walk(n){
 if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&['save','checkSaved'].includes(n.name.text)&&n.initializer&&ts.isArrowFunction(n.initializer))helpers[n.name.text]=n.initializer;
 ts.forEachChild(n,walk);
}
walk(fn);assert.ok(helpers.save&&helpers.checkSaved,'Extract actual Save and Check saved callbacks');
const source=fn.getText(ast);
assert.ok(source.includes('disabled={saving||uncertain||!bundle.ready||!changedSinceOpen}'),'Uncertain state disables iPhone Save');
assert.ok(source.includes('Check saved estimate'),'Read-only recovery action is accessible');
const code=ts.transpileModule('exports.save='+helpers.save.getText(ast)+';exports.checkSaved='+helpers.checkSaved.getText(ast)+';',{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
function fixture(kind){
 const out={requests:[],saved:[],closed:[],errors:[],uncertain:false};
 const row={id:'estimate-uuid',customerId:'customer-uuid',customer:'Synthetic Customer',service:'Wash',
  status:'draft',subtotalCents:20001,discountCents:0,totalCents:20001,depositCents:10001,
  items:[{id:'saved-real-uuid',name:'Synthetic Wash',description:'Exact charge',quantity:3,unit:'job',totalCents:20001}]};
 const ctx={exports:{},saveLock:{current:false},saving:false,uncertain:false,bundle:{ready:true},
  estimate:{id:'estimate-uuid',customerId:'customer-uuid'},items:[{id:'saved-real-uuid',name:'Synthetic Wash',description:'Exact charge',quantity:3,unit:'job',unitRateCents:6667,preservedLineTotalCents:20001}],
  editableLineTotalCents:()=>20001,validEditablePrice:()=>true,subtotal:20001,bundleInvalid:false,
  discountInputCents:0,bundleInputCents:0,discountMode:'percent',discount:{total:20001,deposit:10001,appliedDiscount:0},
  appreciationDiscount:false,setSaving(){},setError:v=>out.errors.push(v),
  setUncertain:v=>{ctx.uncertain=v;out.uncertain=v;},setOpen:v=>out.closed.push(v),
  onSaved:v=>out.saved.push(v),
  fetch:async(url,opts)=>{
   out.requests.push({url,opts});
   if(opts?.method==='PATCH'){
    if(kind==='network')throw Error('Synthetic network interrupted');
    if(kind==='malformed')return {status:200,ok:true,json:async()=>{throw Error('Broken response')}};
    if(kind==='wrong200')return {status:200,ok:true,json:async()=>({estimate:{id:'wrong-id',totalCents:20001}})};
    if(kind==='409')return {status:409,ok:false,json:async()=>({error:'Synthetic conflict'})};
    if(kind==='503')return {status:503,ok:false,json:async()=>({saveUncertain:true,error:'Uncertain D1 batch'})};
    return {status:200,ok:true,json:async()=>({estimate:{...row,bundleDiscountCents:0}})};
   }
   if(kind==='badHistory'&&url.startsWith('/api/estimate-history'))return {status:200,ok:true,json:async()=>({estimates:[{...row,totalCents:22000}]})};
   if(kind==='badDiscounts'&&url.includes('/discounts'))return {status:200,ok:true,json:async()=>({estimateId:'estimate-uuid',totalCents:1234,bundleDiscountCents:0})};
   if(url.startsWith('/api/estimate-history'))return {status:200,ok:true,json:async()=>({estimates:[row]})};
   if(url.includes('/discounts'))return {status:200,ok:true,json:async()=>({estimateId:row.id,totalCents:row.totalCents,bundleDiscountCents:0})};
   throw Error('Unexpected network URL: '+url);
  }};
 vm.runInNewContext(code,ctx);
 return {ctx,out,save:ctx.exports.save,check:ctx.exports.checkSaved};
}
for(const kind of ['network','malformed','wrong200','503']){
 const f=fixture(kind);await f.save();
 eq(f.out.requests.length,1,kind+' one original financial PATCH');
 eq(f.out.uncertain,true,kind+' locks uncertain outcome');
 await f.save();eq(f.out.requests.length,1,kind+' repeat Save never emits another PATCH');
 eq(f.out.errors.at(-1).includes('Check the saved estimate'),true,kind+' asks for verification');
 await f.check();
 eq(f.out.requests.length,3,kind+' two independent GETs, still only one write');
 eq(f.out.requests.filter(v=>v.opts?.method==='PATCH').length,1,kind+' no duplicate estimate edit');
 eq(f.out.saved.length,1,kind+' confirmed stored estimate reported');
 eq(f.out.saved[0].items[0].id,'saved-real-uuid',kind+' original service ID preserved');
 eq(f.out.closed,[false],kind+' editor closes after exact verified read');
 eq(f.out.uncertain,false,kind+' only verified DB read releases lock');
}
for(const kind of ['badHistory','badDiscounts']){
 const f=fixture('503');const expected=fixture(kind);
 // Force negative recovery without changing the normal save scenario.
 expected.ctx.fetch=async(url,opts)=>{
  expected.out.requests.push({url,opts});
  if(opts?.method==='PATCH')return {status:503,ok:false,json:async()=>({saveUncertain:true,error:'Pending'})};
  if(url.startsWith('/api/estimate-history'))return {status:200,ok:true,json:async()=>({estimates:[kind==='badHistory'?{id:'estimate-uuid',customerId:'customer-uuid',subtotalCents:20001,discountCents:0,totalCents:22000,depositCents:10001,items:[{id:'saved-real-uuid',name:'Synthetic Wash',description:'Exact charge',quantity:3,unit:'job',totalCents:20001}]}:{id:'estimate-uuid',customerId:'customer-uuid',subtotalCents:20001,discountCents:0,totalCents:20001,depositCents:10001,items:[{id:'saved-real-uuid',name:'Synthetic Wash',description:'Exact charge',quantity:3,unit:'job',totalCents:20001}]}]})};
  return {status:200,ok:true,json:async()=>({estimateId:'estimate-uuid',totalCents:kind==='badDiscounts'?1234:20001,bundleDiscountCents:0})};
 };
 await expected.save();await expected.check();
 eq(expected.out.uncertain,true,kind+' cannot clear uncertain flag');
 eq(expected.out.saved.length,0,kind+' cannot propagate unverified estimate');
 eq(expected.out.requests.filter(v=>v.opts?.method==='PATCH').length,1,kind+' failure sends no second PATCH');
}
{
 const f=fixture('409');await f.save();eq(f.out.uncertain,false,'Deterministic business-rule 409 is not ambiguous');
 await f.save();eq(f.out.requests.length,2,'A corrected deterministic 409 can be resubmitted');
}
{
 const f=fixture('success');await f.save();eq(f.out.uncertain,false,'Verified 200 has no uncertain flag');
 eq(f.out.saved.length,1,'Confirmed saved edit updates parent');
 eq(f.out.requests.length,1,'One successful PATCH only');
}
console.log('PASS '+checks+'/'+checks+' actual EditEstimateDialog Save/checkSaved handlers: ambiguous 503/network/malformed 200 fail closed; exact line and discount GET recovers without another write; stale reads and 409 handled safely.');
