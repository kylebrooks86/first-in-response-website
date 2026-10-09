import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';

const db=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
const env={DB:{prepare(sql){return {sql,async all(){return {results:db.prepare(sql).all()};}};},async batch(queries){return queries.map(({sql})=>({results:db.prepare(sql).all()}));}}};
let user={email:'kylebrooks8605@gmail.com'};
function load(source,imports){const exports={};const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{exports,require:name=>{if(!(name in imports))throw Error('Unexpected import '+name);return imports[name];},Response});return exports;}
const imports={'cloudflare:workers':{env},'../../chatgpt-auth':{getChatGPTUser:async()=>user}};
const customers=load(readFileSync('app/api/customers/route.ts','utf8'),imports);
const invoices=load(readFileSync('app/api/invoices/route.ts','utf8'),imports);
const estimates=load(readFileSync('app/api/estimates/route.ts','utf8'),imports);
// Execute the actual UI billing helpers, selected by AST rather than copied formulas.
const dashboardSource=readFileSync('app/dashboard.tsx','utf8');
const tree=ts.createSourceFile('dashboard.tsx',dashboardSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const helperNames=['resolvedBillingTotalCents','billingBalanceCents','amountDueNow'];
const declarations=tree.statements.filter(statement=>ts.isVariableStatement(statement)&&statement.declarationList.declarations.some(declaration=>helperNames.includes(declaration.name.getText(tree))));
assert.equal(declarations.length,3);
const helpers=load(declarations.map(statement=>'export '+statement.getText(tree)).join('\n'),{});
let checks=0;
function equal(actual,expected){assert.equal(actual,expected);checks++;}
async function body(route){const response=await route.GET();equal(response.status,200);return response.json();}
function seed({invoice=null,payments=[],total=10000,status='completed'}){
 db.exec('DELETE FROM payments; DELETE FROM invoices; DELETE FROM estimate_items; DELETE FROM estimates; DELETE FROM customers;');
 db.prepare("INSERT INTO customers(id,name,created_at) VALUES('c','Synthetic QA','now')").run();
 db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES('e','c',?,?,?,5000,'now')").run(status,total,total);
 if(invoice!==null)db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,created_at) VALUES('i','e','c','sent',?,'now')").run(invoice);
 payments.forEach(([type,amount,paymentStatus='paid'],index)=>db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,'e',?,?,?,'now')").run('p'+index,type,amount,paymentStatus));
}
try{
 const fixtures=[
  [{},10000,0,10000],
  [{invoice:8000,payments:[['balance',6000],['Tip',3000],['Refund',-1000],['Tip Refund',-500]]},8000,5000,3000],
  [{invoice:15000,payments:[['deposit',5000]]},15000,5000,10000],
  [{invoice:0},0,0,0],
  [{invoice:8000,payments:[['balance',15000]]},8000,15000,0],
  [{invoice:8000,payments:[['balance',8000,'pending'],['balance',8000,'failed']]},8000,0,8000],
  [{invoice:8000,payments:[['balance',8000],['Refund',-8000]]},8000,0,8000],
  [{invoice:8000,payments:[['balance',8000],['Tip',500],['Tip Refund',-500]]},8000,8000,0],
  [{status:'scheduled',payments:[['deposit',2000],['Tip',500]]},10000,2000,8000],
 ];
 for(const [fixture,billingTotal,principal,balance] of fixtures){
  seed(fixture);const customerData=await body(customers);const invoiceData=await body(invoices);const estimateData=await body(estimates);
  const c=customerData.customers[0],e=customerData.estimates[0],listed=estimateData.estimates[0];
  equal(c.estimateTotal,billingTotal);equal(c.paidTotal,principal);equal(e.paidCents,principal);equal(listed.paidCents,principal);
  equal(helpers.resolvedBillingTotalCents(e),billingTotal);equal(helpers.billingBalanceCents(e),balance);equal(helpers.billingBalanceCents(listed),balance);
  equal(customerData.payments.filter(row=>!['Tip','Tip Refund'].includes(row.type)).reduce((sum,row)=>sum+row.amountCents,0),principal);
  equal(invoiceData.invoices.length,fixture.invoice===undefined?0:1);
  if(fixture.invoice!==undefined){const i=invoiceData.invoices[0];equal(i.totalCents,billingTotal);equal(i.paidCents,principal);equal(Math.max(0,i.totalCents-i.paidCents),balance);equal(customerData.invoices[0].totalCents,billingTotal);}
  equal(helpers.amountDueNow(e),fixture.status==='scheduled'?3000:balance);
 }
 // One overpaid job must not hide another job's open balance; unrelated customers stay isolated.
 seed({invoice:8000,payments:[['balance',12000]]});
 db.exec("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES('e2','c','completed',10000,10000,5000,'now'); INSERT INTO customers(id,name,created_at) VALUES('other','Other synthetic','now'); INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES('other-e','other','completed',99000,99000,49500,'now'); INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES('other-p','other-e','balance',99000,'paid','now');");
 const multiple=await body(customers);const customer=multiple.customers.find(row=>row.id==='c');const jobs=multiple.estimates.filter(row=>row.customerId==='c');
 equal(customer.estimateTotal,18000);equal(customer.paidTotal,12000);equal(jobs.reduce((sum,row)=>sum+helpers.billingBalanceCents(row),0),10000);equal(multiple.payments.filter(row=>row.customerId==='c'&&!['Tip','Tip Refund'].includes(row.type)).reduce((sum,row)=>sum+row.amountCents,0),12000);
 for(const unauthorized of [null,{email:'other@example.test'}]){user=unauthorized;for(const route of [customers,invoices,estimates])equal((await route.GET()).status,401);}
 console.log(`PASS ${checks}/${checks}: actual customer/invoice/estimate routes and UI helpers preserve revised/zero invoice totals, principal versus tips/refunds, pending/failed exclusion, overpayment floor, per-job balances, customer isolation and owner access. Synthetic SQLite only.`);
}finally{db.close();}
