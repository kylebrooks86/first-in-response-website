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
import {readFile,open,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {recoverProtectedOfflinePhotoZip,isProtectedOfflinePhotoArchive} from './shared/lib/protected-offline-photo-archive.mjs';
import {inspectStoredFirePhotoZip} from './verify_saved_protected_photo_backup.mjs';
import {validateNumberedCoreRecordsV2} from './shared/lib/numbered-records-v2-preflight.mjs';

const MAX_FILE=161*1024*1024+4096;
const stop=message=>{throw Error('FIRE private photo ZIP recovery BLOCKED: '+message);};
export async function recoverSavedProtectedPhotoZip(input,output,phrase,{allowPlaintextRecovery=false,recordsPath}={}){
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
 const proof=inspectStoredFirePhotoZip(plain,{includePhotoInventory:recordsPath!==undefined});
 let matchingRecordsVerified=false;
 if(recordsPath!==undefined){
  if(typeof recordsPath!=='string'||!recordsPath||resolve(recordsPath)===resolve(output))
   stop('independent numbered-records source file required');
  let records;
  try{records=JSON.parse(await readFile(resolve(recordsPath),'utf8'));}
  catch{stop('numbered customer records file cannot be read');}
  try{validateNumberedCoreRecordsV2(records);}
  catch{stop('numbered customer records archive is incomplete or invalid');}
  if(records.tables.customer_photos.length!==0)
   stop('cloud-only photo metadata prevents a complete device-photo recovery');
  const customers=new Set(records.tables.customers.map(row=>row.id));
  if(proof.photoInventory.some(photo=>!customers.has(photo.customerId)))
   stop('a photo references a customer absent from the records snapshot');
  matchingRecordsVerified=true;
 }
 let handle;
 try{
  handle=await open(resolve(output),'wx',0o600);
  await handle.writeFile(plain);
  await handle.sync();
  await handle.close();handle=undefined;
 }catch(error){
  if(handle){await handle.close().catch(()=>{});await unlink(resolve(output)).catch(()=>{});}
  stop(error?.code==='EEXIST'?'output already exists; overwrite forbidden':'private ZIP output could not be saved');
 }
 return Object.freeze({
  photoCount:proof.photoCount,distinctCustomerIds:proof.distinctCustomerIds,
  verifiedZipSha256:proof.verifiedZipSha256,
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
