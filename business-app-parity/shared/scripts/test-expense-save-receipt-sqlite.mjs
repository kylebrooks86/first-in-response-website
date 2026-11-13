/** Real FIRE expense POST route with native disposable SQLite. No LIVE D1, Stripe,
 * customer identities, external requests or uploaded files. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createRouteFixtureLoader} from './route-test-loader.mjs';

const sql=new DatabaseSync(':memory:');
sql.exec(`
 CREATE TABLE estimates (id TEXT PRIMARY KEY,customer_id TEXT);
 CREATE TABLE expenses (
  id TEXT PRIMARY KEY,estimate_id TEXT,category TEXT NOT NULL,description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,incurred_at TEXT NOT NULL,created_at TEXT NOT NULL
 );
 INSERT INTO estimates VALUES ('job-synthetic','owner-synthetic');
`);
let user={email:'kylebrooks8605@gmail.com'},writes=0,reads=0;
let throwAfterCommit=false,skipWrite=false,throwReadback=false;
const prepare=query=>({
 values:[],
 bind(...values){this.values=values;return this;},
 async first(){
   reads++;
   if(throwReadback&&query.includes('FROM expenses WHERE id=?')){
     throwReadback=false;throw Error('synthetic readback outage');
   }
   return sql.prepare(query).get(...this.values)??null;
 },
 async run(){
   assert.match(query,/^INSERT OR IGNORE INTO expenses/,'Only expense inserts can mutate this fixture');
   writes++;
   if(skipWrite){skipWrite=false;return {success:true,meta:{changes:0}};}
   const result=sql.prepare(query).run(...this.values);
   if(throwAfterCommit){throwAfterCommit=false;throw Error('synthetic lost commit ACK');}
   return {success:true,meta:{changes:Number(result.changes)}};
 },
 async all(){return {results:sql.prepare(query).all(...this.values)};}
});
const {POST}=createRouteFixtureLoader(process.cwd(),{DB:{prepare}},()=>user)('app/api/expenses/route.ts');
const id=(suffix)=>`bb3b4eab-8ccb-4cee-8e6e-${suffix.toString(16).padStart(12,'0')}`;
const base=(i,extra={})=>({
 requestId:id(i),category:'Supplies',description:'Real synthetic soap, no purchase date',
 amountCents:1759,estimateId:'job-synthetic',...extra
});
const call=body=>POST(new Request('https://synthetic.invalid/api/expenses',{
 method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)
}));
const stored=id=>sql.prepare('SELECT * FROM expenses WHERE id=?').get(id)??null;
const count=()=>sql.prepare('SELECT COUNT(*) n FROM expenses').get().n;
let tests=0;const check=(condition,label)=>{assert.ok(condition,label);tests++;console.log('PASS '+label);};
try{
 user=null;
 const noAuthWrites=writes;
 check((await call(base(1))).status===401,'Anonymous expense POST rejected before D1');
 check(writes===noAuthWrites,'No financial record written by anonymous request');
 user={email:'stranger@example.invalid'};
 check((await call(base(1))).status===401,'Nonowner expense POST denied');
 user={email:'kylebrooks8605@gmail.com'};

 const firstRequest=base(1);
 let response=await call(firstRequest);
 check(response.status===201,'Undated expense saved once with server-generated timestamp');
 let receipt=await response.json();
 check(receipt.confirmed===true&&receipt.requestId===firstRequest.requestId&&receipt.expense.id===firstRequest.requestId,'First save returns exact immutable record identity');
 check(response.headers.get('cache-control')==='private, no-store','Financial record save receipt not cached');
 const firstDate=receipt.expense.incurredAt,firstCreated=receipt.expense.createdAt;
 check(Number.isFinite(Date.parse(firstDate))&&Number.isFinite(Date.parse(firstCreated)),'Server-created expense timestamps are valid');

 // The caller may retry the same ID after reconnecting on another shift.
 await new Promise(resolve=>setTimeout(resolve,20));
 response=await call(firstRequest);
 receipt=await response.json();
 check(response.status===200&&receipt.confirmed===true,'Undated same-ID replay is confirmed, not a false 409 conflict');
 check(receipt.expense.incurredAt===firstDate&&receipt.expense.createdAt===firstCreated&&count()===1,'Replay never changes the original purchase time or adds a second expense');
 check(stored(firstRequest.requestId).incurred_at===firstDate,'Original database purchase timestamp remains unchanged');

 response=await call({...firstRequest,amountCents:1760});
 check(response.status===409&&count()===1,'Changed financial amount with reused ID is a conflict, never an overwrite');
 response=await call({...firstRequest,description:'different description'});
 check(response.status===409&&count()===1,'Changed expense text with reused ID is rejected');

 const withDate=base(2,{description:'Explicit purchase date',incurredAt:'2026-10-23T12:00:00.000Z'});
 response=await call(withDate);
 check(response.status===201,'Explicit purchase date saved');
 response=await call(withDate);
 check(response.status===200&&count()===2,'Exact explicit-date request replay verified without duplication');
 response=await call({...withDate,incurredAt:'2026-10-24T12:00:00.000Z'});
 check(response.status===409,'An altered explicit purchase date cannot reuse the first request ID');
 check(stored(withDate.requestId).incurred_at===withDate.incurredAt,'Saved date still matches original explicit date');

 // D1 can commit before its write acknowledgement is lost. Never infer no
 // insert and retry with a new ID: independently read the original row.
 throwAfterCommit=true;
 const lostAck=base(3,{description:'Ack lost after actual INSERT'});
 response=await call(lostAck);
 receipt=await response.json();
 check(response.status===200&&receipt.confirmed===true&&receipt.expense.id===lostAck.requestId,'Lost post-commit ACK recovered from immutable SQLite row');
 check(count()===3,'Lost-ACK recovery does not create a second cost');

 skipWrite=true;
 const silentMiss=base(4,{description:'Not actually committed'});
 response=await call(silentMiss);
 receipt=await response.json();
 check(response.status===503&&receipt.saveUncertain===true,'Silent no-write D1 result never reports a confirmed expense');
 check(stored(silentMiss.requestId)===null,'Silent write failure inserted no phantom expense');

 throwReadback=true;
 const lostReadback=base(5,{description:'Committed but readback unavailable'});
 response=await call(lostReadback);
 check(response.status===503&&(await response.json()).saveUncertain===true,'Readback outage cannot falsely claim success');
 check(count()===4,'Readback outage retains actual committed expense');
 response=await call(lostReadback);
 check(response.status===200&&count()===4,'Replay after readback outage confirms the same expense without another financial row');

 check((await call(base(6,{incurredAt:'not-an-instant'}))).status===400,'Invalid expense date rejected');
 check((await call(base(7,{estimateId:'not-a-job'}))).status===404,'Unknown job expense link rejected');
 check(count()===4,'Invalid inputs do not create expenses');
 console.log('PASS '+tests+'/'+tests+' actual owner expense POST and native SQLite: idempotent undated and dated replay, immutable receipt, lost ACK, stale result, tax-date and identity checks; synthetic-only.');
} finally{sql.close();}
