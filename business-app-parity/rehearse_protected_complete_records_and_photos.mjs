/** FIRE Gate 7 single-command PRIVATE paired recovery, NO paid cloud/R2.
 *
 * Restore TWO separately authenticated owner-held encrypted files, WITHOUT
 * ever saving plaintext business JSON archives or silently orphaning photos:
 *  - SAVED.firerecords: all numbered/financial/operational SQLite tables
 *  - SAVED.firephotos: verified device photo bytes with original customer IDs
 *
 * Output SQLite and ZIP are necessarily plaintext locally for recovery.
 * Keep them on a trusted private volume and delete responsibly after import.
 * Source encrypted backups are NEVER rewritten or removed.
 * This is NOT a Cloudflare D1/photo deployment or off-device custody proof.
 *
 * node --experimental-sqlite rehearse_protected_complete_records_and_photos.mjs \
 *  RECORDS.firerecords EMPTY_MIGRATED.sqlite PHOTOS.firephotos \
 *  RESTORED.sqlite RESTORED_PHOTOS.zip --allow-private-recovery
 * Supply two private phrases separated by a newline on NON-ECHOING stdin:
 * first records passphrase, second encrypted photos passphrase.
 */
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createReadStream} from 'node:fs';
import {lstat,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectSavedProtectedCompleteRecords}
 from './protected_complete_isolated_sqlite_recovery.mjs';
import {restoreNumberedRecordsToIsolatedSqliteFromArchives}
 from './restore_numbered_records_to_isolated_sqlite.mjs';
import {recoverSavedProtectedPhotoZip}
 from './recover_saved_protected_photo_zip.mjs';
import {inspectSavedProtectedPairReceipt}
 from './protected_recovery_pair_receipt.mjs';
import {fingerprintIsolatedSqliteSchema,requireSameIsolatedSchema}
 from './fingerprint_isolated_sqlite_schema.mjs';
import {NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES}
 from './shared/lib/numbered-records-v2-preflight.mjs';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS}
 from './shared/lib/new-live-migration-journal.mjs';

const stop=why=>{throw Error('FIRE encrypted records + photos recovery BLOCKED: '+why);};
const passValid=x=>typeof x==='string'&&x.length>=16&&x.length<=1024&&
 Buffer.byteLength(x,'utf8')<=4096;
/** A photo ZIP must be SAVED, reopened, with explicit successful CRC and
 * SHA-256 of EVERY original photo, and cross-checked against exactly
 * the authenticated records restored into this isolated SQLite. A saved
 * but unpaired photo ZIP is an incomplete and potentially sensitive restore.
 */
export function assertPairedRecoveredPhotoEvidence(photo){
 if(!photo||photo.originalGalleryZipRecovered!==true||
    photo.matchingCustomerRecordsVerified!==true||
    photo.savedRecoveryZipReadBackVerified!==true||
    photo.allFilesCryptographicallyVerified!==true||
    !/^[a-f0-9]{64}$/.test(photo.verifiedZipSha256||'')||
    photo.savedRecoveredZipSha256!==photo.verifiedZipSha256||
    photo.savedRecoveryPhotoCount!==photo.photoCount||
    !Number.isSafeInteger(photo.photoCount)||photo.photoCount<0||
    photo.providerWriteAttempted!==false||photo.gate7Accepted!==false)
  stop('saved recovered photo ZIP, source customer relationship or no-provider proof incomplete');
 return true;
}
// A valid records/photo restore must use EXACTLY the same encrypted bytes
// throughout the operation. Rechecking the saved input after the actual
// recovery catches replacement/rotation between initial receipt validation
// and final output receipt. This is NOT an atomic cross-device snapshot.
export function assertProtectedRecoverySourceCustody({
 openedRecordsSha256,usedPhotosSha256,finalRecordsSha256,finalPhotosSha256,
 originalPairReceipt,finalPairReceipt
}){
 const valid=d=>typeof d==='string'&&/^[a-f0-9]{64}$/.test(d);
 if(![openedRecordsSha256,usedPhotosSha256,finalRecordsSha256,finalPhotosSha256].every(valid)||
    openedRecordsSha256!==finalRecordsSha256||
    usedPhotosSha256!==finalPhotosSha256)
  stop('encrypted records or photos changed during paired recovery');
 if(originalPairReceipt!==undefined||finalPairReceipt!==undefined){
  if(originalPairReceipt?.exactSavedEncryptedPairVerified!==true||
     finalPairReceipt?.exactSavedEncryptedPairVerified!==true||
     originalPairReceipt.protectedRecordsSha256!==openedRecordsSha256||
     originalPairReceipt.protectedPhotosSha256!==usedPhotosSha256||
     finalPairReceipt.protectedRecordsSha256!==openedRecordsSha256||
     finalPairReceipt.protectedPhotosSha256!==usedPhotosSha256||
     originalPairReceipt.gate7Accepted!==false||
     finalPairReceipt.gate7Accepted!==false)
    stop('saved paired backup receipt or source identity changed during recovery');
 }
 return Object.freeze({
  encryptedRecordsAndPhotosUnchangedAfterRestore:true,
  exactOptionalSavedPairUnchanged:originalPairReceipt!==undefined,
  snapshotSameTimeVerified:false,
  offDeviceCustodyVerified:false,gate7Accepted:false
 });
}
async function hashUnchangedProtectedFile(file,maxBytes){
 let before;
 try{
  before=await lstat(resolve(file));
  if(!before.isFile()||before.isSymbolicLink()||
     before.size<64||before.size>maxBytes)
   stop('saved encrypted recovery source is not a supported regular file');
 }catch{stop('saved encrypted recovery source metadata unavailable');}
 let size=0,digest=createHash('sha256');
 try{
  for await(const bytes of createReadStream(resolve(file))){
   size+=bytes.length;
   if(size>maxBytes)stop('saved encrypted recovery source expanded');
   digest.update(bytes);
  }
  const after=await lstat(resolve(file));
  if(!after.isFile()||after.isSymbolicLink()||
     size!==before.size||after.size!==before.size||
     after.ino!==before.ino||after.dev!==before.dev)
    stop('saved encrypted recovery source was replaced or changed');
 }catch{stop('saved encrypted recovery source could not be verified after restore');}
 return digest.digest('hex');
}
/** After the photo ZIP is saved, reopen the FINAL on-disk SQLite in
 * READ-ONLY mode. The first restore checked rows before close; this second
 * inspection rejects a replaced, truncated, altered or uncheckpointed DB
 * before paired success is reported. D1 migration applied_at timestamps stay
 * target-local; every other journal field and all owner data must match.
 * This remains strictly a LOCAL recovery proof, never hosted acceptance.
 */
export async function verifySavedPairedRecoveredSqlite(path,core,supplemental){
 if(typeof path!=='string'||!path||!core?.tables||!supplemental?.tables||
    !core.schemaIdentity||!supplemental.schemaIdentity)
  stop('final saved SQLite source identity unavailable');
 const stable=value=>Array.isArray(value)?'['+value.map(stable).join(',')+']':
  value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}':
  JSON.stringify(typeof value==='boolean'?Number(value):value);
 const eq=(a,b)=>stable(a)===stable(b);
 const expected={...core.tables,...supplemental.tables};
 const safeName=name=>/^[a-z][a-z0-9_]*$/.test(name);
 const requiredCore=[...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES];
 if(requiredCore.some(name=>!Array.isArray(core.tables[name]))||
    Object.keys(expected).some(name=>!safeName(name)||!Array.isArray(expected[name])))
  stop('saved SQLite recovery archive has missing or unsafe tables');
 let before,db;
 try{
  before=await lstat(resolve(path));
  if(!before.isFile()||before.isSymbolicLink()||before.size<512||
     before.size>512*1024*1024)
   stop('saved recovered SQLite is absent, unsafe or exceeds private recovery limit');
  db=new DatabaseSync(resolve(path),{readOnly:true});
  if(db.prepare('PRAGMA journal_mode').get()?.journal_mode==='wal')
   stop('restored SQLite must be standalone, not an external WAL snapshot');
  const actual=fingerprintIsolatedSqliteSchema(db);
  requireSameIsolatedSchema(core.schemaIdentity,actual);
  requireSameIsolatedSchema(supplemental.schemaIdentity,actual);
  if(db.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok'||
     db.prepare('PRAGMA foreign_key_check').all().length!==0)
   stop('saved recovered SQLite fails its actual on-disk integrity constraints');
  const tableNames=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
   .all().map(row=>row.name).sort();
  if(!eq(tableNames,Object.keys(expected).sort()))
   stop('saved recovered SQLite has missing or extra business tables');
  let inspectedRows=0;
  for(const [table,source] of Object.entries(expected)){
   const actualRows=db.prepare('SELECT * FROM "'+table+'"').all();
   if(actualRows.length!==source.length)
    stop('saved recovered SQLite row count differs in '+table);
   inspectedRows+=actualRows.length;
   if(table==='d1_migrations'){
    if(source.length!==EXPECTED_NEW_LIVE_D1_MIGRATIONS.length)
     stop('saved recovered SQLite migration journal incomplete');
    const byId=rows=>[...rows].sort((a,b)=>a.id-b.id);
    const original=byId(source),saved=byId(actualRows);
    for(let i=0;i<source.length;i++){
     const left=original[i],right=saved[i];
     if(left.id!==i+1||right.id!==i+1||
        left.name!==EXPECTED_NEW_LIVE_D1_MIGRATIONS[i]||
        right.name!==EXPECTED_NEW_LIVE_D1_MIGRATIONS[i]||
        !eq(Object.keys(left).sort(),Object.keys(right).sort()))
      stop('saved recovered SQLite migration lineage differs');
     for(const key of Object.keys(left))
      if(key!=='applied_at'&&!eq(left[key],right[key]))
       stop('saved recovered SQLite migration identity differs');
     if(Object.hasOwn(left,'applied_at')&&
        (!Number.isFinite(Date.parse(String(left.applied_at)))||
         !Number.isFinite(Date.parse(String(right.applied_at)))))
      stop('saved recovered SQLite migration timestamps malformed');
    }
   }else{
    const normalized=rows=>rows.map(stable).sort();
    if(!eq(normalized(actualRows),normalized(source)))
     stop('saved recovered SQLite row bytes or ownership fields differ in '+table);
   }
  }
  const expectedSequences={...supplemental.sqliteSequence,
   fire_customer_numbers:core.highWater?.customer,
   fire_job_numbers:core.highWater?.job};
  for(const [name,high] of Object.entries(expectedSequences)){
   if(!safeName(name)||!Number.isSafeInteger(high)||high<0||
      db.prepare('SELECT seq FROM sqlite_sequence WHERE name=?').get(name)?.seq!==high)
    stop('saved recovered SQLite permanent/migration high-water changed: '+name);
  }
  db.close();db=undefined;
  const after=await lstat(resolve(path));
  if(!after.isFile()||after.isSymbolicLink()||after.ino!==before.ino||
     after.dev!==before.dev||after.size!==before.size)
   stop('saved recovered SQLite changed during independent readback');
  return Object.freeze({
   savedRecoveredSqliteReadBackVerified:true,
   allRecoveredSqliteRowsCompared:true,
   persistedRowsChecked:inspectedRows,
   d1MigrationHistoryRevalidated:Array.isArray(expected.d1_migrations)?
    expected.d1_migrations.length:0,
   allForeignKeysAndIntegrityVerified:true,
   providerD1Restored:false,gate7Accepted:false
  });
 }catch(e){
  if(e instanceof Error&&e.message.startsWith('FIRE encrypted records + photos recovery BLOCKED:'))throw e;
  stop('saved recovered SQLite failed independent read-only verification');
 }finally{
  if(db)try{db.close();}catch{}
 }
}
export async function rehearseProtectedCompleteRecordsAndPhotos(
 protectedRecords,emptySchema,protectedPhotos,outputDb,outputZip,
 recordsPhrase,photoPhrase,{approved=false,pairReceiptPath}={}
){
 if(!approved)stop('explicit private local recovery permission required');
 const paths=[protectedRecords,emptySchema,protectedPhotos,outputDb,outputZip];
 if(paths.some(x=>typeof x!=='string'||!x)||new Set(paths.map(p=>resolve(p))).size!==paths.length)
  stop('all protected inputs, independent template and new output paths must differ');
 if(!passValid(recordsPhrase)||!passValid(photoPhrase))
  stop('two private 16–1024-character recovery phrases are required');
 // Optional saved receipt binds the EXACT two encrypted files selected now.
 // Validate it before creating a plaintext database or photo ZIP. This
 // does NOT prove that every photo/record existed at receipt creation.
 let originalPairReceipt;
 if(pairReceiptPath!==undefined){
  if(typeof pairReceiptPath!=='string'||!pairReceiptPath||
     paths.map(p=>resolve(p)).includes(resolve(pairReceiptPath)))
   stop('the protected pair receipt must be a distinct saved file');
  originalPairReceipt=await inspectSavedProtectedPairReceipt(
   pairReceiptPath,protectedRecords,protectedPhotos);
 }
 // Authenticate complete business archives and their shared source schema
 // before creating either unencrypted recovery artifact.
 const opened=await inspectSavedProtectedCompleteRecords(protectedRecords,recordsPhrase);
 const result=await restoreNumberedRecordsToIsolatedSqliteFromArchives(
  opened.core,emptySchema,outputDb,opened.supplemental
 );
 let photoCreatedByThisRun=false;
 try{
  // Keep the exact post-restore on-disk SQLite bytes as a local custody
  // baseline. The separate read-only row/schema verification occurs only
  // AFTER the photo ZIP has been completely saved and checked.
  const initialSqliteSha256=await hashUnchangedProtectedFile(outputDb,512*1024*1024);
  const photo=await recoverSavedProtectedPhotoZip(
   protectedPhotos,outputZip,photoPhrase,{
    allowPlaintextRecovery:true,
    recordsArchive:opened.core
   }
  );
  // Only a successful exclusive save is ours to remove if the subsequent
  // final paired proof fails. On EEXIST, preserve the owner's original ZIP.
  photoCreatedByThisRun=true;
  assertPairedRecoveredPhotoEvidence(photo);
  // The photo work finished after the SQLite restore. Independently reopen
  // the FINAL saved database now, recheck every archived row, 26 provider
  // journal identities, schema, serial high-water, FK and file integrity.
  const savedSqlite=await verifySavedPairedRecoveredSqlite(
   outputDb,opened.core,opened.supplemental);
  const finalSqliteSha256=await hashUnchangedProtectedFile(outputDb,512*1024*1024);
  if(initialSqliteSha256!==finalSqliteSha256)
   stop('recovered SQLite bytes changed during paired photo restore');
  // The saved protected inputs are checked AGAIN after actual restored SQLite
  // and photo ZIP bytes are verified. No accepted output can refer to changed
  // ciphertext or an old .firepair receipt (if the owner supplied one).
  const finalPairReceipt=pairReceiptPath===undefined?undefined:
   await inspectSavedProtectedPairReceipt(pairReceiptPath,protectedRecords,protectedPhotos);
  const finalRecordsSha256=await hashUnchangedProtectedFile(
   protectedRecords,112*1024*1024+8192);
  const finalPhotosSha256=await hashUnchangedProtectedFile(
   protectedPhotos,161*1024*1024+8192);
  const sourceCustody=assertProtectedRecoverySourceCustody({
   openedRecordsSha256:opened.protectedFileSha256,
   usedPhotosSha256:photo.protectedPhotoSourceSha256,
   finalRecordsSha256,finalPhotosSha256,
   originalPairReceipt,finalPairReceipt
  });
  return Object.freeze({
   pairedEncryptedInputsReadBack:true,
   exactPairReceiptVerified:pairReceiptPath!==undefined,
   recoveredCustomerRows:result.customers,
   recoveredJobNumberRows:result.jobNumbers,
   restoredBusinessRows:result.restoredRows,
   existingMigrationRowsPreserved:result.existingD1MigrationRowsVerified,
   supplementalBusinessRowsRestored:result.supplementalRowsRestored,
   recoveredPhotoCount:photo.photoCount,
   verifiedPhotoZipSha256:photo.verifiedZipSha256,
   savedRecoveredPhotoZipReadBackVerified:true,
   savedRecoveredPhotoZipSha256:photo.savedRecoveredZipSha256,
   savedRecoveredSqliteReadBackVerified:savedSqlite.savedRecoveredSqliteReadBackVerified,
   savedRecoveredSqliteUnchangedAfterPhotoRestore:true,
   allRecoveredSqliteRowsCompared:savedSqlite.allRecoveredSqliteRowsCompared,
   savedSqliteRowsIndependentlyChecked:savedSqlite.persistedRowsChecked,
   finalSqliteMigrationHistoryVerified:savedSqlite.d1MigrationHistoryRevalidated,
   encryptedRecordsSha256:opened.protectedFileSha256,
   plaintextJsonIntermediatesWritten:false,
   originalProtectedInputsUnmodified:sourceCustody.encryptedRecordsAndPhotosUnchangedAfterRestore,
   encryptedInputsUnchangedAfterRestore:sourceCustody.encryptedRecordsAndPhotosUnchangedAfterRestore,
   exactOptionalSavedPairUnchanged:sourceCustody.exactOptionalSavedPairUnchanged,
   localSqliteAndPhotoZipRecovered:true,
   independentCloudflareD1Restored:false,
   hostedPhotoStorageRestored:false,
   offDeviceCustodyVerified:false,
   remoteWritesPerformed:false,gate7Accepted:false
  });
 }catch(error){
  // A failed pair must not leave a misleading partial database OR a newly
  // saved unpaired PLAINTEXT photo ZIP. The photo helper itself cleans up
  // failed writes; after a successful save, only THIS invocation's output is
  // ours to delete. NEVER unlink an already-existing owner ZIP on EEXIST.
  if(photoCreatedByThisRun)
   await unlink(resolve(outputZip)).catch(()=>{});
  await unlink(resolve(outputDb)).catch(()=>{});
  throw error;
 }
}
async function readTwoPhrases(){
 if(process.stdin.isTTY)
  stop('two recovery secrets must arrive over non-echoing stdin; never CLI args');
 let raw='',n=0;
 for await(const chunk of process.stdin){
  n+=chunk.length;
  if(n>8192)stop('recovery phrase input too long');
  raw+=chunk.toString('utf8');
 }
 const lines=raw.replace(/\r?\n$/,'').split(/\r?\n/);
 if(lines.length!==2||!lines.every(passValid))
  stop('stdin must contain one private records phrase and one photo phrase');
 return lines;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
 try{
  if(![8,10].includes(process.argv.length)||
     process.argv[7]!=='--allow-private-recovery'||
     process.argv.length===10&&(
      process.argv[8]!=='--pair-receipt'||!process.argv[9]))

   stop('usage: RECORDS.firerecords EMPTY.sqlite PHOTOS.firephotos RESTORED.sqlite RESTORED.zip --allow-private-recovery');
  const [recordsPhrase,photoPhrase]=await readTwoPhrases();
  const result=await rehearseProtectedCompleteRecordsAndPhotos(
   ...process.argv.slice(2,7),recordsPhrase,photoPhrase,
   {approved:true,...(process.argv.length===10?{pairReceiptPath:process.argv[9]}:{})}
  );
  console.log(JSON.stringify(result));
 }catch{
  // Keep errors generic on a shared terminal: never leak owner paths/secrets.
  console.error('FIRE protected paired recovery BLOCKED; no cloud resource changed.');
  process.exitCode=1;
 }
}
