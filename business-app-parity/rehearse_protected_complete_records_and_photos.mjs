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
import {unlink} from 'node:fs/promises';
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

const stop=why=>{throw Error('FIRE encrypted records + photos recovery BLOCKED: '+why);};
const passValid=x=>typeof x==='string'&&x.length>=16&&x.length<=1024&&
 Buffer.byteLength(x,'utf8')<=4096;
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
 if(pairReceiptPath!==undefined){
  if(typeof pairReceiptPath!=='string'||!pairReceiptPath||
     paths.map(p=>resolve(p)).includes(resolve(pairReceiptPath)))
   stop('the protected pair receipt must be a distinct saved file');
  await inspectSavedProtectedPairReceipt(pairReceiptPath,protectedRecords,protectedPhotos);
 }
 // Authenticate complete business archives and their shared source schema
 // before creating either unencrypted recovery artifact.
 const opened=await inspectSavedProtectedCompleteRecords(protectedRecords,recordsPhrase);
 const result=await restoreNumberedRecordsToIsolatedSqliteFromArchives(
  opened.core,emptySchema,outputDb,opened.supplemental
 );
 try{
  const photo=await recoverSavedProtectedPhotoZip(
   protectedPhotos,outputZip,photoPhrase,{
    allowPlaintextRecovery:true,
    recordsArchive:opened.core
   }
  );
  if(!photo.matchingCustomerRecordsVerified||photo.savedRecoveryZipReadBackVerified!==true||
     photo.savedRecoveredZipSha256!==photo.verifiedZipSha256)
   stop('saved recovered photo ZIP bytes or customer relationship were not independently verified');
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
   encryptedRecordsSha256:opened.protectedFileSha256,
   plaintextJsonIntermediatesWritten:false,
   originalProtectedInputsUnmodified:true,
   localSqliteAndPhotoZipRecovered:true,
   independentCloudflareD1Restored:false,
   hostedPhotoStorageRestored:false,
   offDeviceCustodyVerified:false,
   remoteWritesPerformed:false,gate7Accepted:false
  });
 }catch(error){
  // The new SQLite was created by this invocation. A bad photo key,
  // corrupted ZIP, customer mismatch or preexisting photo output must never
  // leave an apparently complete but photo-less recovered business DB.
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
