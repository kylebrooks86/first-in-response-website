/** Exercise REAL owner share endpoints with disposable SQLite; no hosted URLs. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createRouteFixtureLoader} from './route-test-loader.mjs';

const database=new DatabaseSync(':memory:');
database.exec(`
  CREATE TABLE estimates(id TEXT PRIMARY KEY,share_token TEXT);
  CREATE TABLE invoices(id TEXT PRIMARY KEY,share_token TEXT);
`);
const tables=['estimates','invoices'];
const who={email:'kylebrooks8605@gmail.com'};
const activity={reads:0,updates:0,race:null,failBeforeWrite:null,lostAck:null,failSecondRead:null,readsPerTable:{}};
function reset(){
 activity.reads=0;activity.updates=0;activity.race=null;
 activity.failBeforeWrite=null;activity.lostAck=null;activity.failSecondRead=null;
 activity.readsPerTable={};
}
function put(table,id,token=null){
 database.prepare(`INSERT INTO ${table}(id,share_token) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET share_token=excluded.share_token`).run(id,token);
}
function saved(table,id){return database.prepare(`SELECT share_token AS shareToken FROM ${table} WHERE id=?`).get(id)?.shareToken??null;}
const env={DB:{
 prepare(sql){
  const table=sql.match(/(?:FROM|UPDATE) (estimates|invoices)\b/i)?.[1];
  assert.ok(table,'Only allow share route SQL on fixture tables');
  return {bind(...params){
   return {
    async first(){
     activity.reads++;
     activity.readsPerTable[table]=(activity.readsPerTable[table]??0)+1;
     if(activity.failSecondRead===table&&activity.readsPerTable[table]===2)throw Error('synthetic D1 read-back failure');
     const stmt=database.prepare(sql);
     return stmt.get(...params)??null;
    },
    async run(){
     activity.updates++;
     assert.match(sql,/WHERE id=\? AND \(share_token IS NULL OR share_token=''\)/,
      'Share write must be atomic compare-and-set with no rewrite of issued token');
     if(activity.race===table){
      activity.race=null;
      const id=params[1];
      database.prepare(`UPDATE ${table} SET share_token=? WHERE id=? AND share_token IS NULL`).run('the_other_confirmed_writer_token',id);
     }
     if(activity.failBeforeWrite===table)throw Error('synthetic D1 write rejected');
     const changed=database.prepare(sql).run(...params);
     if(activity.lostAck===table)throw Error('synthetic lost D1 ACK after commit');
     return {success:true,meta:{changes:Number(changed.changes)}};
    }
   };
  }};
 }
}};
const loader=createRouteFixtureLoader(process.cwd(),env,()=>who.email?{email:who.email}:null);
const routes={
 estimates:loader('app/api/estimates/[id]/share/route.ts').POST,
 invoices:loader('app/api/invoices/[id]/share/route.ts').POST
};
let checks=0;
function same(actual,expected,why){assert.deepEqual(actual,expected,why);checks++;}
async function issue(table,id){
 const response=await routes[table](new Request(`https://synthetic.invalid/api/${table}/${id}/share`,{method:'POST'}),{params:Promise.resolve({id})});
 const value=await response.json();
 same(response.headers.get('cache-control'),'private, no-store',table+' share tokens are not cacheable');
 same(response.headers.get('vary'),'Cookie',table+' private auth responses vary on cookies');
 return {status:response.status,value};
}
for(const table of tables){
 const id=table+'-synthetic-id';
 reset();put(table,id);
 // First issuance must be confirmed by a real D1 reread.
 let x=await issue(table,id);
 same(x.status,200,table+' initial issue success');
 same(x.value.shareToken,saved(table,id),table+' initial returned token actually persisted');
 same(activity.updates,1,table+' initial issuance is one CAS update');
 if(table==='estimates')same(x.value.customerPath,'/estimate/'+x.value.shareToken,'estimate customer path agrees with saved token');
 // Repeated requests never overwrite an existing customer link.
 const firstToken=x.value.shareToken;reset();
 x=await issue(table,id);
 same(x.value.shareToken,firstToken,table+' existing link reused');
 same(activity.updates,0,table+' existing token never rewritten');
 // A newly concurrent request can win between first SELECT and our CAS.
 reset();put(table,id,null);activity.race=table;
 x=await issue(table,id);
 same(x.status,200,table+' losing CAS still responds');
 same(x.value.shareToken,'the_other_confirmed_writer_token',table+' must use actual winning token, not invented losing token');
 same(saved(table,id),x.value.shareToken,table+' link is real when another writer wins');
 if(table==='estimates')same(x.value.customerPath,'/estimate/the_other_confirmed_writer_token','estimate race returns authoritative path');
 // A missing ACK after the DB committed must be recovered by readback, never invent another token.
 reset();put(table,id,null);activity.lostAck=table;
 x=await issue(table,id);
 same(x.status,200,table+' lost DB ACK recovered');
 same(x.value.shareToken,saved(table,id),table+' lost ACK confirmed through DB');
 // Genuine write refusal cannot be mistaken for success; return retryable error instead.
 reset();put(table,id,null);activity.failBeforeWrite=table;
 x=await issue(table,id);
 same(x.status,503,table+' refused write stays retryable');
 same(x.value.shareToken,undefined,table+' refused write never exposes unconfirmed token');
 same(saved(table,id),null,table+' refused write preserves empty DB token');
 // Reread failures cannot release a token even after the write.
 reset();put(table,id,null);activity.failSecondRead=table;
 x=await issue(table,id);
 same(x.status,503,table+' unconfirmed readback stays retryable');
 same(x.value.shareToken,undefined,table+' no unconfirmed token returned');
 // Parallel first requests both converge on one saved token.
 reset();put(table,id,null);
 const parallel=await Promise.all([issue(table,id),issue(table,id)]);
 same(parallel.every(r=>r.status===200),true,table+' both concurrent responses succeed');
 same(parallel[0].value.shareToken,parallel[1].value.shareToken,table+' both receive identical saved share link');
 same(parallel[0].value.shareToken,saved(table,id),table+' parallel link is actually saved');
 // Missing record returns 404 and never creates a token on another row.
 reset();
 x=await issue(table,'missing-'+id);
 same(x.status,404,table+' unknown item refused');
 same(activity.updates,0,table+' unknown item cannot write');
 // Unauthenticated callers never even query the private record.
 for(const user of [null,'intruder@example.invalid']){
  reset();who.email=user;
  x=await issue(table,id);
  same(x.status,401,table+' denied unauthenticated/nonowner');
  same(activity.reads,0,table+' denied caller never accesses D1');
  same(activity.updates,0,table+' denied caller never writes D1');
 }
 who.email='kylebrooks8605@gmail.com';
}
database.close();
console.log('PASS '+checks+'/'+checks+' actual owner estimate/invoice share-route checks. Concurrent CAS, lost ACK, denied auth, existing tokens and strict D1 readback. Disposable SQLite only.');
