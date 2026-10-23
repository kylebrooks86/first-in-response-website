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
db.exec("CREATE TABLE tasks(id TEXT PRIMARY KEY,title TEXT,status TEXT NOT NULL,completed_at TEXT,due_at TEXT,customer_id TEXT,estimate_id TEXT,notes TEXT); INSERT INTO tasks VALUES ('synthetic-task','Synthetic task','open',NULL,NULL,'synthetic-customer','synthetic-estimate','FIRE yard sign placement: 2026-10-22T10:00:00.000Z');");
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
const state=()=>db.prepare('SELECT status,completed_at AS completedAt,due_at AS dueAt FROM tasks WHERE id=?').get(id);
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
// Open tasks can be rescheduled without creating a new task or changing its
// customer, status, historic completion, or note markers. One latest saved date
// is the mandatory compare-and-swap precondition for changing it again.
{
 const change=(expectedDueAt,dueAt)=>patch({operation:'reschedule',id,expectedStatus:'open',expectedDueAt,dueAt});
 const firstDate='2026-10-29T15:30:00.000Z',secondDate='2026-11-02T18:00:00.000Z';
 const before=state().completedAt;
 const linkedBefore=db.prepare('SELECT customer_id,estimate_id,notes FROM tasks WHERE id=?').get(id);
 const first=await change(null,firstDate);
 eq(first.status,200,'Owner can set a missing task due date');
 eq(first.data.dueAt,firstDate,'Server confirms exact saved due timestamp');
 eq(state().dueAt,firstDate,'New deadline is stored');
 eq(state().completedAt,before,'Reschedule cannot modify completion history');
 const repeated=await change(null,firstDate);
 eq(repeated.status,200,'Lost-response reschedule replay returns saved date without rewriting');
 eq(repeated.data.replayed,true,'Repeated due-date request is identified as already applied');
 eq(state().dueAt,firstDate,'Duplicate has no second deadline change');
 const stale=await change(null,secondDate);
 eq(stale.status,409,'Stale device cannot overwrite newer date');
 eq(stale.data.currentDueAt,firstDate,'Conflict returns current owner-only date for review');
 eq(state().dueAt,firstDate,'Conflict preserves first saved date');
 const latest=await change(firstDate,secondDate);
 eq(latest.status,200,'Fresh owner view can reschedule using exact prior deadline');
 eq(state().dueAt,secondDate,'Latest confirmed deadline is stored');
 const cleared=await change(secondDate,null);
 eq(cleared.status,200,'Owner can clear task due date without deleting task');
 eq(state().dueAt,null,'Clear persists an explicit NULL');
 const clearAgain=await change(secondDate,null);
 eq(clearAgain.status,200,'Lost-response clear replay stays idempotent');
 eq(state().status,'open','Rescheduling never marks a task complete');
 eq(db.prepare('SELECT customer_id,estimate_id,notes FROM tasks WHERE id=?').get(id),linkedBefore,'Reschedule preserves customer, job and exact original yard-sign marker');
 for(const request of [
  {id,operation:'reschedule',expectedStatus:'open',dueAt:firstDate},
  {id,operation:'reschedule',expectedStatus:'open',expectedDueAt:null,dueAt:'2026-02-30T00:00:00.000Z'},
  {id,operation:'reschedule',expectedStatus:'open',expectedDueAt:null,dueAt:'tomorrow'},
  {id,operation:'reschedule',expectedStatus:'completed',expectedDueAt:null,dueAt:firstDate},
  {id,operation:'reschedule',expectedStatus:'open',expectedDueAt:'bad',dueAt:firstDate},
  {id,operation:'unknown',status:'completed'}
 ]){
  const invalid=await patch(request);eq(invalid.status,400,'Malformed/mismatched due-date update refused');
  eq(state().dueAt,null,'Invalid due-date input never mutates saved task');
 }
 const completed=await patch({id,status:'completed',expectedStatus:'open'});
 eq(completed.status,200,'Task completion remains functional');
 const forbidden=await change(null,firstDate);
 eq(forbidden.status,409,'Completed task cannot be rescheduled');
 eq(state().dueAt,null,'Completed task retains original deadline');
 eq(db.prepare('SELECT customer_id,estimate_id,notes FROM tasks WHERE id=?').get(id),linkedBefore,'Refused deadline update leaves linked context unchanged');
 const reopened=await patch({id,status:'open',expectedStatus:'completed'});
 eq(reopened.status,200,'Task can be reopened through existing explicit completion control');
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
 const beforeReschedule=state().dueAt;
 const forbiddenDate=await patch({id,operation:'reschedule',expectedStatus:'open',expectedDueAt:beforeReschedule,dueAt:'2026-11-30T12:00:00.000Z'});
 eq(forbiddenDate.status,401,'Unauthorized user cannot change task due date');
 eq(state().dueAt,beforeReschedule,'Unauthorized due-date request cannot modify saved row');
 const forbidden=await patch({id,status:'open',expectedStatus:'completed'});
 eq(forbidden.status,401,'Only authorized owner may modify task');
 eq(state().status,'completed','Unauthorized PATCH does not mutate');
}
db.close();
console.log('PASS '+tests+'/'+tests+': actual Task PATCH confirms status, safely handles retries, stale conflicts and unauthorized writes; SQLite in memory only.');
