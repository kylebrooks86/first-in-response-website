/** Customer-facing Job # contract: actual page JSX + real synthetic SQLite.
 * No network, hosted migrations, customer records, Stripe or email/text sends.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
import {jobNumberLabelForEstimate,newJobStatements,replacementJobStatement} from '../lib/job-numbering.mjs';

let checks=0;
const eq=(actual,expected,message)=>{assert.equal(actual,expected,message);checks++;};

for(const [path,fn,sourceEstimate] of [
 ['app/estimate/[token]/page.tsx','CustomerEstimatePage','row.id'],
 ['app/invoice/[token]/page.tsx','CustomerInvoicePage','row.estimateId'],
]){
 const source=readFileSync(path,'utf8');
 const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const page=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===fn);
 assert.ok(page,'Actual customer-facing page found: '+fn);checks++;
 const pageText=page.getText(ast);
 const notFound=pageText.match(/if\s*\(\s*!row\s*\)/);
 assert.ok(notFound&&pageText.indexOf(notFound[0])<pageText.indexOf('const jobLabel='),
  'Unknown or invalid customer token cannot resolve a job reference');checks++;
 assert.ok(pageText.includes('FIRE_JOB_NUMBERS_CANDIDATE')&&pageText.includes("'owner-approved-schema-v1'"),
  'Job # is only displayed after an explicitly approved schema enablement');checks++;
 assert.ok(pageText.includes('await jobNumberLabelForEstimate(env.DB,'+sourceEstimate+')'),
  'The same authenticated token-resolved estimate linkage supplies Job #');checks++;
 const titles=[];
 function visit(node){
  if(ts.isJsxElement(node)){
   const tag=node.openingElement,hasClass=tag.attributes.properties.some(attr=>
    ts.isJsxAttribute(attr)&&attr.name.text==='className'&&attr.initializer&&
    ts.isStringLiteral(attr.initializer)&&attr.initializer.text==='pay-title');
   if(hasClass)titles.push(node.getText(ast));
  }
  ts.forEachChild(node,visit);
 }
 visit(page);
 eq(titles.length,1,'Exactly one primary customer-facing document title');
 assert.ok(titles[0].includes('{jobLabel&&<small>{jobLabel}</small>}'),
  'Customer can see the reference directly beneath their name');checks++;
}

const db=new DatabaseSync(':memory:');
try{
 for(const file of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())
  db.exec(readFileSync('drizzle/'+file,'utf8'));
 const d1={prepare(sql){return {bind(...args){return {first:async()=>db.prepare(sql).get(...args)??null,all:async()=>({results:db.prepare(sql).all(...args)})};},first:async()=>db.prepare(sql).get()??null};}};
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
 db.prepare("INSERT INTO customers(id,name,created_at) VALUES ('a','Synthetic Customer A','2026-10-29T00:00:00Z'),('b','Synthetic Customer B','2026-10-29T00:00:00Z')").run();
 const estimate=(id,customer,token,status='sent')=>db.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,share_token,created_at) VALUES(?,?,?,2500,2500,1250,?,'2026-10-29T00:00:00Z')").run(id,customer,status,token);
 estimate(a,'a','synthetic-share-a','superseded');
 estimate(b,'a','synthetic-share-b','completed');
 estimate(c,'b','synthetic-share-c','completed');
 db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,share_token,created_at) VALUES('invoice-a',?,'a','sent',2500,'synthetic-invoice-a','2026-10-29T00:00:00Z')").run(b);
 db.prepare("INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,share_token,created_at) VALUES('invoice-b',?,'b','sent',2500,'synthetic-invoice-b','2026-10-29T00:00:00Z')").run(c);

 eq(await jobNumberLabelForEstimate(d1,a),null,'No migration: never fabricate Job #');
 db.exec(`CREATE TABLE fire_job_numbers(job_number INTEGER PRIMARY KEY AUTOINCREMENT,root_estimate_id TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL);
 CREATE TABLE fire_job_estimate_links(estimate_id TEXT PRIMARY KEY NOT NULL,job_number INTEGER NOT NULL);`);
 const run=(statement)=>db.prepare(statement.sql).run(...statement.values);
 const batchDb={prepare(sql){return {bind(...values){return {sql,values};}}}};
 for(const statement of newJobStatements(batchDb,a,'2026-10-29T00:00:00Z'))run(statement);
 run(replacementJobStatement(batchDb,b,a));
 for(const statement of newJobStatements(batchDb,c,'2026-10-29T00:00:00Z'))run(statement);

 const estimateByToken=token=>db.prepare('SELECT id FROM estimates WHERE share_token=?').get(token);
 const invoiceByToken=token=>db.prepare('SELECT estimate_id AS estimateId FROM invoices WHERE share_token=?').get(token);
 const shownEstimate=estimateByToken('synthetic-share-b');
 const shownInvoice=invoiceByToken('synthetic-invoice-a');
 eq(await jobNumberLabelForEstimate(d1,shownEstimate.id),'Job #0001','Replacement estimate keeps original Job #');
 eq(await jobNumberLabelForEstimate(d1,shownInvoice.estimateId),'Job #0001','Related invoice shows identical Job #');
 eq(await jobNumberLabelForEstimate(d1,a),'Job #0001','Superseded original retains historic reference');
 eq(await jobNumberLabelForEstimate(d1,c),'Job #0002','Unrelated customer gets a separate number');
 eq(await jobNumberLabelForEstimate(d1,invoiceByToken('synthetic-invoice-b').estimateId),'Job #0002','Other invoice never adopts first customer Job #');
 eq(estimateByToken('not-a-saved-token'),undefined,'Unknown estimate token resolves no row');
 eq(invoiceByToken('not-a-saved-token'),undefined,'Unknown invoice token resolves no row');
 eq(db.prepare("SELECT COUNT(DISTINCT l.job_number) AS n FROM fire_job_estimate_links l JOIN estimates e ON e.id=l.estimate_id WHERE e.status='completed'").get().n,2,
   'Two completed jobs, not three completed/replaced estimate records');
 console.log(`PASS ${checks} real page structure, token-scoped permanent Job #, revised estimate/invoice consistency and unrelated customer isolation. Local SQLite only.`);
}finally{db.close();}
