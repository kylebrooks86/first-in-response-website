/** FIRE Gate7 numbered v2 core-record OWNER DEVICE custody, SOURCE ONLY.
 *
 * Builds on the validated 23-table encrypted records Blob. No D1, HTTP,
 * localStorage, IndexedDB, FS, Cloudflare, Stripe, R2, or automatic file save.
 * A user must intentionally save the prepared file, reopen its SAVED bytes
 * through an independent file selection and keep the passphrase separately.
 * Even a perfect saved-file readback CANNOT prove off-device custody, photos,
 * property/location tables, same-instant records/photos or isolated restore.
 */
import {protectNumberedCoreV2Records,verifyProtectedNumberedCoreV2Records}
 from './protected-numbered-v2-records.mjs';

const MAX_FILE=5_000_056;
const stop=why=>{throw Error('FIRE numbered core owner-file review blocked: '+why);};
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async file=>hex(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()));
function validFile(file){
 if(!(file instanceof Blob)||file.size<57||file.size>MAX_FILE)stop('missing or oversized encrypted records file');
}
function exactSnapshot(a,b){
 // The encrypted reader already validates both manifests. JSON identity
 // includes every original column, row order and serial high-water; this
 // source review deliberately refuses even reordered/lossy readbacks.
 return JSON.stringify(a)===JSON.stringify(b);
}
/** Memory-only: NOT a file downloaded or saved off the owner device. */
export async function prepareNumberedV2OwnerFile(snapshot,phrase,confirmation,now=new Date()){
 if(typeof phrase!=='string'||phrase!==confirmation||phrase.length<16||phrase.length>1024)
  stop('enter and confirm the same private 16–1024 character passphrase');
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))stop('invalid backup filename date');
 const blob=await protectNumberedCoreV2Records(snapshot,phrase);
 validFile(blob);
 const check=await verifyProtectedNumberedCoreV2Records(blob,phrase);
 if(!exactSnapshot(snapshot,check.snapshot))
  stop('prepared encrypted records differ from the full reviewed source');
 const sha256=await digest(blob);
 const filename='FIRE-numbered-v2-CORE-ONLY-'+now.toISOString().replace(/[:.]/g,'-')+'.firerecords';
 return Object.freeze({
  blob,filename,sha256,sizeBytes:blob.size,
  format:'fire-numbered-v2-owner-file-prepared',version:1,
  preparedAndDecryptedInMemory:true,savedFileReadbackVerified:false,
  offDeviceCustodyVerified:false,photoBytesIncluded:false,
  supplementalTableCoverageVerified:false,isolatedRestoreVerified:false,
  gate7Accepted:false
 });
}
/** Compare a user-picked SAVED file with the exact prepared source file,
 * authenticate ciphertext and revalidate every business/numbered record.
 * NEVER auto-select from Downloads or claim the user used a separate device.
 */
export async function verifySavedNumberedV2OwnerFile(prepared,saved,phrase){
 if(!prepared||prepared.format!=='fire-numbered-v2-owner-file-prepared'||
   prepared.version!==1||prepared.preparedAndDecryptedInMemory!==true||
   prepared.savedFileReadbackVerified!==false||prepared.gate7Accepted!==false||
   !/^[0-9a-f]{64}$/.test(prepared.sha256)||
   !Number.isSafeInteger(prepared.sizeBytes)||
   typeof prepared.filename!=='string'||!prepared.filename.endsWith('.firerecords'))
  stop('a previously prepared, unconfirmed records file is required');
 validFile(prepared.blob);validFile(saved);
 if(saved.size!==prepared.sizeBytes)stop('selected saved file differs in byte length');
 const actual=await digest(saved);
 const original=await digest(prepared.blob);
 if(original!==prepared.sha256||actual!==original)
  stop('selected saved file is not byte-identical to this prepared records file');
 const [stored,source]=await Promise.all([
  verifyProtectedNumberedCoreV2Records(saved,phrase),
  verifyProtectedNumberedCoreV2Records(prepared.blob,phrase)
 ]);
 if(!exactSnapshot(stored.snapshot,source.snapshot))
  stop('saved records, numbering or financial history differ from prepared source');
 return Object.freeze({
  format:'fire-numbered-v2-owner-file-readback',version:1,
  encryptedFileSha256:actual,byteLength:saved.size,
  numberOfCoreTables:20,numberOfPermanentIdentityTables:3,
  selectedSavedFileByteIdentical:true,
  savedFileAuthenticatedAndCoreValidated:true,
  sourceAndSavedRecordContentIdentical:true,
  independentOffDeviceCustodyVerified:false,
  sameInstantPhotoPairVerified:false,
  supplementalSchemaCoverageVerified:false,
  isolatedRestoreVerified:false,hostedProviderIdentityVerified:false,
  gate7Accepted:false,remoteWritesPerformed:false
 });
}
/** Verify a prior file after page reload without claiming it is current.
 * There is no original prepared in-memory baseline to compare here.
 */
export async function inspectExistingProtectedNumberedV2File(file,phrase){
 validFile(file);
 const verified=await verifyProtectedNumberedCoreV2Records(file,phrase);
 return Object.freeze({
  format:'fire-numbered-v2-owner-file-inspection',version:1,
  encryptedFileSha256:await digest(file),
  numberedCoreValidated:verified.numberedCoreValidated,
  currentSourceSnapshotCompared:false,offDeviceCustodyVerified:false,
  photoBytesIncluded:false,supplementalSchemaCoverageVerified:false,
  isolatedRestoreVerified:false,gate7Accepted:false,remoteWritesPerformed:false
 });
}
