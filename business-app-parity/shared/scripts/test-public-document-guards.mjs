import assert from 'node:assert/strict';
import {invoicePaymentState} from '../lib/invoice-state.mjs';
import {recordPublicDocumentFirstView} from '../lib/public-document-first-view.mjs';
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
// Legacy first-view INSERTs have deliberately moved into the real shared
// token-bound SQL helper; a static search in TSX would now incorrectly miss
// the protected event. Exercise actual event SQL/native SQLite instead.
db.exec("UPDATE estimates SET share_token='synthetic-public-estimate' WHERE id='e'");
db.exec("INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,created_at,share_token) VALUES('i','e','c','draft',10000,'now','synthetic-public-invoice')");
const d1={
 prepare(sql){return {bind(...args){
  return {first:async()=>db.prepare(sql).get(...args)??null};
 }};},
 async batch(statements){
  db.exec('BEGIN');
  try{
   const out=statements.map(s=>({meta:{changes:Number(db.prepare(s.sql).run(...s.args).changes)}}));
   db.exec('COMMIT');return out;
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
};
// Reuse the exact real helper SQL with original customer/token, including
// three duplicate views and an independent customer-linked notification.
for(const kind of ['estimate','invoice']){
 const page=readFileSync(root+'/app/'+(kind==='invoice'?'invoice':'estimate')+'/[token]/page.tsx','utf8');
 assert.ok(page.includes('recordPublicDocumentFirstView(env.DB,{'),
  'Public '+kind+' page must invoke tested SQL/token-bound first-view helper');
 for(let i=0;i<3;i++){
  const receipt=await recordPublicDocumentFirstView(d1,{
   kind,id:kind==='invoice'?'i':'e',customerId:'c',
   token:kind==='invoice'?'synthetic-public-invoice':'synthetic-public-estimate',
   customerName:'Synthetic',serviceSummary:'Test'
  });
  assert.equal(receipt.allowed,true,'Public '+kind+' first-view receipt remains valid');
 }
 assert.equal(db.prepare('SELECT COUNT(*) n FROM notifications WHERE type=? AND estimate_id=?').get(kind+'_viewed','e').n,1,
  'Only one actual '+kind+' first-view alert, even after three visits');
 assert.ok(!page.includes('DELETE FROM notifications'));
}
// Customer estimate acceptance has a different, separately guarded atomic
// UPDATE/notification batch. Keep executing its real SQL from the route AST.
for(const path of ['app/api/public/estimates/[token]/accept/route.ts']){
 const source=readFileSync(root+'/'+path,'utf8'),ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const statements=[];
 function walk(node){
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='bind'){
   const prepare=node.expression.expression;
   if(ts.isCallExpression(prepare)&&prepare.arguments[0]?.text?.includes('INSERT INTO notifications ('))statements.push(node);
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
 assert.equal(db.prepare('SELECT COUNT(*) n FROM notifications WHERE type=? AND estimate_id=?').get('estimate_accepted','e').n,1,path);
 assert.ok(!source.includes('DELETE FROM notifications'));
}
const path='app/estimate/[token]/page.tsx',source=readFileSync(root+'/'+path,'utf8'),ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=['estimateItemsSafe','itemSubtotalCents','estimateSnapshotSafe','paymentReviewPending','billingTotalCents','estimateAmountsSafe','billingStateSafe','balance','depositRemaining','estimateApproved','canPayDeposit','canPayBalance'];
const declarations=new Map();
function walk(node){if(ts.isVariableDeclaration(node)&&names.includes(node.name.getText(ast)))declarations.set(node.name.getText(ast),node.initializer.getText(ast));ts.forEachChild(node,walk);}
walk(ast);assert.equal(declarations.size,names.length);
function guard(overrides={},paidCents=0,items=[{name:'Test',quantity:1,totalCents:10000}]){
 const row={subtotalCents:10000,discountCents:0,totalCents:10000,invoiceTotalCents:null,depositCents:5000,invoiceOwnershipMismatch:0,status:'approved',acceptedAt:'now',signedAt:'now',paymentOverageOpen:0,pendingRefundCount:0,openCheckoutCount:0,...overrides};
 // The real route computes these before the extracted payment-review
 // expression; reproduce that precondition rather than omitting it from vm.
 const scope={row,paidCents,items,
  paymentExceptionsPending:Number(row.paymentOverageOpen??0)>0||Number(row.pendingRefundCount??0)>0,
  checkedOpenCheckout:null};
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
assert.equal(guard({invoiceOwnershipMismatch:1}).billingStateSafe,false,
  'A foreign-customer invoice must disable saved estimate billing state');
const invoice=readFileSync(root+'/app/invoice/[token]/page.tsx','utf8');
assert.ok(invoice.includes("r.status='pending'"));assert.ok(invoice.includes('invoicePaymentState(row)'));assert.ok(invoice.includes('const paymentReviewPending=state.review'));assert.equal(invoicePaymentState({status:'paid',totalCents:10000,paidCents:10000,pendingRefundCount:1}).review,true);
console.log('PASS: actual notification SQL handles repeated/stale visits and acceptance without duplicate alerts; valid deposit/final payments remain available; malformed billing and pending refund/overage block collection.');
