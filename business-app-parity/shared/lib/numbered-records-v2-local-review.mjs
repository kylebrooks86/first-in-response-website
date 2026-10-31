/** FIRE private recovery-kit review, browser-side ONLY.
 * A caller supplies decrypted input solely in volatile memory; no fetch, XHR,
 * storage, logging, service-worker messages, filesystem writes or DB actions.
 * Only NONIDENTIFYING totals are returned. Never return the archive, photo
 * keys, images, invoices, agreements, payment IDs, or the passphrase.
 * This is NOT a restore or a hosted release signoff.
 */
import {openNumberedV2PrivateRecoveryKit}
 from './numbered-records-v2-private-kit.mjs';

export const FIRE_PRIVATE_REVIEW_MAX_FILE_BYTES=110*1024*1024;
const fail=reason=>{throw new Error('FIRE LOCAL RECOVERY REVIEW REFUSED: '+reason);};

export async function inspectLocalEncryptedRecoveryKit({
 text,passphrase
}={}){
 if(typeof text!=='string'||!text||new TextEncoder().encode(text).byteLength>FIRE_PRIVATE_REVIEW_MAX_FILE_BYTES)
  fail('missing or oversized private recovery file (no partial processing)');
 if(typeof passphrase!=='string'||passphrase.length<20)
  fail('a recovery passphrase is required');
 let kit;
 try{kit=JSON.parse(text);}
 catch{fail('the selected file is not a valid encrypted recovery kit');}
 try{
  const {proof}=await openNumberedV2PrivateRecoveryKit({kit,passphrase});
  if(proof.completePrivateKitDecryptedInMemory!==true||
     proof.financialAuditContractVerified!==true||
     proof.signedDocumentTextDigestVerified!==true||
     proof.verifiedPhotoFiles!==proof.photoRecords||
     proof.ownerAuthenticated!==false||
     proof.productionRestoreAuthorized!==false||
     proof.hostedRecoveryPerformed!==false)
    fail('the complete private recovery contract was not verified');
  const stats={
   recordTables:proof.recordTables,recordRows:proof.recordRows,
   customers:proof.customers,estimates:proof.estimates,
   customerNumbers:proof.customerNumbers,jobNumbers:proof.jobNumbers,
   jobLinks:proof.jobLinks,
   verifiedPhotoFiles:proof.verifiedPhotoFiles,
   verifiedPhotoBytes:proof.verifiedPhotoBytes
  };
  if(Object.values(stats).some(n=>!Number.isSafeInteger(n)||n<0))
   fail('the verified count summary is invalid');
  return Object.freeze({...stats,validEncryptedRecordsAndPhotos:true,
   filesUploaded:false,recordsRestored:false,photosRestored:false,
   releaseApproved:false});
 }catch{
  // Intentionally avoid displaying internal customer/payment/document details.
  fail('passphrase, encrypted bundle, photo data or financial records failed verification');
 }
}
