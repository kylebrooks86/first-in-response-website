/** Focused zero-provider cryptographic photo backup regressions. */
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {protectOfflinePhotoZip,recoverProtectedOfflinePhotoZip,
 isProtectedOfflinePhotoArchive,openOwnerOfflinePhotoArchive} from '../lib/protected-offline-photo-archive.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const phrase='Private FIRE backup phrase 2026! (synthetic test only)';
const wrong='Different passphrase, also over sixteen chars';
const text='manifest.json photos/customer-0001/before.jpg Original image bytes';
const original=new Blob([new TextEncoder().encode(text)],{type:'application/zip'});
let n=0;
function check(value,message){assert.ok(value,message);n++;}
const result=await protectOfflinePhotoZip(original,phrase);
check(await isProtectedOfflinePhotoArchive(result),'encrypted format header');
check(result.type==='application/octet-stream','opaque binary format');
check(result.size>original.size+48,'authenticated encryption has extra metadata');
check(!new TextDecoder().decode(await result.arrayBuffer()).includes(text),'no plaintext photo names in protected bytes');
const decoded=await recoverProtectedOfflinePhotoZip(result,phrase);
check(await decoded.text()===text,'exact decrypted bytes');
check(decoded.type==='application/zip','old ZIP validator can accept decrypted bytes');
check(await (await openOwnerOfflinePhotoArchive(result,phrase)).text()===text,'new archive opens for verify/restore');
check(await openOwnerOfflinePhotoArchive(original,'')===original,'legacy unencrypted ZIP remains readable');
check(!await isProtectedOfflinePhotoArchive(original),'legacy ZIP is not mislabeled protected');
await assert.rejects(recoverProtectedOfflinePhotoZip(result,wrong),/wrong passphrase or damaged/);n++;
await assert.rejects(protectOfflinePhotoZip(original,'too short'),/16/);n++;
await assert.rejects(recoverProtectedOfflinePhotoZip(result,'too short'),/16/);n++;
await assert.rejects(protectOfflinePhotoZip(new Blob([]),phrase),/empty|limit/);n++;
async function altered(change){
 const bytes=new Uint8Array(await result.arrayBuffer());change(bytes);
 await assert.rejects(recoverProtectedOfflinePhotoZip(new Blob([bytes]),phrase),/Protected FIRE photo backup/);n++;
}
await altered(bytes=>{bytes[29]^=0x11;}); // authenticated nonce header
await altered(bytes=>{bytes[44]^=0x01;}); // chunk count
await altered(bytes=>{bytes[60]^=0x01;}); // ciphertext
await assert.rejects(recoverProtectedOfflinePhotoZip(result.slice(0,result.size-1),phrase),/Protected FIRE photo backup/);n++;
await assert.rejects(recoverProtectedOfflinePhotoZip(new Blob([result,new Uint8Array([1])]),phrase),/Protected FIRE photo backup/);n++;
// Each chunk authenticates its index and the complete header. Reordering two
// equal-size ciphertext chunks may NEVER silently restore mixed-up photos.
const block=1024*1024;
const many=new Uint8Array(block*2);
many.fill(71,0,block);many.fill(83,block);
const larger=await protectOfflinePhotoZip(new Blob([many]),phrase);
const buffer=new Uint8Array(await larger.arrayBuffer());
const one=buffer.slice(48,48+block+16),two=buffer.slice(48+block+16,48+2*(block+16));
buffer.set(two,48);buffer.set(one,48+block+16);
await assert.rejects(recoverProtectedOfflinePhotoZip(new Blob([buffer]),phrase),/wrong passphrase or damaged/);n++;
const recovered=await recoverProtectedOfflinePhotoZip(larger,phrase);
check(recovered.size===many.byteLength,'multi-chunk complete recovery');
const good=new Uint8Array(await recovered.arrayBuffer());
check(good[0]===71&&good[block-1]===71&&good[block]===83&&good[good.length-1]===83,'authenticated chunk ordering');
console.log('PASS '+n+'/'+n+' protected photo ZIP encryption, wrong phrase, tamper, ordering, truncation, legacy compatibility; no cloud/provider writes');
