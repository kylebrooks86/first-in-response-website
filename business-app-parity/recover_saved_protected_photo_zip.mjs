/** FIRE offline owner recovery: turn an authenticated .firephotos backup into the
 * original QA-master photo-gallery ZIP, ready for its existing import flow.
 * SOURCE ONLY. No Cloudflare, D1, Stripe, uploads, subscriptions or deployment.
 * WARNING: OUTPUT IS UNENCRYPTED CUSTOMER PHOTOS. Use a private local volume;
 * remove it securely after authorized gallery import.
 *
 * Usage (stdin pipe, NOT a CLI passphrase argument):
 * node recover_saved_protected_photo_zip.mjs BACKUP.firephotos OUTPUT.zip --allow-plaintext-recovery
 * Output must not already exist; permissions are owner-only (0600).
 */
import {readFile,open,unlink,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {recoverProtectedOfflinePhotoZip,isProtectedOfflinePhotoArchive} from './shared/lib/protected-offline-photo-archive.mjs';
import {inspectStoredFirePhotoZip} from './verify_saved_protected_photo_backup.mjs';
import {validateNumberedCoreRecordsV2} from './shared/lib/numbered-records-v2-preflight.mjs';

const MAX_FILE=161*1024*1024+4096;
/**
 * Reopen the actual *saved* recovery ZIP. Encryption authentication and
 * in-memory CRC/SHA verification do not establish disk write completeness.
 * This is READ-ONLY; the caller owns deletion of its newly-created output
 * when the post-write check fails. No Cloudflare/provider access.
 */
export async function verifySavedRecoveredPhotoZip(path,sourceProof){
 if(typeof path!=='string'||!path||
    !sourceProof||sourceProof.allFilesCryptographicallyVerified!==true||
    !/^[a-f0-9]{64}$/.test(sourceProof.verifiedZipSha256))
  throw Error('FIRE private photo ZIP recovery BLOCKED: authenticated source proof required');
 let saved;
 try{
  const stat=await lstat(resolve(path));
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<23||stat.size>MAX_FILE)
   throw Error('recovered file not regular or exceeds limit');
  saved=await readFile(resolve(path));
  if(saved.length!==stat.size)throw Error('recovered ZIP size changed during readback');
 }catch{throw Error('FIRE private photo ZIP recovery BLOCKED: saved recovery ZIP is unavailable or incomplete');}
 // Revalidate central directory, CRC32 and EACH original photograph SHA-256
 // from the file on disk, not from the earlier decrypted in-memory buffer.
 const checked=inspectStoredFirePhotoZip(saved);
 if(checked.verifiedZipSha256!==sourceProof.verifiedZipSha256||
    checked.photoCount!==sourceProof.photoCount||
    checked.distinctCustomerIds!==sourceProof.distinctCustomerIds||
    checked.totalOriginalPhotoBytes!==sourceProof.totalOriginalPhotoBytes)
  throw Error('FIRE private photo ZIP recovery BLOCKED: saved recovery ZIP differs from the verified protected original');
 return Object.freeze({savedRecoveryZipReadBackVerified:true,
  savedRecoveredZipSha256:checked.verifiedZipSha256,
  savedRecoveryPhotoCount:checked.photoCount});
}
const stop=message=>{throw Error('FIRE private photo ZIP recovery BLOCKED: '+message);};
export async function recoverSavedProtectedPhotoZip(input,output,phrase,{allowPlaintextRecovery=false,recordsPath,recordsArchive}={}){
 if(!allowPlaintextRecovery)stop('explicit plaintext-recovery consent required');
 if(typeof input!=='string'||typeof output!=='string'||!input||!output||
    resolve(input)===resolve(output))stop('separate input and output files required');
 if(typeof phrase!=='string'||phrase.length<16||phrase.length>1024)
  stop('private passphrase required');
 let protectedBytes;
 try{protectedBytes=await readFile(resolve(input));}
 catch{stop('encrypted source file is unreadable');}
 if(protectedBytes.length<=64||protectedBytes.length>MAX_FILE)
  stop('unsupported encrypted source size');
 const source=new Blob([protectedBytes]);
 if(!await isProtectedOfflinePhotoArchive(source))
  stop('source is not an encrypted FIRE photo backup');
 const recovered=await recoverProtectedOfflinePhotoZip(source,phrase);
 const plain=Buffer.from(await recovered.arrayBuffer());
 // Full CRC, SHA-256, filename, manifest and relationship verification BEFORE
 // creating any output. A corrupted or forged archive never writes photos.
 if(recordsPath!==undefined&&recordsArchive!==undefined)
  stop('supply either a saved records path or authenticated in-memory records, never both');
 const hasRecords=recordsPath!==undefined||recordsArchive!==undefined;
 const proof=inspectStoredFirePhotoZip(plain,{includePhotoInventory:hasRecords});
 let matchingRecordsVerified=false;
 if(hasRecords){
  let records=recordsArchive;
  if(recordsPath!==undefined){
   if(typeof recordsPath!=='string'||!recordsPath||resolve(recordsPath)===resolve(output))
    stop('independent numbered-records source file required');
   try{records=JSON.parse(await readFile(resolve(recordsPath),'utf8'));}
   catch{stop('numbered customer records file cannot be read');}
  }
  try{validateNumberedCoreRecordsV2(records);}
  catch{stop('numbered customer records archive is incomplete or invalid');}
  if(records.tables.customer_photos.length!==0)
   stop('cloud-only photo metadata prevents a complete device-photo recovery');
  const customers=new Set(records.tables.customers.map(row=>row.id));
  if(proof.photoInventory.some(photo=>!customers.has(photo.customerId)))
   stop('a photo references a customer absent from the records snapshot');
  matchingRecordsVerified=true;
 }
 let handle,created=false,readback;
 try{
  handle=await open(resolve(output),'wx',0o600);created=true;
  await handle.writeFile(plain);
  await handle.sync();
  await handle.close();handle=undefined;
  readback=await verifySavedRecoveredPhotoZip(output,proof);
 }catch(error){
  // Never leave a truncated, damaged or unverified plaintext photo ZIP
  // presenting itself as a successful restore. Never delete an output that
  // already existed before this invocation.
  if(handle)await handle.close().catch(()=>{});
  if(created)await unlink(resolve(output)).catch(()=>{});
  if(error?.code==='EEXIST')stop('output already exists; overwrite forbidden');
  if(error instanceof Error&&error.message.startsWith('FIRE private photo ZIP recovery BLOCKED:'))throw error;
  stop('private ZIP output could not be saved and independently verified');
 }
 return Object.freeze({
  photoCount:proof.photoCount,distinctCustomerIds:proof.distinctCustomerIds,
  verifiedZipSha256:proof.verifiedZipSha256,...readback,
  originalGalleryZipRecovered:true,matchingCustomerRecordsVerified:matchingRecordsVerified,
  customerRecordsRestored:false,independentD1Restored:false,
  providerWriteAttempted:false,gate7Accepted:false
 });
}
async function readPhrase(){
 if(process.stdin.isTTY)stop('pipe the private passphrase on stdin, never as an argument');
 let input='',bytes=0;
 for await(const chunk of process.stdin){
  bytes+=chunk.length;if(bytes>4096)stop('passphrase input too large');
  input+=chunk.toString('utf8');
 }
 input=input.replace(/\r?\n$/,'');
 if(input.length<16||input.length>1024)stop('private recovery passphrase required');
 return input;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
 try{
  if(![5,6].includes(process.argv.length)||process.argv[4]!=='--allow-plaintext-recovery')
   stop('usage: node recover_saved_protected_photo_zip.mjs INPUT.firephotos OUTPUT.zip --allow-plaintext-recovery [NUMBERED_RECORDS.json]');
  const result=await recoverSavedProtectedPhotoZip(process.argv[2],process.argv[3],await readPhrase(),{allowPlaintextRecovery:true,recordsPath:process.argv[5]});
  process.stdout.write(JSON.stringify(result)+'\n');
 }catch(error){
  console.error(error instanceof Error?error.message:'private recovery failed');
  process.exitCode=1;
 }
}
