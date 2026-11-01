/** FIRE PRIVATE RECOVERY KIT — SOURCE ONLY / IN-MEMORY.
 * Single portable, encrypted records+photos object. Actual photo FILE BYTES
 * are included as authenticated ciphertext, bound to the exact underlying
 * 21-table records checksum. The passphrase must never be included in kit.
 * This builds no UI, reads no R2/D1, writes no files or hosted DB, and does
 * not assert that a real source export is complete or an owner authenticated.
 */
import {encryptFinanciallyVerifiedNumberedV2,decryptFinanciallyVerifiedNumberedV2}
 from './numbered-records-v2-sealed.mjs';
import {sealNumberedV2PhotoBytes,unsealNumberedV2PhotoBytes}
 from './numbered-records-v2-sealed-photos.mjs';

export const FIRE_PRIVATE_RECOVERY_KIT_FORMAT='fire-app-complete-numbered-private-recovery-kit';
export const FIRE_PRIVATE_RECOVERY_KIT_VERSION=1;
const fail=reason=>{throw new Error('FIRE PRIVATE RECOVERY KIT REFUSED: '+reason);};
const exact=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).sort().join('|')==='format|sealedPhotoBytes|sealedRecords|version';
export async function createNumberedV2PrivateRecoveryKit({
 archive,files,passphrase,cryptoImpl=globalThis.crypto
}={}){
 // Photo sealing first avoids creating the encrypted records half of the kit
 // when any required original file is absent or cannot be hashed.
 const sealedPhotoBytes=await sealNumberedV2PhotoBytes({
  archive,files,passphrase,cryptoImpl
 });
 const sealedRecords=await encryptFinanciallyVerifiedNumberedV2({
  archive,passphrase,cryptoImpl
 });
 return Object.freeze({format:FIRE_PRIVATE_RECOVERY_KIT_FORMAT,
  version:FIRE_PRIVATE_RECOVERY_KIT_VERSION,sealedRecords,sealedPhotoBytes});
}
/** Validate the complete paired package *before* presenting recovery content.
 * Returns volatile in-memory records and raw image bytes with no persist action.
 */
export async function openNumberedV2PrivateRecoveryKit({
 kit,passphrase,cryptoImpl=globalThis.crypto
}={}){
 if(!exact(kit)||kit.format!==FIRE_PRIVATE_RECOVERY_KIT_FORMAT||
    kit.version!==FIRE_PRIVATE_RECOVERY_KIT_VERSION)
  fail('missing or unreviewed encrypted recovery package');
 try{
  const {archive,summary}=await decryptFinanciallyVerifiedNumberedV2({
   sealed:kit.sealedRecords,passphrase,cryptoImpl
  });
  const photo=await unsealNumberedV2PhotoBytes({
   archive,sealed:kit.sealedPhotoBytes,passphrase,cryptoImpl
  });
  return {archive,photos:photo.files,proof:Object.freeze({
   ...summary,
   verifiedPhotoFiles:photo.proof.photoFilesVerified,
   verifiedPhotoBytes:photo.proof.verifiedBytes,
   completePrivateKitDecryptedInMemory:true,
   recordsPersisted:false,photoFilesPersisted:false,
   ownerAuthenticated:false,hostedRecoveryPerformed:false,
   productionRestoreAuthorized:false
  })};
 }catch{
  fail('wrong passphrase, changed records, photos missing or mismatched encrypted pair');
 }
}
