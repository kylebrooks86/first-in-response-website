/** FIRE owner task POST: real route, disposable SQLite; no hosted records/messages. */
import assert from 'node:assert/strict';
import {stackedRuntime} from './stacked-discount-test-runtime.mjs';

const rt=stackedRuntime(),db=rt.db,api=rt.load('app/api/tasks/route.ts');
const at='2026-11-12T12:00:00.000Z',customer='task-owner-a',other='task-owner-b';
for(const id of [customer,other])
 db.prepare('INSERT INTO customers(id,name,created_at) VALUES (?,?,?)').run(id,'Synthetic '+id,at);
db.prepare('INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES (?,?,?,?,?,?,?)')
 .run('task-job',customer,'scheduled',10000,10000,5000,at);
const key=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
const body=(i,more={})=>({
 requestId:key(i),title:'Return owner call',customerId:customer,estimateId:'task-job',
 notes:'Follow up on estimate after shift',dueAt:'2026-11-14T15:00:00.000Z',...more
});
async function post(value){
 const r=await api.POST(new Request('https://synthetic.invalid/api/tasks',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)
 }));
 return {status:r.status,data:await r.json(),headers:r.headers};
}
const row=id=>db.prepare('SELECT id,title,customer_id AS customerId,estimate_id AS estimateId,created_at AS createdAt FROM tasks WHERE id=?').get(id);
const count=()=>db.prepare('SELECT count(*) AS n FROM tasks').get().n;
const original=rt.env.DB.prepare;
let intercept=null,checks=0;
function check(ok,msg){assert.ok(ok,msg);checks++;console.log('PASS '+msg);}
rt.env.DB.prepare=function(sql){
 const stmt=original(sql);
 if(sql.trimStart().startsWith('INSERT OR IGNORE INTO tasks')&&intercept){
  return {...stmt,bind(...args){
   const bound=stmt.bind(...args);
   return {...bound,async run(){
    const mode=intercept;intercept=null;
    if(mode==='reassign')db.prepare("UPDATE estimates SET customer_id=? WHERE id='task-job'").run(other);
    if(mode==='zero')return {success:true,meta:{changes:0}};
    if(mode==='commit-lost'){await bound.run();throw Error('Synthetic D1 ACK lost after commit');}
    return bound.run();
   }};
  }};
 }
 return stmt;
};
try{
 const first=await post(body(1));
 check(first.status===201&&first.data.confirmed===true,'First linked owner task saved with exact D1 receipt');
 check(first.data.task?.customerId===customer&&first.data.task?.estimateId==='task-job','Task receipt keeps original customer and job together');
 check(first.headers.get('cache-control')==='no-store, private','Private customer/task creation receipt is not cached');
 const originalCreated=row(key(1)).createdAt;
 const replay=await post(body(1));
 check(replay.status===200&&replay.data.confirmed===true&&count()===1,'Lost HTTP response replay cannot duplicate task');
 check(row(key(1)).createdAt===originalCreated,'Task replay preserves first saved timestamp');
 check((await post(body(1,{title:'Changed title'}))).status===409,'Reused immutable ID cannot overwrite task title');
 check((await post(body(2,{customerId:other}))).status===409,'Initial job/customer mismatch rejected');
 check(count()===1,'Preflight mismatch causes no task creation');

 // Another phone reassigns the job AFTER the app checked ownership. The actual
 // conditional SQL INSERT must refuse the now-wrong customer.
 intercept='reassign';
 const moved=await post(body(2));
 check(moved.status===409,'Concurrent job reassignment blocks task at SQL write boundary');
 check(intercept===null&&row(key(2))===undefined,'Reassigned job creates no cross-customer task');
 check(count()===1,'Existing original task unaffected by rejected operation');
 db.prepare("UPDATE estimates SET customer_id=? WHERE id='task-job'").run(customer);
 check((await post(body(2))).status===201,'Same request can safely create task after correcting owner relationship');
 check(row(key(2)).customerId===customer&&count()===2,'Recovered owner task linked to correct customer exactly once');

 // Even a signed success response cannot invent a task if SQLite did not
 // actually write a row. Confirmed responses need independent readback.
 intercept='zero';
 const silentlyMissing=await post(body(3));
 check(silentlyMissing.status===503&&silentlyMissing.data.saveUncertain===true,
  'Silent zero-row D1 acknowledgement yields unconfirmed save');
 check(!row(key(3)),'Silent zero-row response creates no fictitious task');

 intercept='commit-lost';
 const lostAck=await post(body(4));
 check(lostAck.status===200&&lostAck.data.confirmed===true,
  'Post-commit D1 ACK loss recovers original immutable task row');
 check(row(key(4)).id===key(4)&&count()===3,
  'Acknowledgement loss results in exactly one task');
 check((await post(body(4))).status===200&&count()===3,
  'Later HTTP replay cannot create an additional task after lost D1 ACK');

 // Pre-existing task can no longer be represented as safely linked after
 // external customer reassignment. Refuse false success, preserve history.
 db.prepare("UPDATE estimates SET customer_id=? WHERE id='task-job'").run(other);
 const stale=await post(body(1));
 check(stale.status===409&&typeof stale.data.error==='string'&&!stale.data.confirmed,
  'Stale task replay cannot claim correct ownership after external reassignment');
 check(count()===3,'Stale replay cannot move or erase historical tasks');
 db.prepare("UPDATE estimates SET customer_id=? WHERE id='task-job'").run(customer);
 const newCustomer=await post(body(5,{estimateId:null}));
 check(newCustomer.status===201&&newCustomer.data.task.customerId===customer,'Customer-only task still works without a linked job');
 const standalone=await post(body(6,{estimateId:null,customerId:null}));
 check(standalone.status===201&&standalone.data.task.estimateId===null,'General owner task with no linked customer remains supported');

 rt.setOwner(null);
 const before=count();
 check((await post(body(7))).status===401,'Unauthenticated task create rejected');
 check(count()===before,'No database writes on unauthorized task request');
 console.log('PASS '+checks+'/'+checks+' FIRE task POST: owner binding race, lost ACK, idempotency, genuine receipt, unrelated tasks (local SQLite only)');
}finally{rt.env.DB.prepare=original;db.close();}
