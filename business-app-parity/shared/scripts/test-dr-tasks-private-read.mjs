/** Actual independent DR owner task-list route against disposable native SQLite. NO HOSTED OPERATIONS. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';

const routePath=process.argv[2];
assert.ok(routePath,'Pass fire-app-dr/app/api/tasks/route.ts from this PR checkout');
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
  if(!/^\\s*SELECT\\b/i.test(sql)){writes++;throw Error('DR task GET attempted a database write');}
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
const context={exports:{},Response,Array,JSON,Number,String,require(name){
  if(name==='cloudflare:workers')return {env:{DB:backing}};
  if(name==='../../owner-auth')return {getOwnerUser};
  throw Error('Unexpected DR route import: '+name);
}};
vm.runInNewContext(compiled,context);
assert.equal(typeof context.exports.GET,'function');

let assertions=0;
const eq=(actual,expected,label)=>{assert.equal(actual,expected,label);assertions++;};
const privateReceipt=(response,label)=>{
  eq(response.headers.get('cache-control'),'private, no-store',label+' private');
  eq(response.headers.get('vary'),'Cookie',label+' Cookie variation');
  eq(response.headers.get('x-content-type-options'),'nosniff',label+' nosniff');
};
try{
  for(const identity of ['missing','numeric','unreadable','foreign','throw']){
    principal=identity;
    const before=prepares;
    const response=await context.exports.GET();
    eq(response.status,401,identity+' fails closed');
    privateReceipt(response,identity);
    eq(prepares,before,identity+' denied before database');
    const body=await response.json();
    eq('tasks' in body,false,identity+' no owner task disclosure');
  }
  principal='owner';
  let response=await context.exports.GET();
  eq(response.status,200,'owner reads confirmed tasks');
  privateReceipt(response,'owner tasks');
  let body=await response.json();
  eq(body.tasks.length,4,'all synthetic tasks retained');
  eq(body.tasks.map(x=>x.id).join(','),'earlier,later,undated,completed','matches QA master chronological open-first task priority');
  eq(body.tasks[0].customer,'Synthetic customer','customer display name preserved');

  for(const failure of ['soft','missing','invalid','null','undefined','throw']){
    mode=failure;
    response=await context.exports.GET();
    eq(response.status,503,failure+' database failure never masquerades as empty tasks');
    privateReceipt(response,failure);
    body=await response.json();
    eq('tasks' in body,false,failure+' does not return incomplete list');
  }
  mode='';
  db.exec('DELETE FROM tasks');
  response=await context.exports.GET();
  eq(response.status,200,'genuinely empty confirmed ledger is valid');
  privateReceipt(response,'confirmed empty');
  body=await response.json();
  eq(body.tasks.length,0,'confirmed empty list');
  eq(writes,0,'GET made no task writes');
  eq(reads>0,true,'actual task SQL was read');
  console.log('PASS '+assertions+' DR owner task GET privacy, QA sorting and D1 read confirmation assertions (native SQLite, NO HOSTED OPERATIONS)');
}finally{db.close();}
