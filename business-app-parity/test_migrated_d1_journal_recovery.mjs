/** Prove a FULL real 26-migration independent release SQLite schema can recover
 * synthetic customer records without rewriting or inventing its D1 history.
 * No provider, owner files, real business records or Cloudflare operations.
 * node --experimental-sqlite business-app-parity/test_migrated_d1_journal_recovery.mjs
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {mkdtemp,copyFile,readFile,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS} from './shared/lib/new-live-migration-journal.mjs';
import {exportCompleteIsolatedSqliteSnapshot} from './export_complete_isolated_sqlite_snapshot.mjs';
import {restoreNumberedRecordsToIsolatedSqlite} from './restore_numbered_records_to_isolated_sqlite.mjs';

const folder=await mkdtemp(join(tmpdir(),'fire-migrated-journal-'));
const template=join(folder,'independent-26-empty-schema.sqlite');
const source=join(folder,'source-synthetic.sqlite');
const core=join(folder,'core.json'),supp=join(folder,'supplemental.json');
const recovered=join(folder,'recovered.sqlite');
const sqlDir=new URL('./adapters/doomsday/drizzle/',import.meta.url);
const base=readdirSync(sqlDir).filter(name=>/^\d{4}_.+\.sql$/.test(name)).sort();
const addon='0025_independent_permanent_numbers.sql';
let checks=0;
const okay=(condition,why)=>{assert.ok(condition,why);checks++;};
const reject=async(path,records,isolated,extra,why)=>{
 await assert.rejects(restoreNumberedRecordsToIsolatedSqlite(records,isolated,path,extra),/BLOCKED|blocked|differ|history|journal|data|columns/i,why);
 await assert.rejects(access(path),undefined,'failed recovery must never leave partial records');
 checks++;
};
try{
 assert.deepEqual(EXPECTED_NEW_LIVE_D1_MIGRATIONS,[...base,addon]);
 const baseline=new DatabaseSync(template);
 baseline.exec('PRAGMA foreign_keys=ON');
 baseline.exec('CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,applied_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)');
 for(let i=0;i<base.length;i++){
  baseline.exec(readFileSync(new URL(base[i],sqlDir),'utf8'));
  baseline.prepare('INSERT INTO d1_migrations(id,name) VALUES (?,?)').run(i+1,base[i]);
 }
 baseline.exec(readFileSync(new URL('./adapters/independent-live/drizzle/'+addon,import.meta.url),'utf8'));
 baseline.prepare('INSERT INTO d1_migrations(id,name) VALUES (26,?)').run(addon);
 okay(baseline.prepare('SELECT COUNT(*) AS n FROM d1_migrations').get().n===26,
  'actual 25-plus-independent-#0025 source SQL and applied journal');
 okay(baseline.prepare("SELECT seq FROM sqlite_sequence WHERE name='d1_migrations'").get().seq===26,
  'actual migration journal AUTOINCREMENT high-water is 26');
 baseline.close();
 await copyFile(template,source);
 const synthetic=new DatabaseSync(source);
 synthetic.exec('PRAGMA foreign_keys=ON');
 synthetic.prepare('INSERT INTO customers(id,name,created_at) VALUES (?,?,?)')
  .run('synthetic-first-customer','Synthetic','2026-11-13T00:00:00Z');
 synthetic.prepare('UPDATE customers SET email=? WHERE id=?')
  .run('synthetic-owner@example.invalid','synthetic-first-customer');
 synthetic.prepare('INSERT INTO fire_customer_numbers(customer_id,created_at) VALUES (?,?)')
  .run('synthetic-first-customer','2026-11-13T00:00:00Z');
 // Exercise actual daily FIRE work records, not only numbering table shape.
 // All synthetic: one signed-workflow-shaped estimate, Job #0001, one paid
 // balance, and a smaller associated refund with its required journal row.
 synthetic.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at) VALUES (?,?,'completed',3000,0,3000,1500,?)")
  .run('synthetic-first-job','synthetic-first-customer','2026-11-13T00:01:00Z');
 synthetic.prepare('INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES (?,?)')
  .run('synthetic-first-job','2026-11-13T00:01:00Z');
 synthetic.prepare('INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES (?,?)')
  .run('synthetic-first-job',1);
 synthetic.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES (?,?,'Balance',3000,'paid',?,?)")
  .run('synthetic-paid','synthetic-first-job','manual:synthetic-paid','2026-11-13T00:02:00Z');
 synthetic.prepare("INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at) VALUES (?,?,'Refund',-500,'paid',?,?)")
  .run('synthetic-refund-ledger','synthetic-first-job','refund:synthetic-paid:synthetic-refund','2026-11-13T00:03:00Z');
 synthetic.prepare("INSERT INTO payment_refunds(id,payment_id,estimate_id,amount_cents,mode,status,created_at) VALUES (?,?,?,500,'manual','succeeded',?)")
  .run('synthetic-refund','synthetic-paid','synthetic-first-job','2026-11-13T00:03:00Z');
 okay(synthetic.prepare('SELECT customer_number AS n FROM fire_customer_numbers').get().n===1,
  'source real-numbering schema allocated Customer #0001');
 okay(synthetic.prepare('SELECT job_number AS n FROM fire_job_numbers').get().n===1,
  'source real-numbering schema allocated first Job #0001');
 synthetic.close();
 const archived=await exportCompleteIsolatedSqliteSnapshot(source,core,supp);
 const saved=JSON.parse(await readFile(supp,'utf8'));
 const savedCore=JSON.parse(await readFile(core,'utf8'));
 okay(archived.coreAndSupplementalArchivesWritten&&saved.rowCounts.d1_migrations===26,
  'full local records archive includes 26 applied migrations');
 okay(saved.sqliteSequence.d1_migrations===26,
  'migration high-water captured without provider writes');

 const result=await restoreNumberedRecordsToIsolatedSqlite(core,template,recovered,supp);
 okay(result.sqliteRestoreVerified===true&&result.existingD1MigrationRowsVerified===26,
  'real migrated target preserves and verifies existing 26-row journal');
 okay(result.supplementalRowsRestored===0&&result.providerD1Restored===false,
  'migration journal not counted as restored business rows or provider action');
 const verified=new DatabaseSync(recovered,{readOnly:true});
 okay(verified.prepare('SELECT customer_number AS n FROM fire_customer_numbers').get().n===1,
  'exact permanent Customer #0001 actually restored');
 okay(verified.prepare('SELECT name FROM customers').get().name==='Synthetic',
  'real customer row restored into migrated schema');
 okay(verified.prepare('SELECT email FROM customers').get().email==='synthetic-owner@example.invalid',
  'customer contact information survives the complete restore exactly');
 okay(verified.prepare("SELECT job_number AS n FROM fire_job_estimate_links WHERE estimate_id='synthetic-first-job'").get().n===1,
  'actual job relationship preserved with Job #0001');
 okay(verified.prepare("SELECT amount_cents AS n FROM payments WHERE id='synthetic-paid'").get().n===3000,
  'paid synthetic $30 balance preserved exactly in cents');
 okay(verified.prepare("SELECT amount_cents AS n FROM payments WHERE id='synthetic-refund-ledger'").get().n===-500,
  'negative synthetic $5 refund ledger preserved exactly');
 okay(verified.prepare("SELECT amount_cents AS n FROM payment_refunds WHERE id='synthetic-refund'").get().n===500,
  'actual refund journal still reconciles to the negative payment entry');
 const sourceJournal=new DatabaseSync(template,{readOnly:true});
 const rows=db=>db.prepare('SELECT * FROM d1_migrations ORDER BY id').all();
 okay(JSON.stringify(rows(verified))===JSON.stringify(rows(sourceJournal)),
  'all existing migration rows identical including applied timestamps');
 okay(verified.prepare("SELECT seq FROM sqlite_sequence WHERE name='d1_migrations'").get().seq===26,
  'D1 journal high-water unchanged; no INSERT into existing provider history');
 okay(verified.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_customer_numbers'").get().seq===1,
  'permanent customer allocation history preserved');
 okay(verified.prepare('PRAGMA foreign_key_check').all().length===0,
  'recovered actual 26-migration schema has no FK violations');
 verified.close();sourceJournal.close();
 // A successful recovery must continue issuing new permanent Job numbers,
 // never restarting at #0001 and never replaying deleted legacy counters.
 const resumed=new DatabaseSync(recovered);
 resumed.exec('PRAGMA foreign_keys=ON');
 resumed.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,discount_cents,total_cents,deposit_cents,created_at) VALUES (?,?,'draft',2000,0,2000,1000,?)")
  .run('synthetic-second-job','synthetic-first-customer','2026-11-13T00:05:00Z');
 resumed.prepare('INSERT INTO fire_job_numbers(root_estimate_id,created_at) VALUES (?,?)')
  .run('synthetic-second-job','2026-11-13T00:05:00Z');
 okay(resumed.prepare("SELECT job_number AS n FROM fire_job_numbers WHERE root_estimate_id='synthetic-second-job'").get().n===2,
  'after isolated restore a genuinely new estimate allocates Job #0002');
 resumed.close();

 const mismatched=join(folder,'mismatched-journal-template.sqlite');
 await copyFile(template,mismatched);
 const badTarget=new DatabaseSync(mismatched);
 badTarget.exec("UPDATE d1_migrations SET name='0018_refunds_replaced.sql' WHERE id=19");
 badTarget.close();
 await reject(join(folder,'reject-forged-destination.sqlite'),core,mismatched,supp,
  'destination with substituted refund migration must reject before customer restore');

 const lostJournal=join(folder,'missing-journal-row.sqlite');
 await copyFile(template,lostJournal);
 const missing=new DatabaseSync(lostJournal);
 missing.exec('DELETE FROM d1_migrations WHERE id=26');
 missing.close();
 await reject(join(folder,'reject-25-of-26.sqlite'),core,lostJournal,supp,
  'real schema with missing applied 26th D1 journal cannot recover');

 const changedWater=join(folder,'modified-journal-highwater.sqlite');
 await copyFile(template,changedWater);
 const altered=new DatabaseSync(changedWater);
 altered.exec("INSERT INTO d1_migrations(id,name) VALUES (27,'0026_fake.sql'); DELETE FROM d1_migrations WHERE id=27");
 altered.close();
 await reject(join(folder,'reject-journal-highwater.sqlite'),core,changedWater,supp,
  'same migration rows but modified serial high-water must reject');

 // Earlier core restore code accepted source records with missing valid
 // database columns; an absent email could silently restore as NULL and
 // pass by comparing only the surviving archived keys. Fail closed.
 const truncatedCore=structuredClone(savedCore);
 delete truncatedCore.tables.customers[0].email;
 const truncatedCoreFile=join(folder,'truncated-customer-core.json');
 await writeFile(truncatedCoreFile,JSON.stringify(truncatedCore));
 await reject(join(folder,'reject-missing-customer-email.sqlite'),truncatedCoreFile,template,supp,
  'missing saved core customer contact field must never restore as NULL');
 const truncatedPayment=structuredClone(savedCore);
 delete truncatedPayment.tables.payments[1].provider_id;
 const truncatedPaymentFile=join(folder,'truncated-payment-core.json');
 await writeFile(truncatedPaymentFile,JSON.stringify(truncatedPayment));
 await reject(join(folder,'reject-missing-payment-reference.sqlite'),truncatedPaymentFile,template,supp,
  'missing core refund ledger provider reference cannot be silently blanked');

 const forged=structuredClone(saved);
 forged.tables.d1_migrations[18].name='0018_fake_refunds.sql';
 const forgedFile=join(folder,'forged-source-journal.json');
 await writeFile(forgedFile,JSON.stringify(forged));
 await reject(join(folder,'reject-forged-source.sqlite'),core,template,forgedFile,
  'forged original 25 migration source cannot be restored');

 const emptyJournal=join(folder,'empty-journal-template.sqlite');
 await copyFile(template,emptyJournal);
 const cleared=new DatabaseSync(emptyJournal);
 cleared.exec('DELETE FROM d1_migrations');
 cleared.close();
 await reject(join(folder,'reject-unmigrated-journal.sqlite'),core,emptyJournal,supp,
  'empty journal with schema copied must not be presented as applied migrations');

 const occupied=join(folder,'occupied-template.sqlite');
 await copyFile(source,occupied);
 await reject(join(folder,'reject-existing-business.sqlite'),core,occupied,supp,
  'nonempty customer destination must remain non-destructive');
 console.log('PASS '+checks+'/'+checks+' real 26-migration independent SQLite schema offline customer backup/restore and immutable migration-journal provenance checks; zero provider writes.');
}finally{
 await rm(folder,{recursive:true,force:true});
}
