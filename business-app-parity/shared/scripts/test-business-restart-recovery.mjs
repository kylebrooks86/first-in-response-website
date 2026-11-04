/** Exercise actual BusinessView reconciliation of opaque receipts against owner-authenticated saved lists. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync('app/dashboard.tsx','utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const component=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='BusinessView');
assert.ok(component,'Actual BusinessView exists');
const statement=component.body.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='reconcileReceipts'));
assert.ok(statement,'Actual saved-list recovery implementation exists');
const declaration=statement.declarationList.declarations.find(d=>d.name.getText(ast)==='reconcileReceipts');
const compiled=ts.transpileModule('exports.reconcile='+declaration.initializer.getText(ast)+';',{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
const receiptExports={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/business-create-receipt.ts','utf8'),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText,receiptExports);
const helpers=receiptExports.exports;
const task='10000000-0000-4000-8000-000000000001',expense='10000000-0000-4000-8000-000000000002';
const key=kind=>'fire:business:'+kind+':create-request:v1';
let checks=0;const eq=(a,b,label)=>{assert.equal(a,b,label);checks++;};
function fixture(initial={}){
 const data=new Map(Object.entries(initial));
 const storage={getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const calls=[],attemptTask={current:{requestId:task}},attemptExpense={current:{requestId:expense}};
 const ctx={exports:{},...helpers,businessReceiptStorage:()=>storage,taskCreateAttempt:attemptTask,expenseCreateAttempt:attemptExpense,
  setTaskRecoveryId:value=>calls.push(['task',value]),setExpenseRecoveryId:value=>calls.push(['expense',value]),
  setReceiptError:value=>calls.push(['error',value]),setBusinessMessage:value=>calls.push(['message',value])};
 vm.runInNewContext(compiled,ctx);
 return {data,calls,attemptTask,attemptExpense,reconcile:ctx.exports.reconcile,storage};
}
{
 const f=fixture({[key('task')]:task,[key('expense')]:expense});
 f.reconcile([{id:task}], [{id:'unrelated'}]);
 eq(f.data.has(key('task')),false,'Previously saved task ID verified and released');
 eq(f.data.get(key('expense')),expense,'Missing expense remains pending');
 eq(f.attemptTask.current,null,'Verified task in-memory attempt cleared');
 eq(f.attemptExpense.current?.requestId,expense,'Unconfirmed expense stays locked');
 eq(f.calls.some(([kind,id])=>kind==='expense'&&id===expense),true,'Pending expense UI stays visible');
 eq(f.calls.some(([kind,value])=>kind==='message'&&value.includes('task save verified')),true,'Recovered task displays verified status');
 f.reconcile([], [{id:expense}]);
 eq(f.data.has(key('expense')),false,'Later expense match clears its receipt');
 eq(f.attemptExpense.current,null,'Verified expense attempt is cleared');
}
{
 const f=fixture({[key('task')]:task});
 f.reconcile([{id:'another-task'}], []);
 eq(f.data.get(key('task')),task,'Different task must not release original ID');
 eq(f.calls.some(([kind,id])=>kind==='task'&&id===task),true,'Unresolved task remains visible');
}
{
 const f=fixture({[key('expense')]:'INVALID'});
 f.reconcile([],[]);
 eq(f.data.get(key('expense')),'INVALID','Invalid receipt preserved, never overwritten');
 eq(f.calls.some(([kind,value])=>kind==='error'&&value.includes('unavailable or damaged')),true,'Unusable receipt raises visible warning');
}
eq(source.includes('Review an interrupted Business save'),true,'Owner-visible restart recovery panel exists');
eq(source.includes('Review task reset'),true,'Explicit task reset review exists');
eq(source.includes('Review expense reset'),true,'Explicit expense reset review exists');
eq(source.includes('I reviewed the list — abandon ID'),true,'Manual reset requires explicit owner confirmation');
console.log('PASS '+checks+'/'+checks+': actual BusinessView saved-list reconciliation preserves unresolved IDs and clears only verified records. Synthetic storage and records only.');
