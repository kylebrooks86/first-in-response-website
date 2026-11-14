/** FIRE owner-device protected photo archive: synthetic files only, no network or provider. */
import assert from 'node:assert/strict';
import {
 protectOfflinePhotoZip,recoverProtectedOfflinePhotoZip,openOwnerOfflinePhotoArchive,
 isProtectedOfflinePhotoArchive
} from '../lib/protected-offline-photo-archive.mjs';
let count=0;
const test=(truth,reason)=>{assert(truth,reason);count++;};
const assertReject=async(promise,pattern,reason)=>{
 await assert.rejects(promise,pattern,reason);count++;
};
const phrase='Correct Horse Stable Warehouse _ FIRE 2026 owner phrase';
const bytes=new Uint8Array(1024*1024+127);
for(let i=0;i<bytes.length;i++)bytes[i]=(i*37+91)&255;
const archive=new Blob([bytes],{type:'application/zip'});
const protectedOne=await protectOfflinePhotoZip(archive,phrase);
test(protectedOne.size>archive.size,'protected file includes authenticated headers and tags');
test(await isProtectedOfflinePhotoArchive(protectedOne),'protected file signature');
const original=await recoverProtectedOfflinePhotoZip(protectedOne,phrase);
test(original.size===archive.size,'decrypted size');
test(Buffer.compare(Buffer.from(await original.arrayBuffer()),Buffer.from(bytes))===0,'all encrypted chunks recover exactly');
const opened=await openOwnerOfflinePhotoArchive(protectedOne,phrase);
test(Buffer.compare(Buffer.from(await opened.arrayBuffer()),Buffer.from(bytes))===0,'owner protected opener');
const legacy=await openOwnerOfflinePhotoArchive(archive,'');
test(legacy===archive,'legacy ZIP remains unchanged for existing verified importer');
test(!(await isProtectedOfflinePhotoArchive(archive)),'existing raw ZIP is not misidentified as encrypted');
const another=await protectOfflinePhotoZip(archive,phrase);
test(Buffer.compare(Buffer.from(await another.arrayBuffer()),Buffer.from(await protectedOne.arrayBuffer()))!==0,
 'each export uses fresh salt and IV');
await assertReject(recoverProtectedOfflinePhotoZip(protectedOne,'something deliberately very different'),/wrong passphrase|damaged protected/i,
 'wrong phrase never yields photo bytes');
await assertReject(protectOfflinePhotoZip(archive,'short'),/passphrase/i,'short phrase rejected before protection');
await assertReject(protectOfflinePhotoZip(archive,'x'.repeat(1025)),/passphrase/i,'oversize phrase rejected');
const raw=new Uint8Array(await protectedOne.arrayBuffer());
const damagedCipher=raw.slice();damagedCipher[48+250]^=1;
await assertReject(recoverProtectedOfflinePhotoZip(new Blob([damagedCipher]),phrase),/wrong passphrase|damaged protected/i,
 'first encrypted chunk mutation fails');
const secondChunk=raw.slice();secondChunk[48+1024*1024+16+10]^=1;
await assertReject(recoverProtectedOfflinePhotoZip(new Blob([secondChunk]),phrase),/wrong passphrase|damaged protected/i,
 'later chunk mutation fails whole archive before restore');
const tamperedHeader=raw.slice();tamperedHeader[9]^=1;
await assertReject(recoverProtectedOfflinePhotoZip(new Blob([tamperedHeader]),phrase),/wrong passphrase|damaged protected/i,
 'salt mutation authentication fails');
const changedIv=raw.slice();changedIv[25]^=1;
await assertReject(recoverProtectedOfflinePhotoZip(new Blob([changedIv]),phrase),/wrong passphrase|damaged protected/i,
 'nonce mutation authentication fails');
const alteredHeaderCount=raw.slice();alteredHeaderCount[44]^=1;
await assertReject(recoverProtectedOfflinePhotoZip(new Blob([alteredHeaderCount]),phrase),/incomplete|unsupported/i,
 'invalid chunk count rejected before decryption');
const truncated=new Blob([raw.subarray(0,raw.length-1)]);
await assertReject(recoverProtectedOfflinePhotoZip(truncated,phrase),/incomplete|unsupported/i,
 'truncated file rejected before restore');
const extra=new Blob([raw,new Uint8Array([3])]);
await assertReject(recoverProtectedOfflinePhotoZip(extra,phrase),/incomplete|unsupported/i,
 'trailing unexpected bytes rejected');
const blank=new Blob([]);
await assertReject(protectOfflinePhotoZip(blank,phrase),/empty/i,'empty archive rejected');
const notProtected=new Blob([new Uint8Array([1,2,3])]);
await assertReject(recoverProtectedOfflinePhotoZip(notProtected,phrase),/truncated/i,
 'malformed short file rejected');
test(protectedOne.type==='application/octet-stream','protected file remains opaque binary');
console.log('PASS '+count+'/'+count+' protected offline photo ZIP encryption, compatibility and corruption controls (synthetic only, no cloud).');
