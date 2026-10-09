import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
const db=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
const DB={prepare(sql){return {args:[],sql,bind(...args){this.args=args;return this;},async first(){return db.prepare(sql).get(...this.args)??null;},async all(){return {results:db.prepare(sql).all(...this.args)};},async run(){return {meta:{changes:Number(db.prepare(sql).run(...this.args).changes)}};}};},async batch(queries){db.exec('BEGIN');try{const results=[];for(const q of queries)results.push(/^\s*SELECT/i.test(q.sql)?{results:db.prepare(q.sql).all(...q.args)}:{meta:{changes:Number(db.prepare(q.sql).run(...q.args).changes)}});db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}}};
const auth={getChatGPTUser:async()=>({email:'kylebrooks8605@gmail.com'})};
function load(source,imports,context={}){const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{if(!(name in imports))throw Error('Unexpected import '+name);return imports[name];},Response,crypto,...context});return exports;}
const fees=load(readFileSync('lib/processing-fees.ts','utf8'),{});
const common={'cloudflare:workers':{env:{DB}},'../../chatgpt-auth':auth};
const payments=load(readFileSync('app/api/payments/route.ts','utf8'),{...common,'../../../lib/processing-fees':fees});
const invoices=load(readFileSync('app/api/invoices/route.ts','utf8'),common);
const workflow=load(readFileSync('app/api/estimates/[id]/route.ts','utf8'),{'cloudflare:workers':{env:{DB}},'../../../chatgpt-auth':auth});
const dashboard=load(readFileSync('lib/dashboard-data.ts','utf8'),{});
const source=readFileSync('app/dashboard.tsx','utf8');const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const helper=ast.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='amountDueNow'));
const {amountDueNow}=load('export '+helper.getText(ast),{});
const invoiceView=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='InvoicesView');
let invoiceRows=[],cursor=0;const RecordPayment=()=>null;
const invoiceUI=load('export '+invoiceView.getText(ast),{'react/jsx-runtime':jsx},{useState:()=>[cursor++===0?invoiceRows:false,()=>{}],useEffect(){},RecordPayment,Receipt:()=>null,ExternalLink:()=>null,money:c=>String(c),statusLabel:s=>s});
function nodes(tree){const result=[];function walk(n){if(Array.isArray(n))return n.forEach(walk);if(!n||typeof n!=='object')return;result.push(n);walk(n.props?.children);}walk(tree);return result;}
let checks=0;function equal(a,b){assert.equal(a,b);checks++;}
function seed({status='approved',invoice=8000,deposit=5000,ledger=[['deposit',2000],['Tip',1000]]}){
 db.exec('DELETE FROM notifications; DELETE FROM payments; DELETE FROM invoices; DELETE FROM estimates; DELETE FROM customers;');
 db.exec("INSERT INTO customers(id,name,created_at) VALUES('c','Synthetic QA','now')");
 db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,accepted_at,signed_at,created_at) VALUES('e','c',?,10000,10000,?,'2026-10-01','2026-10-01','now')").run(status,deposit);
 if(invoice!==null)db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,created_at) VALUES('i','e','c','sent',?,'now')").run(invoice);
 ledger.forEach(([type,amount,status='paid'],i)=>db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,created_at) VALUES(?,'e',?,?,?,'now')").run('p'+i,type,amount,status));
}
function count(){return Number(db.prepare('SELECT COUNT(*) n FROM payments').get().n);}
function row(){return db.prepare("SELECT status,total_cents totalCents,deposit_cents depositCents,(SELECT total_cents FROM invoices WHERE estimate_id='e') invoiceTotalCents,(SELECT COALESCE(SUM(amount_cents),0) FROM payments WHERE estimate_id='e' AND status='paid' AND type NOT IN ('Tip','Tip Refund')) paidCents FROM estimates WHERE id='e'").get();}
function pay(amountCents){return payments.POST(new Request('https://synthetic.test/api/payments',{method:'POST',body:JSON.stringify({estimateId:'e',amountCents,method:'Cash'})}));}
try{
 const fixtures=[
  [{},3000],[{status:'scheduled'},3000],[{invoice:15000},3000],[{status:'completed'},6000],
  [{invoice:null},3000],[{status:'scheduled',invoice:null},3000],[{deposit:0,ledger:[]},0],
  [{status:'draft',invoice:null,ledger:[]},0],[{status:'sent',invoice:null,ledger:[]},0],[{status:'declined',invoice:null,ledger:[]},0],
  [{status:'completed',invoice:0,ledger:[]},0],
  [{ledger:[['deposit',2000],['Refund',-1000],['Tip',1000],['Tip Refund',-500]]},4000],
  [{ledger:[['deposit',5000,'pending'],['deposit',5000,'failed']]},5000],
  [{ledger:[['deposit',5000]]},0],
 ];
 for(const [fixture,due] of fixtures){
  seed(fixture);
  if(fixture.invoice!==null){const response=await invoices.GET();equal(response.status,200);invoiceRows=(await response.json()).invoices;cursor=0;const action=nodes(invoiceUI.InvoicesView({searchQuery:''})).find(n=>n.type===RecordPayment);equal(action.props.estimate.status,row().status);equal(action.props.estimate.depositCents,row().depositCents);equal(amountDueNow(action.props.estimate),due);}
  equal(amountDueNow(row()),due);equal((await dashboard.loadDashboardData(DB)).outstanding,due);
  const before=count();const rejected=await pay(due+1);equal(rejected.status,due>0?400:fixture.deposit===0||['draft','sent','declined'].includes(fixture.status)||fixture.invoice===0?409:400);equal(count(),before);
  if(due>0){const response=await pay(due);equal(response.status,201);equal(amountDueNow(row()),0);equal((await dashboard.loadDashboardData(DB)).outstanding,0);equal(count(),before+1);}
 }
 seed({invoice:null,ledger:[]});equal((await invoices.POST(new Request('https://synthetic.test/api/invoices',{method:'POST',body:JSON.stringify({estimateId:'e'})}))).status,409);equal(db.prepare('SELECT COUNT(*) n FROM invoices').get().n,0);
 seed({status:'completed'});
 for(const status of ['approved','scheduled']){const response=await workflow.PATCH(new Request('https://synthetic.test/api/estimates/e',{method:'PATCH',body:JSON.stringify({status,scheduledAt:status==='scheduled'?'2026-10-10T12:00:00Z':undefined})}),{params:Promise.resolve({id:'e'})});equal(response.status,409);equal(row().status,'completed');}
 console.log(`PASS ${checks}/${checks}: actual UI helper, dashboard queries and manual POST agree on deposit until completion, revised final invoice after completion, refunds, tips, unpaid entries and waived deposit. Excess amounts rejected without ledger writes. Invoice creation before completion and billed-job backward transitions blocked. Synthetic SQLite only.`);
}finally{db.close();}
