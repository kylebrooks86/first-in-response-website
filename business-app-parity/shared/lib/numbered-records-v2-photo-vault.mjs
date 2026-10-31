/** FIRE v2 external photo-vault verification — SOURCE ONLY.
 *
 * Records backups contain customer_photos rows, NOT image bytes. A separate
 * owner-held photo ZIP/vault is required. This module accepts bytes supplied
 * by an explicitly authorized caller in memory; it NEVER reads/writes R2,
 * filesystem, ZIPs, databases or network, and NEVER moves/recovers images.
 *
 * A manifest is SENSITIVE (contains photo object keys/customer IDs).
 * Encrypt it alongside the v2 owner-held records archive before storage.
 * A newly computed hash alone cannot authenticate original bytes; compare to
 * an independently retained owner-protected manifest for change detection.
 */
import {inspectFinanciallyVerifiedNumberedRecordsV2}
  from './numbered-records-v2-integrity.mjs';

export const FIRE_PHOTO_VAULT_MANIFEST_FORMAT='fire-numbered-v2-photo-vault-manifest';
export const FIRE_PHOTO_VAULT_MANIFEST_VERSION=1;
const fail=x=>{throw new Error('FIRE PHOTO VAULT V2 REFUSED: '+x);};
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(obj,keys)=>record(obj)&&Object.keys(obj).sort().join('|')===[...keys].sort().join('|');
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
async function sha256(c,bytes){
 if(!c?.subtle?.digest)fail('secure SHA-256 unavailable');
 return hex(await c.subtle.digest('SHA-256',bytes));
}
function validateFileInputs(metadata,files){
 if(!Array.isArray(files)||files.length!==metadata.length)
  fail('photo file count differs from archived metadata');
 const names=new Set(),index=new Map();
 for(const entry of files){
  if(!exact(entry,['objectKey','contentType','bytes'])||
     typeof entry.objectKey!=='string'||!entry.objectKey||
     names.has(entry.objectKey)||typeof entry.contentType!=='string'||
     !(entry.bytes instanceof Uint8Array))
   fail('invalid/duplicate photo file');
  names.add(entry.objectKey);
  index.set(entry.objectKey,entry);
 }
 for(const row of metadata){
  const file=index.get(row.object_key);
  if(!file||file.contentType!==row.content_type||
     file.bytes.byteLength!==row.size_bytes)
   fail('missing, changed size, or incorrect type for archived photo');
 }
 return index;
}
function manifestFromEntries(entries){
 return {
  format:FIRE_PHOTO_VAULT_MANIFEST_FORMAT,
  version:FIRE_PHOTO_VAULT_MANIFEST_VERSION,
  allFilesComplete:true,
  photoFilesIncludedInRecords:false,
  files:entries
 };
}
function checkManifest(expected,metadata){
 if(!exact(expected,['format','version','allFilesComplete',
   'photoFilesIncludedInRecords','files'])||
   expected.format!==FIRE_PHOTO_VAULT_MANIFEST_FORMAT||
   expected.version!==FIRE_PHOTO_VAULT_MANIFEST_VERSION||
   expected.allFilesComplete!==true||
   expected.photoFilesIncludedInRecords!==false||!Array.isArray(expected.files)||
   expected.files.length!==metadata.length)
  fail('missing or unreviewed owner-protected photo manifest');
 const keys=new Set();
 for(const entry of expected.files){
  if(!exact(entry,['objectKey','contentType','sizeBytes','sha256'])||
     typeof entry.objectKey!=='string'||keys.has(entry.objectKey)||
     typeof entry.contentType!=='string'||!Number.isSafeInteger(entry.sizeBytes)||
     entry.sizeBytes<0||typeof entry.sha256!=='string'||
     !/^[0-9a-f]{64}$/.test(entry.sha256))
   fail('invalid/duplicate owner photo manifest entry');
  keys.add(entry.objectKey);
 }
 if(metadata.some(row=>!keys.has(row.object_key)))
  fail('manifest omits an archived photo record');
}

/** Build a SHA-256 manifest from independently obtained original photo bytes.
 * Returns a sensitive manifest; caller must store it inside authenticated
 * owner-held encrypted storage. NO claim of off-device custody or restore.
 */
export async function buildNumberedV2PhotoVaultManifest({
 archive,files,cryptoImpl=globalThis.crypto
}={}){
 if(!archive)fail('missing records source');
 await inspectFinanciallyVerifiedNumberedRecordsV2(archive);
 const metadata=archive.records.tables.customer_photos;
 const index=validateFileInputs(metadata,files);
 const entries=[];
 for(const photo of metadata){
  const file=index.get(photo.object_key);
  entries.push({objectKey:photo.object_key,contentType:photo.content_type,
    sizeBytes:photo.size_bytes,sha256:await sha256(cryptoImpl,file.bytes)});
 }
 entries.sort((a,b)=>a.objectKey.localeCompare(b.objectKey,'en'));
 return manifestFromEntries(entries);
}

/** Reverify ALL independently supplied photo file bytes against a previously
 * stored protected manifest; same-size tampering fails by SHA-256 comparison.
 * Does not restore bytes or attest where this owner manifest originated.
 */
export async function verifyNumberedV2PhotoVault({
 archive,files,protectedManifest,cryptoImpl=globalThis.crypto
}={}){
 if(!archive)fail('missing records source');
 await inspectFinanciallyVerifiedNumberedRecordsV2(archive);
 const metadata=archive.records.tables.customer_photos;
 checkManifest(protectedManifest,metadata);
 const actual=await buildNumberedV2PhotoVaultManifest({archive,files,cryptoImpl});
 const indexed=new Map(protectedManifest.files.map(row=>[row.objectKey,row]));
 for(const entry of actual.files){
  const expected=indexed.get(entry.objectKey);
  if(!expected||expected.sha256!==entry.sha256||
     expected.sizeBytes!==entry.sizeBytes||expected.contentType!==entry.contentType)
   fail('photo byte content differs from previously protected manifest');
 }
 const bytes=actual.files.reduce((sum,row)=>sum+row.sizeBytes,0);
 if(!Number.isSafeInteger(bytes))fail('photo vault total is outside integer range');
 return Object.freeze({photoRecords:metadata.length,photoFilesVerified:actual.files.length,
  verifiedBytes:bytes,completeMetadataMatchesFiles:true,
  trustedManifestOriginProven:false,cloudPhotoRestorePerformed:false,
  hostedWritesPerformed:false});
}
