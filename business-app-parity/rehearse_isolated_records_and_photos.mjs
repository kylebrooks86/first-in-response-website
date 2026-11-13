/** FIRE one-command OFFLINE paired recovery rehearsal.
 * Restores numbered business records to a NEW private SQLite database and
 * decrypts verified photos to the original gallery ZIP, checking every photo
 * customer relationship against the SAME source records snapshot.
 * Neither file is uploaded, deployed, or imported into Cloudflare.
 *
 * node rehearse_isolated_records_and_photos.mjs RECORDS.json EMPTY_SCHEMA.sqlite \
 *   OWNER_BACKUP.firephotos RESTORED.sqlite RESTORED_PHOTOS.zip SUPPLEMENTAL.json --allow-private-recovery
 * Passphrase MUST be piped on stdin. Output files must not exist.
 */
import {readFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {restoreNumberedRecordsToIsolatedSqlite} from './restore_numbered_records_to_isolated_sqlite.mjs';
import {recoverSavedProtectedPhotoZip} from './recover_saved_protected_photo_zip.mjs';
const stop=why=>{throw Error('FIRE paired offline recovery BLOCKED: '+why);};
export async function rehearseIsolatedRecordsAndPhotos(records,template,protectedPhotos,outputDb,outputPhotos,phrase,{approved=false,supplementalPath}={}){
 if(!approved)stop('explicit private recovery acknowledgment required');
 const paths=[records,template,protectedPhotos,outputDb,outputPhotos,supplementalPath];
 if(paths.some(x=>typeof x!=='string'||!x)||new Set(paths.map(resolve)).size!==6)
  stop('all six source and output paths must be distinct');
 // Restore the records first; if photos fail validation or cannot be saved,
 // discard the newly created DB rather than leaving an incomplete pair.
 const database=await restoreNumberedRecordsToIsolatedSqlite(records,template,outputDb,supplementalPath);
 try{
  const photos=await recoverSavedProtectedPhotoZip(protectedPhotos,outputPhotos,phrase,{
   allowPlaintextRecovery:true,recordsPath:records
  });
  if(!photos.matchingCustomerRecordsVerified)
   stop('photo/customer relationships were not verified');
  return Object.freeze({
   pairedOfflineArtifactsCreated:true,restoredDatabaseRows:database.restoredRows,
   restoredCustomers:database.customers,restoredJobNumbers:database.jobNumbers,
   verifiedPhotoCount:photos.photoCount,photoZipSha256:photos.verifiedZipSha256,
   localDatabaseRowParityVerified:database.sqliteRestoreVerified,
   supplementalTablesRestored:database.supplementalTablesRestored,
   supplementalRowsRestored:database.supplementalRowsRestored,
   photoCustomerRelationshipsVerified:true,
   hostedD1RestoreVerified:false,hostedPhotoRestoreVerified:false,
   remoteWritesPerformed:false,gate7Accepted:false
  });
 }catch(error){
  await unlink(resolve(outputDb)).catch(()=>{});
  throw error;
 }
}
async function readPhrase(){
 if(process.stdin.isTTY)stop('pipe private recovery phrase via stdin, never CLI arguments');
 let s='',bytes=0;
 for await(const chunk of process.stdin){
  bytes+=chunk.length;if(bytes>4096)stop('passphrase input exceeds limit');
  s+=chunk.toString('utf8');
 }
 s=s.replace(/\r?\n$/,'');
 if(s.length<16||s.length>1024)stop('private passphrase required');
 return s;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
 try{
  if(process.argv.length!==9||process.argv[8]!=='--allow-private-recovery')
   stop('usage: node rehearse_isolated_records_and_photos.mjs RECORDS.json EMPTY_SCHEMA.sqlite BACKUP.firephotos RESTORED.sqlite PHOTOS.zip --allow-private-recovery');
  console.log(JSON.stringify(await rehearseIsolatedRecordsAndPhotos(
   ...process.argv.slice(2,7),await readPhrase(),{approved:true,supplementalPath:process.argv[7]})));
 }catch(error){console.error(error instanceof Error?error.message:'recovery failed');process.exitCode=1;}
}
