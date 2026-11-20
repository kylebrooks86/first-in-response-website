/** Evaluate actual shared payment-entry expressions, not a copied policy. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync('app/dashboard.tsx','utf8'),ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const due=ast.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='amountDueNow'));
const form=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='RecordPayment');assert.ok(due&&form);
const names=['billingTotal','normalized','balance','collectible','paymentEntryLabel'];
const expressions=form.body.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>names.includes(d.name.getText(ast))));assert.equal(expressions.length,names.length);
const code=ts.transpileModule(due.getText(ast)+'\n'+expressions.map(n=>n.getText(ast)).join('\n')+'\nresult={label:paymentEntryLabel,disabled:!retryPending&&(!collectible||balance<=0&&normalized.status!=="completed")};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
let checks=0;const base={totalCents:20000,depositCents:10000,paidCents:0};
for(const [status,paid,deposit,label,disabled]of [
 ['draft',0,10000,'Approval required',true],['sent',0,10000,'Approval required',true],['viewed',0,10000,'Approval required',true],
 ['declined',0,10000,'Payment unavailable',true],['canceled',0,10000,'Payment unavailable',true],
 ['approved',0,10000,'Record payment',false],['scheduled',0,10000,'Record payment',false],
 ['approved',5000,10000,'Record payment',false],['scheduled',5000,10000,'Record payment',false],
 ['approved',10000,10000,'Deposit recorded',true],['scheduled',10000,10000,'Deposit recorded',true],
 ['scheduled',0,0,'No deposit required',true],['completed',0,10000,'Record payment',false],
 ['completed',10000,10000,'Record payment',false],['completed',20000,10000,'Record tip',false],
])for(const retryPending of [false,true]){
 const context={estimate:{...base,status,paidCents:paid,depositCents:deposit},retryPending,result:null};vm.runInNewContext(code,context);
 assert.equal(context.result.label,retryPending?'Check payment status':label,`${status}/${paid}: truthful payment entry`);checks++;
 assert.equal(context.result.disabled,retryPending?false:disabled,`${status}/${paid}: pending review stays accessible`);checks++;
}
console.log(`PASS ${checks}/${checks} actual payment-entry expressions: no false paid claims for unapproved/zero-deposit jobs; pending review available after balance changes.`);
