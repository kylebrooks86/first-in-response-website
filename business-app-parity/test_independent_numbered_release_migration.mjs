/** Apply ONLY source files to disposable in-memory SQLite, no Cloudflare, no real D1.
 * Verify independently layered DR/LIVE migration 0025 installs immutable
 * Customer # and Job # on exactly 25 migrated, empty baseline tables.
 */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {immutableNumberingTriggersReady} from './shared/lib/numbered-immutable-trigger-contract.mjs';
import {inspectNewLiveFirstJobCleanStart} from './shared/lib/new-live-first-job-preflight.mjs';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS,assertNewLiveMigrationJournal}
 from './shared/lib/new-live-migration-journal.mjs';

const release='0025_independent_permanent_numbers.sql';
const folder=new URL('./adapters/doomsday/drizzle/',import.meta.url);
const names=readdirSync(folder).filter(name=>/^\d{4}_.+\.sql$/.test(name)).sort();
assert.equal(names.length,25,'existing 25 QA-family migrations must be unchanged');
assert.deepEqual(EXPECTED_NEW_LIVE_D1_MIGRATIONS,[...names,release],
 'reviewed independent release journal and migration files must match');
const dr=readFileSync(new URL('./adapters/independent-dr/drizzle/'+release,import.meta.url),'utf8');
const live=readFileSync(new URL('./adapters/independent-live/drizzle/'+release,import.meta.url),'utf8');
assert.equal(dr,live,'DR and NEW LIVE must install byte-identical numbering schema');
assert.match(live,/CREATE TABLE fire_customer_numbers/);
assert.match(live,/CREATE TABLE fire_job_numbers/);
assert.match(live,/CREATE TABLE fire_job_estimate_links/);
assert.doesNotMatch(live,/\b(?:DROP TABLE customers|DELETE FROM customers|UPDATE customers)\b/i,
 'number installation cannot erase or renumber customers');
let checks=4;

function createBaseline(){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON');
 db.exec('CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY,name TEXT NOT NULL)');
 for(let i=0;i<names.length;i++){
  db.exec(readFileSync(new URL(names[i],folder),'utf8'));
  db.prepare('INSERT INTO d1_migrations(id,name) VALUES (?,?)').run(i+1,names[i]);
 }
 return db;
}
function applyAddon(db){
 db.exec('BEGIN IMMEDIATE');
 try{
  db.exec(live);
  db.prepare('INSERT INTO d1_migrations(id,name) VALUES (26,?)').run(release);
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
}
const bound=db=>({
 prepare(sql){
  const stmt=db.prepare(sql);
  const wrapper={
   first:async()=>stmt.get()??null,
   all:async()=>({results:stmt.all()}),
   bind(...params){return {
    first:async()=>stmt.get(...params)??null,
    all:async()=>({results:stmt.all(...params)})
   };}
  };
  return wrapper;
 }
});
let database=createBaseline();
try{
 assert.equal(database.prepare('SELECT COUNT(*) AS n FROM d1_migrations').get().n,25);
 applyAddon(database);
 assert.equal(database.prepare('SELECT COUNT(*) AS n FROM d1_migrations').get().n,26);
 checks+=2;
 const connected=bound(database);
 assert.equal(await assertNewLiveMigrationJournal(connected),true);
 assert.equal(await immutableNumberingTriggersReady(connected),true);
 checks+=2;
 const proof=await inspectNewLiveFirstJobCleanStart(connected,{
  FIRE_ENV:'new-live-prelaunch',
  FIRE_JOB_NUMBERS_CANDIDATE:'owner-approved-schema-v1',
  FIRE_CUSTOMER_NUMBERS_CANDIDATE:'owner-approved-schema-v1'
 });
 assert.equal(proof.firstJobNumberExpected,'0001');
 assert.equal(proof.exactSourceMigrationJournalMatched,true);
 assert.equal(proof.jobAndCustomerSequencesEmpty,true);
 assert.equal(proof.physicalD1IdentityVerified,false);
 assert.equal(proof.orderedMigrationsVerified,false);
 assert.equal(proof.ownerApprovedRelease,false);
 checks+=6;
 assert.equal(database.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='_fire_independent_numbers_guard'").get().n,0,
  'temporary precondition must not persist');
 checks++;
}finally{database.close();}

async function rejectMutation(reason,mutate){
 const db=createBaseline();
 try{
  mutate(db);
  assert.throws(()=>applyAddon(db),undefined,reason);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM d1_migrations').get().n,25,
   'failed install cannot advance ordered migrations');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='fire_job_numbers'").get().n,0,
   'failed install cannot leave a partially created numbering table');
  checks+=3;
 }finally{db.close();}
}
await rejectMutation('existing customer record requires no-op refusal',db=>{
 db.prepare('INSERT INTO customers(id,name,created_at) VALUES (?,?,?)')
  .run('synthetic-customer','Synthetic','2026-11-13T00:00:00Z');
});
await rejectMutation('forged refund journal refuses migration',db=>{
 db.prepare('UPDATE d1_migrations SET name=? WHERE id=19')
  .run('0018_wrong_refund_migration.sql');
});
await rejectMutation('unknown supplemental user table prevents untracked record loss',db=>{
 db.exec('CREATE TABLE unreviewed_customer_history(id TEXT PRIMARY KEY)');
});
console.log('PASS '+checks+'/'+checks+
 ' independent DR/LIVE source-only 25-to-26 clean-number migration with real SQLite DDL and first Job #0001 preflight; zero provider writes.');
