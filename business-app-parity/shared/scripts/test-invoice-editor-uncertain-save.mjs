/** Real EditInvoiceDialog save closure, offline. Prove no repeated PATCH
 * after an uncertain first response can create duplicate invoice revisions.
 * No browser/provider/customer account or hosted mutation.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),
  ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='EditInvoiceDialog');
assert.ok(fn,'Real invoice editor not found');
let saveNode=null;
function visit(n){
 if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.name.text==='save'&&
    n.initializer&&ts.isArrowFunction(n.initializer))saveNode=n.initializer;
 ts.forEachChild(n,visit);
}
visit(fn);
assert.ok(saveNode,'Actual EditInvoiceDialog save handler was not located');
const code=ts.transpileModule('exports.save='+saveNode.getText(ast)+';',{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const editor=fn.getText(ast);
assert.ok(editor.includes('disabled={saving||uncertain||!invoiceHasUnsavedChanges}'),
 'The iPhone Save invoice action must disable after uncertain outcome');
assert.ok(editor.includes('Check saved invoice')&&editor.includes('void hydrate()'),
 'Provide read-only server reload rather than a blind repeat financial write');
assert.ok(editor.includes('The last invoice save may already have committed.'),
 'Never tell owner a possibly committed invoice remained unchanged');
assert.ok(editor.includes('loadedInvoice.current=key;setUncertain(false);'),
 'Only an independently loaded saved invoice may unlock the next edit');
let checks=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
function setup(kind){
 const state={uncertain:false,errors:[],saving:[],closed:[],saved:[],requests:[]};
 const context={
  exports:{},saveLock:{current:false},currentInvoice:{current:'invoice/one'},invoiceKey:'invoice/one',
  loadedInvoice:{current:'invoice/one'},uncertain:false,
  estimate:{id:'estimate-one',invoiceId:'invoice-one'},
  items:[{id:'item-one',name:'Synthetic concrete',description:'Only synthetic',
    quantity:1,unit:'job',unitRateCents:2500}],
  editableLineTotalCents:()=>2500,
  invoiceDiscountInputCents:0,discountMode:'dollar',subtotal:2500,
  dueMode:'receipt',dueDate:'',
  setError:s=>state.errors.push(s),setSaving:s=>state.saving.push(s),
  setUncertain:v=>{state.uncertain=v;context.uncertain=v;},
  setOpen:v=>state.closed.push(v),onSaved:v=>state.saved.push(v),
  fetch:async(url,options)=>{
   state.requests.push({url,options});
   if(kind==='network')throw Error('Synthetic network failure');
   if(kind==='invalid-json')return {status:200,ok:true,json:async()=>{throw Error('Malformed JSON')}};
   const status=kind==='server-503'?503:kind==='client-409'?409:200;
   const invoice={id:kind==='wrong-receipt'?'different-invoice':'invoice-one',totalCents:2500};
   return {status,ok:status===200,json:async()=>status===200?{invoice}:{error:'Synthetic rejection'}};
  }
 };
 vm.runInNewContext(code,context,{filename:'extracted-real-EditInvoiceDialog-save.js'});
 return {context,state,save:context.exports.save};
}
for(const kind of ['server-503','network','invalid-json','wrong-receipt']){
 const f=setup(kind);
 await f.save();
 eq(f.state.requests.length,1,kind+' submitted exactly one PATCH');
 eq(f.state.uncertain,true,kind+' must mark the invoice outcome uncertain');
 eq(f.context.saveLock.current,false,kind+' frees local in-flight lock');
 const prior=f.state.requests.length;
 await f.save();
 eq(f.state.requests.length,prior,kind+' repeat tap MUST NOT send another financial write');
 eq(f.state.errors.at(-1).includes('Check the saved invoice'),true,kind+' safe recovery instruction');
 eq(f.state.saved.length,0,kind+' must not claim a new invoice total');
}
{
 const f=setup('client-409');await f.save();
 eq(f.state.uncertain,false,'Confirmed business-rule rejection is not an ambiguous commit');
 eq(f.state.saved.length,0,'A rejected invoice cannot be counted as saved');
 await f.save();eq(f.state.requests.length,2,'After a deterministic 409 the owner may correct and resubmit');
}
{
 const f=setup('success');await f.save();
 eq(f.state.uncertain,false,'Valid confirmed invoice clears uncertainty');
 eq(f.state.saved,[2500],'Only verified saved cents reported to parent');
 eq(f.state.closed,[false],'Confirmed invoice closes editor');
 eq(f.state.requests.length,1,'One confirmed write only');
}
console.log('PASS '+checks+'/'+checks+': exact invoice editor save code blocks all repeated PATCH after 503/network/malformed/false-200, retains explicit recovery, permits valid business rejection edit and confirmed success; no provider requests.');
