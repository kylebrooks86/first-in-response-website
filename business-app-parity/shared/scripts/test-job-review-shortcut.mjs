/** Actual EstimateDetail review shortcut condition; no copied financial policy. */
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const ast=ts.createSourceFile('dashboard.tsx',readFileSync('app/dashboard.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const detail=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='EstimateDetail');let guard;
function visit(n){if(ts.isJsxSelfClosingElement(n)&&n.tagName.getText(ast)==='MessageComposer'&&n.attributes.properties.some(p=>p.name?.text==='initialTemplate'&&p.initializer?.text==='review'))guard=n.parent.left;ts.forEachChild(n,visit);}visit(detail);assert.ok(guard);
const context={exports:{},resolvedBillingTotalCents:e=>e.invoiceTotalCents??e.totalCents};vm.runInNewContext(ts.transpileModule('exports.allowed=estimate=>Boolean('+guard.getText(ast)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);
const base={customerId:'synthetic',status:'completed',totalCents:10000,paidCents:10000,paymentOverageOpen:0,pendingRefundCount:0,openCheckoutCount:0};let count=0;
const test=(patch,expected,label)=>{assert.equal(context.exports.allowed({...base,...patch}),expected,label);count++;};
test({},true,'Exact positive paid completed job');
for(const patch of [{status:'scheduled'},{customerId:''},{paidCents:5000},{paidCents:10001},{totalCents:0,paidCents:0},{totalCents:1.5,paidCents:1.5},{totalCents:NaN,paidCents:NaN},{totalCents:Number.MAX_SAFE_INTEGER+1,paidCents:Number.MAX_SAFE_INTEGER+1},{paymentOverageOpen:1},{pendingRefundCount:1},{openCheckoutCount:1},{pendingRefundCount:undefined},{openCheckoutCount:undefined},{reviewReceivedAt:'2026-10-22T12:00:00Z'},{lastReviewRequestAt:'2026-10-22T12:00:00Z'}])test(patch,false,'Unsafe, unknown or already tracked review state '+JSON.stringify(patch));
test({invoiceTotalCents:12000},false,'Revised invoice balance blocks request');test({invoiceTotalCents:12000,paidCents:12000},true,'Exact revised invoice balance permits request');
let nextAction;function findNext(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='nextAction')nextAction=n.initializer;ts.forEachChild(n,findNext);}findNext(detail);assert.ok(nextAction);
vm.runInNewContext(ts.transpileModule('exports.next=estimate=>'+nextAction.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);
for(const [patch,text] of [[{},'Paid in full — review the saved closeout status'],[{status:'scheduled'},'complete the job report'],[{pendingRefundCount:1},'Payment review:'],[{openCheckoutCount:1},'Payment review:'],[{paymentOverageOpen:1},'Billing exception:']]){assert.ok(context.exports.next({...base,...patch}).includes(text));count++;}
console.log(`PASS ${count} actual job review shortcut checks; exact cents, invoice revisions, holds and duplicate outreach controls.`);
