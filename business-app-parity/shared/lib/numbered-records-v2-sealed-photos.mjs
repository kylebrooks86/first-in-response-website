/** FIRE source-only PHOTO BYTE recovery package — no hosting or filesystem I/O.
 * Pair this sensitive sealed vault with its original sealed v2 records archive.
 * Records (not in this package) must be independently decrypted and reviewed.
 * Key material, names, object keys and hashes are inside authenticated AES-GCM
 * ciphertext. Each image has a fresh nonce, with metadata bound by AAD to the
 * exact ORIGINAL records checksum and zero-based image index.
 * All operations are in-memory; photos >64 MiB total require future chunked
 * workflow, never silent truncation. This does not authenticate an owner.
 */
import {inspectFinanciallyVerifiedNumberedRecordsV2}
 from './numbered-records-v2-integrity.mjs';
import {buildNumberedV2PhotoVaultManifest,verifyNumberedV2PhotoVault}
 from './numbered-records-v2-photo-vault.mjs';

export const FIRE_SEALED_PHOTO_VAULT_FORMAT='fire-numbered-v2-encrypted-photo-bytes';
export const FIRE_SEALED_PHOTO_VAULT_VERSION=1;
const ITERATIONS=600000, MAX_FILES=1000, MAX_BYTES=64*1024*1024;
const fail=reason=>{throw new Error('FIRE SEALED PHOTO VAULT REFUSED: '+reason);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(v,k)=>obj(v)&&Object.keys(v).sort().join('|')===[...k].sort().join('|');
const utf8=text=>new TextEncoder().encode(text);
const envKeys=['format','version','recordChecksum','kdf','iterations','cipher',
 'saltBase64','manifestNonceBase64','manifestCiphertextBase64','items'];
const itemKeys=['nonceBase64','ciphertextBase64'];
function requireCrypto(c){
 if(!c?.getRandomValues||!c?.subtle?.importKey||!c?.subtle?.deriveKey||
    !c?.subtle?.encrypt||!c?.subtle?.decrypt)fail('Web Crypto unavailable');
 return c;
}
function password(p){
 if(typeof p!=='string'||p.length<20||utf8(p).length>1024)
  fail('private passphrase length outside reviewed range');
 return p;
}
function encode(bytes){
 // Fixed-size chunks avoid large arguments to String.fromCharCode.
 let binary='';
 for(let i=0;i<bytes.length;i+=0x4000)
  binary+=String.fromCharCode(...bytes.subarray(i,i+0x4000));
 return btoa(binary);
}
function decode(value,min,max){
 if(typeof value!=='string'||value.length>Math.ceil(max/3)*4+4||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
  fail('invalid base64 encoding');
 let raw;try{raw=atob(value);}catch{fail('invalid base64 encoding');}
 if(raw.length<min||raw.length>max)fail('invalid sealed byte length');
 const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
 if(encode(bytes)!==value)fail('noncanonical base64 encoding');
 return bytes;
}
function digest(archive){
 const value=archive?.checksum?.hex;
 if(typeof value!=='string'||!/^[0-9a-f]{64}$/.test(value))
  fail('verified records checksum missing');
 return value;
}
function associated(checksum,index,nonce){
 return utf8(JSON.stringify([FIRE_SEALED_PHOTO_VAULT_FORMAT,1,checksum,index,encode(nonce)]));
}
async function derive(c,p,salt,iterations){
 const material=await c.subtle.importKey('raw',utf8(p),'PBKDF2',false,['deriveKey']);
 return c.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',
  salt,iterations},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function random(c,size){return c.getRandomValues(new Uint8Array(size));}
async function seal(c,key,bytes,checksum,index){
 const nonce=random(c,12);
 const ciphertext=new Uint8Array(await c.subtle.encrypt({name:'AES-GCM',
  iv:nonce,additionalData:associated(checksum,index,nonce),tagLength:128},key,bytes));
 return {nonceBase64:encode(nonce),ciphertextBase64:encode(ciphertext)};
}
async function open(c,key,item,checksum,index,min,max){
 if(!keys(item,itemKeys))fail('unknown or incomplete photo cipher entry');
 const nonce=decode(item.nonceBase64,12,12);
 const data=decode(item.ciphertextBase64,min+16,max+16);
 return new Uint8Array(await c.subtle.decrypt({name:'AES-GCM',
  iv:nonce,additionalData:associated(checksum,index,nonce),tagLength:128},key,data));
}
function bounded(files){
 if(!Array.isArray(files)||files.length>MAX_FILES)fail('photo count exceeds reviewed bound');
 let total=0;
 for(const f of files){
  if(!(f?.bytes instanceof Uint8Array))fail('photo byte array missing');
  total+=f.bytes.byteLength;
  if(total>MAX_BYTES||!Number.isSafeInteger(total))
   fail('total photo bytes exceed reviewed in-memory bound');
 }
 return total;
}
/** Create one encrypted photo-byte container for an ALREADY VALID v2 records
 * archive and separately fetched original file bytes. No file/ZIP/R2 reads.
 * Manifest + keys are encrypted. The original checksum binds this package to
 * one exact records archive. The passphrase must be kept outside the archive.
 */
export async function sealNumberedV2PhotoBytes({
 archive,files,passphrase,cryptoImpl=globalThis.crypto
}={}){
 const c=requireCrypto(cryptoImpl),p=password(passphrase);
 await inspectFinanciallyVerifiedNumberedRecordsV2(archive);
 const checksum=digest(archive);
 bounded(files);
 const manifest=await buildNumberedV2PhotoVaultManifest({archive,files,cryptoImpl:c});
 const sorted=[...files].sort((a,b)=>a.objectKey.localeCompare(b.objectKey,'en'));
 const salt=random(c,16),key=await derive(c,p,salt,ITERATIONS);
 const encryptedManifest=await seal(c,key,utf8(JSON.stringify(manifest)),checksum,-1);
 const items=[];
 for(let i=0;i<sorted.length;i++)
  items.push(await seal(c,key,sorted[i].bytes,checksum,i));
 return Object.freeze({format:FIRE_SEALED_PHOTO_VAULT_FORMAT,
  version:FIRE_SEALED_PHOTO_VAULT_VERSION,recordChecksum:checksum,
  kdf:'PBKDF2-SHA256',iterations:ITERATIONS,cipher:'AES-256-GCM',
  saltBase64:encode(salt),manifestNonceBase64:encryptedManifest.nonceBase64,
  manifestCiphertextBase64:encryptedManifest.ciphertextBase64,items});
}
/** Decrypt + fully revalidate image bytes against the authenticated manifest
 * and the independently verified *matching* records archive. Returns ONLY
 * volatile byte arrays, never writes to R2 or a filesystem.
 */
export async function unsealNumberedV2PhotoBytes({
 archive,sealed,passphrase,cryptoImpl=globalThis.crypto
}={}){
 const c=requireCrypto(cryptoImpl),p=password(passphrase);
 await inspectFinanciallyVerifiedNumberedRecordsV2(archive);
 const checksum=digest(archive);
 if(!keys(sealed,envKeys)||sealed.format!==FIRE_SEALED_PHOTO_VAULT_FORMAT||
    sealed.version!==FIRE_SEALED_PHOTO_VAULT_VERSION||
    sealed.recordChecksum!==checksum||sealed.kdf!=='PBKDF2-SHA256'||
    sealed.iterations!==ITERATIONS||sealed.cipher!=='AES-256-GCM'||
    !Array.isArray(sealed.items)||sealed.items.length>MAX_FILES||
    sealed.items.length!==archive.records.tables.customer_photos.length)
  fail('records association, cipher settings or photo count invalid');
 const salt=decode(sealed.saltBase64,16,16);
 try{
  const key=await derive(c,p,salt,ITERATIONS);
  const manifestBytes=await open(c,key,{
   nonceBase64:sealed.manifestNonceBase64,
   ciphertextBase64:sealed.manifestCiphertextBase64
  },checksum,-1,2,MAX_BYTES);
  const manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes));
  if(!Array.isArray(manifest.files)||manifest.files.length!==sealed.items.length)
   fail('decrypted photo manifest count invalid');
  const files=[];let total=0;
  for(let i=0;i<sealed.items.length;i++){
   const metadata=manifest.files[i];
   if(!obj(metadata)||!Number.isSafeInteger(metadata.sizeBytes)||
       metadata.sizeBytes<0||metadata.sizeBytes>20*1024*1024)
    fail('unreviewed photo file size');
   total+=metadata.sizeBytes;
   if(total>MAX_BYTES)fail('photo aggregate exceeds reviewed bound');
   const bytes=await open(c,key,sealed.items[i],checksum,i,
    metadata.sizeBytes,metadata.sizeBytes);
   files.push({objectKey:metadata.objectKey,
    contentType:metadata.contentType,bytes});
  }
  const proof=await verifyNumberedV2PhotoVault({
   archive,files,protectedManifest:manifest,cryptoImpl:c});
  return {files,proof:Object.freeze({...proof,encryptedFilesOpened:true,
   photoFilesPersisted:false,cloudPhotoRestorePerformed:false,
   ownerAuthenticated:false})};
 }catch{
  fail('wrong password, changed sealed bytes, mismatched records or incomplete files');
 }
}
