/** FIRE Gate7: offline, synthetic-only independent saved-file verification tests.
 * Nothing real is read or written; temporary files are discarded on exit.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,truncateSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {protectOfflinePhotoZip} from './shared/lib/protected-offline-photo-archive.mjs';
import {inspectOwnerSavedNumberedPhotoPair} from './verify_saved_numbered_photo_pair.mjs';
import {NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES,NUMBERED_RECORDS_V2_FORMAT,NUMBERED_RECORDS_V2_VERSION} from './shared/lib/numbered-records-v2-preflight.mjs';
import {inspectStoredFirePhotoZip,verifyOwnerSavedProtectedPhotoFile} from './verify_saved_protected_photo_backup.mjs';
import {recoverSavedProtectedPhotoZip,verifySavedRecoveredPhotoZip} from './recover_saved_protected_photo_zip.mjs';
let n=0;const ok=(v,msg)=>{assert.ok(v,msg);n++;};
const reject=async(fn,match)=>{await assert.rejects(fn,match);n++;};
const sha=b=>createHash('sha256').update(b).digest('hex');
const readFileSyncSafe=p=>{try{return readFileSync(p);}catch{return null;}};
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
 const badDirectory=zip();const centralAt=badDirectory.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
  ok(centralAt>=0,'synthetic ZIP central directory exists');
  badDirectory.writeUInt32LE(0xfffffff0,centralAt+42);
 await reject(Promise.resolve().then(()=>inspectStoredFirePhotoZip(badDirectory)),/local file|metadata/i);
 await reject(Promise.resolve().then(()=>inspectStoredFirePhotoZip(
  zip([data,data]))),/incomplete|duplicate/i);
 await reject(Promise.resolve().then(()=>inspectStoredFirePhotoZip(
  storedFireZip([['photos/'+photoId,photoBytes]]))),/manifest/i);
 const tamperedZip=zip();tamperedZip[30+Buffer.byteLength('photos/'+photoId)+1]^=0x20;
 await reject(Promise.resolve().then(()=>inspectStoredFirePhotoZip(tamperedZip)),/CRC/i);
 // New actual offline recovery: ensure decrypted output matches original bytes,
 // exclusive file creation prevents accidental overwrite, and failures leave
 // no plaintext file behind. Synthetic data only.
 const recoveredPath=join(folder,'recovered-gallery.zip');
 await reject(recoverSavedProtectedPhotoZip(file,recoveredPath,phrase),
  /explicit plaintext-recovery consent/i);
 ok(!readFileSyncSafe(recoveredPath),'refused recovery does not create output');
 const recovered=await recoverSavedProtectedPhotoZip(file,recoveredPath,phrase,
  {allowPlaintextRecovery:true});
 ok(recovered.originalGalleryZipRecovered&&recovered.photoCount===1,
  'offline protected photo recovery writes original gallery ZIP');
 ok(recovered.savedRecoveryZipReadBackVerified&&recovered.savedRecoveredZipSha256===sha(original)&&
  recovered.savedRecoveryPhotoCount===1,
  'real recovery independently reread saved ZIP and verified EACH original image byte');
 ok(sha(readFileSync(recoveredPath))===sha(original),
  'recovered original ZIP is byte-identical to protected source plaintext');
 const savedProof=inspectStoredFirePhotoZip(original);
 const reopened=await verifySavedRecoveredPhotoZip(recoveredPath,savedProof);
 ok(reopened.savedRecoveryZipReadBackVerified&&reopened.savedRecoveredZipSha256===sha(original),
  'independent verification accepts exact saved ZIP on disk');
 await reject(verifySavedRecoveredPhotoZip(join(folder,'never-created.zip'),savedProof),
  /saved recovery ZIP is unavailable or incomplete/i);
 // A corrupt SAVED output is rejected even if the original protected source
 // and pre-save in-memory source proof remain valid.
 const corruptedSavedZip=Buffer.from(readFileSync(recoveredPath));
 corruptedSavedZip[30+Buffer.byteLength('photos/'+photoId)+1]^=0x20;
 writeFileSync(recoveredPath,corruptedSavedZip);
 await reject(verifySavedRecoveredPhotoZip(recoveredPath,savedProof),/CRC checksum|SHA-256|saved recovery ZIP/i);
 writeFileSync(recoveredPath,original);
 ok(sha(readFileSync(recoveredPath))===sha(original),
  'synthetic saved ZIP corruption test does not alter the protected source');
 await reject(recoverSavedProtectedPhotoZip(file,recoveredPath,phrase,
  {allowPlaintextRecovery:true}),/output already exists/i);
 ok(sha(readFileSync(recoveredPath))===sha(original),
  'existing recovery output is never overwritten');
 const missingRecordsPath=join(folder,'missing-records.json');
 await reject(recoverSavedProtectedPhotoZip(file,join(folder,'orphan.zip'),phrase,
  {allowPlaintextRecovery:true,recordsPath:missingRecordsPath}),
  /numbered customer records file cannot be read/i);
 ok(!readFileSyncSafe(join(folder,'orphan.zip')),
  'invalid paired customer archive never writes plaintext photos');
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
 // End-to-end: two INDEPENDENTLY SAVED original source files are read back,
 // never merely two in-memory archives. Full numbered core financial/identity
 // validation and exact owner-held photo bytes must form one recovery seal.
 const recordsPath=join(folder,'synthetic-numbered-records-v2.json');
 const tables=Object.fromEntries([...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES]
  .map(table=>[table,[]]));
 const id='synthetic-estimate-one',date='2026-11-13T12:00:00.000Z';
 tables.customers=[{id:customerId,name:'Synthetic test only',created_at:date}];
 tables.estimates=[{id,customer_id:customerId,status:'draft',total_cents:100,created_at:date}];
 tables.fire_customer_numbers=[{customer_id:customerId,customer_number:1,created_at:date}];
 tables.fire_job_numbers=[{root_estimate_id:id,job_number:1,created_at:date}];
 tables.fire_job_estimate_links=[{estimate_id:id,job_number:1}];
 const records={format:NUMBERED_RECORDS_V2_FORMAT,version:NUMBERED_RECORDS_V2_VERSION,
  allTablesComplete:true,truncated:false,tables,
  rowCounts:Object.fromEntries(Object.entries(tables).map(([key,list])=>[key,list.length])),
  highWater:{customer:1,job:1}};
 writeFileSync(recordsPath,JSON.stringify(records));
 const pair=await inspectOwnerSavedNumberedPhotoPair(recordsPath,file,phrase);
 ok(pair.savedRecordsFileReadBack&&pair.savedProtectedPhotoFileReadBack,
  'read back the separate actual saved records AND protected photo files');
 ok(pair.photoCount===1&&pair.customerCount===1&&pair.jobCount===1,
  'separate source records and photo metadata reference same numbered customer');
 ok(pair.matchingCustomerAndFinancialReferences&&/^[a-f0-9]{64}$/.test(pair.pairSha256),
  'financial/customer integrity and original photograph bytes paired cryptographically');
 ok(pair.recordSourceD1UuidPhysicallyVerified===false&&
    pair.originalRecordsSnapshotConsistencyVerified===false&&
    pair.destinationD1RestorePerformed===false&&pair.gate7Accepted===false,
  'saved-file relationship never pretends to prove physical D1 binding or restore');
 ok(pair.encryptedPhotoFileSha256===sha(readFileSync(file)),
  'owner-saved protected file hash really uses disk bytes');
 await reject(inspectOwnerSavedNumberedPhotoPair(recordsPath,file,
  'incorrect synthetic passphrase for pairing 2026'),/wrong passphrase|damaged/i);
 // The real owner HTTP download is an envelope, not bare core JSON.
 const envelope={format:'fire-numbered-core-export-review',version:1,
  completeBackup:false,recoveryAuthorized:false,photoBytesIncluded:false,
  offDeviceCustodyVerified:false,warning:'Core review only',coreSnapshot:records};
 writeFileSync(recordsPath,JSON.stringify(envelope));
 const downloaded=await inspectOwnerSavedNumberedPhotoPair(recordsPath,file,phrase);
 ok(downloaded.pairSha256===pair.pairSha256,
  'actual owner-facing downloaded review JSON pairs identically to core snapshot');
 const forgedEnvelope={...envelope,completeBackup:true};
 writeFileSync(recordsPath,JSON.stringify(forgedEnvelope));
 await reject(inspectOwnerSavedNumberedPhotoPair(recordsPath,file,phrase),/blocked/i);
 writeFileSync(recordsPath,JSON.stringify(envelope));
 const beforeRecords=readFileSync(recordsPath);
 const wrong=structuredClone(records);
 delete wrong.tables.payment_refunds;
 writeFileSync(recordsPath,JSON.stringify(wrong));
 await reject(inspectOwnerSavedNumberedPhotoPair(recordsPath,file,phrase),/blocked/i);
 const forged=structuredClone(records);
 forged.tables.customer_photos=[{id:'phantom-hosted',
  customer_id:customerId,object_key:'customers/forged/nonexistent.jpg'}];
 forged.rowCounts.customer_photos=1;
 writeFileSync(recordsPath,JSON.stringify(forged));
 await reject(inspectOwnerSavedNumberedPhotoPair(recordsPath,file,phrase),/blocked/i);
 writeFileSync(recordsPath,beforeRecords);
 const pairCli=resolve('business-app-parity/verify_saved_numbered_photo_pair.mjs');
 const check=spawnSync(process.execPath,[pairCli,recordsPath,file],{
  input:phrase+'\n',encoding:'utf8',timeout:15000});
 ok(check.status===0&&JSON.parse(check.stdout).gate7Accepted===false,
  'standalone real-file paired-audit CLI executes safely: '+check.stderr);
 ok(!check.stdout.includes(customerId)&&!check.stderr.includes(customerId)&&
    !check.stdout.includes(phrase),'paired CLI cannot disclose customer ID or passphrase');
 const badPairCli=spawnSync(process.execPath,[pairCli,recordsPath,file],{
  input:'A wrong but long synthetic phrase 2026\n',encoding:'utf8',timeout:15000});
 ok(badPairCli.status!==0&&!badPairCli.stderr.includes(customerId)&&
    !badPairCli.stderr.includes('wrong but long'),'paired CLI fails without disclosing private data');
 const oversized=join(folder,'oversized-source-records.json');
 writeFileSync(oversized,'{}');
 truncateSync(oversized,65*1024*1024);
 await reject(inspectOwnerSavedNumberedPhotoPair(oversized,file,phrase),
  /file size|unsupported/i);
 ok(sha(readFileSync(recordsPath))===sha(beforeRecords)&&
    sha(readFileSync(file))===originalHash,'paired proof never changes original saved files');
 console.log('PASS '+n+'/'+n+' independent saved protected FIRE photo backup tests; no Cloudflare, restore or customer data.');
}finally{rmSync(folder,{recursive:true,force:true});}

// New recovery code requires one targeted synthetic local SQLite round-trip.
await import('./test_isolated_sqlite_recovery.mjs');
