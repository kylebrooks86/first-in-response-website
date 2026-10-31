/** Customer-facing Job # contract: actual page JSX + real synthetic SQLite.
 * No network, hosted migrations, customer records, Stripe or email/text sends.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';
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

// Actual owner estimate POST and replay, with isolated candidate-like schema.
// A committed estimate returns its real database Job # on the first receipt;
// repeating the same request must never allocate another job or mutate records.
const runtime=stackedRuntime();
try{
 runtime.db.exec(`CREATE TABLE fire_job_numbers(job_number INTEGER PRIMARY KEY AUTOINCREMENT,root_estimate_id TEXT NOT NULL UNIQUE REFERENCES estimates(id),created_at TEXT NOT NULL);
 CREATE TABLE fire_job_estimate_links(estimate_id TEXT PRIMARY KEY NOT NULL REFERENCES estimates(id),job_number INTEGER NOT NULL REFERENCES fire_job_numbers(job_number));
 CREATE TRIGGER fire_job_numbers_no_update BEFORE UPDATE ON fire_job_numbers BEGIN SELECT RAISE(ABORT,'immutable'); END;
 CREATE TRIGGER fire_job_numbers_no_delete BEFORE DELETE ON fire_job_numbers BEGIN SELECT RAISE(ABORT,'immutable'); END;
 CREATE TRIGGER fire_job_estimate_links_no_update BEFORE UPDATE ON fire_job_estimate_links BEGIN SELECT RAISE(ABORT,'immutable'); END;
 CREATE TRIGGER fire_job_estimate_links_no_delete BEFORE DELETE ON fire_job_estimate_links BEGIN SELECT RAISE(ABORT,'immutable'); END;`);
 runtime.env.FIRE_JOB_NUMBERS_CANDIDATE='owner-approved-schema-v1';
 const requestId='44444444-4444-4444-8444-444444444444';
 const quote={requestId,customer:'Synthetic Job Number Receipt',email:'synthetic-job@example.invalid',phone:'9185550100',address:'100 Synthetic Job St',
  items:[{name:'Custom Service',description:'Synthetic only',quantity:1,unit:'job',totalCents:2500}],
  appreciationDiscount:false,additionalDiscountType:'percent',additionalDiscountValue:0,bundleDiscountCents:0};
 const firstResponse=await runtime.post(quote),first=await firstResponse.json();
 eq(firstResponse.status,201,'New permanent-numbered estimate saves once');
 eq(first.jobNumber,1,'First saved receipt includes the database-assigned Job #0001');
 eq(first.id,requestId,'Original idempotent operation ID is unchanged');
 const beforeReplay=runtime.counters().writes;
 const repeatResponse=await runtime.post(quote),repeat=await repeatResponse.json();
 eq(repeatResponse.status,200,'Retry returns the original receipt');
 eq(repeat.replayed,true,'Retry is explicitly identified');
 eq(repeat.id,first.id,'Retry cannot create a second estimate');
 eq(repeat.jobNumber,first.jobNumber,'Retry returns the identical permanent Job #');
 eq(runtime.counters().writes,beforeReplay,'Retry has no financial/customer writes');
 eq(runtime.db.prepare('SELECT COUNT(*) AS n FROM fire_job_numbers').get().n,1,'One job number was allocated');
 eq(runtime.db.prepare('SELECT COUNT(*) AS n FROM fire_job_estimate_links').get().n,1,'One estimate link was allocated');
 const secondResponse=await runtime.post({...quote,requestId:'55555555-5555-4555-8555-555555555555',customer:'Synthetic Second Customer',email:'second-job@example.invalid',phone:'9185550199',address:'200 Separate Synthetic St'});
 const second=await secondResponse.json();
 eq(secondResponse.status,201,'Second independent job saves');
 eq(second.jobNumber,2,'Second independent customer receives Job #0002');
 eq(runtime.db.prepare('SELECT COUNT(*) AS n FROM fire_job_numbers').get().n,2,'Two independent jobs each have permanent numbers');
 // If the owner deliberately has not enabled numbering, never invent a
 // serial in the quote receipt, even when other local mappings exist.
 runtime.env.FIRE_JOB_NUMBERS_CANDIDATE=undefined;
 const third=await (await runtime.post({...quote,requestId:'66666666-6666-4666-8666-666666666666',customer:'Synthetic Legacy Customer',email:'legacy-job@example.invalid',phone:'9185550188',address:'300 Legacy Synthetic St'})).json();
 eq('jobNumber' in third,false,'Disabled candidate never advertises an unverified reference');
}finally{runtime.db.close();}

