/** Prove a FULL real 26-migration independent release SQLite schema can recover
 * synthetic customer records without rewriting or inventing its D1 history.
 * No provider, owner files, real business records or Cloudflare operations.
 * node --experimental-sqlite business-app-parity/test_migrated_d1_journal_recovery.mjs
 */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFileSync,readdirSync} from 'node:fs';
import {mkdtemp,copyFile,readFile,writeFile,rm,access,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS} from './shared/lib/new-live-migration-journal.mjs';
import {exportCompleteIsolatedSqliteSnapshot} from './export_complete_isolated_sqlite_snapshot.mjs';
import {restoreNumberedRecordsToIsolatedSqlite} from './restore_numbered_records_to_isolated_sqlite.mjs';
import {sealCompleteIsolatedSqliteSnapshot,restoreSavedProtectedCompleteRecords,inspectSavedProtectedCompleteRecords}
 from './protected_complete_isolated_sqlite_recovery.mjs';
import {protectOfflinePhotoZip} from './shared/lib/protected-offline-photo-archive.mjs';
import {rehearseProtectedCompleteRecordsAndPhotos}
 from './rehearse_protected_complete_records_and_photos.mjs';

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
// A tiny synthetically generated QA-master gallery ZIP, not a real photo.
// Uses the SAME ZIP local descriptors, central-directory and SHA-256 format
// that the deployed app's existing protected photo verifier requires.
function makeStoredPhotoZip(customerId){
 const photoId='synthetic-photo-001',bytes=Buffer.from([0xff,0xd8,0xff,0xd9,1,2,3,4]);
 const hash=createHash('sha256').update(bytes).digest('hex');
 const manifest={format:'fire-offline-photo-vault',version:1,
  exportedAt:'2026-11-13T12:01:00.000Z',requiresMatchingCustomerRecords:true,
  photos:[{id:photoId,customerId,category:'before',caption:'synthetic bytes only',
   filename:'synthetic.jpg',contentType:'image/jpeg',sizeBytes:bytes.length,
   createdAt:'2026-11-13T12:00:00.000Z',sha256:hash}]};
 const parts=[['photos/'+photoId,bytes],['manifest.json',Buffer.from(JSON.stringify(manifest))]];
 const head=(n,write)=>{const out=Buffer.alloc(n);write(out);return out;};
 const crc32=data=>{
  let crc=0xffffffff;
  for(const byte of data){
   crc^=byte;
   for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
 };
 const locals=[],centrals=[];let offset=0;
 for(const [name,data] of parts){
  const filename=Buffer.from(name,'utf8'),crc=crc32(data),localAt=offset;
  const local=head(30,h=>{h.writeUInt32LE(0x04034b50,0);
   h.writeUInt16LE(20,4);h.writeUInt16LE(0x0808,6);h.writeUInt16LE(filename.length,26);});
  const descriptor=head(16,d=>{d.writeUInt32LE(0x08074b50,0);d.writeUInt32LE(crc,4);
   d.writeUInt32LE(data.length,8);d.writeUInt32LE(data.length,12);});
  locals.push(local,filename,data,descriptor);
  offset+=local.length+filename.length+data.length+descriptor.length;
  const central=head(46,h=>{h.writeUInt32LE(0x02014b50,0);
   h.writeUInt16LE(20,4);h.writeUInt16LE(20,6);h.writeUInt16LE(0x0808,8);
   h.writeUInt32LE(crc,16);h.writeUInt32LE(data.length,20);
   h.writeUInt32LE(data.length,24);h.writeUInt16LE(filename.length,28);
   h.writeUInt32LE(localAt,42);});
  centrals.push(central,filename);
 }
 const centralBytes=centrals.reduce((n,data)=>n+data.length,0);
 const ending=head(22,h=>{h.writeUInt32LE(0x06054b50,0);
  h.writeUInt16LE(parts.length,8);h.writeUInt16LE(parts.length,10);
  h.writeUInt32LE(centralBytes,12);h.writeUInt32LE(offset,16);});
 return Buffer.concat([...locals,...centrals,ending]);
}
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

 // Real independent DR cannot reuse LIVE's migration clock: execute the
 // approved 25+1 SQL migrations in a distinct synthetic physical SQLite file
 // and record a DIFFERENT legitimate migration-applied timestamp per row.
 const independentTemplate=join(folder,'independent-dr-26-migrated.sqlite');
 const dr=new DatabaseSync(independentTemplate);
 dr.exec('PRAGMA foreign_keys=ON');
 dr.exec('CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,applied_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL)');
 for(let i=0;i<base.length;i++){
  dr.exec(readFileSync(new URL(base[i],sqlDir),'utf8'));
  dr.prepare('INSERT INTO d1_migrations(id,name,applied_at) VALUES (?,?,?)')
   .run(i+1,base[i],'2026-11-14 09:45:00');
 }
 dr.exec(readFileSync(new URL('./adapters/independent-dr/drizzle/'+addon,import.meta.url),'utf8'));
 dr.prepare('INSERT INTO d1_migrations(id,name,applied_at) VALUES (?,?,?)')
  .run(26,addon,'2026-11-14 09:45:00');
 const targetBefore=dr.prepare('SELECT * FROM d1_migrations ORDER BY id').all();
 okay(targetBefore.length===26&&targetBefore[0].applied_at!==saved.tables.d1_migrations[0].applied_at,
  'separately migrated DR has its own valid provider-local migration time');
 dr.close();
 const result=await restoreNumberedRecordsToIsolatedSqlite(core,independentTemplate,recovered,supp);
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
 const sourceJournal=new DatabaseSync(independentTemplate,{readOnly:true});
 const rows=db=>db.prepare('SELECT * FROM d1_migrations ORDER BY id').all();
 okay(JSON.stringify(rows(verified))===JSON.stringify(rows(sourceJournal)),
  'restored DR preserves ITS OWN applied times rather than rewriting them to LIVE timestamps');
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

 // The new no-paid encrypted full-record archive must independently export
 // directly from SQLite without creating any plaintext JSON intermediary.
 // Restore it into a separately migrated DR, preserving that DR's own journal.
 const phrase='FIRE synthetic strong local recovery passphrase November 2026';
 const protectedFile=join(folder,'complete-private.firerecords');
 const protectedRecovered=join(folder,'recovered-from-protected.sqlite');
 const sealed=await sealCompleteIsolatedSqliteSnapshot(source,protectedFile,phrase);
 okay(sealed.encryptedRecordsArchiveCreated===true&&
      sealed.savedEncryptedFileReadBack===true&&sealed.plaintextJsonFilesWritten===false,
  'direct complete SQLite snapshot is AES-GCM protected without writing plain records JSON');
 const ciphertext=await readFile(protectedFile);
 okay(ciphertext.subarray(0,8).toString('ascii')==='FIRERB01'&&
      !ciphertext.includes(Buffer.from('synthetic-owner@example.invalid'))&&
      !ciphertext.includes(Buffer.from('synthetic-first-job')),
  'saved private archive contains authenticated ciphertext, not visible customer/job data');
 okay(((await stat(protectedFile)).mode&0o777)===0o600,
  'saved full-record backup is owner-only mode 0600');
 const unlocked=await inspectSavedProtectedCompleteRecords(protectedFile,phrase);
 okay(unlocked.core.tables.customers[0].email==='synthetic-owner@example.invalid'&&
      unlocked.supplemental.rowCounts.d1_migrations===26,
  'verified saved encrypted file unseals complete customer and migration data only in memory');
 const privatelyRestored=await restoreSavedProtectedCompleteRecords(
  protectedFile,independentTemplate,protectedRecovered,phrase);
 okay(privatelyRestored.sqliteRestoreVerified&&
      privatelyRestored.existingD1MigrationRowsVerified===26&&
      privatelyRestored.plaintextJsonFilesWritten===false,
  'encrypted full records restore directly into independent 26-migration DR');
 const privateDb=new DatabaseSync(protectedRecovered);
 okay(privateDb.prepare("SELECT customer_number AS n FROM fire_customer_numbers").get().n===1&&
      privateDb.prepare("SELECT job_number AS n FROM fire_job_numbers").get().n===1&&
      privateDb.prepare("SELECT amount_cents AS n FROM payment_refunds").get().n===500,
  'encrypted full-record restore preserves Customer #, Job # and signed $5 refund journal');
 okay(JSON.stringify(privateDb.prepare('SELECT * FROM d1_migrations ORDER BY id').all())===
      JSON.stringify(targetBefore),
  'encrypted restore keeps native DR migration timestamps and serial lineage');
 privateDb.close();
 const encryptedBadPassword=join(folder,'reject-wrong-secret.sqlite');
 await assert.rejects(restoreSavedProtectedCompleteRecords(
  protectedFile,independentTemplate,encryptedBadPassword,'totally different recovery password 2026'),
  /BLOCKED|blocked/i);
 await assert.rejects(access(encryptedBadPassword));
 checks++;
 const damagedProtected=join(folder,'tampered.firerecords');
 const forgedCiphertext=Buffer.from(ciphertext);
 forgedCiphertext[forgedCiphertext.length-1]^=1;
 await writeFile(damagedProtected,forgedCiphertext);
 const encryptedTamperedOutput=join(folder,'reject-altered-secret.sqlite');
 await assert.rejects(restoreSavedProtectedCompleteRecords(
  damagedProtected,independentTemplate,encryptedTamperedOutput,phrase),/BLOCKED|blocked/i);
 await assert.rejects(access(encryptedTamperedOutput));
 checks++;
 await assert.rejects(sealCompleteIsolatedSqliteSnapshot(source,protectedFile,phrase),
  /EEXIST|already exists|file exists/i,
  'full private backup must never overwrite previously saved ciphertext');
 checks++;
 // Recover two separately authenticated SAVED files in one local command.
 // The database must disappear if any photo/customer proof fails.
 const photoPhrase='FIRE synthetic distinct photo recovery phrase 2026';
 const galleryZip=makeStoredPhotoZip('synthetic-first-customer');
 const protectedPhotoFile=join(folder,'saved-photos.firephotos');
 const galleryCipher=await protectOfflinePhotoZip(new Blob([galleryZip]),photoPhrase);
 await writeFile(protectedPhotoFile,Buffer.from(await galleryCipher.arrayBuffer()));
 const pairDb=join(folder,'paired-restored.sqlite'),pairZip=join(folder,'paired-gallery.zip');
 const paired=await rehearseProtectedCompleteRecordsAndPhotos(
  protectedFile,independentTemplate,protectedPhotoFile,pairDb,pairZip,
  phrase,photoPhrase,{approved:true});
 okay(paired.pairedEncryptedInputsReadBack&&paired.recoveredPhotoCount===1&&
      paired.recoveredCustomerRows===1&&paired.recoveredJobNumberRows===1&&
      paired.existingMigrationRowsPreserved===26&&
      paired.plaintextJsonIntermediatesWritten===false&&paired.remoteWritesPerformed===false,
  'one authorized call restores BOTH encrypted full records and encrypted photo gallery');
 okay((await readFile(pairZip)).equals(galleryZip),
  'encrypted saved original-photo ZIP bytes survive recovered private gallery exactly');
 const pairedDb=new DatabaseSync(pairDb,{readOnly:true});
 okay(pairedDb.prepare('SELECT job_number AS n FROM fire_job_numbers').get().n===1&&
      pairedDb.prepare('SELECT amount_cents AS n FROM payment_refunds').get().n===500,
  'paired recovery contains actual immutable Job #0001 and paid/refund ledger');
 pairedDb.close();

 // Exercise actual owner-facing CLI: use stdin secrets and the newly saved
 // encrypted files, not only exported JS helpers. Never pass phrases in args.
 const cliDb=join(folder,'cli-restored.sqlite'),cliZip=join(folder,'cli-gallery.zip');
 const cliScript=fileURLToPath(new URL('./rehearse_protected_complete_records_and_photos.mjs',import.meta.url));
 const cli=spawnSync(process.execPath,[
  '--experimental-sqlite',cliScript,protectedFile,independentTemplate,protectedPhotoFile,
  cliDb,cliZip,'--allow-private-recovery'
 ],{input:phrase+'\n'+photoPhrase+'\n',encoding:'utf8',timeout:20000});
 okay(cli.status===0&&cli.error===undefined,
  'actual two-password CLI reads stdin and restores protected records plus photos');
 okay((await readFile(cliZip)).equals(galleryZip)&&
      JSON.parse(cli.stdout).localSqliteAndPhotoZipRecovered===true,
  'actual CLI creates the exact independently checked protected recovery pair');
 const cliDbOpened=new DatabaseSync(cliDb,{readOnly:true});
 okay(cliDbOpened.prepare('SELECT COUNT(*) AS n FROM d1_migrations').get().n===26&&
      cliDbOpened.prepare('SELECT customer_number AS n FROM fire_customer_numbers').get().n===1,
  'actual CLI preserved independent DR migration lineage and customer #0001');
 cliDbOpened.close();

 const wrongPairDb=join(folder,'wrong-photo-phrase.sqlite');
 const wrongPairZip=join(folder,'wrong-photo-phrase.zip');
 await assert.rejects(rehearseProtectedCompleteRecordsAndPhotos(
  protectedFile,independentTemplate,protectedPhotoFile,wrongPairDb,wrongPairZip,
  phrase,'FIRE synthetic INCORRECT photo phrase 2026',{approved:true}),/BLOCKED|blocked|damaged/i);
 await assert.rejects(access(wrongPairDb));
 await assert.rejects(access(wrongPairZip));
 checks++;

 const orphanPhotoFile=join(folder,'orphan-photos.firephotos');
 const orphanBytes=await protectOfflinePhotoZip(new Blob([
  makeStoredPhotoZip('unrelated-orphan-customer')
 ]),photoPhrase);
 await writeFile(orphanPhotoFile,Buffer.from(await orphanBytes.arrayBuffer()));
 const orphanDb=join(folder,'orphan-photos.sqlite'),orphanZip=join(folder,'orphan-photos.zip');
 await assert.rejects(rehearseProtectedCompleteRecordsAndPhotos(
  protectedFile,independentTemplate,orphanPhotoFile,orphanDb,orphanZip,
  phrase,photoPhrase,{approved:true}),/BLOCKED|blocked|customer/i);
 await assert.rejects(access(orphanDb));
 await assert.rejects(access(orphanZip));
 checks++;

 const damagedPhotoFile=join(folder,'damaged-photos.firephotos');
 const damagedPhotoBytes=Buffer.from(await readFile(protectedPhotoFile));
 damagedPhotoBytes[damagedPhotoBytes.length-1]^=1;
 await writeFile(damagedPhotoFile,damagedPhotoBytes);
 const damagedPairDb=join(folder,'damaged-photo-pair.sqlite');
 const damagedPairZip=join(folder,'damaged-photo-pair.zip');
 await assert.rejects(rehearseProtectedCompleteRecordsAndPhotos(
  protectedFile,independentTemplate,damagedPhotoFile,damagedPairDb,damagedPairZip,
  phrase,photoPhrase,{approved:true}),/BLOCKED|blocked|damaged/i);
 await assert.rejects(access(damagedPairDb));
 await assert.rejects(access(damagedPairZip));
 checks++;

 const unapprovedPairDb=join(folder,'no-approval.sqlite');
 await assert.rejects(rehearseProtectedCompleteRecordsAndPhotos(
  protectedFile,independentTemplate,protectedPhotoFile,unapprovedPairDb,
  join(folder,'no-approval.zip'),phrase,photoPhrase),/BLOCKED|blocked/i);
 await assert.rejects(access(unapprovedPairDb));
 checks++;

 const differentDrClock=join(folder,'dr-bad-applied-time.sqlite');
 await copyFile(independentTemplate,differentDrClock);
 const invalidClock=new DatabaseSync(differentDrClock);
 invalidClock.exec("UPDATE d1_migrations SET applied_at='not-a-valid-date' WHERE id=4");
 invalidClock.close();
 await reject(join(folder,'reject-invalid-dr-clock.sqlite'),core,differentDrClock,supp,
  'malformed independent DR provider timestamp cannot be silently accepted');
 const corruptedSource=structuredClone(saved);
 corruptedSource.tables.d1_migrations[4].applied_at='nonsense-time';
 const corruptSrc=join(folder,'forged-migration-clock.json');
 await writeFile(corruptSrc,JSON.stringify(corruptedSource));
 await reject(join(folder,'reject-invalid-source-clock.sqlite'),core,independentTemplate,corruptSrc,
  'unreadable source provider timestamp cannot impersonate legitimate migration metadata');

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
