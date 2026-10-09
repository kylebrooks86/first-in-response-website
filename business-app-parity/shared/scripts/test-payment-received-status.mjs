import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const db=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));
const env={DB:{prepare(sql){return {async all(){return {results:db.prepare(sql).all()};}};}}};
let user={email:'kylebrooks8605@gmail.com'};
function load(source,context){const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,...context});return exports;}
const accounting=load(readFileSync('lib/processing-fees.ts','utf8'),{require});
const api=load(readFileSync('app/api/payments/route.ts','utf8'),{Response,require:name=>({'../../../lib/processing-fees':accounting,'cloudflare:workers':{env},'../../chatgpt-auth':{getChatGPTUser:async()=>user}})[name]});
const source=readFileSync('app/dashboard.tsx','utf8'),ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const helpers=['resolvedBillingTotalCents','billingBalanceCents'];
const declarations=ast.statements.filter(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>helpers.includes(d.name.getText(ast))));
const view=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='PaymentsView');
let state=[],cursor=0;
const stub=()=>null;
const ui=load(declarations.map(node=>node.getText(ast)).join('\n')+'\n'+view.getText(ast)+'\nexports.PaymentsView=PaymentsView;',{
 require,useState:initial=>[state[cursor++]??initial,()=>{}],useRef:initial=>({current:initial}),useEffect(){},money:c=>'$'+(c/100).toFixed(2),statusLabel:s=>s.charAt(0).toUpperCase()+s.slice(1),ProcessingReport:stub,ProcessingDetails:stub,RefundPayment:stub,RecordPayment:stub,CircleDollarSign:stub,CheckCircle2:stub,CreditCard:stub,
});
function nodes(tree){const result=[];function walk(node){if(Array.isArray(node))return node.forEach(walk);if(!node||typeof node!=='object')return;result.push(node);walk(node.props?.children);}walk(tree);return result;}
let checks=0;function equal(actual,expected){assert.equal(actual,expected);checks++;}
try{
 db.exec("INSERT INTO customers(id,name,created_at) VALUES('c','Synthetic QA','now'); INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES('e','c','completed',10000,10000,5000,'now');");
 const fixtures=[
  [[['paid','Cash App',10000,300],['paid','Tip',1000],['paid','Refund',-2000],['paid','Tip Refund',-200],['pending','Cash App',90000,800],['pending','Tip',5000],['failed','Venmo',90000,900],['failed','Tip Refund',-3000]],8800,800,300],
  [[['pending','Cash App',10000,300],['pending','Tip',1000]],0,0,0],
  [[['failed','Venmo',10000,300],['failed','Tip',1000]],0,0,0],
  [[['paid','Refund',-1000],['paid','Tip Refund',-200]],-1200,-200,0],
  [[],0,0,0],
  [[['paid','Cash App',0,0]],0,0,0],
  [[['unknown','Cash App',10000,300],['unknown','Tip',1000]],0,0,0],
  [[['pending','Refund',-1000],['failed','Tip Refund',-200],['paid','Tip',500]],500,500,0],
 ];
 for(const [rows,collected,tips,fees] of fixtures){
  db.exec('DELETE FROM payments;');rows.forEach(([status,type,amount,fee=null],index)=>db.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,processing_fee_cents,gross_received_cents,processing_method,created_at) VALUES(?,'e',?,?,?,?,?,?, '2026-10-09T00:00:00Z')").run('p'+index,type,amount,status,fee,fee===null?null:amount,fee===null?null:type));
  const response=await api.GET();equal(response.status,200);const {payments}=await response.json();equal(payments.length,rows.length);
  state=[[],payments,false];cursor=0;const rendered=ui.PaymentsView({searchQuery:''});const all=nodes(rendered);
  const metrics=all.find(node=>node.props?.className==='business-metrics');const metric=label=>metrics.props.children.find(node=>node.props.children[0].props.children===label).props.children[1].props.children;
  equal(metric('Total recorded'),'$'+(collected/100).toFixed(2));equal(metric('Net tips'),'$'+(tips/100).toFixed(2));
  const report=all.find(node=>node.type===stub&&node.props?.payments);equal(report.props.payments.length,rows.filter(row=>row[0]==='paid').length);equal(report.props.payments.reduce((sum,row)=>sum+(row.processingFeeCents??0),0),fees);
  const history=all.find(node=>node.props?.className==='payment-history');const entries=nodes(history).filter(node=>node.type==='article');equal(entries.length,rows.length);
  for(const entry of entries){const payment=payments.find(row=>row.id===entry.key);const entryNodes=nodes(entry);const status=statusLabel(payment.status);assert.ok(entryNodes.some(node=>node.type==='small'&&Array.isArray(node.props.children)&&node.props.children.includes(status)));checks++;
   equal(entryNodes.filter(node=>node.type===stub&&node.props?.payment).length,payment.status==='paid'?2:0);
  }
 }
 user=null;equal((await api.GET()).status,401);user={email:'other@example.test'};equal((await api.GET()).status,401);
 console.log(`PASS ${checks}/${checks}: actual Payments GET and component exclude pending/failed/unknown amounts and fees from received summaries, preserve paid refunds and tip refunds, retain every history entry with status, and hide non-paid refund/net-received controls. Synthetic SQLite/component checks only.`);
}finally{db.close();}
function statusLabel(value){return value.charAt(0).toUpperCase()+value.slice(1);}
