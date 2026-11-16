/** FIRE SOURCE-ONLY: encrypt the complete transactional D1 records review
 * into the EXISTING offline FIRE .firerecords format (FIRERB01).
 *
 * This is NOT a deployment, database/Stripe write or provider backup.
 * The owner must save these encrypted bytes, reopen the independently saved
 * file and separately preserve verified ORIGINAL photo bytes, then perform
 * authorized isolated full records+photo restoration before Gate 7 acceptance.
 *
 * Wire format, byte-for-byte interoperable with
 * business-app-parity/protected_complete_isolated_sqlite_recovery.mjs:
 *   MAGIC 'FIRERB01' (8), PBKDF2 salt (16), GCM IV (12),
 *   core JSON length uint32 LE (4), supplemental JSON length (4),
 *   PBKDF2 iterations uint32 LE (4), AES-GCM ciphertext+tag.
 * Header is authenticated as AES-GCM AAD. Never write plaintext JSON.
 */
import {validateNumberedCoreRecordsV2} from './numbered-records-v2-preflight.mjs';
import {validateSupplementalRecoveryArchive}
 from './complete-supplemental-recovery-validation.mjs';
import {validateCompleteSupplementalCustomerHistory}
 from './complete-supplemental-customer-history.mjs';

const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const MAGIC=enc.encode('FIRERB01');
const HEADER=48,TAG=16,ITERATIONS=600_000,MAX_REVIEW=5_000_000;
const fail=reason=>{throw Error('FIRE protected complete D1 records blocked: '+reason);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(x,expected)=>object(x)&&Object.keys(x).length===expected.length&&
 expected.every(k=>Object.prototype.hasOwnProperty.call(x,k));
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const passphrase=x=>{
 if(typeof x!=='string'||x.length<16||x.length>1024)
  fail('a 16–1024-character private recovery passphrase is required');
 const bytes=enc.encode(x);
 if(bytes.length>4096)fail('recovery passphrase exceeds safe byte length');
 return bytes;
};
const keyFrom=async (phrase,salt)=>{
 if(!globalThis.crypto?.subtle)fail('secure browser encryption is unavailable');
 const bytes=passphrase(phrase);
 try{
  const secret=await crypto.subtle.importKey('raw',bytes,'PBKDF2',false,['deriveKey']);
  return await crypto.subtle.deriveKey(
   {name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},
   secret,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 }finally{bytes.fill(0);}
};
const ordered=JSON.stringify;
const exactReviewKeys=['format','version','schemaIdentity','core','supplemental',
 'allReviewedRecordTablesIncluded','sourceTables','sourceRowCount','isEncrypted',
 'completeBackup','actualProviderSourceIdentityVerified','offDeviceCustodyVerified',
 'photoBytesIncluded','isolatedPhysicalRestoreVerified','gate7Accepted','cloudflareWritesPerformed'];
/** Independent browser preflight: fail closed for partial tables, malformed
 * history, a false claimed release proof or missing original D1 journal.
 * Returns the original core+supplemental contract accepted by Node recovery.
 */
export function validateCompleteReviewedD1Archive(review){
 if(!keys(review,exactReviewKeys)||review.format!=='fire-full-d1-records-review'||
    review.version!==1||review.allReviewedRecordTablesIncluded!==true||
    !Number.isSafeInteger(review.sourceTables)||
    !Number.isSafeInteger(review.sourceRowCount)||review.sourceRowCount<0||
    review.isEncrypted!==false||review.completeBackup!==false||
    review.actualProviderSourceIdentityVerified!==false||
    review.offDeviceCustodyVerified!==false||review.photoBytesIncluded!==false||
    review.isolatedPhysicalRestoreVerified!==false||review.gate7Accepted!==false||
    review.cloudflareWritesPerformed!==false)
  fail('source review is not a truthful complete record-only snapshot');
 const {core,supplemental:extra,schemaIdentity:identity}=review;
 if(!object(core)||!object(extra)||!object(identity)||
    identity.format!=='fire-isolated-sqlite-schema'||identity.version!==1||
    !/^[a-f0-9]{64}$/.test(identity.sha256||'')||
    !Number.isSafeInteger(identity.tables)||!Number.isSafeInteger(identity.objects)||
    !keys(core,['format','version','allTablesComplete','truncated','schemaIdentity','tables','rowCounts','highWater'])||
    !keys(extra,['format','version','allTablesComplete','truncated','schemaIdentity','tables','rowCounts','sqliteSequence'])||
    ordered(core.schemaIdentity)!==ordered(identity)||
    ordered(extra.schemaIdentity)!==ordered(identity))
  fail('record and supplemental source schema identities differ');
 let proof,checked;
 try{
  proof=validateNumberedCoreRecordsV2(core);
  const extraTables=Object.keys(extra.tables||{}).sort();
  if(!extraTables.includes('auth_rate_limits')||!extraTables.includes('d1_migrations')||
     extraTables.length!==Object.keys(extra.rowCounts||{}).length||
     !['auth_rate_limits','d1_migrations','estimate_service_locations',
      'customer_properties','estimate_property_links','property_recovery_guard']
      .every(name=>extraTables.includes(name)||!Object.prototype.hasOwnProperty.call(extra.rowCounts||{},name)))
   fail('supplemental source table inventory malformed');
  checked=validateSupplementalRecoveryArchive(extra,extraTables);
  validateCompleteSupplementalCustomerHistory(core,extra);
 }catch{fail('full core, signed financial history or supplemental relationships invalid');}
 const extras=Object.keys(extra.tables);
 // The source contract must enumerate exactly the known 2 or 3/6
 // supplemental tables; any unsupported feature needs its own review.
 const expected=['auth_rate_limits','d1_migrations'];
 if(extras.includes('estimate_service_locations'))expected.push('estimate_service_locations');
 if(extras.includes('customer_properties')||extras.includes('estimate_property_links')||
    extras.includes('property_recovery_guard'))
  expected.push('customer_properties','estimate_property_links','property_recovery_guard');
 if(new Set(extras).size!==expected.length||expected.some(x=>!extras.includes(x)))
  fail('unknown/missing supplemental table in source review');
 const journal=extra.tables.d1_migrations;
 if(!Array.isArray(journal)||journal.length<1||journal.length>64)
  fail('physical D1 migration journal is absent or unsupported');
 const migrations=new Set();
 const sorted=journal.slice().sort((a,b)=>a.id-b.id);
 for(let i=0;i<sorted.length;i++){
  const row=sorted[i];
  if(!object(row)||!Number.isSafeInteger(row.id)||row.id!==i+1||
     typeof row.name!=='string'||!/^00[0-9]{2}_[a-z0-9_]+\.sql$/.test(row.name)||
     migrations.has(row.name))
   fail('migration journal is not ordered, unique and contiguous');
  migrations.add(row.name);
 }
 const coreTableCount=Object.keys(core.tables).length;
 if(coreTableCount!==23||review.sourceTables!==coreTableCount+extras.length||
    identity.tables!==review.sourceTables||
    review.sourceRowCount!==proof.coreRows+
      core.tables.fire_customer_numbers.length+core.tables.fire_job_numbers.length+
      core.tables.fire_job_estimate_links.length+checked.rows)
  fail('record source count or sealed schema inventory mismatch');
 return Object.freeze({core,extra,schemaIdentity:identity,sourceTables:review.sourceTables,
  sourceRowCount:review.sourceRowCount,migrationCount:journal.length});
}
function encodeSnapshot(review){
 const snapshot=validateCompleteReviewedD1Archive(review);
 // Independent JSON round-trip refuses getters / toJSON that mutate a
 // supposedly complete records source before encryption.
 let cloned;
 try{cloned=validateCompleteReviewedD1Archive(JSON.parse(JSON.stringify(review)));}
 catch{fail('review source cannot be serialized without loss or mutation');}
 if(ordered(snapshot.core)!==ordered(cloned.core)||
    ordered(snapshot.extra)!==ordered(cloned.extra))
  fail('complete records changed while preparing encrypted bytes');
 const core=enc.encode(ordered(cloned.core));
 const extra=enc.encode(ordered(cloned.extra));
 if(!core.length||!extra.length||core.length+extra.length>MAX_REVIEW){
  core.fill(0);extra.fill(0);fail('review exceeds safe 5MB protected record limit');
 }
 return {core,extra};
}
/** Entire object encrypted in memory; never produces a plaintext file. */
export async function protectCompleteReviewedD1Records(review,phrase){
 const {core,extra}=encodeSnapshot(review);
 const header=new Uint8Array(HEADER),api=globalThis.crypto;
 if(!api?.subtle||typeof api.getRandomValues!=='function')
  fail('secure browser encryption unavailable');
 header.set(MAGIC);
 api.getRandomValues(header.subarray(8,24));
 api.getRandomValues(header.subarray(24,36));
 const view=new DataView(header.buffer);
 view.setUint32(36,core.length,true);
 view.setUint32(40,extra.length,true);
 view.setUint32(44,ITERATIONS,true);
 const plain=new Uint8Array(core.length+extra.length);
 plain.set(core);plain.set(extra,core.length);
 try{
  const key=await keyFrom(phrase,header.subarray(8,24));
  const ciphertext=await api.subtle.encrypt(
   {name:'AES-GCM',iv:header.subarray(24,36),additionalData:header,tagLength:128},
   key,plain);
  return new Blob([header,ciphertext],{type:'application/octet-stream'});
 }finally{core.fill(0);extra.fill(0);plain.fill(0);}
}
/** Compatible with existing Node restore's FIRERB01 decryptor. */
export async function verifyProtectedCompleteReviewedD1Records(file,phrase){
 if(!(file instanceof Blob)||file.size<HEADER+TAG+2||
    file.size>HEADER+MAX_REVIEW+TAG)fail('missing, oversized or incomplete encrypted file');
 const header=new Uint8Array(await file.slice(0,HEADER).arrayBuffer());
 const view=new DataView(header.buffer);
 const n=view.getUint32(36,true),m=view.getUint32(40,true);
 if(!same(header.subarray(0,8),MAGIC)||
    view.getUint32(44,true)!==ITERATIONS||n<1||m<1||
    n+m>MAX_REVIEW||file.size!==HEADER+n+m+TAG)
  fail('invalid complete encrypted records header or body length');
 let plain;
 try{
  const key=await keyFrom(phrase,header.subarray(8,24));
  plain=new Uint8Array(await crypto.subtle.decrypt(
   {name:'AES-GCM',iv:header.subarray(24,36),additionalData:header,tagLength:128},
   key,await file.slice(HEADER).arrayBuffer()));
  if(plain.byteLength!==n+m)fail('authenticated record bytes mismatch');
  const core=JSON.parse(dec.decode(plain.subarray(0,n)));
  const supplemental=JSON.parse(dec.decode(plain.subarray(n)));
  const countCore=Object.keys(core.tables||{}).length,
    countExtra=Object.keys(supplemental.tables||{}).length;
  const result=validateCompleteReviewedD1Archive({
   format:'fire-full-d1-records-review',version:1,
   schemaIdentity:core.schemaIdentity,core,supplemental,
   allReviewedRecordTablesIncluded:true,
   sourceTables:countCore+countExtra,
   sourceRowCount:Object.values(core.rowCounts||{}).reduce((a,b)=>a+b,0)+
    Object.values(supplemental.rowCounts||{}).reduce((a,b)=>a+b,0),
   isEncrypted:false,completeBackup:false,
   actualProviderSourceIdentityVerified:false,offDeviceCustodyVerified:false,
   photoBytesIncluded:false,isolatedPhysicalRestoreVerified:false,
   gate7Accepted:false,cloudflareWritesPerformed:false
  });
  return Object.freeze({format:'fire-protected-complete-d1-records-review',version:1,
   core:result.core,supplemental:result.extra,schemaIdentity:result.schemaIdentity,
   authenticatedSavedFileBytes:true,sourceTables:result.sourceTables,
   migrationCount:result.migrationCount,photoBytesIncluded:false,
   offDeviceCustodyVerified:false,hostedD1RestoreVerified:false,
   gate7Accepted:false,remoteWritesPerformed:false});
 }catch{
  fail('wrong recovery phrase, tampered file or incomplete saved records');
 }finally{plain?.fill(0);}
}
const digestBlob=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),
 b=>b.toString(16).padStart(2,'0')).join('');
/** In-memory draft is not saved, backed up or recoverable until owner saves. */
export async function prepareCompleteD1OwnerFile(review,phrase,confirmation,now=new Date()){
 if(typeof phrase!=='string'||phrase!==confirmation)fail('recovery passphrases differ');
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))fail('invalid archive filename date');
 const blob=await protectCompleteReviewedD1Records(review,phrase);
 const verified=await verifyProtectedCompleteReviewedD1Records(blob,phrase);
 if(ordered(verified.core)!==ordered(review.core)||
    ordered(verified.supplemental)!==ordered(review.supplemental))
  fail('prepared encrypted bytes differ from complete original source');
 return Object.freeze({format:'fire-protected-complete-d1-owner-file',version:1,
  blob,sha256:await digestBlob(blob),sizeBytes:blob.size,
  filename:'FIRE-complete-D1-RECORDS-REVIEW-'+now.toISOString().replace(/[:.]/g,'-')+'.firerecords',
  inMemoryEncryptionVerified:true,savedFileReadBackVerified:false,
  offDeviceCustodyVerified:false,photoBytesIncluded:false,
  isolatedD1RestoreVerified:false,gate7Accepted:false});
}
/** Read back a deliberately selected SAVED owner file: never infer iCloud
 * custody or reuse a prior in-memory-only Blob as a physical saved file.
 */
export async function verifySelectedSavedCompleteD1OwnerFile(prepared,saved,phrase){
 if(!prepared||prepared.format!=='fire-protected-complete-d1-owner-file'||
    prepared.version!==1||prepared.inMemoryEncryptionVerified!==true||
    prepared.savedFileReadBackVerified!==false||prepared.gate7Accepted!==false||
    !(prepared.blob instanceof Blob)||!(saved instanceof Blob)||
    saved.size!==prepared.sizeBytes||!Number.isSafeInteger(saved.size)||
    !/^[a-f0-9]{64}$/.test(prepared.sha256||''))
  fail('previous unsaved source and separately selected file required');
 const original=await digestBlob(prepared.blob),actual=await digestBlob(saved);
 if(original!==prepared.sha256||actual!==original)
  fail('chosen SAVED ciphertext is not identical to prepared source');
 const [source,copy]=await Promise.all([
  verifyProtectedCompleteReviewedD1Records(prepared.blob,phrase),
  verifyProtectedCompleteReviewedD1Records(saved,phrase)
 ]);
 if(ordered(source.core)!==ordered(copy.core)||
    ordered(source.supplemental)!==ordered(copy.supplemental))
  fail('saved original numbered/financial records differ');
 return Object.freeze({format:'fire-protected-complete-d1-selected-file',version:1,
  encryptedFileSha256:actual,encryptedFileByteLength:saved.size,
  selectedCiphertextIdentical:true,completeReviewedD1RecordsAuthenticated:true,
  sourceTables:source.sourceTables,migrationCount:source.migrationCount,
  originalPhotoBytesIncluded:false,offDeviceCustodyVerified:false,
  providerIdentityVerified:false,isolatedD1RestoreVerified:false,
  gate7Accepted:false,remoteWritesPerformed:false});
}
