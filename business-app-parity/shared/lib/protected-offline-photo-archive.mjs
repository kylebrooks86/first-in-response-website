/**
 * FIRE owner-device photo archive encryption, no cloud storage or subscription.
 * Opaque v1 file wrapping the EXISTING verified FIRE photo ZIP, not a new ZIP
 * schema. PBKDF2-SHA256 (600,000) -> AES-256-GCM on independently authenticated
 * 1 MiB chunks. The fixed header is authenticated as AAD on EVERY chunk.
 * No photos, filenames or manifest contents appear outside the ciphertext.
 *
 * Browser/Node WebCrypto only; never transmits, stores or logs passphrases.
 * Decryption must finish ALL chunks before callers may inspect or restore.
 */
const encoder=new TextEncoder();
const MAGIC=encoder.encode('FIREPX01');
const HEADER_SIZE=48,CHUNK=1024*1024,TAG=16,ITERATIONS=600000;
const MAX_PLAINTEXT=161*1024*1024;
const stop=message=>{throw Error('Protected FIRE photo backup: '+message);};
const api=()=>{const c=globalThis.crypto;if(!c?.subtle||typeof c.getRandomValues!=='function')stop('secure local cryptography is unavailable');return c;};
const validPhrase=phrase=>{
 if(typeof phrase!=='string'||phrase.length<16||phrase.length>1024)
  stop('use a private recovery passphrase of 16–1024 characters');
 return encoder.encode(phrase);
};
const expectedChunks=length=>Math.ceil(length/CHUNK);
const bits=(bytes,offset=0)=>new DataView(bytes.buffer,bytes.byteOffset+offset);
const same=(a,b)=>a.length===b.length&&a.every((value,i)=>value===b[i]);
async function key(phrase,salt){
 const c=api(),pass=validPhrase(phrase);
 try{
  const base=await c.subtle.importKey('raw',pass,'PBKDF2',false,['deriveKey']);
  return await c.subtle.deriveKey({name:'PBKDF2',salt,hash:'SHA-256',iterations:ITERATIONS},
   base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 }finally{pass.fill(0);}
}
function params(header,index){
 const iv=new Uint8Array(12);
 iv.set(header.subarray(24,32),0);bits(iv).setUint32(8,index,true);
 const additionalData=new Uint8Array(HEADER_SIZE+4);
 additionalData.set(header);bits(additionalData).setUint32(HEADER_SIZE,index,true);
 return {name:'AES-GCM',iv,additionalData,tagLength:128};
}
function headerFor(length){
 if(!Number.isSafeInteger(length)||length<1||length>MAX_PLAINTEXT)
  stop('the verified ZIP is empty or exceeds the encrypted backup limit');
 const header=new Uint8Array(HEADER_SIZE),view=bits(header),c=api();
 header.set(MAGIC);
 c.getRandomValues(header.subarray(8,24)); // random salt
 c.getRandomValues(header.subarray(24,32)); // random IV prefix, independent from salt
 view.setUint32(32,CHUNK,true);
 view.setBigUint64(36,BigInt(length),true);
 view.setUint32(44,expectedChunks(length),true);
 return header;
}
function parseHeader(header,size){
 if(header.byteLength!==HEADER_SIZE||!same(header.subarray(0,8),MAGIC))
  stop('not a supported protected FIRE photo archive');
 const view=bits(header),plain=Number(view.getBigUint64(36,true)),count=view.getUint32(44,true);
 if(view.getUint32(32,true)!==CHUNK||
    !Number.isSafeInteger(plain)||plain<1||plain>MAX_PLAINTEXT||
    count!==expectedChunks(plain)||count<1||
    HEADER_SIZE+plain+count*TAG!==size)
  stop('incomplete or unsupported protected file; no photo changes');
 return {plain,count};
}
export async function isProtectedOfflinePhotoArchive(file){
 if(!(file instanceof Blob)||file.size<HEADER_SIZE)return false;
 const bytes=new Uint8Array(await file.slice(0,MAGIC.length).arrayBuffer());
 return same(bytes,MAGIC);
}
export async function protectOfflinePhotoZip(zip,phrase){
 if(!(zip instanceof Blob))stop('a verified ZIP file is required');
 const header=headerFor(zip.size),secret=await key(phrase,header.subarray(8,24));
 const result=[header];
 for(let i=0;i<expectedChunks(zip.size);i++){
  const start=i*CHUNK;
  const plain=await zip.slice(start,Math.min(zip.size,start+CHUNK)).arrayBuffer();
  const encrypted=await api().subtle.encrypt(params(header,i),secret,plain);
  result.push(encrypted);
 }
 return new Blob(result,{type:'application/octet-stream'});
}
export async function recoverProtectedOfflinePhotoZip(file,phrase){
 if(!(file instanceof Blob)||file.size<HEADER_SIZE+TAG+1)stop('protected archive is truncated');
 const header=new Uint8Array(await file.slice(0,HEADER_SIZE).arrayBuffer());
 const {plain,count}=parseHeader(header,file.size),secret=await key(phrase,header.subarray(8,24));
 const restored=[];let offset=HEADER_SIZE;
 try{
  for(let i=0;i<count;i++){
   const size=Math.min(CHUNK,plain-i*CHUNK)+TAG;
   const encrypted=await file.slice(offset,offset+size).arrayBuffer();
   const decoded=await api().subtle.decrypt(params(header,i),secret,encrypted);
   if(decoded.byteLength!==size-TAG)stop('decrypted length mismatch');
   restored.push(decoded);offset+=size;
  }
 }catch{
  stop('wrong passphrase or damaged protected file; no photos were changed');
 }
 if(offset!==file.size)stop('protected archive contains unexpected bytes');
 return new Blob(restored,{type:'application/zip'});
}
/** Legacy plain FIRE ZIP is still supported; its existing ZIP+SHA-256
 * validator MUST run on the returned Blob before any local DB writes.
 */
export async function openOwnerOfflinePhotoArchive(file,phrase){
 if(!(file instanceof Blob))stop('choose a photo backup file');
 if(await isProtectedOfflinePhotoArchive(file))
  return recoverProtectedOfflinePhotoZip(file,phrase);
 return file;
}
