/** Real EditInvoiceDialog save closure, offline. Prove no repeated PATCH
 * after an uncertain first response can create duplicate invoice revisions.
 * No browser/provider/customer account or hosted mutation.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
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
assert.ok(editor.includes('disabled={saving||uncertain||invoiceRateInvalid||!invoiceHasUnsavedChanges}'),
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
  loadedInvoice:{current:'invoice/one'},loadedInvoiceRevisionCount:{current:3},uncertain:false,invoiceRateInvalid:false,
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
 eq(JSON.parse(f.state.requests[0].options.body).expectedRevisionCount,3,'Actual invoice owner PATCH carries exact loaded version');
}
{
 const f=setup('success');
 f.context.loadedInvoiceRevisionCount.current=null;
 await f.save();
 eq(f.state.requests.length,0,'Owner editor refuses a PATCH without a verified loaded invoice revision');
 eq(f.state.saved.length,0,'A missing source version never claims an invoice change');
}

// Invoice payment status is driven by the ACTUAL PATCH route expression.
// A complimentary/no-charge invoice is not proof any cash was received.
// Verify all three statuses without mocking a Stripe payment or customer.
const invoiceRouteSource=readFileSync('app/api/invoices/[id]/route.ts','utf8');
const statusExpression=invoiceRouteSource.match(/const status=([^;]+);/)?.[1];
assert.ok(statusExpression,'Actual invoice PATCH payment status expression is required');
const invoiceStatus=(totalCents,latestPaidCents,existingStatus='draft',firstViewedAt=null)=>
 vm.runInNewContext(statusExpression,{
  totalCents,latestPaidCents,existing:{status:existingStatus,firstViewedAt}
 });
eq(invoiceStatus(0,0),'draft','Unpaid zero-dollar draft cannot claim a paid invoice');
eq(invoiceStatus(0,0,'sent'),'sent','Unpaid zero-dollar sent invoice retains sent status');
eq(invoiceStatus(0,0,'draft','2026-11-14T18:00:00Z'),'sent','Previously viewed zero-dollar invoice stays sent, not paid');
eq(invoiceStatus(2500,0),'draft','Unpaid positive invoice is draft');
eq(invoiceStatus(2500,500),'partial','Positive partially received amount is partial');
eq(invoiceStatus(2500,2500),'paid','Exactly settled positive invoice remains paid');
eq(invoiceStatus(2500,3000),'paid','Existing full-payment status remains unchanged for overage (separate review required)');

// Exercise the ACTUAL compiled invoice API revision gate SQL in disposable SQLite.
// Both tabs can pass an initial read; the transactional count is what blocks
// the stale second INSERT and every dependent invoice header/line mutation.
const api=readFileSync('app/api/invoices/[id]/route.ts','utf8');
assert.ok(api.includes('staleInvoice:true')&&api.includes('BEFORE expiring any Stripe checkout session.')&&
  api.includes('expectedRevisionCount===null?[]:[expectedRevisionCount]'),
  'Actual invoice route must deny a stale edit before Stripe and bind the CAS value');
const paid=api.match(/const actualPaid = `([\s\S]*?)`;/)?.[1];
const versionMatch=api.match(/" AND \(SELECT COUNT\(\*\) FROM invoice_revisions version WHERE version.invoice_id=guard.id\)=\?"/)?.[0];
const gate=api.match(/const revisionGate = env\.DB\.prepare\(`([\s\S]*?)`\)\s*\.bind\(/)?.[1];
assert.ok(paid&&versionMatch&&gate,'Actual versioned D1 batch revision INSERT source is required');
const sql=gate.replaceAll('${actualPaid}',paid).replace('${revisionVersionGuard}',JSON.parse(versionMatch));
assert.ok(!sql.includes('${'),'No unbound template values in actual revision gate SQL');
const db=new DatabaseSync(':memory:');
try{
 db.exec(`CREATE TABLE estimates(id TEXT PRIMARY KEY, customer_id TEXT);
 CREATE TABLE invoices(id TEXT PRIMARY KEY,estimate_id TEXT,customer_id TEXT);
 CREATE TABLE payments(estimate_id TEXT,status TEXT,type TEXT,amount_cents INTEGER);
 CREATE TABLE payment_refunds(estimate_id TEXT,status TEXT);
 CREATE TABLE invoice_revisions(id TEXT PRIMARY KEY,invoice_id TEXT,subtotal_cents INTEGER,discount_cents INTEGER,discount_type TEXT,discount_value INTEGER,total_cents INTEGER,due_at TEXT,status TEXT,items_json TEXT,created_at TEXT);
 INSERT INTO estimates VALUES('estimate-one','customer-one');
 INSERT INTO invoices VALUES('invoice-one','estimate-one','customer-one');`);
 const insert=db.prepare(sql);
 const save=(version,id)=>insert.run(id,'invoice-one',10000,0,'dollar',0,10000,null,'sent','[]',
   '2026-11-14T18:00:00.000Z','invoice-one',0,15000,version).changes;
 eq(save(0,'first-edit'),1,'First version-0 editor revision is permitted');
 eq(save(0,'stale-tab'),0,'Competing stale version-0 owner tab is refused by REAL SQL');
 eq(db.prepare('SELECT COUNT(*) AS count FROM invoice_revisions').get().count,1,'Stale edit created no second revision');
 eq(save(1,'newly-loaded'),1,'Refreshed owner version-1 editor may create next revision');
 db.exec("INSERT INTO payments VALUES('estimate-one','paid','deposit',16000)");
 eq(save(2,'paid-race'),0,'New payment blocks concurrent invoice revision even with fresh version');
 db.exec("DELETE FROM payments; INSERT INTO payment_refunds VALUES('estimate-one','pending')");
 eq(save(2,'refund-pending'),0,'Pending refund blocks invoice revision irrespective of version');
 db.exec("DELETE FROM payment_refunds; UPDATE invoices SET customer_id='other-homeowner'");
 eq(save(2,'foreign-customer'),0,'Cross-customer invoice ownership cannot pass revision insert');
}finally{db.close();}
console.log('PASS '+checks+'/'+checks+': actual invoice editor version handoff + transactional SQLite CAS, no real invoice, provider, checkout or Stripe calls.');
