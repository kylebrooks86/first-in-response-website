/** Gate7 changed functionality ONLY: synthetic full 26-migration independent
 * NEW LIVE D1 -> reviewed transactional complete D1 -> browser AES-GCM
 * FIRERB01 .firerecords -> existing Node PRIVATE ISOLATED SQLite restore.
 * No remote D1, Stripe, owner files, credentials, Cloudflare, photos or deploy.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {protectOfflinePhotoZip} from '../lib/protected-offline-photo-archive.mjs';
import {prepareBrowserProtectedPairReceipt,verifySelectedBrowserProtectedPairReceipt}
 from '../lib/protected-pair-owner-custody.mjs';
import {inspectStoredFirePhotoZip} from '../../verify_saved_protected_photo_backup.mjs';
import {inspectSavedProtectedPairReceipt} from '../../protected_recovery_pair_receipt.mjs';
import {rehearseProtectedCompleteRecordsAndPhotos}
 from '../../rehearse_protected_complete_records_and_photos.mjs';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,writeFileSync,copyFileSync,rmSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {captureCompleteReviewedD1RecordsReadOnly}
 from '../lib/complete-d1-records-review.mjs';
import {prepareCompleteD1OwnerFile,verifySelectedSavedCompleteD1OwnerFile,
 protectCompleteReviewedD1Records}
 from '../lib/protected-complete-d1-records.mjs';
import {restoreSavedProtectedCompleteRecords}
 from '../../protected_complete_isolated_sqlite_recovery.mjs';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS}
 from '../lib/new-live-migration-journal.mjs';
const base='../adapters/doomsday/drizzle';
const migrationNames=readdirSync(base).filter(x=>/^[0-9]{4}_.+\.sql$/.test(x)).sort();
assert.equal(migrationNames.length,25);
assert.deepEqual(migrationNames,EXPECTED_NEW_LIVE_D1_MIGRATIONS.slice(0,25));
const fullSql=readFileSync('../adapters/independent-live/drizzle/0025_independent_permanent_numbers.sql','utf8');
const dir=mkdtempSync(join(tmpdir(),'fire-full-26-synthetic-'));
const template=join(dir,'empty_26.sqlite'),source=join(dir,'source_26.sqlite'),
 output=join(dir,'restored_26.sqlite'),protectedFile=join(dir,'browser_26.firerecords');
const date='2026-11-15T12:00:00.000Z';
const phrase='synthetic only FIRE complete 26 migration offline restore';
const sha=x=>createHash('sha256').update(x).digest('hex');
const crc32=bytes=>{
 let crc=0xffffffff;
 for(const b of bytes){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
};
const hdr=(size,fill)=>{const b=Buffer.alloc(size);fill(b);return b;};
/** Byte-for-byte format of existing FIRE stored/uncompressed photo ZIP writer.
 * The offline verifier independently checks central directory, CRC32,
 * data descriptor, photo manifest and original SHA256, not our test code.
 */
function storedPhotoZip(parts){
 const local=[],central=[];let offset=0;
 for(const [name,raw] of parts){
  const filename=Buffer.from(name,'utf8'),data=Buffer.from(raw);
  const crc=crc32(data),start=offset;
  const h=hdr(30,b=>{b.writeUInt32LE(0x04034b50,0);b.writeUInt16LE(20,4);
   b.writeUInt16LE(0x0808,6);b.writeUInt16LE(filename.length,26);});
  const desc=hdr(16,b=>{b.writeUInt32LE(0x08074b50,0);
   b.writeUInt32LE(crc,4);b.writeUInt32LE(data.length,8);b.writeUInt32LE(data.length,12);});
  local.push(h,filename,data,desc);
  offset+=h.length+filename.length+data.length+desc.length;
  const c=hdr(46,b=>{b.writeUInt32LE(0x02014b50,0);b.writeUInt16LE(20,4);
   b.writeUInt16LE(20,6);b.writeUInt16LE(0x0808,8);b.writeUInt32LE(crc,16);
   b.writeUInt32LE(data.length,20);b.writeUInt32LE(data.length,24);
   b.writeUInt16LE(filename.length,28);b.writeUInt32LE(start,42);});
  central.push(c,filename);
 }
 const length=central.reduce((n,b)=>n+b.length,0);
 const end=hdr(22,b=>{b.writeUInt32LE(0x06054b50,0);
  b.writeUInt16LE(parts.length,8);b.writeUInt16LE(parts.length,10);
  b.writeUInt32LE(length,12);b.writeUInt32LE(offset,16);});
 return Buffer.concat([...local,...central,end]);
}
const verifiedOriginalPhotos=async zip=>
 inspectStoredFirePhotoZip(Buffer.from(await zip.arrayBuffer()),
  {includeVerifiedPhotoItems:true}).verifiedPhotoItems;
let checks=0;
const ok=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
try{
 const db=new DatabaseSync(template);
 for(const name of migrationNames)db.exec(readFileSync(base+'/'+name,'utf8'));
 db.exec('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE)');
 const insert=db.prepare('INSERT INTO d1_migrations(name) VALUES (?)');
 for(const name of migrationNames)insert.run(name);
 db.exec(fullSql);
 insert.run('0025_independent_permanent_numbers.sql');
 ok(db.prepare('SELECT COUNT(*) AS n FROM d1_migrations').get().n,26,
  'the actual source-frozen 26 reviewed migrations were applied ONLY in disposable SQLite');
 ok(db.prepare('SELECT COUNT(*) AS n FROM customers').get().n,0,
  'independent NEW LIVE source template begins empty');
 ok(db.prepare('SELECT COUNT(*) AS n FROM fire_job_numbers').get().n,0,
  'Job #0001 remains available before any synthetic data is inserted');
 db.close();
 copyFileSync(template,source);
 const src=new DatabaseSync(source);
 src.exec('PRAGMA foreign_keys=ON');
 src.prepare('INSERT INTO customers(id,name,created_at) VALUES (?,?,?)').run(
  'synthetic-full-26-customer','Synthetic NEW LIVE Restore',date);
 src.prepare("INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at) VALUES (?,?,'draft',10000,10000,5000,?)").run(
  'synthetic-full-26-estimate','synthetic-full-26-customer',date);
 src.prepare('INSERT INTO fire_customer_numbers(customer_number,customer_id,created_at) VALUES (?,?,?)').run(
  1,'synthetic-full-26-customer',date);
 src.prepare('INSERT INTO fire_job_numbers(job_number,root_estimate_id,created_at) VALUES (?,?,?)').run(
  1,'synthetic-full-26-estimate',date);
 src.prepare('INSERT INTO fire_job_estimate_links(estimate_id,job_number) VALUES (?,?)').run(
  'synthetic-full-26-estimate',1);
 let reads=0,writes=0,batches=0;
 const d1={
  prepare(sql){
   if(!/^(SELECT\b|PRAGMA table_xinfo\()/i.test(sql)){writes++;throw Error('unsafe D1 source query');}
   reads++;return {sql,values:[],bind(...values){return{sql,values}}};
  },
  async batch(stmts){
   batches++;src.exec('BEGIN');let out;
   try{out=stmts.map(x=>({success:true,results:src.prepare(x.sql).all(...x.values)}));
    src.exec('COMMIT');return out;
   }catch(e){src.exec('ROLLBACK');throw e;}
  }
 };
 const review=await captureCompleteReviewedD1RecordsReadOnly(d1);
 ok(batches,1,'all 26 migration and app record data captured in one transactional D1 batch');
 assert.ok(reads>50,'complete Free-tier batch includes all supplemental tables');checks++;
 ok(writes,0,'source D1 queries never mutate financial or customer data');
 ok(review.supplemental.tables.d1_migrations.length,26,'full source review preserves 26 applied migrations');
 ok(review.core.highWater.job,1,'synthetic first job permanently numbered 0001');
 ok(review.photoBytesIncluded,false,'database-only backup never claims customer photo bytes');
 const prepared=await prepareCompleteD1OwnerFile(review,phrase,phrase);
 writeFileSync(protectedFile,Buffer.from(await prepared.blob.arrayBuffer()),{mode:0o600,flag:'wx'});
 const saved=new Blob([readFileSync(protectedFile)]);
 const confirmed=await verifySelectedSavedCompleteD1OwnerFile(prepared,saved,phrase);
 ok(confirmed.selectedCiphertextIdentical,true,'saved independent FIRECD browser encrypted file byte-identical');
 ok(confirmed.migrationCount,26,'browser decrypted saved file retains actual 26 migration journal');
 src.close();
 const restored=await restoreSavedProtectedCompleteRecords(protectedFile,template,output,phrase);
 ok(restored.sqliteRestoreVerified,true,'existing Node offline engine physically restored browser full-record file');
 ok(restored.existingD1MigrationRowsVerified,26,'recovery preserved existing destination 26-migration journal');
 ok(restored.photosRestored,false,'isolation restore never claims original customer photos restored');
 const recovered=new DatabaseSync(output,{readOnly:true});
 ok(recovered.prepare('SELECT COUNT(*) AS n FROM customers').get().n,1,'original customer records physically recovered');
 ok(recovered.prepare('SELECT job_number AS n FROM fire_job_numbers').get().n,1,'future first job preserves number 0001');
 ok(recovered.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_job_numbers'").get().seq,1,
  'next Job # allocation cannot reuse restored 0001');
 ok(recovered.prepare('SELECT COUNT(*) AS n FROM d1_migrations').get().n,26,
  'restored physical D1 migration journal is exactly complete');
 recovered.close();
 // FULL paired offline recovery: owner-selected original protected photo bytes
 // + browser-written complete FIRERB01 + portable saved .firepair receipt.
 // This closes a source-only integration gap; it does not touch hosted D1.
 const photoPhrase='synthetic only FIRE original photos phrase 2026';
 const photoPath=join(dir,'saved_original.firephotos'),pairPath=join(dir,'saved_pair.firepair');
 const pairedDb=join(dir,'paired_restored_26.sqlite'),pairedZip=join(dir,'paired_restored_photos.zip');
 const photoId='synthetic-photo-26',photoBytes=Buffer.from([0xff,0xd8,0xff,0xd9,6,2,0,1]);
 const meta={id:photoId,customerId:'synthetic-full-26-customer',
  category:'before',caption:'fake synthetic image bytes, no owner photos',
  filename:'synthetic.jpg',contentType:'image/jpeg',sizeBytes:photoBytes.length,
  createdAt:date,sha256:sha(photoBytes)};
 const manifest=metaRows=>({format:'fire-offline-photo-vault',version:1,
  exportedAt:date,requiresMatchingCustomerRecords:true,photos:metaRows});
 const makePhotoZip=metaRows=>storedPhotoZip([
  ['photos/'+photoId,photoBytes],
  ['manifest.json',Buffer.from(JSON.stringify(manifest(metaRows)))]
 ]);
 const protectedPhotos=await protectOfflinePhotoZip(new Blob([makePhotoZip([meta])]),photoPhrase);
 writeFileSync(photoPath,Buffer.from(await protectedPhotos.arrayBuffer()),{mode:0o600,flag:'wx'});
 const selectedPhoto=new Blob([readFileSync(photoPath)]);
 const browserPair=await prepareBrowserProtectedPairReceipt(
  saved,phrase,selectedPhoto,photoPhrase,verifiedOriginalPhotos,new Date(date));
 ok(browserPair.verifiedRecordsAndPhotoOwnership,true,
  'browser paired the exact authenticated source customers and original verified photo bytes');
 ok(browserPair.sourcePhotos,1,'paired original-photo archive contains one verified synthetic image');
 ok(browserPair.sourceMigrationCount,26,'paired records preserve independent NEW LIVE migration journal');
 ok(browserPair.gate7Accepted,false,'matching encrypted files never claim provider custody or Gate7 closure');
 writeFileSync(pairPath,Buffer.from(await browserPair.blob.arrayBuffer()),{mode:0o600,flag:'wx'});
 const savedPair=new Blob([readFileSync(pairPath)]);
 const ownerPair=await verifySelectedBrowserProtectedPairReceipt(browserPair,savedPair);
 ok(ownerPair.exactSavedPairReceiptVerified,true,'owner-reselected .firepair matches both original encrypted sources');
 ok(ownerPair.offDeviceCustodyVerified,false,'local readback cannot falsely certify off-device ownership');
 const nodePair=await inspectSavedProtectedPairReceipt(pairPath,protectedFile,photoPath);
 ok(nodePair.exactSavedEncryptedPairVerified,true,
  'EXISTING Node receipt verifier accepts exact browser-produced portable .firepair');
 ok(nodePair.protectedRecordsSha256,browserPair.receipt.recordsSha256,
  'browser and existing Node pair tool hash EXACT same saved encrypted records');
 ok(nodePair.protectedPhotosSha256,browserPair.receipt.photosSha256,
  'browser and Node pair tool hash EXACT same saved encrypted photo archive');
 const both=await rehearseProtectedCompleteRecordsAndPhotos(
  protectedFile,template,photoPath,pairedDb,pairedZip,
  phrase,photoPhrase,{approved:true,pairReceiptPath:pairPath});
 ok(both.pairedEncryptedInputsReadBack,true,
  'existing complete private offline tool recovered actual paired ciphertext originals');
 ok(both.savedRecoveredSqliteReadBackVerified,true,
  'paired recovery independently reopened restored physical SQLite rows');
 ok(both.recoveredPhotoCount,1,'paired recovery independently verified original photo bytes');
 ok(both.exactPairReceiptVerified,true,'paired recovery requires same exact saved .firepair');
 ok(both.gate7Accepted,false,'real synthetic pair restore never claims hosted production acceptance');
 const badPhotoMeta={...meta,customerId:'unknown-owner-not-in-D1'};
 const orphanPhotos=await protectOfflinePhotoZip(new Blob([makePhotoZip([badPhotoMeta])]),photoPhrase);
 await assert.rejects(prepareBrowserProtectedPairReceipt(
  saved,phrase,orphanPhotos,photoPhrase,verifiedOriginalPhotos),
  /FIRE browser protected pair BLOCKED:/,
  'photo belonging to a customer absent from exact records MUST fail');checks++;
 await assert.rejects(prepareBrowserProtectedPairReceipt(
  saved,phrase,selectedPhoto,'incorrect synthetic private photo phrase 2026',verifiedOriginalPhotos),
  /Protected FIRE photo backup:|FIRE browser protected pair BLOCKED:/,
  'incorrect original-photo AES phrase MUST block paired receipt');checks++;
 const badReceipt={...browserPair.receipt,gate7Accepted:true};
 await assert.rejects(verifySelectedBrowserProtectedPairReceipt(
  browserPair,new Blob([Buffer.from(JSON.stringify(badReceipt))])),
  /FIRE browser protected pair BLOCKED:/,
  'forged saved receipt claiming accepted release MUST fail');checks++;
 const alteredPhoto=Buffer.from(readFileSync(photoPath));alteredPhoto[alteredPhoto.length-1]^=1;
 await assert.rejects(verifySelectedBrowserProtectedPairReceipt(
  {...browserPair,photosFile:new Blob([alteredPhoto])},savedPair),
  /FIRE browser protected pair BLOCKED:/,
  'changed original saved photo ciphertext invalidates its matching pair');checks++;
 ok(sha(readFileSync(photoPath)),sha(Buffer.from(await protectedPhotos.arrayBuffer())),
  'original encrypted photo file not altered by pairing or restore');
 ok(sha(readFileSync(protectedFile)),browserPair.receipt.recordsSha256,
  'original encrypted full-record file not altered by pairing or restore');
 const damaged=structuredClone(review);
 damaged.supplemental.tables.d1_migrations.pop();
 await assert.rejects(protectCompleteReviewedD1Records(damaged,phrase),/blocked/,
  'truncated 26 migration source cannot be offered as a protected complete file');
 checks++;
 console.log('PASS '+checks+'/'+checks+' exact independent 26-migration synthetic D1 browser AES-GCM -> existing FIRERB01 Node isolated SQLite restore; Job #0001, journal, no provider/real files.');
}finally{rmSync(dir,{recursive:true,force:true});}
