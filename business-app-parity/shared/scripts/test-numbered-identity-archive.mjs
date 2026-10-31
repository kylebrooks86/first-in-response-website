/** No hosted resources. In-memory SQLite only: permanent number archive preflight.
 * This test is NOT a live JSON backup/restore migration or an authorized deploy.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {validateNumberedIdentityArchive,NUMBERED_IDENTITY_ARCHIVE_FORMAT,NUMBERED_IDENTITY_ARCHIVE_VERSION} from '../lib/numbered-identity-archive.mjs';
let checks=0;
function eq(actual,expected,message){assert.deepEqual(actual,expected,message);checks++;}
function rejects(fn,message){assert.throws(fn,/Unsafe FIRE numbered-identity archive/,message);checks++;}
const root='business-app-parity/';
const customerSchema=readFileSync(root+'customer-numbering/customer_numbers_v1.sql','utf8');
const jobSchema=readFileSync(root+'job-numbering/job_numbers_v1.sql','utf8');
const customerRows=[
 {id:'c1',created_at:'2026-10-01T12:00:00Z'},
 {id:'c2',created_at:'2026-10-02T12:00:00Z'},
 {id:'c3',created_at:'2026-10-03T12:00:00Z'}
];
const estimateRows=[
 {id:'e1',customer_id:'c1',created_at:'2026-10-04T12:00:00Z'},
 {id:'e2',customer_id:'c1',created_at:'2026-10-05T12:00:00Z'}, // revision of job e1
 {id:'e3',customer_id:'c2',created_at:'2026-10-06T12:00:00Z'}
];
const template={
 format:NUMBERED_IDENTITY_ARCHIVE_FORMAT,version:NUMBERED_IDENTITY_ARCHIVE_VERSION,
 allTablesComplete:true,truncated:false,
 customers:customerRows,estimates:estimateRows,
 fire_customer_numbers:customerRows.map((r,i)=>({customer_number:i+1,customer_id:r.id,created_at:r.created_at})),
 fire_job_numbers:[
  {job_number:2,root_estimate_id:'e1',created_at:estimateRows[0].created_at},
  {job_number:5,root_estimate_id:'e3',created_at:estimateRows[2].created_at}
 ],
 fire_job_estimate_links:[
  {estimate_id:'e1',job_number:2},
  {estimate_id:'e2',job_number:2},
  {estimate_id:'e3',job_number:5}
 ],
 // Preserve original sqlite_sequence high-water, not MAX() of current records.
 highWater:{customer:7,job:9}
};
const clone=()=>structuredClone(template);
eq(validateNumberedIdentityArchive(template),{
 customers:3,estimates:3,customerNumbers:3,jobNumbers:2,jobLinks:3,
 customerHighWater:7,jobHighWater:9
},'Complete numbered archive preserves repeat-job links and both serial high-water marks');
const cases=[
 ['unknown format',x=>x.format='untrusted'],
 ['version',x=>x.version=2],
 ['missing completeness',x=>delete x.allTablesComplete],
 ['truncation',x=>x.truncated=true],
 ['missing all customers',x=>delete x.customers],
 ['missing serials',x=>delete x.fire_customer_numbers],
 ['missing jobs',x=>delete x.fire_job_numbers],
 ['missing links',x=>delete x.fire_job_estimate_links],
 ['missing high-water',x=>delete x.highWater],
 ['gap in customer coverage',x=>x.fire_customer_numbers.pop()],
 ['duplicate customer number',x=>x.fire_customer_numbers[1].customer_number=1],
 ['duplicate customer id',x=>x.fire_customer_numbers[1].customer_id='c1'],
 ['invented customer number',x=>x.fire_customer_numbers[1].customer_number=4.5],
 ['number belongs to missing customer',x=>x.fire_customer_numbers[0].customer_id='c4'],
 ['changed original customer timestamp',x=>x.fire_customer_numbers[0].created_at='2025-01-01'],
 ['missing estimate owner',x=>x.estimates[0].customer_id='missing'],
 ['duplicate estimate',x=>x.estimates[1].id='e1'],
 ['job has unknown root',x=>x.fire_job_numbers[0].root_estimate_id='gone'],
 ['job number duplicate',x=>x.fire_job_numbers[1].job_number=2],
 ['job root duplicate',x=>x.fire_job_numbers[1].root_estimate_id='e1'],
 ['job timestamp tampered',x=>x.fire_job_numbers[0].created_at='2025-01-01'],
 ['job link to missing job',x=>x.fire_job_estimate_links[1].job_number=800],
 ['incomplete estimate link coverage',x=>x.fire_job_estimate_links.pop()],
 ['duplicate estimate link',x=>x.fire_job_estimate_links[1].estimate_id='e1'],
 ['root cannot be reassigned',x=>x.fire_job_estimate_links[0].job_number=5],
 ['cross-customer revision',x=>x.fire_job_estimate_links[1].job_number=5],
 ['job high-water does not preserve gaps',x=>x.highWater.job=4],
 ['customer high-water too small',x=>x.highWater.customer=1],
 ['numeric string high-water rejected',x=>x.highWater.customer='7'],
 ['numeric string serial rejected',x=>x.fire_customer_numbers[0].customer_number='1']
];
for(const [name,mutate] of cases){const copy=clone();mutate(copy);rejects(()=>validateNumberedIdentityArchive(copy),name);}

function freshDB(){
 const db=new DatabaseSync(':memory:');
 db.exec("PRAGMA foreign_keys=ON; CREATE TABLE customers(id TEXT PRIMARY KEY,created_at TEXT NOT NULL); CREATE TABLE estimates(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customers(id),created_at TEXT NOT NULL);");
 db.exec(customerSchema);db.exec(jobSchema);
 return db;
}
const db=freshDB();
for(const row of template.customers)db.prepare('INSERT INTO customers(id,created_at) VALUES(?,?)').run(row.id,row.created_at);
for(const row of template.estimates)db.prepare('INSERT INTO estimates(id,customer_id,created_at) VALUES(?,?,?)').run(row.id,row.customer_id,row.created_at);
for(const row of template.fire_customer_numbers)db.prepare('INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at) VALUES(?,?,?)').run(row.customer_number,row.customer_id,row.created_at);
for(const row of template.fire_job_numbers)db.prepare('INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) VALUES(?,?,?)').run(row.job_number,row.root_estimate_id,row.created_at);
for(const row of template.fire_job_estimate_links)db.prepare('INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES(?,?)').run(row.estimate_id,row.job_number);
db.prepare("UPDATE sqlite_sequence SET seq=? WHERE name='fire_customer_numbers'").run(template.highWater.customer);
db.prepare("UPDATE sqlite_sequence SET seq=? WHERE name='fire_job_numbers'").run(template.highWater.job);
const query=(table)=>db.prepare('SELECT * FROM '+table).all();
const restored={...clone(),
 customers:query('customers'),estimates:query('estimates'),
 fire_customer_numbers:query('fire_customer_numbers'),fire_job_numbers:query('fire_job_numbers'),
 fire_job_estimate_links:query('fire_job_estimate_links'),
 highWater:{customer:db.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_customer_numbers'").get().seq,
            job:db.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_job_numbers'").get().seq}};
eq(validateNumberedIdentityArchive(restored).jobLinks,3,'Real SQLite restored original and revision links');
eq(db.prepare('PRAGMA foreign_key_check').all().length,0,'All restored relationships retain real FKs');
assert.throws(()=>db.prepare("UPDATE fire_customer_numbers SET customer_number=99 WHERE customer_id='c1'").run(),/permanent/);checks++;
assert.throws(()=>db.prepare("DELETE FROM fire_job_estimate_links WHERE estimate_id='e2'").run(),/permanent/);checks++;
assert.throws(()=>db.prepare("DELETE FROM fire_job_numbers WHERE job_number=2").run(),/reused/);checks++;
db.prepare("INSERT INTO customers(id,created_at) VALUES('c4','2026-11-01')").run();
db.prepare("INSERT INTO fire_customer_numbers(customer_id,created_at) VALUES('c4','2026-11-01')").run();
eq(db.prepare("SELECT customer_number FROM fire_customer_numbers WHERE customer_id='c4'").get().customer_number,8,
   'Next number follows original SQLite high-water, not current maximum');
db.prepare("INSERT INTO estimates(id,customer_id,created_at) VALUES('e4','c2','2026-11-02')").run();
db.prepare("INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES('e4','2026-11-02')").run();
eq(db.prepare("SELECT job_number FROM fire_job_numbers WHERE root_estimate_id='e4'").get().job_number,10,
   'Next job preserves the high-water mark despite gaps');
db.close();
console.log('PASS '+checks+'/'+checks+' numbered-identity lossless archive, cross-customer refusal and in-memory SQLite non-reuse checks. No hosted resources.');
