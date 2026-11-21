/** Actual independent DR owner task-list route against disposable native SQLite. NO HOSTED OPERATIONS. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const routePath=process.argv[2];
assert.ok(routePath,'Pass fire-app-dr/app/api/tasks/route.ts from this PR checkout');
// Use the DR production origin/stream guard, never a permissive test substitute.
const {readOwnerWriteObject}=await import(pathToFileURL(resolve(dirname(routePath),'../../../lib/customer-write-request-guard.mjs')).href);
const db=new DatabaseSync(':memory:');
db.exec([
  'CREATE TABLE customers(id TEXT PRIMARY KEY,name TEXT)',
  'CREATE TABLE tasks(id TEXT PRIMARY KEY,title TEXT,customer_id TEXT,estimate_id TEXT,due_at TEXT,status TEXT,notes TEXT,created_at TEXT,completed_at TEXT)'
].join(';')+';');
db.prepare('INSERT INTO customers(id,name) VALUES (?,?)').run('c1','Synthetic customer');
const add=(id,status,due,created)=>db.prepare('INSERT INTO tasks(id,title,customer_id,estimate_id,due_at,status,notes,created_at,completed_at) VALUES (?,?,?,?,?,?,?,?,?)')
  .run(id,id,'c1',null,due,status,'Synthetic task',created,status==='completed'?created:null);
add('undated','open',null,'2026-11-21T00:00:00Z');
add('later','open','2026-11-28T11:00:00Z','2026-11-21T01:00:00Z');
add('earlier','open','2026-11-22T11:00:00Z','2026-11-21T02:00:00Z');
add('completed','completed','2026-11-20T11:00:00Z','2026-11-21T03:00:00Z');

let principal='owner',mode='',prepares=0,reads=0,writes=0;
const backing={prepare(sql){
  prepares++;
  if(!sql.trimStart().toUpperCase().startsWith('SELECT ')){writes++;throw Error('DR task GET attempted a database write');}
  return {async all(){
    reads++;
    if(mode==='throw')throw Error('Synthetic D1 outage');
    if(mode==='soft')return {success:false,results:[]};
    if(mode==='missing')return {success:true};
    if(mode==='invalid')return {success:true,results:{}};
    if(mode==='null')return null;
    if(mode==='undefined')return undefined;
    return {success:true,results:db.prepare(sql).all()};
  }};
}};
const getOwnerUser=async()=>{
  if(principal==='throw')throw Error('Owner session unavailable');
  if(principal==='unreadable')return {get email(){throw Error('Unreadable owner email')}};
  if(principal==='missing')return null;
  if(principal==='numeric')return {email:101};
  if(principal==='foreign')return {email:'other@synthetic.invalid'};
  return {email:'kylebrooks8605@gmail.com'};
};
const compiled=ts.transpileModule(readFileSync(routePath,'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
const context={exports:{},Response,Headers,Array,JSON,Number,String,require(name){
  if(name==='cloudflare:workers')return {env:{DB:backing}};
  if(name==='../../owner-auth')return {getOwnerUser};
  if(name==='../../../lib/customer-write-request-guard.mjs')return {readOwnerWriteObject};
  throw Error('Unexpected DR route import: '+name);
}};
vm.runInNewContext(compiled,context);
assert.equal(typeof context.exports.GET,'function');
const qaPath=process.argv[3];
assert.ok(qaPath,'Pass the QA-master tasks route for source parity');
const qaCompiled=ts.transpileModule(readFileSync(qaPath,'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
const qaContext={exports:{},Response,Headers,Array,JSON,Number,String,require(name){
  if(name==='cloudflare:workers')return {env:{DB:backing}};
  if(name==='../../chatgpt-auth')return {getChatGPTUser:getOwnerUser};
  if(name==='../../../lib/customer-write-request-guard.mjs')return {readOwnerWriteObject:()=>{throw Error('GET cannot save tasks')}};
  throw Error('Unexpected QA route import: '+name);
}};
vm.runInNewContext(qaCompiled,qaContext);
assert.equal(typeof qaContext.exports.GET,'function');
const handlers=[{name:'independent DR',GET:context.exports.GET},{name:'QA master',GET:qaContext.exports.GET}];

let assertions=0;
const eq=(actual,expected,label)=>{assert.equal(actual,expected,label);assertions++;};
const privateReceipt=(response,label)=>{
  eq(response.headers.get('cache-control'),'private, no-store',label+' private');
  eq(response.headers.get('vary'),'Cookie',label+' Cookie variation');
  eq(response.headers.get('x-content-type-options'),'nosniff',label+' nosniff');
};
try{
 for(const target of handlers){
  const GET=target.GET;
  for(const identity of ['missing','numeric','unreadable','foreign','throw']){
    principal=identity;
    const before=prepares;
    const response=await GET();
    eq(response.status,401,identity+' fails closed');
    privateReceipt(response,identity);
    eq(prepares,before,identity+' denied before database');
    const body=await response.json();
    eq('tasks' in body,false,identity+' no owner task disclosure');
  }
  principal='owner';
  let response=await GET();
  eq(response.status,200,'owner reads confirmed tasks');
  privateReceipt(response,'owner tasks');
  let body=await response.json();
  eq(body.tasks.length,4,'all synthetic tasks retained');
  eq(body.tasks.map(x=>x.id).join(','),'earlier,later,undated,completed','matches QA master chronological open-first task priority');
  eq(body.tasks[0].customer,'Synthetic customer','customer display name preserved');

  for(const failure of ['soft','missing','invalid','null','undefined','throw']){
    mode=failure;
    response=await GET();
    eq(response.status,503,failure+' database failure never masquerades as empty tasks');
    privateReceipt(response,failure);
    body=await response.json();
    eq('tasks' in body,false,failure+' does not return incomplete list');
  }
  mode='';
  db.exec('DELETE FROM tasks');
  response=await GET();
  eq(response.status,200,'genuinely empty confirmed ledger is valid');
  privateReceipt(response,'confirmed empty');
  body=await response.json();
  eq(body.tasks.length,0,'confirmed empty list');
  eq(writes,0,'GET made no task writes');
  eq(reads>0,true,'actual task SQL was read');
  if(target.name==='independent DR'){
    add('undated','open',null,'2026-11-21T00:00:00Z');
    add('later','open','2026-11-28T11:00:00Z','2026-11-21T01:00:00Z');
    add('earlier','open','2026-11-22T11:00:00Z','2026-11-21T02:00:00Z');
    add('completed','completed','2026-11-20T11:00:00Z','2026-11-21T03:00:00Z');
  }
 }
  // Verify actual DR owner writes refuse unauthorized/forged requests before D1.
  // Use the production stream parser and exported POST/PATCH route functions.
  const dr=context.exports;
  eq(typeof dr.POST,'function','DR task create handler exists');
  eq(typeof dr.PATCH,'function','DR task update handler exists');
  const url='https://synthetic.invalid/api/tasks';
  const normalBody=JSON.stringify({requestId:'00000000-0000-4000-8000-000000000007',title:'Synthetic task'});
  const badRequests=[
   {name:'foreign Origin',expected:403,headers:{origin:'https://other.synthetic.invalid','content-type':'application/json'},body:normalBody},
   {name:'sibling same-site metadata',expected:403,headers:{'sec-fetch-site':'same-site','content-type':'application/json'},body:normalBody},
   {name:'cross-site metadata',expected:403,headers:{'sec-fetch-site':'cross-site','content-type':'application/json'},body:normalBody},
   {name:'browser form body',expected:415,headers:{origin:'https://synthetic.invalid','content-type':'text/plain'},body:normalBody},
   {name:'oversized declared body',expected:413,headers:{'content-type':'application/json','content-length':'64001'},body:normalBody},
   {name:'malformed JSON',expected:400,headers:{'content-type':'application/json'},body:'{'},
   {name:'array instead of object',expected:400,headers:{'content-type':'application/json'},body:'[]'},
   {name:'empty body',expected:400,headers:{'content-type':'application/json'},body:''},
  ];
  for(const method of ['POST','PATCH']){
   for(const identity of ['missing','foreign','throw']){
    principal=identity;
    const start=prepares;
    const response=await dr[method](new Request(url,{method,headers:{'content-type':'application/json'},body:normalBody}));
    eq(response.status,401,method+' denies '+identity+' owner identity');
    privateReceipt(response,method+' '+identity+' denial');
    eq(prepares,start,method+' '+identity+' never touches D1');
   }
   principal='owner';
   for(const bad of badRequests){
    const start=prepares;
    const response=await dr[method](new Request(url,{method,headers:bad.headers,body:bad.body}));
    eq(response.status,bad.expected,method+' refuses '+bad.name);
    privateReceipt(response,method+' '+bad.name);
    eq(prepares,start,method+' '+bad.name+' never touches D1');
   }
  }
  console.log('PASS '+assertions+' QA-master + DR task GET and real POST/PATCH denied-write assertions (native SQLite, NO HOSTED OPERATIONS)');
}finally{db.close();}
