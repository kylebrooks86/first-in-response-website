/** FIRE Gate 7: PRIVATE, SAVED-FILE, READ-ONLY no-R2 recovery-pair inspection.
 *
 * Node 22+. Two owner-selected, already-saved local files:
 *   (1) complete versioned numbered core records-v2 JSON snapshot,
 *   (2) encrypted owner .firephotos archive.
 * Stdin supplies a separate recovery phrase. No network, D1 queries, writes,
 * migrations, photos on disk, secrets in args, deployment or release claims.
 *
 * This proves only local saved-file integrity and their CUSTOMER/PHOTO/FINANCIAL
 * relationship. It cannot attest source DB UUID, snapshot consistency,
 * supplemental tables, independent off-device custody or isolated restore.
 */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isProtectedOfflinePhotoArchive,recoverProtectedOfflinePhotoZip}
 from './shared/lib/protected-offline-photo-archive.mjs';
import {inspectStoredFirePhotoZip}
 from './verify_saved_protected_photo_backup.mjs';
import {sealNumberedRecordAndPhotoRecoveryPair}
 from './shared/lib/numbered-photo-recovery-pair.mjs';

const MAX_RECORDS=64*1024*1024,MAX_ENCRYPTED=161*1024*1024+4096;
const fail=why=>{throw Error('FIRE saved recovery pair BLOCKED: '+why);};
const digest=b=>createHash('sha256').update(b).digest('hex');
const decode=new TextDecoder('utf-8',{fatal:true});

export async function inspectOwnerSavedNumberedPhotoPair(recordsFile,photoFile,phrase){
 if(typeof recordsFile!=='string'||!recordsFile||
    typeof photoFile!=='string'||!photoFile||typeof phrase!=='string'||
    phrase.length<16||phrase.length>1024)
  fail('two saved source files and a private phrase are required');
 if(resolve(recordsFile)===resolve(photoFile))
  fail('records and encrypted photos must be separate saved files');
 let rawRecords,rawProtected;
 try{
  [rawRecords,rawProtected]=await Promise.all([
   readFile(resolve(recordsFile)),readFile(resolve(photoFile))
  ]);
 }catch{fail('a selected saved file could not be read');}
 if(!rawRecords.length||rawRecords.length>MAX_RECORDS||
    rawProtected.length<64||rawProtected.length>MAX_ENCRYPTED)
  fail('a saved file exceeds supported safety limits');
 let records;
 try{records=JSON.parse(decode.decode(rawRecords));}
 catch{fail('numbered records JSON is invalid or incomplete');}
 const encrypted=new Blob([rawProtected]);
 if(!await isProtectedOfflinePhotoArchive(encrypted))
  fail('photo file must be a protected .firephotos archive');
 // WebCrypto authenticates every encrypted chunk and fixed header FIRST.
 // Nothing is written, and ZIP bytes never reach a restore operation.
 const unsealed=await recoverProtectedOfflinePhotoZip(encrypted,phrase);
 const zip=Buffer.from(await unsealed.arrayBuffer());
 const verified=inspectStoredFirePhotoZip(zip,{includeVerifiedPhotoItems:true});
 // Existing source validator requires all numbered core tables, source row
 // counts, immutable job/customer high-water, payment/refund relationships.
 // Pair code rejects hosted R2 photo references, orphan customer photos and
 // photo byte/metadata mismatch. This is a READ-only hash, not a restore.
 const seal=await sealNumberedRecordAndPhotoRecoveryPair(records,verified.verifiedPhotoItems);
 if(seal.photoCount!==verified.photoCount||seal.customerCount<verified.distinctCustomerIds)
  fail('photo inventory and numbered customer counts differ');
 return Object.freeze({
  format:'fire-saved-numbered-photo-recovery-review',version:1,
  savedRecordsFileReadBack:true,savedProtectedPhotoFileReadBack:true,
  verifiedPhotoZipSha256:verified.verifiedZipSha256,
  encryptedPhotoFileSha256:digest(rawProtected),
  numberedRecordsFileSha256:digest(rawRecords),
  recordsSha256:seal.recordsSha256,photosSha256:seal.photosSha256,
  pairSha256:seal.pairSha256,customerCount:seal.customerCount,
  photoCount:seal.photoCount,jobCount:seal.numberedJobCount,
  customerHighWater:seal.customerHighWater,jobHighWater:seal.jobHighWater,
  originalPhotoBytes:verified.totalOriginalPhotoBytes,
  matchingCustomerAndFinancialReferences:true,
  recordSourceD1UuidPhysicallyVerified:false,
  originalRecordsSnapshotConsistencyVerified:false,
  allSupplementalTablesCovered:false,
  independentlyHeldOffDevice:false,
  destinationD1RestorePerformed:false,
  restoredPhotoBytesCompared:false,
  hostedCrossDeviceSyncVerified:false,
  providerWriteAttempted:false,ownerApprovedRelease:false,
  gate7Accepted:false,gate10Accepted:false
 });
}

async function phraseFromStdin(){
 if(process.stdin.isTTY)fail('recovery phrase must be piped on stdin, not entered as a CLI argument');
 const chunks=[];let bytes=0;
 for await(const chunk of process.stdin){
  bytes+=chunk.length;if(bytes>4096)fail('recovery phrase input is too large');
  chunks.push(Buffer.from(chunk));
 }
 let phrase;
 try{phrase=decode.decode(Buffer.concat(chunks)).replace(/\r?\n$/,'');}
 catch{fail('recovery phrase encoding is invalid');}
 if(phrase.length<16||phrase.length>1024)fail('a private recovery phrase is required');
 return phrase;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
 try{
  if(process.argv.length!==4)
   fail('usage: node verify_saved_numbered_photo_pair.mjs SAVED_RECORDS.json SAVED_PHOTOS.firephotos');
  const result=await inspectOwnerSavedNumberedPhotoPair(
   process.argv[2],process.argv[3],await phraseFromStdin());
  process.stdout.write(JSON.stringify(result)+'\n');
 }catch{
  // File paths, customer IDs, error row values and passphrases never appear
  // in terminal output. Preserve the originals for deliberate review.
  process.stderr.write('FIRE saved recovery pair BLOCKED; no files or provider resources changed.\n');
  process.exitCode=1;
 }
}
