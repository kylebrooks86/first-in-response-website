/** Check actual authenticated task PATCH against disposable SQLite, no hosted D1. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync('app/api/tasks/route.ts','utf8');
const owner=source.match(/OWNER_EMAIL="([^"]+)"/)?.[1];
assert.ok(owner,'Owner guard preserved');
const db=new DatabaseSync(':memory:');
db.exec("CREATE TABLE tasks(id TEXT PRIMARY KEY,title TEXT,status TEXT NOT NULL,completed_at TEXT); INSERT INTO tasks VALUES ('synthetic-task','Synthetic task','open',NULL);");
const wrapper={prepare(sql){const stmt=db.prepare(sql);return {bind(...args){return {run:async()=>({meta:{changes:Number(stmt.run(...args).changes)}}),first:async()=>stmt.get(...args)??null};}};}};
let authorized=true;
const auth=async()=>authorized?{email:owner}:null;
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const ctx={exports:{},Response,Request,Date,Number,String,JSON,crypto:{randomUUID:()=> '10000000-0000-4000-8000-000000000001'},
 require(id){if(id==='cloudflare:workers')return {env:{DB:wrapper}};if(id==='../../chatgpt-auth')return {getChatGPTUser:auth};throw Error('Unexpected import '+id);}};
vm.runInNewContext(js,ctx);
const send=(data)=>new Request('https://synthetic.invalid/api/tasks',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
const parse=async response=>({status:response.status,data:await response.json()});
const patch=body=>ctx.exports.PATCH(send(body)).then(parse);
const id='synthetic-task';
const state=()=>db.prepare('SELECT status,completed_at AS completedAt FROM tasks WHERE id=?').get(id);
let tests=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);tests++;};
{
 const first=await patch({id,status:'completed',expectedStatus:'open'});
 eq(first.status,200,'Open task can be completed');
 eq(first.data.ok,true,'Completed response acknowledges write');
 eq(first.data.status,'completed','Server echoes saved status');
 eq(Boolean(state().completedAt),true,'Completion timestamp persisted');
 const timestamp=state().completedAt;
 const duplicate=await patch({id,status:'completed',expectedStatus:'open'});
 eq(duplicate.status,200,'Lost response replay resolves idempotently');
 eq(duplicate.data.completedAt,timestamp,'Replay does not reset original completion timestamp');
 eq(state().completedAt,timestamp,'Retry cannot rewrite completed_at');
 const conflict=await patch({id,status:'open',expectedStatus:'open'});
 eq(conflict.status,409,'Stale device cannot reopen task assuming earlier open state');
 eq(state().status,'completed','Stale request preserves latest server status');
 const reopen=await patch({id,status:'open',expectedStatus:'completed'});
 eq(reopen.status,200,'Latest confirmed state can be reopened');
 eq(state().status,'open','Reopen persists');
 eq(state().completedAt,null,'Reopen clears completion timestamp');
 const repeat=await patch({id,status:'open',expectedStatus:'completed'});
 eq(repeat.status,200,'Replayed reopen returns current target state');
 eq(state().completedAt,null,'Replayed reopen does not change timestamp');
}
for(const candidate of [{id,status:'invalid'},{id,status:undefined},{id,status:'open',expectedStatus:'invalid'},{id:'',status:'open'}]){
 const response=await patch(candidate);eq(response.status,400,'Invalid transition rejected');
}
eq(state().status,'open','Bad requests preserve saved status');
{
 const missing=await patch({id:'not-found',status:'completed',expectedStatus:'open'});
 eq(missing.status,404,'Missing task cannot be changed');
}
{
 const legacy=await patch({id,status:'completed'});
 eq(legacy.status,200,'Legacy client without expected status remains compatible');
 eq(state().status,'completed','Legacy explicit target persists');
}
// A redundant completion request must not overwrite the historical completion timestamp.
{
 const fixed='2025-01-02T03:04:05.000Z';
 db.prepare('UPDATE tasks SET completed_at=? WHERE id=?').run(fixed,id);
 const already=await patch({id,status:'completed',expectedStatus:'completed'});
 eq(already.status,200,'Already-completed compare-and-swap is safely acknowledged');
 eq(already.data.completedAt,fixed,'Already-completed request echoes original completion time');
 eq(state().completedAt,fixed,'Already-completed request does not rewrite completion time');
 const olderClient=await patch({id,status:'completed'});
 eq(olderClient.status,200,'Legacy repeated completion is idempotent');
 eq(olderClient.data.completedAt,fixed,'Legacy repetition returns original completion time');
 eq(state().completedAt,fixed,'Legacy repeated completion never resets timestamp');
}
for(const raw of ['null','[]','"completed"','42','{not valid','']){
 const before=state().completedAt;
 const malformed=new Request('https://synthetic.invalid/api/tasks',{method:'PATCH',headers:{'content-type':'application/json'},body:raw});
 const result=await parse(await ctx.exports.PATCH(malformed));
 eq(result.status,400,'Malformed or non-object PATCH JSON refused: '+JSON.stringify(raw));
 eq(state().completedAt,before,'Invalid PATCH payload never changes historical completion time');
}
authorized=false;
{
 const forbidden=await patch({id,status:'open',expectedStatus:'completed'});
 eq(forbidden.status,401,'Only authorized owner may modify task');
 eq(state().status,'completed','Unauthorized PATCH does not mutate');
}
db.close();
console.log('PASS '+tests+'/'+tests+': actual Task PATCH confirms status, safely handles retries, stale conflicts and unauthorized writes; SQLite in memory only.');
