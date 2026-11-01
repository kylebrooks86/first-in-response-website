/** FIRE v2 owner-held encrypted records container — SOURCE ONLY, NO ROUTE.
 *
 * Confidential customer, estimate, payment, refund, signed agreement, and
 * permanent Customer#/Job# records must never be treated as safe-to-share JSON.
 * PBKDF2(SHA-256, 600,000 iterations, fresh 16-byte random salt) derives a
 * nonextractable AES-256-GCM key. Each export uses a NEW 12-byte random nonce.
 * Decryption rechecks complete v2 hash, financial, agreement, and identity
 * semantics before returning an archive. Plaintext is never logged/stored here.
 *
 * This is not an authenticated owner session, a photo FILE backup, a hosted
 * API, a D1 read/restore, a credential vault, or proof that a passphrase is
 * strong. If the passphrase is lost, the archive cannot be recovered.
 */
import {inspectFinanciallyVerifiedNumberedRecordsV2}
  from './numbered-records-v2-integrity.mjs';

export const FIRE_ENCRYPTED_NUMBERED_FORMAT='fire-app-numbered-records-v2-sealed';
export const FIRE_ENCRYPTED_NUMBERED_VERSION=1;
const ITERATIONS=600000;
const MIN_ITERATIONS=600000;
const MAX_ITERATIONS=1500000;
const MAX_JSON_BYTES=64*1024*1024;
const KDF='PBKDF2-SHA256',CIPHER='AES-256-GCM';
const ENVELOPE_KEYS=['format','version','kdf','iterations','cipher','saltBase64','nonceBase64',
  'photoFilesIncluded','ciphertextBase64'];

const reject=reason=>{throw new Error('FIRE PRIVATE v2 ARCHIVE REFUSED: '+reason);};
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const bytesUtf8=value=>new TextEncoder().encode(value);
function requireCrypto(c){
 if(!c?.subtle?.importKey||!c?.subtle?.deriveKey||!c?.subtle?.encrypt||
    !c?.subtle?.decrypt||!c?.getRandomValues)
   reject('secure Web Crypto unavailable');
 return c;
}
function verifyPassword(passphrase){
 if(typeof passphrase!=='string'||!passphrase||passphrase.length<20||
    bytesUtf8(passphrase).length>1024)
  reject('owner-held passphrase must be at least 20 characters (and at most 1024 UTF-8 bytes)');
 return passphrase;
}
function b64(bytes){
 let out='';
 for(let i=0;i<bytes.length;i+=0x8000)
  out+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return btoa(out);
}
function unb64(value,minLength,maxLength,label){
 if(typeof value!=='string'||value.length>Math.ceil(maxLength/3)*4+4||
   value.length<Math.ceil(minLength/3)*4||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
  reject('invalid '+label+' encoding');
 let bin;
 try{bin=atob(value);}catch{reject('invalid '+label+' encoding');}
 if(bin.length<minLength||bin.length>maxLength)reject('invalid '+label+' size');
 const data=Uint8Array.from(bin,c=>c.charCodeAt(0));
 if(b64(data)!==value)reject('noncanonical '+label+' encoding');
 return data;
}
function aad(header){
 return bytesUtf8(JSON.stringify([
  header.format,header.version,header.kdf,header.iterations,header.cipher,
  header.saltBase64,header.nonceBase64,header.photoFilesIncluded
 ]));
}
function validateEnvelope(value){
 if(!record(value)||Object.keys(value).sort().join('|')!==[...ENVELOPE_KEYS].sort().join('|'))
  reject('unreviewed or incomplete encrypted container');
 if(value.format!==FIRE_ENCRYPTED_NUMBERED_FORMAT||
    value.version!==FIRE_ENCRYPTED_NUMBERED_VERSION||
    value.kdf!==KDF||value.cipher!==CIPHER||
    value.photoFilesIncluded!==false||
    !Number.isSafeInteger(value.iterations)||
    value.iterations<MIN_ITERATIONS||value.iterations>MAX_ITERATIONS)
  reject('unsupported encryption format, parameters, or photo-file claim');
 const salt=unb64(value.saltBase64,16,16,'salt');
 const nonce=unb64(value.nonceBase64,12,12,'nonce');
 const ciphertext=unb64(value.ciphertextBase64,17,MAX_JSON_BYTES+16,'encrypted data');
 return {salt,nonce,ciphertext};
}
async function secretKey(c,password,salt,iterations){
 const key=await c.subtle.importKey('raw',bytesUtf8(password),'PBKDF2',false,['deriveKey']);
 return c.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},
   key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}

/** Seal a fully verified, trusted v2 source archive before any download or
 * storage. Returns only the encrypted container and safe count-free metadata.
 */
export async function encryptFinanciallyVerifiedNumberedV2({
 archive,passphrase,cryptoImpl=globalThis.crypto
}={}){
 const c=requireCrypto(cryptoImpl),password=verifyPassword(passphrase);
 try{await inspectFinanciallyVerifiedNumberedRecordsV2(archive);}
 catch{reject('unverified full source archive cannot be sealed');}
 const plain=bytesUtf8(JSON.stringify(archive));
 if(plain.byteLength===0||plain.byteLength>MAX_JSON_BYTES)
  reject('records exceed reviewed private archive size; do not split silently');
 const salt=c.getRandomValues(new Uint8Array(16));
 const nonce=c.getRandomValues(new Uint8Array(12));
 const header={format:FIRE_ENCRYPTED_NUMBERED_FORMAT,
  version:FIRE_ENCRYPTED_NUMBERED_VERSION,kdf:KDF,iterations:ITERATIONS,cipher:CIPHER,
  saltBase64:b64(salt),nonceBase64:b64(nonce),photoFilesIncluded:false};
 const key=await secretKey(c,password,salt,ITERATIONS);
 const ciphertext=new Uint8Array(await c.subtle.encrypt(
  {name:'AES-GCM',iv:nonce,additionalData:aad(header),tagLength:128},key,plain));
 return Object.freeze({...header,ciphertextBase64:b64(ciphertext)});
}

/** Unseal and revalidate both AES-GCM authenticity and the complete v2
 * financial+signed document+identity contracts. NO database or file actions.
 */
export async function decryptFinanciallyVerifiedNumberedV2({
 sealed,passphrase,cryptoImpl=globalThis.crypto
}={}){
 const c=requireCrypto(cryptoImpl),password=verifyPassword(passphrase);
 const {salt,nonce,ciphertext}=validateEnvelope(sealed);
 try{
  const key=await secretKey(c,password,salt,sealed.iterations);
  const bytes=new Uint8Array(await c.subtle.decrypt(
   {name:'AES-GCM',iv:nonce,additionalData:aad(sealed),tagLength:128},key,ciphertext));
  if(bytes.byteLength===0||bytes.byteLength>MAX_JSON_BYTES)
   reject('decrypted archive size is out of range');
  const archive=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  const summary=await inspectFinanciallyVerifiedNumberedRecordsV2(archive);
  return {archive,summary:Object.freeze({...summary,encryptedAtRest:false,ownerAuthenticated:false,
    photoFilesRecovered:false,hostedWritesPerformed:false})};
 }catch{
  // Do not reveal which part of potentially private decrypted content failed.
  reject('wrong passphrase, changed container, or invalid source archive');
 }
}
