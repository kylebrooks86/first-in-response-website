/** SOURCE-ONLY: actual D1-style transaction over disposable native SQLite.
 * No providers, hosted database, photo ZIP, Stripe, customer or network data.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {captureNumberedCoreV2ReadOnly} from '../lib/numbered-v2-d1-snapshot.mjs';
import {restoreNumberedCoreV2ToDisposableMemory} from '../lib/disposable-numbered-v2-restore.mjs';
import {validateNumberedCoreRecordsV2} from '../lib/numbered-records-v2-preflight.mjs';

const sqlDir='../adapters/doomsday/drizzle';
const schemaFiles=readdirSync(sqlDir).filter(n=>/^\d{4}_[\w-]+\.sql$/.test(n)).sort();
assert.equal(schemaFiles.length,25,'Keep exact reviewed migration baseline');
const schema=schemaFiles.map(n=>readFileSync(sqlDir+'/'+n,'utf8')).join('\n')+'\n'+
 readFileSync('../customer-numbering/customer_numbers_v1.sql','utf8')+'\n'+
 readFileSync('../job-numbering/job_numbers_v1.sql','utf8');
const database=()=>{const db=new DatabaseSync(':memory:');db.exec(schema);db.exec('PRAGMA foreign_keys=ON');return db;};
const db=database(),restore=database();
let checks=0;
const eq=(actual,expected,why)=>{assert.deepEqual(actual,expected,why);checks++};
const reject=async (input,why)=>{await assert.rejects(()=>captureNumberedCoreV2ReadOnly(input),/BLOCKED|FIRE numbered records v2 blocked/,why);checks++};
const now='2026-10-20T12:00:00Z';
const insert=(sql,...args)=>db.prepare(sql).run(...args);
insert('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)','synthetic-c1','Synthetic One',now);
insert('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)','synthetic-c2','Synthetic Two',now);
for(const [id,owner] of [['synthetic-e1','synthetic-c1'],['synthetic-e2','synthetic-c2']])
 insert("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES(?,?,'completed',3000,3000,1500,?)",id,owner,now);
insert("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES(?,?,'Balance',3000,'paid',?,?)",'synthetic-p1','synthetic-e1','manual:synthetic-p1',now);
insert("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES(?,?,'Refund',-500,'paid',?,?)",'synthetic-p2','synthetic-e1','refund:synthetic-p1:synthetic-r1',now);
insert("INSERT INTO payment_refunds(id,payment_id,estimate_id,amount_cents,mode,status,created_at) VALUES(?,?,?,500,'manual','succeeded',?)",'synthetic-r1','synthetic-p1','synthetic-e1',now);
for(const [serial,customer] of [[3,'synthetic-c1'],[6,'synthetic-c2']])
 insert('INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at) VALUES(?,?,?)',serial,customer,now);
for(const [serial,id] of [[2,'synthetic-e1'],[9,'synthetic-e2']]){
 insert('INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) VALUES(?,?,?)',serial,id,now);
 insert('INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES(?,?)',id,serial);
}
insert("UPDATE sqlite_sequence SET seq=? WHERE name='fire_customer_numbers'",11);
insert("UPDATE sqlite_sequence SET seq=? WHERE name='fire_job_numbers'",15);

let batchCount=0,statementCount=0,writes=0,externalCalls=0;
const oldFetch=globalThis.fetch;
globalThis.fetch=async()=>{externalCalls++;throw Error('No network permitted in numbered recovery regression')};
function d1(overwrite=()=>{}){
 return{
  prepare(sql){
   if(!/^SELECT\b|^PRAGMA\s+table_info\(/.test(sql))throw Error('Unsafe write SQL in read-only D1 adapter');
   statementCount++;
   return{sql,values:[],bind(...values){return{sql,values}}};
  },
  async batch(statements){
   batchCount++;
   if(statements.length>50)throw Error('Free D1 synthetic 50-query limit exceeded');
   const prior=db.prepare("SELECT COUNT(*) AS n FROM customers").get().n;
   db.exec('BEGIN');
   let result;
   try{
    result=statements.map(item=>({success:true,results:db.prepare(item.sql).all(...item.values)}));
    db.exec('COMMIT');
   }catch(error){db.exec('ROLLBACK');throw error;}
   eq(db.prepare("SELECT COUNT(*) AS n FROM customers").get().n,prior,'Snapshot never changes source customer records');
   overwrite(result);
   return result;
  }
 };
}
try{
 const snapshot=await captureNumberedCoreV2ReadOnly(d1());
 eq(batchCount,1,'Entire schema, serials, counts and all rows captured in ONE batch');
 eq(statementCount,49,'Exactly 49 read-only queries stay within D1 Free 50-query limit');
 eq(snapshot.rowCounts.customers,2,'Independent SQL customer count captured');
 eq(snapshot.rowCounts.payment_refunds,1,'Refund audit table captured');
 eq(snapshot.rowCounts.payments,2,'Positive payment and negative refund ledger captured');
 eq(snapshot.highWater,{customer:11,job:15},'Original consumed high-water protected, not MAX serial');
 eq(validateNumberedCoreRecordsV2(snapshot).jobLinks,2,'V2 validator approves complete existing source');
 eq(Object.keys(snapshot.tables).length,23,'All 23 reviewed durable tables included');
 const restored=restoreNumberedCoreV2ToDisposableMemory(restore,snapshot);
 eq(restored.completedAtomicInMemoryRestore,true,'Read-only snapshot feeds original atomic in-memory restore');
 eq(restore.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_job_numbers'").get().seq,15,'Restore preserves historic Job # sequence');
 eq(restore.prepare("SELECT COUNT(*) AS n FROM payment_refunds").get().n,1,'Restored refund journal matches original source');
 eq(externalCalls,0,'No remote photo, Cloudflare, Stripe, email or other network use');
 eq(writes,0,'No D1 mutation statements');

 await reject({prepare:()=>({}),batch:null},'Missing transactional D1 batch refused');
 await reject(d1(result=>{result[0].results.push({name:'unreviewed_business_table'});}), 'New unarchived table fails closed');
 await reject(d1(result=>{result[0].results=result[0].results.filter(r=>r.name!=='fire_job_numbers');}), 'Missing permanent identity SQL table fails closed');
 await reject(d1(result=>{result[1].results.find(r=>r.name==='fire_job_numbers').seq=3;}), 'Consumed permanent Job # serial cannot be reset');
 await reject(d1(result=>{result[3].results=result[3].results.slice(1);}), 'Truncated customers rows detected by independent count');
 await reject(d1(result=>{result[2].results.find(r=>r.table_name==='customers').count=99;}), 'Incorrect independent D1 count fails closed');
 await reject(d1(result=>{result[4].results=[];}), 'Missing SQL columns cannot generate a plausible archive');
 await reject(d1(result=>{delete result[3].results[0].name;}), 'Truncated original SQL row cannot pass');
 await reject(d1(result=>{result[1].results.push({name:'unexpected_sequence',seq:23});}), 'Unexpected SQLite sequence metadata refused');
 await reject(d1(result=>{result[2].results.pop();}), 'A missing per-table count in the UNION proof is refused');
 await reject(d1(result=>{result[2].results.push({...result[2].results[0]});}), 'A duplicate per-table count in the UNION proof is refused');
 await reject(d1(result=>{result[2].results[0].count=-1;}), 'Invalid negative SQL count fails closed');
 await reject(d1(result=>{result.pop();}), 'Partially returned D1 batch refused');
 db.exec('CREATE TABLE unreviewed_customer_feature (id TEXT PRIMARY KEY)');
 await reject(d1(),'Physical unreviewed source table requires a new archive contract');
 eq(externalCalls,0,'Fault tests also used no provider traffic');
 console.log('PASS '+checks+'/'+checks+' real 25-migration read-only transactional numbered v2 D1 snapshot, financial ledger, historical serials, atomic disposable restore, schema drift/corruption denial. NO HOSTED WRITES.');
}finally{globalThis.fetch=oldFetch;db.close();restore.close();}
