/** Actual FIRE owner-screen AST and Copy handler; no hosting or customer traffic. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const component=name=>ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
const variable=(fn,name)=>{
  let found;
  const visit=n=>{
    if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.name.text===name)found=n;
    ts.forEachChild(n,visit);
  };
  visit(fn);
  assert.ok(found?.initializer,`Actual ${name} handler not found`);
  return found.initializer;
};
let checks=0;
const check=(label,fn)=>{fn();checks++;};
const detail=component('EstimateDetail'),customer=component('CustomersView');
assert.ok(detail&&customer);
const schedule=variable(detail,'canChangeJobDate');
const scheduleCode=ts.transpileModule('exports.allowed='+schedule.getText(ast)+';',{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
for(const [status,acceptedAt,signedAt,expected]of [
  ['draft',null,null,false],['sent',null,null,false],
  ['approved',null,null,false],['approved','signed',null,false],
  ['approved','accepted','signed',true],['scheduled','accepted','signed',true],
  ['completed','accepted','signed',false],['declined',null,null,false],
  ['superseded','accepted','signed',false],
]){
  const ctx={exports:{},estimate:{status,acceptedAt,signedAt}};
  vm.runInNewContext(scheduleCode,ctx);
  check(`Date edit availability for ${status}/${Boolean(acceptedAt)}/${Boolean(signedAt)}`,()=>assert.equal(ctx.exports.allowed,expected));
}
const detailText=detail.getText(ast);
check('Actual Save job date button follows the eligibility guard',()=>assert.match(detailText,/\{canChangeJobDate&&<Button[^\n]*Save job date<\/Button>\}/));
check('Historical appointment stays readable without edit affordances',()=>assert.match(detailText,/aria-label="Saved appointment"/));
check('Appointment input and clear actions are inside editable branch',()=>assert.match(detailText,/\{canChangeJobDate\?<>{estimate\.status/));

const copy=variable(customer,'copyPaymentReference');
const copyCode=ts.transpileModule('exports.copy='+copy.getText(ast)+';',{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const successes=[],feedback=[];
const ctx={exports:{},navigator:{clipboard:{writeText:async text=>{successes.push(text);}}},setPaymentReferenceCopyFeedback:result=>feedback.push(result)};
vm.runInNewContext(copyCode,ctx);
await ctx.exports.copy('payment-1','reference-exact-123');
check('Owner Copy uses the exact full reference',()=>assert.deepEqual(successes,['reference-exact-123']));
check('Only a successful clipboard promise reports success',()=>assert.deepEqual(JSON.parse(JSON.stringify(feedback.at(-1))),{id:'payment-1',ok:true}));
ctx.navigator.clipboard.writeText=async()=>{throw new Error('Synthetic iPhone permission denial')};
await ctx.exports.copy('payment-2','reference-failed');
check('Clipboard denial is visible as failure, not a false copied receipt',()=>assert.deepEqual(JSON.parse(JSON.stringify(feedback.at(-1))),{id:'payment-2',ok:false}));
ctx.navigator.clipboard=null;
await ctx.exports.copy('payment-3','reference-unavailable');
check('Unsupported clipboard also gets truthful feedback',()=>assert.deepEqual(JSON.parse(JSON.stringify(feedback.at(-1))),{id:'payment-3',ok:false}));
const customerText=customer.getText(ast);
check('Failed Copy displays original selectable reference',()=>assert.ok(customerText.includes('Select the reference: <code className="break-all select-text">{payment.reference}</code>')));
check('Each customer change clears stale Copy feedback',()=>assert.match(customerText,/setPaymentReferenceCopyFeedback\(null\),\[selectedId\]/));
check('Copy event timeline says prepared, not delivered or copied',()=>assert.ok(customerText.includes('message.channel==="copy"?kind+" copy prepared"')));
check('Customer message history marks unverified clipboard status',()=>assert.ok(customerText.includes('Copy prepared · clipboard result unverified; sending unconfirmed')));
check('Preparation is no longer displayed as proven clipboard success',()=>assert.ok(!customerText.includes('message.channel==="copy"?"Copied')));
console.log('PASS '+checks+'/'+checks+' actual owner scheduling eligibility, iPhone clipboard success/failure handler, truthful message history and unchanged copy fallback; source/VM only.');
