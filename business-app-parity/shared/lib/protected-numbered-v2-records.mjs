/** FIRE numbered v2 CORE RECORDS encrypted owner-file candidate (SOURCE ONLY).
 *
 * This protects the existing validated 23-table snapshot plus permanent number
 * high-water; it does NOT include camera photos, supplemental service-location/
 * property tables, D1 schema/SQL or any provider deployment or physical custody.
 * No HTTP route, D1 mutations, persistent storage, file writes or hidden unlock.
 * A future approved owner UI must save the returned Blob OFF device and read
 * the SAVED file back; even then an independently verified full restore is
 * mandatory before Gate 7 can be accepted. Never call this a full backup.
 *
 * File format: "FIRERN02" (8 bytes) | random 16-byte PBKDF2 salt |
 * random 12-byte AES-GCM IV | uint32 LE original byte count |
 * AES-256-GCM ciphertext and 16-byte authentication tag.
 * Domain-separated AAD authenticates the entire header and file purpose.
 * Intentionally distinct from the existing .firephotos encrypted photo ZIP.
 */
import {validateNumberedCoreRecordsV2} from './numbered-records-v2-preflight.mjs';

const enc=new TextEncoder(),MAGIC=enc.encode('FIRERN02');
const AAD_DOMAIN=enc.encode('FIRE-numbered-v2-CORE-ONLY-owner-encrypted-records-v1\n');
const HEADER=40,TAG=16,MAX_JSON=5_000_000,ITERATIONS=600_000;
const exactFields=['format','version','allTablesComplete','truncated','tables','rowCounts','highWater'];
const fail=why=>{throw Error('FIRE protected numbered CORE records blocked: '+why);};
const cryptoApi=()=>{
 const api=globalThis.crypto;
 if(!api?.subtle||typeof api.getRandomValues!=='function')fail('secure browser cryptography unavailable');
 return api;
};
const exactKeys=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(value,k));
const passphrase=value=>{
 if(typeof value!=='string'||value.length<16||value.length>1024)
  fail('use a private 16–1024 character recovery passphrase');
 return enc.encode(value);
};
const ad=header=>{
 const result=new Uint8Array(AAD_DOMAIN.length+HEADER);
 result.set(AAD_DOMAIN);result.set(header,AAD_DOMAIN.length);return result;
};
async function deriveKey(phrase,salt){
 const bytes=passphrase(phrase),api=cryptoApi();
 try{
  const base=await api.subtle.importKey('raw',bytes,'PBKDF2',false,['deriveKey']);
  return await api.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},
   base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 }finally{bytes.fill(0);}
}
function validateSnapshot(input){
 if(!exactKeys(input,exactFields)||!exactKeys(input.highWater,['customer','job']))
  fail('snapshot has unexpected or missing fields');
 try{validateNumberedCoreRecordsV2(input);}
 catch{fail('numbered schema, financial ledger or permanent numbering is incomplete');}
 return input;
}
function same(a,b){return a.length===b.length&&a.every((value,i)=>value===b[i]);}

/** Returns only a still-IN-MEMORY encrypted Blob. Not saved, not recoverable,
 * and not a Gate7 acceptance. Caller must explicitly save/verify separately.
 */
export async function protectNumberedCoreV2Records(snapshot,phrase){
 validateSnapshot(snapshot);
 // Copy and revalidate the EXACT JSON that is going to be encrypted. Neither
 // object getters nor toJSON may quietly change customer/payment information.
 let bytes;
 try{
  const copied=validateSnapshot(JSON.parse(JSON.stringify(snapshot)));
  bytes=enc.encode(JSON.stringify(copied));
 }catch{fail('snapshot cannot be serialized and validated without data loss');}
 if(!bytes.length||bytes.byteLength>MAX_JSON)fail('reviewed 5 MB records limit exceeded');
 const api=cryptoApi(),header=new Uint8Array(HEADER);
 header.set(MAGIC);
 api.getRandomValues(header.subarray(8,24));
 api.getRandomValues(header.subarray(24,36));
 new DataView(header.buffer).setUint32(36,bytes.byteLength,true);
 try{
  const secret=await deriveKey(phrase,header.subarray(8,24));
  const encrypted=await api.subtle.encrypt({name:'AES-GCM',iv:header.subarray(24,36),
   additionalData:ad(header),tagLength:128},secret,bytes);
  return new Blob([header,encrypted],{type:'application/octet-stream'});
 }finally{bytes.fill(0);}
}

/** Readback verifier. Even when successful it proves only that these bytes
 * can decrypt and satisfy the reviewed v2 records contract, NOT that any
 * Cloudflare photo, optional table, separate device, or restore is covered.
 * It never reads/writes IndexedDB, local files, D1, R2, Stripe or a Worker.
 */
export async function verifyProtectedNumberedCoreV2Records(file,phrase){
 if(!(file instanceof Blob)||file.size<HEADER+TAG+1||
    file.size>HEADER+MAX_JSON+TAG)fail('truncated or oversized records file');
 const header=new Uint8Array(await file.slice(0,HEADER).arrayBuffer());
 if(!same(header.subarray(0,8),MAGIC))fail('not a supported numbered CORE records file');
 const length=new DataView(header.buffer).getUint32(36,true);
 if(length<1||length>MAX_JSON||file.size!==HEADER+length+TAG)
  fail('incomplete or oversized encrypted records body');
 const api=cryptoApi();
 const secret=await deriveKey(phrase,header.subarray(8,24));
 let plain;
 try{
  const cipher=await file.slice(HEADER).arrayBuffer();
  plain=new Uint8Array(await api.subtle.decrypt({name:'AES-GCM',iv:header.subarray(24,36),
   additionalData:ad(header),tagLength:128},secret,cipher));
  if(plain.byteLength!==length)fail('authenticated records byte count differs');
  const decoded=new TextDecoder('utf-8',{fatal:true}).decode(plain);
  const snapshot=validateSnapshot(JSON.parse(decoded));
  return Object.freeze({
   format:'fire-protected-numbered-core-v2-verification',version:1,snapshot,
   encryptedFileAuthenticated:true,numberedCoreValidated:true,
   includedCoreTables:20,includedPermanentIdentityTables:3,
   photoBytesIncluded:false,supplementalSchemaCoverageVerified:false,
   independentOffDeviceCustodyVerified:false,isolatedD1RestoreVerified:false,
   hostedProviderIdentityVerified:false,gate7Accepted:false,
   databaseWritesPerformed:false
  });
 }catch{
  fail('wrong passphrase, altered file or invalid numbered records; no data changed');
 }finally{plain?.fill(0);}
}
