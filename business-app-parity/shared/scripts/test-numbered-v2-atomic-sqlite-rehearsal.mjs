/** Offline-only physical SQLite rehearsal of the **SOURCE-ONLY** numbered
 * core v2 contract. Uses the exact 25 baseline QA schema SQL files plus the
 * separately disabled permanent numbering DDL. Every database is :memory:.
 * This script is NOT a production restore handler or owner permission.
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {
 NUMBERED_RECORDS_V2_FORMAT,NUMBERED_RECORDS_V2_VERSION,
 NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES,
 validateNumberedCoreRecordsV2,planNumberedCoreRecordsV2Restore
} from '../lib/numbered-records-v2-preflight.mjs';
let checks=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
const ok=(value,msg)=>{assert.ok(value,msg);checks++;};
const sqlDir='../adapters/doomsday/drizzle';
const migrationFiles=readdirSync(sqlDir).filter(x=>/^\d{4}_[\w-]+\.sql$/.test(x)).sort();
eq(migrationFiles.length,25,'Exact 25 owner-reviewed QA schema source migrations rehearsed');
const sourceSchema=migrationFiles.map(file=>readFileSync(sqlDir+'/'+file,'utf8')).join('\n');
const numberSchema=readFileSync('../customer-numbering/customer_numbers_v1.sql','utf8')+'\n'+
 readFileSync('../job-numbering/job_numbers_v1.sql','utf8');
const makeDB=()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(sourceSchema);
 db.exec(numberSchema);
 db.exec('PRAGMA foreign_keys=ON');
 return db;
};
const sample=makeDB(),blank=makeDB();
const makeRows=db=>{
 const tables={};
 for(const table of [...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES])
   tables[table]=db.prepare('SELECT * FROM "'+table+'"').all();
 const highWater={customer:db.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_customer_numbers'").get()?.seq??0,
  job:db.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_job_numbers'").get()?.seq??0};
 return{format:NUMBERED_RECORDS_V2_FORMAT,version:NUMBERED_RECORDS_V2_VERSION,allTablesComplete:true,
  truncated:false,tables,rowCounts:Object.fromEntries(Object.entries(tables).map(([t,rows])=>[t,rows.length])),
  highWater};
};
const item=(db,sql,values)=>db.prepare(sql).run(...values);
const now='2026-10-20T12:00:00Z';
try{
 item(sample,'INSERT INTO customers(id,name,created_at) VALUES(?,?,?)',['synthetic-c1','Synthetic Owner QA',now]);
 item(sample,'INSERT INTO customers(id,name,created_at) VALUES(?,?,?)',['synthetic-c2','Synthetic Other QA',now]);
 item(sample,"INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at) VALUES(?,?,'completed',3000,0,3000,1500,?)",
  ['synthetic-e1','synthetic-c1',now]);
 item(sample,"INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at) VALUES(?,?,'draft',4000,0,4000,2000,?)",
  ['synthetic-e2','synthetic-c2',now]);
 item(sample,"INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES(?,?,'Balance',3000,'paid','manual:synthetic-p1',?)",
  ['synthetic-p1','synthetic-e1',now]);
 item(sample,"INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES(?,?,'Refund',-500,'paid','refund:synthetic-p1:synthetic-r1',?)",
  ['synthetic-p2','synthetic-e1',now]);
 item(sample,"INSERT INTO payment_refunds(id,payment_id,estimate_id,amount_cents,mode,status,created_at) VALUES(?,?,?,500,'manual','succeeded',?)",
  ['synthetic-r1','synthetic-p1','synthetic-e1',now]);
 item(sample,"INSERT INTO customer_notes(id,customer_id,body,created_at) VALUES(?,?,?,?)",
  ['synthetic-note','synthetic-c1','No real customer information',now]);
 item(sample,"INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at) VALUES(?,?,?)",
  [3,'synthetic-c1',now]);
 item(sample,"INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at) VALUES(?,?,?)",
  [6,'synthetic-c2',now]);
 item(sample,"INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) VALUES(?,?,?)",
  [2,'synthetic-e1',now]);
 item(sample,"INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) VALUES(?,?,?)",
  [9,'synthetic-e2',now]);
 item(sample,"INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES(?,?)",
  ['synthetic-e1',2]);
 item(sample,"INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES(?,?)",
  ['synthetic-e2',9]);
 sample.prepare("UPDATE sqlite_sequence SET seq=11 WHERE name='fire_customer_numbers'").run();
 sample.prepare("UPDATE sqlite_sequence SET seq=15 WHERE name='fire_job_numbers'").run();

 const original=makeRows(sample);
 eq(validateNumberedCoreRecordsV2(original).jobLinks,2,'Actual 25-migration SQLite source passes v2 integrity');
 const originalBlank=makeRows(blank);
 const plan=planNumberedCoreRecordsV2Restore(original,originalBlank);
 eq(plan.insertCoreRecords.payments,2,'Restore plan includes both payment and negative refund entries');
 eq(plan.insertCoreRecords.payment_refunds,1,'Restore plan includes succeeded refund audit');
 eq(plan.customerHighWater,11,'Restore preserves consumed customer numbers from SQLite');
 eq(plan.jobHighWater,15,'Restore preserves consumed job numbers from SQLite');

 const order=['customers','estimates','estimate_items','customer_notes','invoices',
  'invoice_items','invoice_revisions','payment_checkout_sessions','payments','payment_refunds',
  'deposit_policy_events','deposit_agreement_snapshots','customer_photos','customer_messages',
  'notifications','message_templates','estimate_change_requests','tasks','expenses','job_reports',
  'fire_customer_numbers','fire_job_numbers','fire_job_estimate_links'];
 eq(new Set(order).size,NUMBERED_CORE_TABLES.length+NUMBERED_IDENTITY_TABLES.length,
  'Rehearsal includes all 23 durable core/identity tables once each');
 const known=Object.fromEntries(order.map(table=>[table,new Set(blank.prepare('PRAGMA table_info("'+table+'")').all().map(x=>x.name))]));
 function insert(db,archive,{interruptAfter}={}){
  let inserted=0;
  db.exec('BEGIN IMMEDIATE');
  try{
   for(const table of order){
    for(const row of archive.tables[table]){
     const cols=Object.keys(row);
     if(cols.length===0||cols.some(c=>!known[table].has(c)))
       throw Error('Unsupported synthetic column, refuse unsafe insert');
     const statement='INSERT INTO "'+table+'" ('+cols.map(c=>'"'+c+'"').join(',')+') VALUES ('+
       cols.map(()=>'?').join(',')+')';
     db.prepare(statement).run(...cols.map(c=>row[c]));
     inserted++;
     if(interruptAfter&&inserted===interruptAfter)throw Error('Synthetic crash before SQLite COMMIT');
    }
   }
   db.prepare("UPDATE sqlite_sequence SET seq=? WHERE name='fire_customer_numbers'").run(archive.highWater.customer);
   db.prepare("UPDATE sqlite_sequence SET seq=? WHERE name='fire_job_numbers'").run(archive.highWater.job);
   db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 assert.throws(()=>insert(blank,original,{interruptAfter:4}),/Synthetic crash/);checks++;
 const emptyAgain=makeRows(blank);
 eq(emptyAgain.rowCounts,originalBlank.rowCounts,'Interrupted restore leaves all 23 tables empty');
 eq(emptyAgain.highWater,originalBlank.highWater,'Rolled-back failed restore cannot consume serial history');
 insert(blank,original);
 const restored=makeRows(blank);
 eq(restored,original,'All full-schema SQL columns, finance/refund records and permanent numbers round-trip losslessly');
 eq(blank.prepare('PRAGMA foreign_key_check').all(),[],'Real SQLite foreign keys pass after restored data');
 eq(planNumberedCoreRecordsV2Restore(original,restored).insertCoreRecords.payments,0,
  'Re-running preflight on a restored archive is idempotent');
 const sealed=JSON.stringify(restored);
 assert.throws(()=>insert(blank,original),/UNIQUE constraint/);checks++;
 eq(JSON.stringify(makeRows(blank)),sealed,'Duplicate insert failure rolls back without changing any existing rows');
 item(blank,'INSERT INTO customers(id,name,created_at) VALUES(?,?,?)',['synthetic-c3','Synthetic Future',now]);
 item(blank,'INSERT INTO fire_customer_numbers(customer_id,created_at) VALUES(?,?)',['synthetic-c3',now]);
 eq(blank.prepare("SELECT customer_number FROM fire_customer_numbers WHERE customer_id='synthetic-c3'").get().customer_number,
  12,'Customer # resumes from stored 11, never historical maximum 6');
 item(blank,"INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at) VALUES(?,?,'draft',100,0,100,50,?)",
  ['synthetic-e3','synthetic-c3',now]);
 item(blank,'INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES(?,?)',['synthetic-e3',now]);
 eq(blank.prepare("SELECT job_number FROM fire_job_numbers WHERE root_estimate_id='synthetic-e3'").get().job_number,
  16,'Job # resumes from original SQLite 15, never historical maximum 9');
 console.log('PASS '+checks+' actual 25-migration SQLite numbered core v2 physical round-trip, rolled-back interruption, refund ledger and high-water checks. NO REMOTE WRITES.');
}finally{sample.close();blank.close();}
