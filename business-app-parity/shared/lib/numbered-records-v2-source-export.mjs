/** FIRE private v2 read-only D1+R2 source export — NOT A HOSTED ACTION.
 * No route calls this unless separately QA-only feature flagged and authorized.
 * Uses the real FIRE app bindings DB and BUCKET; never uploads, mutates,
 * deletes or restores any provider data. Output is ENCRYPTED ONLY.
 * Bound prototype: 21-table reviewed schema, max 1000 photos / 64 MiB total;
 * no splitting or truncating. Preserve v1 JSON 409 safety lock.
 *
 * Consistency: capture DB A, read exact photo bytes, recapture DB B with
 * same exportedAt, require identical v2 digest, then seal full kit. This
 * detects changes during export, but cannot prove an atomic transaction
 * across independent D1/R2 providers, or prevent a transient A->B->A race.
 * Never claim a provider-level atomic photo/records snapshot.
 */
import {captureFinanciallyVerifiedNumberedRecordsV2FromD1}
 from './numbered-records-v2-d1-read.mjs';
import {createNumberedV2PrivateRecoveryKit}
 from './numbered-records-v2-private-kit.mjs';
const MAX_PHOTOS=1000,MAX_PHOTO_BYTES=64*1024*1024;
const MAX_IMAGE=20*1024*1024;
const fail=reason=>{throw new Error('FIRE v2 SOURCE EXPORT REFUSED: '+reason);};
function reviewPhotoInventory(archive){
 const photos=archive?.records?.tables?.customer_photos;
 if(!Array.isArray(photos)||photos.length>MAX_PHOTOS)
  fail('missing or oversized original photo inventory; use reviewed streaming backup instead');
 let total=0;
 for(const photo of photos){
  if(!photo||typeof photo.object_key!=='string'||!photo.object_key||
     typeof photo.content_type!=='string'||!photo.content_type.startsWith('image/')||
     !Number.isSafeInteger(photo.size_bytes)||photo.size_bytes<0||
     photo.size_bytes>MAX_IMAGE)
   fail('invalid photo metadata in committed D1 snapshot');
  total+=photo.size_bytes;
  if(!Number.isSafeInteger(total)||total>MAX_PHOTO_BYTES)
   fail('photo vault exceeds reviewed in-memory size; never produce partial backup');
 }
 return photos;
}
async function fetchExactOriginalPhoto(bucket,photo){
 let object;
 try{object=await bucket.get(photo.object_key);}catch{fail('original photo provider read failed');}
 if(!object||typeof object.arrayBuffer!=='function')
  fail('original photo object missing or unreadable');
 if(object.size!==photo.size_bytes)
  fail('original R2 object size differs from D1 metadata');
 const contentType=object.httpMetadata?.contentType;
 if(contentType!==photo.content_type)
  fail('original R2 content type differs from D1 metadata');
 let bytes;
 try{bytes=new Uint8Array(await object.arrayBuffer());}
 catch{fail('original photo body could not be read');}
 if(bytes.byteLength!==photo.size_bytes)
  fail('original photo file is incomplete');
 return {objectKey:photo.object_key,contentType,bytes};
}
/** Produce an owner-held PRIVATE KIT from independently verified source.
 * A separately authenticated caller supplies both correct provider bindings
 * and a strong passphrase; THIS HELPER NEVER AUTHORIZES HOSTED ACCESS.
 * Crypto occurs in the same runtime; no plaintext response or logs.
 */
export async function captureEncryptedNumberedV2PrivateKitFromProviders({
 db,bucket,passphrase,now=()=>new Date().toISOString(),cryptoImpl=globalThis.crypto
}={}){
 if(!db||typeof db.prepare!=='function'||typeof db.batch!=='function'||
    !bucket||typeof bucket.get!=='function')
  fail('actual reviewed D1 and R2 bindings are both required');
 if(typeof passphrase!=='string'||passphrase.length<20||
    new TextEncoder().encode(passphrase).byteLength>1024)
  fail('owner-held recovery passphrase is absent or unsupported');
 if(typeof now!=='function')fail('export clock is invalid');
 const exportedAt=now();
 if(typeof exportedAt!=='string'||!Number.isFinite(Date.parse(exportedAt)))
  fail('export time is invalid');
 const first=await captureFinanciallyVerifiedNumberedRecordsV2FromD1({
  db,now:()=>exportedAt
 });
 const photos=reviewPhotoInventory(first.archive);
 const files=[];
 for(const photo of photos)files.push(await fetchExactOriginalPhoto(bucket,photo));
 // Read the WHOLE database again, not merely customer_photos; refuse when a
 // customer/estimate/payment/refund/signed agreement/number/sequence changed.
 const after=await captureFinanciallyVerifiedNumberedRecordsV2FromD1({
  db,now:()=>exportedAt
 });
 if(first.archive.checksum.hex!==after.archive.checksum.hex)
  fail('database changed while photos were being captured; do not export');
 const kit=await createNumberedV2PrivateRecoveryKit({
  archive:first.archive,files,passphrase,cryptoImpl
 });
 return {kit,proof:Object.freeze({
  databaseReadBatches:2,photoObjectsRead:photos.length,
  encryptedPrivateKitCreated:true,allReferencedPhotosIncluded:true,
  providerAtomicPhotoSnapshotGuaranteed:false,
  ownerAuthorizationPerformedHere:false,providerWritesPerformed:false,
  hostedRestorePerformed:false,productionReleaseApproved:false
 })};
}
