/** DR dashboard: actual independent TypeScript route + native disposable SQLite. No hosted operations. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';

const routePath=process.argv[2];
assert.ok(routePath,'Supply the PR checkout independent DR dashboard route');
const source=readFileSync(routePath,'utf8');
const db=new DatabaseSync(':memory:');
db.exec([
  'CREATE TABLE customers(id TEXT PRIMARY KEY,name TEXT,email TEXT,phone TEXT,address TEXT)',
  'CREATE TABLE estimates(id TEXT PRIMARY KEY,customer_id TEXT,status TEXT,total_cents INTEGER,deposit_cents INTEGER,scheduled_at TEXT,share_token TEXT,first_viewed_at TEXT,accepted_at TEXT,signed_name TEXT,signed_at TEXT,contract_initials TEXT,photo_release TEXT,created_at TEXT)',
  'CREATE TABLE invoices(id TEXT PRIMARY KEY,estimate_id TEXT,customer_id TEXT,total_cents INTEGER,share_token TEXT)',
  'CREATE TABLE payments(id TEXT PRIMARY KEY,estimate_id TEXT,amount_cents INTEGER,status TEXT,type TEXT)',
  'CREATE TABLE estimate_items(id TEXT PRIMARY KEY,estimate_id TEXT,name TEXT,description TEXT)',
  'CREATE TABLE estimate_change_requests(id TEXT PRIMARY KEY,estimate_id TEXT,status TEXT,message TEXT,created_at TEXT)',
  'CREATE TABLE notifications(id TEXT PRIMARY KEY,estimate_id TEXT,type TEXT,resolved_at TEXT)',
  'CREATE TABLE payment_refunds(id TEXT PRIMARY KEY,estimate_id TEXT,status TEXT)'
].join(';')+';');
db.prepare('INSERT INTO customers(id,name) VALUES (?,?)').run('c1','Owner synthetic customer');
db.prepare('INSERT INTO customers(id,name) VALUES (?,?)').run('c2','Another synthetic customer');
db.prepare('INSERT INTO estimates(id,customer_id,status,total_cents,deposit_cents,created_at) VALUES (?,?,?,?,?,?)')
  .run('e1','c1','completed',10000,5000,'2026-11-21T10:00:00Z');
db.prepare('INSERT INTO payments(id,estimate_id,amount_cents,status,type) VALUES (?,?,?,?,?)')
  .run('p1','e1',2000,'paid','balance');
// Deliberately misowned invoice: it must not inflate c1 balance or expose c2 token.
db.prepare('INSERT INTO invoices(id,estimate_id,customer_id,total_cents,share_token) VALUES (?,?,?,?,?)')
  .run('foreign','e1','c2',99000,'DO-NOT-LEAK-FOREIGN');
let principal='owner',batchReads=0,soft='',writes=0;
const backing={
  prepare(sql){return {sql};},
  async batch(statements){
    batchReads++;
    if(soft==='throw')throw Error('Injected D1 outage');
    if(soft==='nonarray')return undefined;
    if(soft==='soft')return [{success:false,results:[]},{success:true,results:[]}];
    if(soft==='missing')return [{success:true},{success:true,results:[]}];
    const results=statements.map(s=>({success:true,results:db.prepare(s.sql).all()}));
    if(soft==='emptySummary')results[0].results=[];
    if(soft==='badTotal')results[0].results[0].outstanding=-1;
    if(soft==='badRecent'&&results[1].results[0])results[1].results[0].totalCents='broken';
    return results;
  }
};
const getOwnerUser=async()=>{
  if(principal==='throw')throw Error('Synthetic session failure');
  if(principal==='missing')return null;
  if(principal==='numeric')return {email:42};
  if(principal==='unreadable')return {get email(){throw Error('Unreadable session');}};
  if(principal==='foreign')return {email:'other@synthetic.invalid'};
  return {email:'kylebrooks8605@gmail.com'};
};
const cjs=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const scope={exports:{},Response,Number,String,Array,JSON,console,
  require(name){
    if(name==='cloudflare:workers')return {env:{DB:backing}};
    if(name==='../../owner-auth')return {getOwnerUser};
    throw Error('Unexpected DR route import '+name);
  }};
vm.runInNewContext(cjs,scope);
assert.equal(typeof scope.exports.GET,'function');
let checks=0;
const eq=(actual,expected,what)=>{assert.equal(actual,expected,what);checks++;};
const priv=(r,label)=>{
  eq(r.headers.get('cache-control'),'private, no-store',label+' private no-store');
  eq(r.headers.get('vary'),'Cookie',label+' session variance');
  eq(r.headers.get('x-content-type-options'),'nosniff',label+' content protection');
};
try{
  for(const mode of ['missing','numeric','unreadable','foreign','throw']){
    principal=mode;
    const before=batchReads;
    const r=await scope.exports.GET();
    eq(r.status,401,mode+' denied');
    priv(r,mode);
    eq(batchReads,before,mode+' zero DB reads');
  }
  principal='owner';
  let r=await scope.exports.GET();
  eq(r.status,200,'owner can read DR dashboard');priv(r,'owner');
  let body=await r.json();
  eq(body.estimates,1,'one estimate');
  eq(body.outstanding,8000,'foreign invoice does not inflate outstanding');
  eq(body.recent[0].invoiceId,null,'cross-customer invoice hidden');
  eq(body.recent[0].invoiceShareToken,null,'cross-customer share token hidden');
  eq(body.recent[0].invoiceTotalCents,null,'cross-customer invoice total hidden');
  // Legitimate matching owner invoice must continue to render.
  db.prepare("DELETE FROM invoices WHERE id='foreign'").run();
  db.prepare('INSERT INTO invoices(id,estimate_id,customer_id,total_cents,share_token) VALUES (?,?,?,?,?)')
    .run('owned','e1','c1',7000,'SAFE-OWNER-TEST-TOKEN');
  r=await scope.exports.GET();body=await r.json();eq(r.status,200,'valid invoice GET');
  eq(body.outstanding,5000,'matching invoice controls due amount');
  eq(body.recent[0].invoiceId,'owned','owned invoice visible');
  eq(body.recent[0].invoiceShareToken,'SAFE-OWNER-TEST-TOKEN','owned share token visible');
  // Genuinely empty database is different from a non-confirmed empty result.
  db.prepare('DELETE FROM payments').run();
  db.prepare('DELETE FROM invoices').run();
  db.prepare('DELETE FROM estimates').run();
  r=await scope.exports.GET();body=await r.json();
  eq(r.status,200,'genuinely empty DR summary allowed');priv(r,'real empty');
  eq(body.estimates,0,'confirmed empty estimate count');
  eq(body.outstanding,0,'confirmed empty outstanding');
  eq(body.recent.length,0,'confirmed empty recent');
  for(const failure of ['throw','nonarray','soft','missing','emptySummary']){
    soft=failure;
    const uncertain=await scope.exports.GET();
    eq(uncertain.status,503,failure+' fail closed rather than false zero');
    priv(uncertain,failure);
    eq((await uncertain.json()).error.includes('could not be verified'),true,failure+' explicit error');
  }
  soft='';
  db.prepare('INSERT INTO estimates(id,customer_id,status,total_cents,deposit_cents,created_at) VALUES (?,?,?,?,?,?)')
    .run('e1','c1','completed',10000,5000,'2026-11-21T10:00:00Z');
  for(const failure of ['badTotal','badRecent']){
    soft=failure;
    const unsafe=await scope.exports.GET();
    eq(unsafe.status,409,failure+' unsafe money refused');
    priv(unsafe,failure);
  }
  eq(writes,0,'dashboard never writes a D1 financial row');
  console.log('PASS '+checks+' independent DR dashboard authorization, customer invoice isolation, confirmed D1 reads and private billing receipts (native SQLite, NO HOSTED OPERATIONS)');
}finally{db.close();}
