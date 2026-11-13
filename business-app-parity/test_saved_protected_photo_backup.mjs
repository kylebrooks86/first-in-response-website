/** FIRE Gate7: offline, synthetic-only independent saved-file verification tests.
 * Nothing real is read or written; temporary files are discarded on exit.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {protectOfflinePhotoZip} from './shared/lib/protected-offline-photo-archive.mjs';
import {inspectStoredFirePhotoZip,verifyOwnerSavedProtectedPhotoFile} from './verify_saved_protected_photo_backup.mjs';
let n=0;const ok=(v,msg)=>{assert.ok(v,msg);n++;};
const reject=async(fn,match)=>{await assert.rejects(fn,match);n++;};
const sha=b=>createHash('sha256').update(b).digest('hex');
const crc32=b=>{
 let crc=0xffffffff;
 for(const byte of b){crc^=byte;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
};
const head=(size,write)=>{const b=Buffer.alloc(size);write(b);return b;};
function storedFireZip(parts){
 const locals=[],centrals=[];let offset=0;
 for(const [name,bytes] of parts){
  const filename=Buffer.from(name,'utf8'),data=Buffer.from(bytes);
  const crc=crc32(data),localOffset=offset;
  const local=head(30,b=>{b.writeUInt32LE(0x04034b50,0);b.writeUInt16LE(20,4);
   b.writeUInt16LE(0x0808,6);b.writeUInt16LE(filename.length,26);});
  const descriptor=head(16,b=>{b.writeUInt32LE(0x08074b50,0);b.writeUInt32LE(crc,4);
   b.writeUInt32LE(data.length,8);b.writeUInt32LE(data.length,12);});
  locals.push(local,filename,data,descriptor);
  offset+=local.length+filename.length+data.length+descriptor.length;
  const central=head(46,b=>{b.writeUInt32LE(0x02014b50,0);
   b.writeUInt16LE(20,4);b.writeUInt16LE(20,6);b.writeUInt16LE(0x0808,8);
   b.writeUInt32LE(crc,16);b.writeUInt32LE(data.length,20);
   b.writeUInt32LE(data.length,24);b.writeUInt16LE(filename.length,28);
   b.writeUInt32LE(localOffset,42);});
  centrals.push(central,filename);
 }
 const size=centrals.reduce((s,b)=>s+b.length,0);
 const end=head(22,b=>{b.writeUInt32LE(0x06054b50,0);
  b.writeUInt16LE(parts.length,8);b.writeUInt16LE(parts.length,10);
  b.writeUInt32LE(size,12);b.writeUInt32LE(offset,16);});
 return Buffer.concat([...locals,...centrals,end]);
}
const photoBytes=Buffer.from([0xff,0xd8,0xff,0xd9,1,2,3,4]);
const photoId='photo-synthetic-0001',customerId='customer-synthetic-0001';
const data={id:photoId,customerId,category:'before',caption:'synthetic test image only',
 filename:'synthetic.jpg',contentType:'image/jpeg',sizeBytes:photoBytes.length,
 createdAt:'2026-11-13T12:00:00.000Z',sha256:sha(photoBytes)};
const manifest=(photos=[data])=>({format:'fire-offline-photo-vault',version:1,
 exportedAt:'2026-11-13T12:01:00.000Z',requiresMatchingCustomerRecords:true,photos});
const zip=(photos=[data],named='photos/'+photoId)=>
 storedFireZip([[named,photoBytes],['manifest.json',Buffer.from(JSON.stringify(manifest(photos)))]]);
const phrase='FIRE synthetic private cross device recovery phrase 2026';
const folder=mkdtempSync(join(tmpdir(),'fire-saved-photo-proof-'));
const file=join(folder,'synthetic.firephotos'),legacy=join(folder,'unprotected.zip');
try{
 const original=zip(),protectedBytes=await protectOfflinePhotoZip(new Blob([original]),phrase);
 writeFileSync(file,Buffer.from(await protectedBytes.arrayBuffer()));
 writeFileSync(legacy,original);
 const originalHash=sha(readFileSync(file));
 const verified=await verifyOwnerSavedProtectedPhotoFile(file,phrase);
 ok(verified.savedFileReadBack&&verified.allFilesCryptographicallyVerified,'reads actual protected file');
 ok(verified.photoCount===1&&verified.distinctCustomerIds===1,'exact photo/customer count');
 ok(verified.totalOriginalPhotoBytes===photoBytes.length,'original image byte count');
 ok(verified.encryptedFileSha256===originalHash,'encrypt-file hash matches actual saved bytes');
 ok(verified.verifiedZipSha256===sha(original),'decrypted ZIP hash matches original');
 ok(verified.offDeviceIndependentCustodyVerified===false&&verified.gate7Accepted===false,
  'never claim physical off-device custody or Gate 7 acceptance');
 ok(sha(readFileSync(file))===originalHash,'read-only verifier does not modify saved bytes');
 await reject(verifyOwnerSavedProtectedPhotoFile(file,'A completely wrong synthetic passphrase 2026'),/wrong passphrase|damaged/i);
 await reject(verifyOwnerSavedProtectedPhotoFile(legacy,phrase),/only encrypted/i);
 const corruption=Buffer.from(readFileSync(file));corruption[100]^=0x45;
 writeFileSync(file,corruption);
 await reject(verifyOwnerSavedProtectedPhotoFile(file,phrase),/wrong passphrase|damaged/i);
 writeFileSync(file,Buffer.from(await protectedBytes.arrayBuffer()));
 // Portable ZIP reader must agree with FIRE's strict gallery ZIP format and
 // reject unsafe/missing paths, checksum mismatches and a forged manifest.
 ok(inspectStoredFirePhotoZip(original).photoCount===1,'valid unencrypted ZIP metadata');
 await reject(Promise.resolve().then(()=>inspectStoredFirePhotoZip(
  zip([data],'../outside'))),/unsafe|unknown/i);
 await reject(Promise.resolve().then(()=>inspectStoredFirePhotoZip(
  zip([{...data,sha256:'a'.repeat(64)}]))),/SHA-256/i);
 // Reject ZIP directory/local-header discrepancies and noncanonical manifest
 // fields before anyone relies on a saved encrypted recovery archive.
 const badHeader=zip();badHeader.writeUInt16LE(99,4);
 await reject(Promise.resolve().then(()=>inspectStoredFirePhotoZip(badHeader)),/local file|metadata/i);
 const badManifest=storedFireZip([['photos/'+photoId,photoBytes],
  ['manifest.json',Buffer.from(JSON.stringify({...manifest(),unknown:'unexpected'}))]]);
 await reject(Promise.resolve().then(()=>inspectStoredFirePhotoZip(badManifest)),/manifest/i);
 const badDirectory=zip();badDirectory.writeUInt32LE(0xfffffff0,42);
 await reject(Promise.resolve().then(()=>inspectStoredFirePhotoZip(badDirectory)),/local file|metadata/i);
 await reject(Promise.resolve().then(()=>inspectStoredFirePhotoZip(
  zip([data,data]))),/incomplete|duplicate/i);
 await reject(Promise.resolve().then(()=>inspectStoredFirePhotoZip(
  storedFireZip([['photos/'+photoId,photoBytes]]))),/manifest/i);
 const tamperedZip=zip();tamperedZip[30+Buffer.byteLength('photos/'+photoId)+1]^=0x20;
 await reject(Promise.resolve().then(()=>inspectStoredFirePhotoZip(tamperedZip)),/CRC/i);
 // Confirm the real command-line boundary reads the passphrase from stdin,
 // never from process arguments, never emits customer IDs or plaintext bytes,
 // and sets exit nonzero on an incorrect passphrase.
 const cli=resolve('business-app-parity/verify_saved_protected_photo_backup.mjs');
 const run=(input)=>spawnSync(process.execPath,[cli,file],{input,encoding:'utf8',timeout:15000});
 const good=run(phrase+'\n');
 ok(good.status===0,'actual standalone Acer CLI succeeds: '+good.stderr);
 const safe=JSON.parse(good.stdout);
 ok(safe.photoCount===1&&safe.gate7Accepted===false,'CLI prints only safe result flags');
 ok(!good.stdout.includes(customerId)&&!good.stdout.includes(phrase)&&
    !good.stderr.includes(customerId),'no private customer ID or passphrase printed');
 const bad=run('Wrong private synthetic recovery phrase 123456\n');
 ok(bad.status!==0&&!bad.stderr.includes('Wrong private synthetic'),'CLI rejects wrong passphrase without echo');
 console.log('PASS '+n+'/'+n+' independent saved protected FIRE photo backup tests; no Cloudflare, restore or customer data.');
}finally{rmSync(folder,{recursive:true,force:true});}
