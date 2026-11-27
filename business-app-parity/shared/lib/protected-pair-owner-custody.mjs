/** FIRE Gate 7: owner-device encrypted records/photo PAIR receipt, SOURCE ONLY.
 *
 * Pair two ALREADY SAVED owner-selected original ciphertext files:
 *  1. complete transactional D1 records, authenticated FIRERB01;
 *  2. original offline customer-photo ZIP, authenticated FIREPX01.
 * A supplied reader MUST be the existing independent ZIP CRC/SHA-256 verifier.
 * Pairing also checks every photo references a customer in that EXACT records
 * snapshot, and refuses legacy object-backed photo rows without original bytes.
 *
 * Outputs the EXACT portable .firepair JSON contract already consumed by
 * protected_recovery_pair_receipt.mjs and rehearse_protected_complete_records_and_photos.mjs.
 * No backend, R2, Stripe, filesystem write, photo upload or automatic download.
 * A matching pair proves SELECTED bytes only, not same-instant physical
 * snapshot, independent off-device custody, real hosted source or Gate7 passage.
 */
import {verifyProtectedCompleteReviewedD1Records}
 from './protected-complete-d1-records.mjs';
import {recoverProtectedOfflinePhotoZip}
 from './protected-offline-photo-archive.mjs';
import {sealNumberedRecordAndPhotoRecoveryPair}
 from './numbered-photo-recovery-pair.mjs';

const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const MAX_RECORDS=5_000_064,MAX_PHOTOS=161*1024*1024+8192;
const expected=['format','version','recordsSha256','recordsBytes','photosSha256',
 'photosBytes','encryptedInputsOnly','offDeviceCustodyVerified','gate7Accepted'];
const stop=why=>{throw Error('FIRE browser protected pair BLOCKED: '+why);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&
 keys.every(k=>Object.prototype.hasOwnProperty.call(x,k));
const sha=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest(
 'SHA-256',await blob.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('');
const hex=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const checkFiles=(records,photos)=>{
 if(!(records instanceof Blob)||!(photos instanceof Blob)||
    records===photos||records.size<65||records.size>MAX_RECORDS||
    photos.size<65||photos.size>MAX_PHOTOS)
  stop('two different supported encrypted record and photo files required');
};
export function validateBrowserProtectedPairReceipt(value){
 if(!exact(value,expected)||value.format!=='fire-saved-protected-record-photo-pair'||
    value.version!==1||!hex(value.recordsSha256)||!hex(value.photosSha256)||
    !Number.isSafeInteger(value.recordsBytes)||value.recordsBytes<65||
    value.recordsBytes>MAX_RECORDS||!Number.isSafeInteger(value.photosBytes)||
    value.photosBytes<65||value.photosBytes>MAX_PHOTOS||
    value.encryptedInputsOnly!==true||
    value.offDeviceCustodyVerified!==false||value.gate7Accepted!==false)
  stop('invalid or misleading paired recovery receipt');
 return value;
}
/** source ZIP reader must independently verify CRC, every photo SHA-256,
 * manifest, size and original bytes; the owner UI supplies the EXISTING
 * readOfflinePhotoBackup implementation after the photo AES-GCM decrypt.
 */
export async function prepareBrowserProtectedPairReceipt(
 recordsFile,recordsPhrase,photosFile,photosPhrase,readVerifiedPhotoZip,now=new Date()
){
 checkFiles(recordsFile,photosFile);
 if(typeof readVerifiedPhotoZip!=='function')
  stop('independent original photo ZIP reader is required');
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))
  stop('invalid owner receipt date');
 // Two independent AEAD checks, and NO receipt if either decryption fails.
 const records=await verifyProtectedCompleteReviewedD1Records(recordsFile,recordsPhrase);
 const decryptedZip=await recoverProtectedOfflinePhotoZip(photosFile,photosPhrase);
 let photos;
 try{photos=await readVerifiedPhotoZip(decryptedZip);}
 catch{stop('original photo ZIP CRC/SHA-256, manifest or source bytes invalid');}
 if(!Array.isArray(photos))stop('verified original photo list is missing');
 let relation;
 try{relation=await sealNumberedRecordAndPhotoRecoveryPair(records.core,photos);}
 catch{stop('customer/photo ownership, original-byte integrity or legacy photo coverage incomplete');}
 if(relation.gate7Accepted!==false||relation.hostedPhotoCoverageVerified!==false)
  stop('physical customer-photo recovery must not be asserted');
 const [recordsHash,photosHash]=await Promise.all([sha(recordsFile),sha(photosFile)]);
 const receipt=validateBrowserProtectedPairReceipt({
  format:'fire-saved-protected-record-photo-pair',version:1,
  recordsSha256:recordsHash,recordsBytes:recordsFile.size,
  photosSha256:photosHash,photosBytes:photosFile.size,
  encryptedInputsOnly:true,offDeviceCustodyVerified:false,gate7Accepted:false
 });
 const blob=new Blob([enc.encode(JSON.stringify(receipt)+'\n')],{type:'application/json'});
 return Object.freeze({
  format:'fire-browser-protected-recovery-pair-prepared',version:1,
  filename:'FIRE-records-and-photos-'+now.toISOString().replace(/[:.]/g,'-')+'.firepair',
  blob,sha256:await sha(blob),recordsFile,photosFile,
  receipt,sourceCustomers:relation.customerCount,sourcePhotos:relation.photoCount,
  sourceNumberedJobs:relation.numberedJobCount,
  sourceMigrationCount:records.migrationCount,
  verifiedRecordsAndPhotoOwnership:true,
  encryptedOriginalFilesMatched:true,
  savedReceiptVerified:false,offDeviceCustodyVerified:false,
  sameInstantSourceSnapshotVerified:false,
  isolatedRestoreVerified:false,gate7Accepted:false
 });
}
/** Deliberately reselect .firepair from Files. Rehash BOTH original selected
 * ciphertext sources and independently re-read the receipt. Never claim this
 * proves that ANY of the 3 files were stored off this device.
 */
export async function verifySelectedBrowserProtectedPairReceipt(prepared,savedReceipt){
 if(!prepared||prepared.format!=='fire-browser-protected-recovery-pair-prepared'||
    prepared.version!==1||prepared.verifiedRecordsAndPhotoOwnership!==true||
    prepared.savedReceiptVerified!==false||prepared.gate7Accepted!==false||
    !(prepared.blob instanceof Blob)||!(savedReceipt instanceof Blob)||
    savedReceipt.size<20||savedReceipt.size>2048||
    !hex(prepared.sha256))
  stop('valid prepared pair and reselected saved receipt required');
 checkFiles(prepared.recordsFile,prepared.photosFile);
 const [preparedHash,savedHash,recordsHash,photosHash]=await Promise.all([
  sha(prepared.blob),sha(savedReceipt),sha(prepared.recordsFile),sha(prepared.photosFile)
 ]);
 if(savedHash!==preparedHash||preparedHash!==prepared.sha256)
  stop('selected saved receipt is not exactly the prepared receipt');
 let fromDisk;
 try{fromDisk=validateBrowserProtectedPairReceipt(JSON.parse(
  dec.decode(await savedReceipt.arrayBuffer())));
 }catch{stop('reselected receipt is malformed');}
 if(JSON.stringify(fromDisk)!==JSON.stringify(prepared.receipt)||
    fromDisk.recordsSha256!==recordsHash||fromDisk.photosSha256!==photosHash||
    fromDisk.recordsBytes!==prepared.recordsFile.size||
    fromDisk.photosBytes!==prepared.photosFile.size)
  stop('original saved encrypted files or pair receipt changed');
 return Object.freeze({
  format:'fire-browser-protected-recovery-pair-readback',version:1,
  exactSavedPairReceiptVerified:true,
  originalEncryptedRecordsAndPhotosUnchanged:true,
  originalRecordsSha256:recordsHash,originalPhotosSha256:photosHash,
  savedReceiptSha256:savedHash,
  recordsAndPhotoOwnershipSourceReviewed:true,
  sourceMigrationCount:prepared.sourceMigrationCount,
  sourcePhotoCount:prepared.sourcePhotos,
  offDeviceCustodyVerified:false,sameInstantSourceSnapshotVerified:false,
  realPhysicalRestorationVerified:false,gate7Accepted:false,
  remoteWritesPerformed:false
 });
}
