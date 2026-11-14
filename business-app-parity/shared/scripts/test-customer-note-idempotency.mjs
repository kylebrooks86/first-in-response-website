/** Actual owner route + disposable SQLite. No hosted data or migrations. */
import assert from'node:assert/strict';import{DatabaseSync}from'node:sqlite';import{randomUUID}from'node:crypto';import{readFileSync,readdirSync}from'node:fs';import{createRouteFixtureLoader}from'./route-test-loader.mjs';
const db=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+f,'utf8'));
db.exec("INSERT INTO customers(id,name,created_at) VALUES('a','Synthetic A','now'),('b','Synthetic B','now')");let owner={email:'kylebrooks8605@gmail.com'},loseReceipt=false,loseWriteAck=false,skipWrite=false,writes=0;
const env={DB:{prepare(sql){return{bind(...args){return{async first(){if(loseReceipt&&sql.startsWith('SELECT id,customer_id AS customerId,body')){loseReceipt=false;throw Error('Synthetic response interruption after insert');}return db.prepare(sql).get(...args)??null;},async run(){writes++;if(skipWrite&&sql.startsWith('INSERT OR IGNORE INTO customer_notes')){skipWrite=false;return{meta:{changes:1}};}const outcome=db.prepare(sql).run(...args);if(loseWriteAck&&sql.startsWith('INSERT OR IGNORE INTO customer_notes')){loseWriteAck=false;throw Error('Synthetic D1 committed note, lost INSERT acknowledgment');}return{meta:{changes:outcome.changes}};}};}};}}};
const route=createRouteFixtureLoader(process.cwd(),env,()=>owner)('app/api/customer-notes/route.ts');const post=body=>route.POST(new Request('https://fixture.invalid/api/customer-notes',{method:'POST',body:JSON.stringify(body)}));let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;},rows=()=>db.prepare('SELECT * FROM customer_notes ORDER BY id').all();
try{
 const body={customerId:'a',body:'  Gate instruction\nKeep side gate closed.  ',requestId:randomUUID()};let response=await post(body);eq(response.status,201);const first=await response.json();eq(first.note.body,body.body.trim());eq(first.note.id,body.requestId);eq(first.confirmed,true);eq(response.headers.get('cache-control'),'no-store, private');
 response=await post(body);eq(response.status,200);eq(await response.json(),first,'Same request returns the original timestamp and content');eq(rows().length,1);
 for(const change of [{...body,customerId:'b'},{...body,body:'Changed content'}]){const before=rows();eq((await post(change)).status,409);eq(rows(),before,'Conflicting reuse never overwrites a saved note');}
 const parallel={...body,requestId:randomUUID()};eq((await Promise.all([post(parallel),post(parallel)])).map(r=>r.status).sort(),[200,201]);eq(rows().length,2,'Concurrent duplicate requests insert once');
 // Actual D1 INSERT can commit even if the acknowledgement is lost. No
 // second write or duplicate customer note may be required for success.
 const lostWrite={...body,requestId:randomUUID()};loseWriteAck=true;
 let writeResponse=await post(lostWrite);
 eq(writeResponse.status,200,'Lost INSERT ACK recovers the already-committed note in one request');
 let recovered=await writeResponse.json();
 eq(recovered.confirmed,true);eq(recovered.note.id,lostWrite.requestId);
 eq(rows().filter(r=>r.id===lostWrite.requestId).length,1);
 // A lost SELECT acknowledgment, unlike a lost INSERT ACK, must NOT be
 // reported as a confirmed save.
 const lost={...body,requestId:randomUUID()};loseReceipt=true;
 let uncertainResponse=await post(lost);eq(uncertainResponse.status,503);
 let uncertainBody=await uncertainResponse.json();
 eq(uncertainBody.saveUncertain,true);eq(uncertainBody.requestId,lost.requestId);
 const saved=rows().find(r=>r.id===lost.requestId);eq(Boolean(saved),true);
 eq((await post(lost)).status,200);
 eq(rows().find(r=>r.id===lost.requestId),saved,'Committed lost SELECT receipt retry preserves original row');
 // A success-looking database ACK without an actual write cannot be trusted.
 const skipped={...body,requestId:randomUUID()};skipWrite=true;
 uncertainResponse=await post(skipped);eq(uncertainResponse.status,503);
 eq((await uncertainResponse.json()).saveUncertain,true);
 eq(rows().some(r=>r.id===skipped.requestId),false);
 eq(rows().length,4);
 const before=rows();for(const bad of [null,[],{},'text',{customerId:{},body:'x'},{customerId:'a',body:{}},{customerId:'a',body:[]},{customerId:'a',body:' '},{customerId:'a',body:'x'.repeat(5001)},...['',null,12,'not-uuid',randomUUID().replace('-','')].map(requestId=>({...body,requestId}))]){eq((await post(bad)).status,400);eq(rows(),before);}
 const malformed=await route.POST(new Request('https://fixture.invalid',{method:'POST',body:'{bad'}));eq(malformed.status,400);eq(rows(),before);eq((await post({...body,customerId:'missing',requestId:randomUUID()})).status,404);eq(rows(),before);
 // Older callers without request IDs remain supported as deliberate new notes.
 eq((await post({customerId:'b',body:'[FIRE FLAG] REVIEW_RECEIVED'})).status,201);eq((await post({customerId:'b',body:'x'.repeat(5000),requestId:randomUUID()})).status,201);
 const frozen=rows(),writeCount=writes;for(const user of [null,{email:'other@example.invalid'}]){owner=user;eq((await post(body)).status,401);eq(rows(),frozen);eq(writes,writeCount);}
 console.log('PASS '+checks+' actual customer-note SQLite/API checks: lost INSERT ACK recovery, lost SELECT ACK fail-closed, fake write ACK refusal, retry, concurrency, immutable timestamps, conflicts, malformed input, limits and owner authorization.');
}finally{db.close();}
