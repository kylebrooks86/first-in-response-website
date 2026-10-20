/** Real SQLite backing the actual Cloudflare task/expense route handlers. No network or hosted D1. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

const database=new DatabaseSync(':memory:');
database.exec(`
 PRAGMA foreign_keys=ON;
 CREATE TABLE customers(id TEXT PRIMARY KEY,name TEXT NOT NULL);
 CREATE TABLE estimates(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id));
 CREATE TABLE tasks(id TEXT PRIMARY KEY,title TEXT NOT NULL,customer_id TEXT,estimate_id TEXT,due_at TEXT,status TEXT NOT NULL,notes TEXT,created_at TEXT,completed_at TEXT);
 CREATE TABLE expenses(id TEXT PRIMARY KEY,estimate_id TEXT,category TEXT NOT NULL,description TEXT NOT NULL,amount_cents INTEGER NOT NULL,incurred_at TEXT NOT NULL,created_at TEXT NOT NULL);
 INSERT INTO customers(id,name) VALUES ('synthetic-customer','Synthetic owner fixture');
 INSERT INTO estimates(id,customer_id) VALUES ('synthetic-estimate','synthetic-customer');
`);
const db={prepare(sql){const stmt=database.prepare(sql);return {bind(...params){return {
 first:async()=>stmt.get(...params)||null,
 all:async()=>({results:stmt.all(...params)}),
 run:async()=>({meta:{changes:Number(stmt.run(...params).changes)}})
};}};}};
const routeEmail=readFileSync('app/api/tasks/route.ts','utf8').match(/OWNER_EMAIL="([^"]+)"/)?.[1];
assert.ok(routeEmail,'Existing owner authentication rule present');
let authorized=true,calls=0;
const getChatGPTUser=async()=>{calls++;return authorized?{email:routeEmail}:null;};
function route(file){
 const content=readFileSync(file,'utf8');
 const js=ts.transpileModule(content,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const ctx={exports:{},Response,Request,URL,Date,Number,String,JSON,crypto:{randomUUID},
 require:(id)=>{
  if(id==='cloudflare:workers')return {env:{DB:db}};
  if(id==='../../chatgpt-auth')return {getChatGPTUser};
  throw Error('Unexpected module '+id);
 }};
 vm.runInNewContext(js,ctx);
 return ctx.exports;
}
const tasks=route('app/api/tasks/route.ts'),expenses=route('app/api/expenses/route.ts');
const body=(data)=>new Request('https://synthetic.fire.invalid/api/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
const read=async(response)=>({status:response.status,value:await response.json()});
const count=table=>Number(database.prepare('SELECT COUNT(*) AS n FROM '+table).get().n);
const taskId='10000000-0000-4000-8000-000000000001',expenseId='10000000-0000-4000-8000-000000000002';
let assertions=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);assertions++;};
for(const [kind,handler,id,payload,table] of [
 ['task',tasks.POST,taskId,{title:'Synthetic house wash reminder',customerId:'synthetic-customer',notes:'Check cleaning estimate',dueAt:'2026-10-22T10:00:00.000Z'},'tasks'],
 ['expense',expenses.POST,expenseId,{description:'Synthetic chemical purchase',category:'Chemicals',amountCents:1525,estimateId:'synthetic-estimate',incurredAt:'2026-10-20T11:00:00.000Z'},'expenses']
]){
 const input={...payload,requestId:id};
 const original=await read(await handler(body(input)));
 eq(original.status,201,kind+' first insert is created');
 eq(original.value.confirmed,true,kind+' first response confirms persisted record');
 eq(original.value.requestId,id,kind+' returns the operation ID');
 eq(original.value[kind].id,id,kind+' uses the operation ID as immutable primary key');
 eq(count(table),1,kind+' first request writes one record');
 const replay=await read(await handler(body(input)));
 eq(replay.status,200,kind+' lost-response replay returns previous record');
 eq(replay.value.requestId,id,kind+' replay preserves original ID');
 eq(replay.value[kind].createdAt,original.value[kind].createdAt,kind+' replay preserves original timestamp');
 eq(count(table),1,kind+' replay does not duplicate');
 const changed=await read(await handler(body({...input,...(kind==='task'?{title:'Changed title'}:{amountCents:999})})));
 eq(changed.status,409,kind+' conflicting payload rejected');
 eq(count(table),1,kind+' conflict never creates record');
 const malformed=await read(await handler(body({...input,requestId:'not-uuid'})));
 eq(malformed.status,400,kind+' invalid operation ID rejected');
 eq(count(table),1,kind+' malformed request never mutates');
 const absent=await read(await handler(body({...payload,requestId:null})));
 eq(absent.status,400,kind+' explicit null operation ID is rejected');
 const legacy=await read(await handler(body({...payload,...(kind==='task'?{title:'Legacy task'}:{description:'Legacy expense'})})));
 eq(legacy.status,201,kind+' old clients without requestId still create a record');
 eq(Boolean(legacy.value[kind].id),true,kind+' legacy request generates a record ID');
 eq(count(table),2,kind+' legacy record is added exactly once');
 if(kind==='task'){
  const mismatch=await read(await handler(body({...input,customerId:'unknown-customer'})));
  eq(mismatch.status,404,'Task retries still enforce customer authorization and linkage');
 }else{
  for(const amount of [1.5,'3.75','',-1,'Infinity',null]){
   const result=await read(await handler(body({...input,requestId:randomUUID(),amountCents:amount})));
   eq(result.status,400,'Expense rejects invalid or fractional cents '+String(amount));
  }
 }
}
const prevTasks=count('tasks'),prevExpenses=count('expenses');
authorized=false;
eq((await read(await tasks.POST(body({title:'Unauthorized',requestId:randomUUID()})))).status,401,'Tasks require real owner session');
eq((await read(await expenses.POST(body({description:'Unauthorized',amountCents:100,requestId:randomUUID()})))).status,401,'Expenses require real owner session');
eq(count('tasks'),prevTasks,'Unauthorized request leaves tasks unchanged');
eq(count('expenses'),prevExpenses,'Unauthorized request leaves expenses unchanged');
database.close();
console.log('PASS '+assertions+'/'+assertions+': actual task/expense route SQL replay and conflicts, legacy compatibility, owner isolation, whole-cent validation. Disposable SQLite only.');
