/** FIRE Gate7 SOURCE-ONLY complete-records + device-photo pair fingerprint.
 * Existing numbered-records v2 validator must accept exact full core/identity
 * records first, and callers must use the already SHA-256-verified FIRE ZIP
 * reader to supply photos. This cannot certify cloud storage, device custody,
 * supplemental tables, independent D1 restore or an actual recovery.
 * No filesystem, database, network, secret store or mutating operations.
 */
import {validateNumberedCoreRecordsV2} from './numbered-records-v2-preflight.mjs';
const enc=new TextEncoder();
const fail=why=>{throw Error('FIRE paired recovery preflight blocked: '+why);};
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const sha=async value=>hex(await crypto.subtle.digest('SHA-256',value));
const stable=value=>{
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 if(value&&typeof value==='object')
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}';
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))
  return JSON.stringify(value);
 fail('records contain unsupported values');
};
const canonicalRecords=archive=>{
 // Sort table names, row identities AND object keys to make a source/restore
 // comparison independent of D1 return order, without removing data.
 const t={};
 for(const table of Object.keys(archive.tables).sort()){
  const key=['fire_customer_numbers'].includes(table)?'customer_id':
   table==='fire_job_numbers'?'root_estimate_id':
   table==='fire_job_estimate_links'?'estimate_id':
   table==='message_templates'?'key':
   table==='deposit_agreement_snapshots'?'event_id':'id';
  t[table]=archive.tables[table].slice().sort((a,b)=>String(a[key]).localeCompare(String(b[key])));
 }
 return stable({format:archive.format,version:archive.version,
  highWater:archive.highWater,rowCounts:archive.rowCounts,tables:t,
  allTablesComplete:archive.allTablesComplete,truncated:archive.truncated});
};
export async function sealNumberedRecordAndPhotoRecoveryPair(archive,photos){
 const recordState=validateNumberedCoreRecordsV2(archive);
 if(!Array.isArray(photos)||photos.length>500)fail('verified complete photo archive required');
 // With NO R2 binding, rows naming legacy cloud photo objects are not
 // included in the device ZIP; a pair must NOT claim complete recovery.
 if(archive.tables.customer_photos.length!==0)
  fail('hosted object photo metadata exists; device ZIP cannot recover its bytes');
 const customers=new Set(archive.tables.customers.map(x=>x.id)),ids=new Set(),photoDigests=[];
 let totalBytes=0;
 for(const photo of photos){
  if(!photo||typeof photo!=='object'||typeof photo.id!=='string'||
     !/^[a-zA-Z0-9_-]{1,90}$/.test(photo.id)||ids.has(photo.id))
   fail('invalid or duplicate photo identifier');
  ids.add(photo.id);
  if(!customers.has(photo.customerId))
   fail('photo customer does not exist in the same numbered records snapshot');
  if(!['before','after','property'].includes(photo.category)||
     typeof photo.caption!=='string'||photo.caption.length>2000||
     typeof photo.filename!=='string'||photo.filename.length<1||photo.filename.length>240||
     typeof photo.createdAt!=='string'||!Number.isFinite(Date.parse(photo.createdAt))||
     typeof photo.contentType!=='string'||!/^image\/(?:jpeg|png|webp|gif|heic|heif|avif|bmp)$/.test(photo.contentType)||
     !(photo.blob instanceof Blob)||photo.blob.type!==photo.contentType||
     !Number.isSafeInteger(photo.sizeBytes)||photo.sizeBytes<1||
     photo.sizeBytes>15*1024*1024||photo.blob.size!==photo.sizeBytes)
   fail('photo metadata or bytes do not match accepted device ZIP format');
  if(photo.jobId!==undefined&&
     (typeof photo.jobId!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(photo.jobId)))
   fail('invalid photo job association');
  totalBytes+=photo.sizeBytes;
  if(totalBytes>160*1024*1024)fail('device-photo bytes exceed supported ZIP size');
  // Hash the verified actual bytes again to bind each record and photograph.
  const digest=await sha(await photo.blob.arrayBuffer());
  photoDigests.push({id:photo.id,customerId:photo.customerId,
   ...(photo.jobId===undefined?{}:{jobId:photo.jobId}),category:photo.category,
   caption:photo.caption,filename:photo.filename,contentType:photo.contentType,
   sizeBytes:photo.sizeBytes,createdAt:photo.createdAt,sha256:digest});
 }
 photoDigests.sort((a,b)=>a.id.localeCompare(b.id));
 const recordsSha256=await sha(enc.encode(canonicalRecords(archive)));
 const photosSha256=await sha(enc.encode(stable(photoDigests)));
 const pairSha256=await sha(enc.encode('FIRE-RECOVERY-PAIR-V1\n'+recordsSha256+'\n'+photosSha256));
 return Object.freeze({
  format:'fire-records-device-photo-pair-seal',version:1,recordsSha256,photosSha256,pairSha256,
  customerCount:recordState.customers,photoCount:photos.length,
  coreRecordRows:recordState.coreRows,numberedJobCount:recordState.jobNumbers,
  customerHighWater:recordState.customerHighWater,jobHighWater:recordState.jobHighWater,
  sourceOnly:true,physicallyStoredBackupVerified:false,independentRestoreVerified:false,
  supplementalTableCoverageVerified:false,hostedPhotoCoverageVerified:false,
  providerSourceIdentityVerified:false,ownerApprovedRelease:false,gate7Accepted:false
 });
}
/**
 * Independently recompute the pair digest from BOTH component fingerprints
 * before declaring two owner/recovery seals equivalent. Equal JSON objects
 * alone are NOT a cryptographic validation: two identically corrupted pair
 * headers previously passed comparison. These files are still source-only
 * integrity checks, not a real physical/photo restore.
 */
export async function compareNumberedRecordAndPhotoPairSeals(source,restored){
 const digestFields=['recordsSha256','photosSha256','pairSha256'];
 const counts=['customerCount','photoCount','coreRecordRows',
  'numberedJobCount','customerHighWater','jobHighWater'];
 const frozenFlags=['sourceOnly','physicallyStoredBackupVerified',
  'independentRestoreVerified','supplementalTableCoverageVerified',
  'hostedPhotoCoverageVerified','providerSourceIdentityVerified',
  'ownerApprovedRelease','gate7Accepted'];
 const expectedKeys=['format','version',...digestFields,...counts,...frozenFlags].sort();
 const validSeal=value=>value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).sort().join(',')===expectedKeys.join(',')&&
  value.format==='fire-records-device-photo-pair-seal'&&value.version===1&&
  digestFields.every(k=>typeof value[k]==='string'&&/^[0-9a-f]{64}$/.test(value[k]))&&
  counts.every(k=>Number.isSafeInteger(value[k])&&value[k]>=0)&&
  value.sourceOnly===true&&frozenFlags.filter(k=>k!=='sourceOnly')
   .every(k=>value[k]===false);
 if(!validSeal(source)||!validSeal(restored)||
    [...digestFields,...counts].some(k=>source[k]!==restored[k]))
  fail('source/isolated-restore record or photo fingerprints differ');
 // This is the same domain-separated algorithm used to create the pair seal.
 // Never accept a supplied pairSha256 value without recomputing it locally.
 const actualPair=await sha(enc.encode('FIRE-RECOVERY-PAIR-V1\n'+
   source.recordsSha256+'\n'+source.photosSha256));
 if(source.pairSha256!==actualPair||restored.pairSha256!==actualPair)
  fail('record and photo digests do not match authenticated pair fingerprint');
 return Object.freeze({sourceAndDestinationMatch:true,
  physicalRecoveryProven:false,gate7Accepted:false,remoteWritesPerformed:false});
}
