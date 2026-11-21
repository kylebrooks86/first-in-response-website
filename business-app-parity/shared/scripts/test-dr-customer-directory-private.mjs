/** Independent DR owner customer directory: actual TS handler, real SQL, disposable SQLite. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const routePath=process.argv[2];
assert.ok(routePath,'Pass independent DR customers/route.ts from the PR checkout');
// Import the actual DR owner streaming/origin guard, never a permissive test stub.
const {readOwnerWriteObject}=await import(pathToFileURL(resolve(dirname(routePath),'../../../lib/customer-write-request-guard.mjs')).href);
const db=new DatabaseSync(':memory:');
db.exec([
  'CREATE TABLE customers(id TEXT PRIMARY KEY,name TEXT,email TEXT,phone TEXT,address TEXT,lead_source TEXT,created_at TEXT)',
  'CREATE TABLE estimates(id TEXT PRIMARY KEY,customer_id TEXT,status TEXT,subtotal_cents INTEGER,discount_cents INTEGER,total_cents INTEGER,deposit_cents INTEGER,scheduled_at TEXT,share_token TEXT,first_viewed_at TEXT,accepted_at TEXT,signed_name TEXT,signed_at TEXT,contract_initials TEXT,photo_release TEXT,created_at TEXT)',
  'CREATE TABLE customer_notes(id TEXT PRIMARY KEY,customer_id TEXT,body TEXT,created_at TEXT)',
  'CREATE TABLE invoices(id TEXT PRIMARY KEY,estimate_id TEXT,customer_id TEXT,status TEXT,total_cents INTEGER,due_at TEXT,share_token TEXT,first_viewed_at TEXT,created_at TEXT)',
  'CREATE TABLE customer_photos(id TEXT PRIMARY KEY,customer_id TEXT,category TEXT,caption TEXT,filename TEXT,content_type TEXT,size_bytes INTEGER,created_at TEXT)',
  'CREATE TABLE customer_messages(id TEXT PRIMARY KEY,customer_id TEXT,estimate_id TEXT,channel TEXT,template TEXT,body TEXT,created_at TEXT)',
  'CREATE TABLE payments(id TEXT PRIMARY KEY,estimate_id TEXT,type TEXT,amount_cents INTEGER,processing_fee_cents INTEGER,gross_received_cents INTEGER,bundled_tip_cents INTEGER,processing_method TEXT,status TEXT,provider_id TEXT,created_at TEXT)',
  'CREATE TABLE estimate_items(id TEXT PRIMARY KEY,estimate_id TEXT,name TEXT,description TEXT,quantity INTEGER,unit TEXT,total_cents INTEGER)',
  'CREATE TABLE estimate_change_requests(id TEXT PRIMARY KEY,estimate_id TEXT,status TEXT,message TEXT,created_at TEXT)',
  'CREATE TABLE notifications(id TEXT PRIMARY KEY,estimate_id TEXT,type TEXT,resolved_at TEXT)',
  'CREATE TABLE payment_refunds(id TEXT PRIMARY KEY,estimate_id TEXT,payment_id TEXT,status TEXT,amount_cents INTEGER)'
].join(';')+';');
db.prepare('INSERT INTO customers(id,name,created_at) VALUES (?,?,?)')
  .run('c1','Synthetic homeowner one','2026-11-21T01:00:00Z');
db.prepare('INSERT INTO customers(id,name,created_at) VALUES (?,?,?)')
  .run('c2','Synthetic unrelated homeowner','2026-11-21T01:00:00Z');
db.prepare('INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at) VALUES (?,?,?,?,?,?,?,?)')
  .run('e1','c1','completed',10000,0,10000,5000,'2026-11-21T02:00:00Z');
db.prepare('INSERT INTO invoices(id,estimate_id,customer_id,status,total_cents,share_token,created_at) VALUES (?,?,?,?,?,?,?)')
  .run('i1','e1','c1','sent',10000,'SYNTHETIC-OWNER-ONLY','2026-11-21T03:00:00Z');
db.prepare('INSERT INTO estimate_items(id,estimate_id,name,description,quantity,unit,total_cents) VALUES (?,?,?,?,?,?,?)')
  .run('line1','e1','Synthetic house wash','Local-only sample',1,'job',10000);
let principal='owner',mode='',readBatches=0,prepares=0,writes=0,seenQueries=[];
const backing={async batch(statements){
  readBatches++;
  if(mode==='throw')throw Error('Synthetic D1 outage');
  if(mode==='nonarray')return undefined;
  if(mode==='short')return [{results:[]}];
  if(mode==='soft')return statements.map((_,i)=>({success:i!==3,results:[]}));
  if(mode==='missing')return statements.map((_,i)=>i===3?{success:true}:{success:true,results:[]});
  const data=statements.map(({sql})=>{
    seenQueries.push(sql);
    return {success:true,results:db.prepare(sql).all()};
  });
  return data;
},prepare(sql){prepares++;return {sql,bind(){writes++;throw Error('GET must not bind or write');}};}};
const getOwnerUser=async()=>{
  if(principal==='throw')throw Error('Broken owner session');
  if(principal==='missing')return null;
  if(principal==='numeric')return {email:12};
  if(principal==='unreadable')return {get email(){throw Error('Unreadable email');}};
  if(principal==='other')return {email:'other@synthetic.invalid'};
  return {email:'kylebrooks8605@gmail.com'};
};
const code=ts.transpileModule(readFileSync(routePath,'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
const scope={exports:{},Response,Headers,Number,Array,String,JSON,Map,crypto:globalThis.crypto,Date,
  require(name){
    if(name==='cloudflare:workers')return {env:{DB:backing}};
    if(name==='../../owner-auth')return {getOwnerUser};
    if(name==='../../../lib/customer-write-request-guard.mjs')return {readOwnerWriteObject};
    throw Error('Unexpected DR route import '+name);
  }};
vm.runInNewContext(code,scope);
assert.equal(typeof scope.exports.GET,'function');
let checks=0;
const eq=(actual,expected,label)=>{assert.equal(actual,expected,label);checks++;};
const privateHeaders=(r,label)=>{
  eq(r.headers.get('cache-control'),'private, no-store',label+' private');
  eq(r.headers.get('vary'),'Cookie',label+' session variance');
  eq(r.headers.get('x-content-type-options'),'nosniff',label+' nosniff');
};
try{
  for(const p of ['missing','numeric','unreadable','other','throw']){
    principal=p;
    const prior=readBatches;
    const denied=await scope.exports.GET();
    eq(denied.status,401,p+' no access to customer list');privateHeaders(denied,p);
    eq(readBatches,prior,p+' no customer database reads');
  }
  principal='owner';
  let r=await scope.exports.GET();
  eq(r.status,200,'actual DR owner directory available');privateHeaders(r,'normal owner');
  let data=await r.json();
  eq(data.customers.length,2,'both synthetic owner customers listed');
  eq(data.estimates[0].invoiceId,'i1','correct linked invoice retained');
  eq(data.estimates[0].invoiceShareToken,'SYNTHETIC-OWNER-ONLY','correct owner invoice token retained');
  eq(data.invoices[0].customerId,'c1','matching owner invoice customer');
  eq('invoiceOwnershipMismatch' in data.invoices[0],false,'internal verification flag not exposed');
  eq(data.estimates[0].items.length,1,'saved service line still grouped into estimate');
  for(const failed of ['throw','nonarray','short','soft','missing']){
    mode=failed;
    const unavailable=await scope.exports.GET();
    eq(unavailable.status,503,failed+' refuses false-empty directory and billing');
    privateHeaders(unavailable,failed);
    const failure=await unavailable.json();
    eq('customers' in failure,false,failed+' never exposes an incomplete directory');
  }
  mode='';
  db.prepare("UPDATE invoices SET customer_id='c2',share_token='DO-NOT-LEAK-FOREIGN' WHERE id='i1'").run();
  r=await scope.exports.GET();
  eq(r.status,409,'mismatched customer invoice blocks all private directory rows');
  privateHeaders(r,'foreign invoice');
  const blocked=await r.text();
  eq(blocked.includes('DO-NOT-LEAK-FOREIGN'),false,'foreign invoice token never leaks');
  db.prepare("UPDATE invoices SET customer_id='c1',share_token='SYNTHETIC-OWNER-ONLY' WHERE id='i1'").run();
  db.prepare("UPDATE estimates SET total_cents=-4 WHERE id='e1'").run();
  r=await scope.exports.GET();
  eq(r.status,409,'invalid negative customer financial total fails closed');
  privateHeaders(r,'invalid cents');
  db.prepare("UPDATE estimates SET total_cents=10000 WHERE id='e1'").run();
  for(const table of ['estimate_items','invoices','estimates','customers'])db.exec('DELETE FROM '+table);
  r=await scope.exports.GET();data=await r.json();
  eq(r.status,200,'verified truly empty directory is allowed');
  privateHeaders(r,'real empty directory');
  eq(data.customers.length,0,'genuinely empty list');
  eq(data.invoices.length,0,'genuinely empty invoice list');
  eq(data.estimates.length,0,'genuinely empty estimates list');
  eq(writes,0,'GET never prepares D1 mutations');
  assert.equal(seenQueries.every(sql=>sql.trim().startsWith('SELECT')),true,'all directory statements remain read-only');
  checks++;
  // Invoke the REAL independent DR POST handler, not a source-string guess.
  // Every rejected request must be session-private and touch ZERO D1 statements.
  const POST=scope.exports.POST;
  eq(typeof POST,'function','independent DR owner customer POST exists');
  const url='https://synthetic.invalid/api/customers';
  const normalBody=JSON.stringify({name:'Synthetic new homeowner'});
  for(const identity of ['missing','numeric','unreadable','other','throw']){
    principal=identity;
    const before=prepares;
    const denied=await POST(new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:normalBody}));
    eq(denied.status,401,identity+' cannot create a customer');
    privateHeaders(denied,identity+' customer POST');
    eq(prepares,before,identity+' cannot prepare customer D1 write');
  }
  principal='owner';
  const rejected=[
    {name:'foreign Origin',status:403,headers:{origin:'https://evil.synthetic.invalid','content-type':'application/json'},body:normalBody},
    {name:'same-site sibling metadata',status:403,headers:{'sec-fetch-site':'same-site','content-type':'application/json'},body:normalBody},
    {name:'cross-site metadata',status:403,headers:{'sec-fetch-site':'cross-site','content-type':'application/json'},body:normalBody},
    {name:'browser form encoding',status:415,headers:{origin:'https://synthetic.invalid','content-type':'text/plain'},body:normalBody},
    {name:'excessive declared bytes',status:413,headers:{'content-type':'application/json','content-length':'64001'},body:normalBody},
    {name:'malformed JSON',status:400,headers:{'content-type':'application/json'},body:'{'},
    {name:'array JSON',status:400,headers:{'content-type':'application/json'},body:'[]'},
    {name:'empty JSON',status:400,headers:{'content-type':'application/json'},body:''}
  ];
  for(const scenario of rejected){
    const before=prepares;
    const denied=await POST(new Request(url,{method:'POST',headers:scenario.headers,body:scenario.body}));
    eq(denied.status,scenario.status,'owner customer POST rejects '+scenario.name);
    privateHeaders(denied,scenario.name);
    eq(prepares,before,scenario.name+' cannot prepare a customer D1 mutation');
  }
  console.log('PASS '+checks+' independent DR customer directory GET and guarded owner POST real-route/privacy/D1 assertions (native SQLite, NO HOSTED OPERATIONS)');
}finally{db.close();}
