import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
const root=resolve(process.argv[2]||'.');
const db=new DatabaseSync(':memory:');
for(const file of readdirSync(root+'/drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(root+'/drizzle/'+file,'utf8'));
db.exec("INSERT INTO customers(id,name,created_at) VALUES('c','Synthetic','2026-10-08'); INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,accepted_at,signed_at,created_at) VALUES('e','c','approved',10000,0,10000,5000,'now','now','now')");
const evaluate=(code,scope)=>vm.runInNewContext(ts.transpile(code,{target:ts.ScriptTarget.ES2022}),scope);
for(const path of ['app/estimate/[token]/page.tsx','app/invoice/[token]/page.tsx','app/api/public/estimates/[token]/accept/route.ts']){
 const source=readFileSync(root+'/'+path,'utf8'),ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const statements=[];
 function walk(node){
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='bind'){
   const prepare=node.expression.expression;
   if(ts.isCallExpression(prepare)&&prepare.arguments[0]?.text?.includes('INSERT INTO notifications'))statements.push(node);
  }
  ts.forEachChild(node,walk);
 }
 walk(ast);assert.equal(statements.length,1,path);
 const scope={crypto:{randomUUID},row:{id:'e',estimateId:'e',customerId:'c',customer:'Synthetic'},estimate:{id:'e',customerId:'c',customer:'Synthetic',service:'Test'},serviceSummary:'Test',now:'now'};
 const statement=statements[0],query=statement.expression.expression.arguments[0].text;
 for(let i=0;i<3;i++){
  const args=statement.arguments.map(arg=>evaluate(`(${arg.getText(ast)})`,scope));
  db.prepare(query).run(...args);
 }
 const type=path.includes('/accept/')?'estimate_accepted':path.includes('/invoice/')?'invoice_viewed':'estimate_viewed';
 assert.equal(db.prepare('SELECT COUNT(*) n FROM notifications WHERE type=? AND estimate_id=?').get(type,'e').n,1,path);
 assert.ok(!source.includes('DELETE FROM notifications'));
}
const path='app/estimate/[token]/page.tsx',source=readFileSync(root+'/'+path,'utf8'),ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=['estimateItemsSafe','itemSubtotalCents','estimateSnapshotSafe','paymentReviewPending','billingTotalCents','estimateAmountsSafe','billingStateSafe','balance','depositRemaining','estimateApproved','canPayDeposit','canPayBalance'];
const declarations=new Map();
function walk(node){if(ts.isVariableDeclaration(node)&&names.includes(node.name.getText(ast)))declarations.set(node.name.getText(ast),node.initializer.getText(ast));ts.forEachChild(node,walk);}
walk(ast);assert.equal(declarations.size,names.length);
function guard(overrides={},paidCents=0,items=[{name:'Test',quantity:1,totalCents:10000}]){
 const scope={row:{subtotalCents:10000,discountCents:0,totalCents:10000,invoiceTotalCents:null,depositCents:5000,status:'approved',acceptedAt:'now',paymentOverageOpen:0,pendingRefundCount:0,...overrides},paidCents,items};
 for(const name of names)scope[name]=evaluate(`(${declarations.get(name)})`,scope);
 return scope;
}
assert.equal(guard().canPayDeposit,true);
assert.equal(guard({status:'completed'},5000).canPayBalance,true);
for(const overrides of [{pendingRefundCount:1},{paymentOverageOpen:1}]){const s=guard(overrides);assert.equal(s.canPayDeposit,false);assert.equal(s.paymentReviewPending,true);assert.equal(guard({...overrides,status:'completed'}).canPayBalance,false);}
for(const overrides of [{subtotalCents:9999},{depositCents:10001},{totalCents:-1},{invoiceTotalCents:NaN},{discountCents:10001}])assert.equal(guard(overrides).billingStateSafe,false);
assert.equal(guard({},0,[]).billingStateSafe,false);
assert.equal(guard({},-1).billingStateSafe,false);
assert.equal(guard({status:'completed'},10000).balance,0);
const invoice=readFileSync(root+'/app/invoice/[token]/page.tsx','utf8');
assert.ok(invoice.includes("r.status='pending'"));assert.ok(invoice.includes('Number(row.pendingRefundCount??0)>0'));
console.log('PASS: actual notification SQL handles repeated/stale visits and acceptance without duplicate alerts; valid deposit/final payments remain available; malformed billing and pending refund/overage block collection.');
