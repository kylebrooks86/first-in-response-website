/** Focused NEW v2 financial/contract integrity tests. Synthetic data ONLY. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {FIRE_NUMBERED_RECORDS_TABLES} from '../lib/numbered-records-v2.mjs';
import {verifyNumberedRecordsV2CriticalIntegrity} from '../lib/numbered-records-v2-integrity.mjs';
import {captureFinanciallyVerifiedNumberedRecordsV2FromD1,FIRE_NUMBERED_V2_READ_TABLES}
  from '../lib/numbered-records-v2-d1-read.mjs';
let checks=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
const rejects=async(fn,msg)=>{await assert.rejects(fn,/FIRE v2 FINANCIAL INTEGRITY REFUSED|FIRE numbered D1 READ REFUSED|Unsafe FIRE numbered-identity archive/,msg);checks++;};
const clone=v=>structuredClone(v);
const time='2026-10-31T20:00:00.000Z';
const scope=JSON.stringify([['line-1','Window cleaning','Exterior',1,'each',10000]]);
const terms='This signed synthetic agreement authorizes the custom deposit exception while retaining original scope and contact records.';
const digest=source=>createHash('sha256').update(source).digest('hex');
const event={
 id:'event-1',estimate_id:'e1',confirmation_id:'confirmation-1',
 actor_email:'synthetic-owner@example.invalid',mode:'waive',
 previous_total_cents:10000,previous_deposit_cents:5000,new_deposit_cents:0,
 paid_principal_cents:0,percent_basis_points:null,schedule_before_collection:0,
 previous_contract_version:null,updated_contract_version:'deposit-exception-v1:event-1',
 previous_signed_at:null,requires_customer_reapproval:0,reason:'Synthetic requested waiver',
 created_at:time
};
const version='deposit-exception-v1:'+event.id;
const documentSource=JSON.stringify({
 format:'deposit-exception-v1',eventId:event.id,totalCents:10000,
 depositCents:0,mode:'waive',scope,terms
});
const documentDigest=digest(documentSource);
const snapshot={
 event_id:event.id,estimate_id:'e1',document_version:version,document_digest:documentDigest,
 total_cents:10000,deposit_cents:0,mode:'waive',
 scope_json:scope,agreement_text:terms,signed_name:'Synthetic Customer',
 photo_release:'yes',signed_at:time,accepted_at:time
};
const tables=Object.fromEntries(FIRE_NUMBERED_RECORDS_TABLES.map(table=>[table,[]]));
tables.customers=[{id:'c1',created_at:time},{id:'c2',created_at:time}];
tables.auth_rate_limits=[{key:'synthetic-throttle',attempts:2,window_started_at:1780000000,blocked_until:1780000120}];
tables.estimates=[
 {id:'e1',customer_id:'c1',created_at:time,contract_version:version+':sha256:'+documentDigest,
  signed_name:'Synthetic Customer',photo_release:'yes',accepted_at:time,signed_at:time},
 {id:'e2',customer_id:'c2',created_at:time,contract_version:null,
  signed_name:null,photo_release:null,accepted_at:null,signed_at:null}
];
tables.invoices=[{id:'i1',estimate_id:'e1',customer_id:'c1'}];
tables.estimate_items=[{id:'item1',estimate_id:'e1'}];
tables.invoice_items=[{id:'item2',invoice_id:'i1'}];
tables.invoice_revisions=[{id:'ir1',invoice_id:'i1'}];
tables.payments=[
 {id:'p1',estimate_id:'e1',type:'Deposit',status:'paid',provider_id:'cs_test',
  amount_cents:10000},
 {id:'p2',estimate_id:'e1',type:'Refund',status:'paid',
  provider_id:'refund:p1:r1',amount_cents:-2500}
];
tables.payment_refunds=[{id:'r1',payment_id:'p1',estimate_id:'e1',
 amount_cents:2500,status:'succeeded',mode:'stripe',provider_refund_id:'re_test'}];
tables.deposit_policy_events=[event];
tables.deposit_agreement_snapshots=[snapshot];
tables.customer_photos=[{
 id:'photo1',customer_id:'c1',estimate_id:'e1',
 object_key:'customers/c1/photo1.jpg',content_type:'image/jpeg',category:'before',size_bytes:2048
}];
tables.customer_messages=[{id:'msg1',customer_id:'c1',estimate_id:'e1'}];
tables.estimate_change_requests=[{id:'req1',customer_id:'c1',estimate_id:'e1'}];
tables.job_reports=[{id:'jobreport1',customer_id:'c1',estimate_id:'e1'}];
tables.notifications=[{id:'notification1',customer_id:'c1',estimate_id:'e1'}];
tables.payment_checkout_sessions=[{id:'checkout1',estimate_id:'e1'}];
tables.customer_notes=[{id:'note1',customer_id:'c1'}];
tables.tasks=[{id:'task1',customer_id:'c1'}];
tables.expenses=[{id:'expense1',estimate_id:'e1'}];
eq(await verifyNumberedRecordsV2CriticalIntegrity(clone(tables)),true,
 'Complete synthetic financial, refund, audit, digest and photo history passes');
const cases=[
 ['refund total exceeds paid principal',x=>x.payment_refunds[0].amount_cents=10001],
 ['refund provider receipt duplicated',x=>x.payment_refunds.push({...x.payment_refunds[0],id:'r2'})],
 ['refund negative ledger mismatch',x=>x.payments[1].amount_cents=-2400],
 ['refund ledger orphan',x=>x.payment_refunds=[]],
 ['refund crossed estimate',x=>x.payment_refunds[0].estimate_id='e2'],
 ['original payment not settled',x=>x.payments[0].status='pending'],
 ['duplicate provider payment',x=>x.payments.push({...x.payments[0],id:'p3'})],
 ['missing paid payment parent',x=>x.payments=x.payments.filter(p=>p.id!=='p1')],
 ['missing audit event',x=>x.deposit_policy_events=[]],
 ['tampered deposit principal',x=>x.deposit_policy_events[0].previous_total_cents=9999],
 ['tampered contract text with original digest',x=>x.deposit_agreement_snapshots[0].agreement_text+=' CHANGED'],
 ['invalid signature version',x=>x.estimates[0].contract_version='deposit-exception-v1:wrong'],
 ['signed document missing',x=>x.deposit_agreement_snapshots=[]],
 ['wrong customer invoice',x=>x.invoices[0].customer_id='c2'],
 ['missing customer on estimate',x=>x.estimates[0].customer_id='unknown'],
 ['invoice orphan',x=>x.invoices[0].estimate_id='missing'],
 ['photo references different customer',x=>x.customer_photos[0].customer_id='c2'],
 ['photo key traversal',x=>x.customer_photos[0].object_key='customers/c1/photo1.jpg/../bad'],
 ['duplicate photo key',x=>x.customer_photos.push({...x.customer_photos[0],id:'photo2'})],
 ['invalid photo size',x=>x.customer_photos[0].size_bytes=-1],
 ['cross customer message',x=>x.customer_messages[0].customer_id='c2'],
 ['cross customer report',x=>x.job_reports[0].customer_id='c2'],
 ['missing required record family',x=>delete x.payment_refunds],
 ['duplicate login throttle key',x=>x.auth_rate_limits.push({...x.auth_rate_limits[0]})],
 ['invalid login attempts',x=>x.auth_rate_limits[0].attempts=-1],
 ['missing login counter',x=>delete x.auth_rate_limits],
 ['unreviewed property family',x=>x.customer_properties=[]]
];
for(const [name,edit] of cases){
 const x=clone(tables);edit(x);
 await rejects(()=>verifyNumberedRecordsV2CriticalIntegrity(x),name);
}
// More important than a custom caller returning true: strict capture performs
// all structural and cryptographic checks before producing an archive.
const identities={
 fire_customer_numbers:[{customer_number:1,customer_id:'c1',created_at:time},
   {customer_number:2,customer_id:'c2',created_at:time}],
 fire_job_numbers:[{job_number:1,root_estimate_id:'e1',created_at:time},
   {job_number:2,root_estimate_id:'e2',created_at:time}],
 fire_job_estimate_links:[{estimate_id:'e1',job_number:1},{estimate_id:'e2',job_number:2}]
};
function d1Double(data){
 const read={...data,...identities};
 const calls={batches:0,statements:[]};
 return {calls,db:{
  prepare(sql){calls.statements.push(sql);return{sql};},
  async batch(statements){calls.batches++;return statements.map((q,i)=>{
   if(i===FIRE_NUMBERED_V2_READ_TABLES.length)return{success:true,results:[
    {name:'fire_customer_numbers',seq:8},{name:'fire_job_numbers',seq:9}]};
   if(i===FIRE_NUMBERED_V2_READ_TABLES.length+1)
    return{success:true,results:FIRE_NUMBERED_V2_READ_TABLES.map(name=>({name}))};
   return{success:true,results:clone(read[FIRE_NUMBERED_V2_READ_TABLES[i]])};
  })}
 }};
}
const good=d1Double(tables);
const archive=await captureFinanciallyVerifiedNumberedRecordsV2FromD1({
 db:good.db,now:()=>time
});
eq(archive.archive.version,2,'Strict D1 capture produces version 2');
eq(archive.archive.tableCounts.payment_refunds,1,'Strict D1 capture preserves completed refund');
eq(archive.archive.tableCounts.auth_rate_limits,1,'Strict D1 capture preserves login throttling history');
eq(good.calls.batches,1,'Strict D1 capture uses one database batch');
eq(good.calls.statements.every(s=>s.startsWith('SELECT ')),true,'Strict capture never prepares writes');
const bad=clone(tables);bad.deposit_agreement_snapshots[0].agreement_text+=' tamper';
const badDb=d1Double(bad);
await rejects(()=>captureFinanciallyVerifiedNumberedRecordsV2FromD1({db:badDb.db,now:()=>time}),
 'Strict D1 capture refuses tampered signed text, no caller override');
eq(badDb.calls.batches,1,'Strict refused capture performs just one read batch');
console.log('PASS '+checks+'/'+checks+
 ' NEW v2 strict real financial/refund/signed text and scoped-photo audit checks. No hosted resources.');



// Integration of NEW strict archive inspection + complete disposable restore.
// The original archive checksum is recomputed for negative cases to ensure
// the semantic validation (not merely SHA-256) catches historical tampering.
const {inspectFinanciallyVerifiedNumberedRecordsV2}=
 await import('../lib/numbered-records-v2-integrity.mjs');
const {buildNumberedRecordsV2}=await import('../lib/numbered-records-v2.mjs');
const {restoreFinanciallyVerifiedNumberedRecordsToDisposableMemory}=
 await import('../../restore-lab/restore_complete_numbered_records_memory.mjs');
const {DatabaseSync}=await import('node:sqlite');
const {readFileSync}=await import('node:fs');
const valid=await inspectFinanciallyVerifiedNumberedRecordsV2(archive.archive);
eq(valid.financialAuditContractVerified,true,'Strict v2 archive has full financial gate');
eq(valid.signedDocumentTextDigestVerified,true,'Strict v2 archive has original signed text digest');
eq(valid.ownerAuthenticated,false,'Cryptographic checksum alone does not prove owner authentication');
function freshStrictMemory(){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON');
 for(const table of FIRE_NUMBERED_RECORDS_TABLES){
  const example=tables[table][0]??{id:'empty'};
  const cols=Object.entries(example).map(([key,value])=>{
   if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))throw Error('Unsafe synthetic column');
   return '"'+key+'" '+(key==='id'?'TEXT PRIMARY KEY':
     typeof value==='number'?'INTEGER':'TEXT');
  });
  db.exec('CREATE TABLE "'+table+'" ('+cols.join(',')+')');
 }
 db.exec(readFileSync('business-app-parity/customer-numbering/customer_numbers_v1.sql','utf8'));
 db.exec(readFileSync('business-app-parity/job-numbering/job_numbers_v1.sql','utf8'));
 return db;
}
const scratch=freshStrictMemory();
const result=await restoreFinanciallyVerifiedNumberedRecordsToDisposableMemory({
 db:scratch,archive:archive.archive
});
eq(result.restoredCustomerNumbers,2,'Strict full restore retains both permanent Customers');
eq(result.restoredJobNumbers,2,'Strict full restore retains distinct jobs');
eq(result.restoredRevisionLinks,2,'Strict full restore retains all estimate/job links');
eq(scratch.prepare('SELECT COUNT(*) AS n FROM deposit_agreement_snapshots').get().n,1,
 'Strict full restore retains matching signed artifact');
eq(scratch.prepare("SELECT attempts FROM auth_rate_limits WHERE key='synthetic-throttle'").get().attempts,2,
 'Strict full restore preserves original authentication throttle counter');
eq(scratch.prepare('SELECT amount_cents FROM payment_refunds').get().amount_cents,2500,
 'Strict full restore retains original refund amount');
eq(scratch.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_customer_numbers'").get().seq,8,
 'Strict full restore preserves original customer allocator');
eq(scratch.prepare("SELECT seq FROM sqlite_sequence WHERE name='fire_job_numbers'").get().seq,9,
 'Strict full restore preserves original job allocator');
eq(result.hostedWritesPerformed,false,'Strict full restore never touches hosted data');
scratch.close();
for(const [name,mutate] of [
 ['Forged signed agreement with valid archive checksum',r=>r.deposit_agreement_snapshots[0].agreement_text+=' tampered'],
 ['Forged refund ledger with valid archive checksum',r=>r.payment_refunds[0].amount_cents=2700],
 ['Missing immutable signed snapshot with valid archive checksum',r=>r.deposit_agreement_snapshots=[]]
]){
 const records=clone(archive.archive.records);
 mutate(records.tables);
 const newArchive=(await buildNumberedRecordsV2({records,identities:archive.archive.identities})).archive;
 const unused=freshStrictMemory();
 await assert.rejects(
  ()=>restoreFinanciallyVerifiedNumberedRecordsToDisposableMemory({db:unused,archive:newArchive}),
  /FIRE v2 FINANCIAL INTEGRITY REFUSED/,name);
 checks++;
 eq(unused.prepare('SELECT COUNT(*) AS n FROM customers').get().n,0,
  'Strict archive semantic rejection occurs before any customer insert');
 unused.close();
}
console.log('PASS '+checks+'/'+checks+' NEW complete financial-gated v2 archive and disposable restore integration checks.');


// NEW private archive custody boundary (synthetic-only data).
const {encryptFinanciallyVerifiedNumberedV2,decryptFinanciallyVerifiedNumberedV2}
 =await import('../lib/numbered-records-v2-sealed.mjs');
const syntheticPassphrase='TEST ONLY deterministic long passphrase - never use for a real customer backup';
const sealed=await encryptFinanciallyVerifiedNumberedV2({
 archive:archive.archive,passphrase:syntheticPassphrase
});
const sealedAgain=await encryptFinanciallyVerifiedNumberedV2({
 archive:archive.archive,passphrase:syntheticPassphrase
});
eq(sealed.photoFilesIncluded,false,'Encrypted metadata explicitly excludes actual photo files');
eq(sealed.format,'fire-app-numbered-records-v2-sealed','Versioned encrypted format explicit');
eq(sealed.cipher,'AES-256-GCM','Authenticated encryption algorithm explicit');
eq(sealed.kdf,'PBKDF2-SHA256','Key derivation algorithm explicit');
eq(sealed.iterations,600000,'Owner-held passphrase key derivation is nontrivial');
eq(sealed.saltBase64!==sealedAgain.saltBase64,true,'Each backup uses a fresh random salt');
eq(sealed.nonceBase64!==sealedAgain.nonceBase64,true,'Each backup uses a fresh random GCM nonce');
eq(JSON.stringify(sealed).includes('Synthetic Customer'),false,
 'Encrypted container never exposes signed customer name as plaintext');
eq(JSON.stringify(sealed).includes('cs_test'),false,
 'Encrypted container never exposes payment provider references as plaintext');
const opened=await decryptFinanciallyVerifiedNumberedV2({
 sealed:JSON.parse(JSON.stringify(sealed)),passphrase:syntheticPassphrase
});
eq(opened.archive,archive.archive,'Encrypted archive round trips all original records and numbers');
eq(opened.summary.financialAuditContractVerified,true,
 'Unsealed archive requires complete refund and signed-document validation');
eq(opened.summary.ownerAuthenticated,false,
 'A correct passphrase does not pretend to authenticate owner identity');
eq(opened.summary.photoFilesRecovered,false,'Encrypted record backup does not contain photo file bytes');
const sealedRefuse=async(run,label)=>{await assert.rejects(run,/FIRE PRIVATE v2 ARCHIVE REFUSED/,label);checks++;};
await sealedRefuse(()=>decryptFinanciallyVerifiedNumberedV2({
 sealed,passphrase:'completely wrong long passphrase for test'
}),'Wrong passphrase cannot decrypt saved customer/payment data');
const tamperedCipher=clone(sealed);
tamperedCipher.ciphertextBase64=tamperedCipher.ciphertextBase64.slice(0,8)+
 (tamperedCipher.ciphertextBase64[8]==='A'?'B':'A')+
 tamperedCipher.ciphertextBase64.slice(9);
await sealedRefuse(()=>decryptFinanciallyVerifiedNumberedV2({
 sealed:tamperedCipher,passphrase:syntheticPassphrase
}),'Modified ciphertext rejected by AES-GCM tag');
const tamperedSalt=clone(sealed);
tamperedSalt.saltBase64=tamperedSalt.saltBase64.slice(0,5)+
 (tamperedSalt.saltBase64[5]==='A'?'B':'A')+
 tamperedSalt.saltBase64.slice(6);
await sealedRefuse(()=>decryptFinanciallyVerifiedNumberedV2({
 sealed:tamperedSalt,passphrase:syntheticPassphrase
}),'Changed salt cannot derive original authentication key');
const tamperedNonce=clone(sealed);
tamperedNonce.nonceBase64=tamperedNonce.nonceBase64.slice(0,5)+
 (tamperedNonce.nonceBase64[5]==='A'?'B':'A')+
 tamperedNonce.nonceBase64.slice(6);
await sealedRefuse(()=>decryptFinanciallyVerifiedNumberedV2({
 sealed:tamperedNonce,passphrase:syntheticPassphrase
}),'Changed GCM nonce cannot decrypt');
const weakKdf=clone(sealed);weakKdf.iterations=1;
await sealedRefuse(()=>decryptFinanciallyVerifiedNumberedV2({
 sealed:weakKdf,passphrase:syntheticPassphrase
}),'No downgrade to cheap KDF rounds');
const falsePhoto=clone(sealed);falsePhoto.photoFilesIncluded=true;
await sealedRefuse(()=>decryptFinanciallyVerifiedNumberedV2({
 sealed:falsePhoto,passphrase:syntheticPassphrase
}),'Encrypted container cannot claim photo files that are missing');
const novelField=clone(sealed);novelField.ownerProof='forged';
await sealedRefuse(()=>decryptFinanciallyVerifiedNumberedV2({
 sealed:novelField,passphrase:syntheticPassphrase
}),'Unreviewed encrypted metadata rejected');
await sealedRefuse(()=>encryptFinanciallyVerifiedNumberedV2({
 archive:archive.archive,passphrase:'password'
}),'Weak/short passphrase rejected by minimum length');
const badFinancial=clone(archive.archive);badFinancial.records.tables.payment_refunds[0].amount_cents=3333;
await sealedRefuse(()=>encryptFinanciallyVerifiedNumberedV2({
 archive:badFinancial,passphrase:syntheticPassphrase
}),'Financially invalid archive cannot be encrypted and falsely treated as valid');
console.log('PASS '+checks+'/'+checks+
 ' NEW owner-passphrase AES-256-GCM encrypted v2 records and wrong-key/tamper refusal checks (synthetic only).');



// NEW photo-file custody comparison against the already reviewed metadata.
// Synthetic 2 KB image bytes, no R2/ZIP/filesystem access or owner photos.
const {buildNumberedV2PhotoVaultManifest,verifyNumberedV2PhotoVault}
 =await import('../lib/numbered-records-v2-photo-vault.mjs');
const sourcePhoto=archive.archive.records.tables.customer_photos[0];
const photoFiles=[{
 objectKey:sourcePhoto.object_key,contentType:sourcePhoto.content_type,
 bytes:new Uint8Array(sourcePhoto.size_bytes).fill(0x91)
}];
const originalManifest=await buildNumberedV2PhotoVaultManifest({
 archive:archive.archive,files:photoFiles
});
eq(originalManifest.files.length,1,'Every original metadata row has one hashed file');
eq(originalManifest.files[0].sha256.length,64,'Photo bytes get SHA-256 digest');
const verifiedPhotos=await verifyNumberedV2PhotoVault({
 archive:archive.archive,files:photoFiles,protectedManifest:originalManifest
});
eq(verifiedPhotos.completeMetadataMatchesFiles,true,
 'Owner photo bytes match all archived photo metadata and their protected hashes');
eq(verifiedPhotos.photoFilesVerified,1,'One actual photo object validated');
eq(verifiedPhotos.verifiedBytes,sourcePhoto.size_bytes,'Exact photo byte size verified');
eq(verifiedPhotos.cloudPhotoRestorePerformed,false,'No false claim that R2 photo bytes are restored');
eq(verifiedPhotos.trustedManifestOriginProven,false,
 'New SHA-256 manifest does not itself authenticate original ownership');
const photoReject=async(fn,label)=>{
 await assert.rejects(fn,/FIRE PHOTO VAULT V2 REFUSED/,label);checks++;
};
await photoReject(()=>verifyNumberedV2PhotoVault({
 archive:archive.archive,files:[],protectedManifest:originalManifest
}),'Missing original photo file refuses recovery');
const extraPhotos=[...photoFiles,{
 objectKey:'customers/c1/not-in-records.jpg',contentType:'image/jpeg',bytes:new Uint8Array(2)
}];
await photoReject(()=>verifyNumberedV2PhotoVault({
 archive:archive.archive,files:extraPhotos,protectedManifest:originalManifest
}),'Unexpected extra photo refuses custody verification');
const wrongType=[{...photoFiles[0],contentType:'image/png'}];
await photoReject(()=>verifyNumberedV2PhotoVault({
 archive:archive.archive,files:wrongType,protectedManifest:originalManifest
}),'Changed image MIME rejected');
const shortFile=[{...photoFiles[0],bytes:new Uint8Array(100)}];
await photoReject(()=>verifyNumberedV2PhotoVault({
 archive:archive.archive,files:shortFile,protectedManifest:originalManifest
}),'Truncated photo bytes rejected');
const alteredBytes=[{...photoFiles[0],bytes:new Uint8Array(photoFiles[0].bytes)}];
alteredBytes[0].bytes[0]=0;
await photoReject(()=>verifyNumberedV2PhotoVault({
 archive:archive.archive,files:alteredBytes,protectedManifest:originalManifest
}),'Same-size corrupted photo rejected against original protected SHA-256');
const forgery=clone(originalManifest);forgery.files[0].sha256='0'.repeat(64);
await photoReject(()=>verifyNumberedV2PhotoVault({
 archive:archive.archive,files:photoFiles,protectedManifest:forgery
}),'Forged original photo hash rejected');
const omittedManifest=clone(originalManifest);omittedManifest.files=[];
await photoReject(()=>verifyNumberedV2PhotoVault({
 archive:archive.archive,files:photoFiles,protectedManifest:omittedManifest
}),'Missing original photo manifest entry rejected');
const changedClaim=clone(originalManifest);changedClaim.photoFilesIncludedInRecords=true;
await photoReject(()=>verifyNumberedV2PhotoVault({
 archive:archive.archive,files:photoFiles,protectedManifest:changedClaim
}),'Photo manifest cannot claim image files are inside database records');
const malformed=clone(originalManifest);malformed.files[0].unreviewed='value';
await photoReject(()=>verifyNumberedV2PhotoVault({
 archive:archive.archive,files:photoFiles,protectedManifest:malformed
}),'Unknown photo manifest fields refused');
console.log('PASS '+checks+'/'+checks+
 ' NEW source-only photo vault file/size/SHA-256 reconciliation checks; no actual file restore.');



// NEW recoverable, encrypted PHOTO BYTES package, independently bound to the
// original sealed records archive by its full authenticated records checksum.
// No R2, ZIP, hosted writes, customer files, or browser downloads are involved.
const {sealNumberedV2PhotoBytes,unsealNumberedV2PhotoBytes}
 =await import('../lib/numbered-records-v2-sealed-photos.mjs');
const photoPrivate=await sealNumberedV2PhotoBytes({
 archive:archive.archive,files:photoFiles,passphrase:syntheticPassphrase
});
eq(photoPrivate.format,'fire-numbered-v2-encrypted-photo-bytes',
 'Actual encrypted photo file bundle has its own versioned type');
eq(photoPrivate.recordChecksum,archive.archive.checksum.hex,
 'All photos cryptographically bind to the exact saved records archive');
eq(photoPrivate.items.length,1,'One encrypted photo BYTES payload is included');
eq(typeof photoPrivate.items[0].ciphertextBase64,'string',
 'Image bytes are present as AES-GCM encrypted data');
eq(JSON.stringify(photoPrivate).includes(sourcePhoto.object_key),false,
 'Encrypted photo package does not reveal customer/object storage key');
eq(JSON.stringify(photoPrivate).includes('synthetic-throttle'),false,
 'Encrypted photo package does not expose private database history');
const openedPhotos=await unsealNumberedV2PhotoBytes({
 archive:archive.archive,sealed:JSON.parse(JSON.stringify(photoPrivate)),
 passphrase:syntheticPassphrase
});
eq(openedPhotos.files.length,1,'Recover one photo into volatile memory');
eq(openedPhotos.files[0].objectKey,sourcePhoto.object_key,
 'Recovered decrypted image retains exact original customer object key');
eq(openedPhotos.files[0].bytes,photoFiles[0].bytes,
 'Recovered photo BYTES match exactly, not just a manifest count');
eq(openedPhotos.proof.encryptedFilesOpened,true,
 'Full authenticated photo bytes were opened from encrypted package');
eq(openedPhotos.proof.photoFilesPersisted,false,
 'In-memory recovery does not imply a hosted R2 restore');
eq(openedPhotos.proof.ownerAuthenticated,false,
 'Password decrypt does not authorize restoring files to a hosting account');
const privatePhotoRefuse=async(fn,label)=>{
 await assert.rejects(fn,/FIRE SEALED PHOTO VAULT REFUSED/,label);checks++;
};
await privatePhotoRefuse(()=>unsealNumberedV2PhotoBytes({
 archive:archive.archive,sealed:photoPrivate,
 passphrase:'This is the wrong synthetic photo backup passphrase'
}),'Wrong passphrase refuses original encrypted photo bytes');
const swappedCipher=clone(photoPrivate);
swappedCipher.items[0].ciphertextBase64=
 (swappedCipher.items[0].ciphertextBase64[0]==='A'?'B':'A')+
 swappedCipher.items[0].ciphertextBase64.slice(1);
await privatePhotoRefuse(()=>unsealNumberedV2PhotoBytes({
 archive:archive.archive,sealed:swappedCipher,passphrase:syntheticPassphrase
}),'Tampered encrypted photo contents rejected even when count is unchanged');
const changedHeader=clone(photoPrivate);changedHeader.recordChecksum='0'.repeat(64);
await privatePhotoRefuse(()=>unsealNumberedV2PhotoBytes({
 archive:archive.archive,sealed:changedHeader,passphrase:syntheticPassphrase
}),'Archive checksum cannot be edited to link a different record snapshot');
const droppedFile=clone(photoPrivate);droppedFile.items.pop();
await privatePhotoRefuse(()=>unsealNumberedV2PhotoBytes({
 archive:archive.archive,sealed:droppedFile,passphrase:syntheticPassphrase
}),'Missing encrypted image causes whole recovery refusal');
const addedFile=clone(photoPrivate);addedFile.items.push(clone(photoPrivate.items[0]));
await privatePhotoRefuse(()=>unsealNumberedV2PhotoBytes({
 archive:archive.archive,sealed:addedFile,passphrase:syntheticPassphrase
}),'Unexpected image entry causes whole recovery refusal');
const alternateRecords=clone(archive.archive.records);
alternateRecords.tables.customer_notes.push({id:'extra-note',customer_id:'c1'});
const alternative=(await buildNumberedRecordsV2({
 records:alternateRecords,identities:archive.archive.identities
})).archive;
await privatePhotoRefuse(()=>unsealNumberedV2PhotoBytes({
 archive:alternative,sealed:photoPrivate,passphrase:syntheticPassphrase
}),'Valid but different customer-records snapshot cannot consume another photo vault');
const secondRecords=clone(archive.archive.records);
secondRecords.tables.customer_photos.push({
 ...sourcePhoto,id:'photo2',object_key:'customers/c1/photo2.jpg',size_bytes:4
});
const twoArchive=(await buildNumberedRecordsV2({
 records:secondRecords,identities:archive.archive.identities
})).archive;
const twoOriginalFiles=[
 {objectKey:'customers/c1/photo2.jpg',contentType:'image/jpeg',
  bytes:new Uint8Array([10,20,30,40])},
 photoFiles[0]
];
const twoSealed=await sealNumberedV2PhotoBytes({
 archive:twoArchive,files:twoOriginalFiles,passphrase:syntheticPassphrase
});
const twoOpened=await unsealNumberedV2PhotoBytes({
 archive:twoArchive,sealed:twoSealed,passphrase:syntheticPassphrase
});
eq(twoOpened.files.length,2,'Two photo-file recovery handles manifest ordering');
eq(twoOpened.files.find(x=>x.objectKey.endsWith('photo2.jpg')).bytes,
 new Uint8Array([10,20,30,40]),'Second photo bytes preserved despite unordered input');
const movedCipher=clone(twoSealed);
[movedCipher.items[0],movedCipher.items[1]]=[movedCipher.items[1],movedCipher.items[0]];
await privatePhotoRefuse(()=>unsealNumberedV2PhotoBytes({
 archive:twoArchive,sealed:movedCipher,passphrase:syntheticPassphrase
}),'Swapping encrypted photo slots invalidates AEAD record/index binding');
const weakRng={subtle:globalThis.crypto.subtle,
 getRandomValues(array){array.fill(7);return array;}};
await privatePhotoRefuse(()=>sealNumberedV2PhotoBytes({
 archive:archive.archive,files:photoFiles,
 passphrase:syntheticPassphrase,cryptoImpl:weakRng
}),'A duplicate AES-GCM nonce from broken RNG fails closed');
const shortEncrypted=await sealNumberedV2PhotoBytes({
 archive:archive.archive,files:[],passphrase:syntheticPassphrase
}).catch(()=>null);
eq(shortEncrypted,null,'Cannot create owner photo vault omitting saved image bytes');
console.log('PASS '+checks+'/'+checks+
 ' NEW encrypted photo-BYTES roundtrip and cross-record/tamper/nonce refusal checks (source-only).');



// NEW single portable PRIVATE recovery kit: encrypted 21-table records and
// actual encrypted image bytes travel together, bound by original checksum.
const {createNumberedV2PrivateRecoveryKit,openNumberedV2PrivateRecoveryKit}
 =await import('../lib/numbered-records-v2-private-kit.mjs');
const kit=await createNumberedV2PrivateRecoveryKit({
 archive:archive.archive,files:photoFiles,passphrase:syntheticPassphrase
});
eq(kit.format,'fire-app-complete-numbered-private-recovery-kit',
 'Portable one-object encrypted recovery bundle has explicit format');
eq(Object.keys(kit).sort(),
 ['format','sealedPhotoBytes','sealedRecords','version'].sort(),
 'Recovery kit cannot hold unexpected plaintext sidecar fields');
const kitText=JSON.stringify(kit);
eq(kitText.includes('Synthetic Customer'),false,
 'Portable recovery kit has no readable signed customer name');
eq(kitText.includes(sourcePhoto.object_key),false,
 'Portable recovery kit has no readable customer photo object key');
eq(kitText.includes('cs_test'),false,
 'Portable recovery kit does not expose payment provider reference');
eq(kitText.includes(syntheticPassphrase),false,
 'Passphrase is never bundled into the recoverable object');
const recoveredKit=await openNumberedV2PrivateRecoveryKit({
 kit:JSON.parse(kitText),passphrase:syntheticPassphrase
});
eq(recoveredKit.archive,archive.archive,
 'Portable kit decrypts exact full original numbered-records archive');
eq(recoveredKit.photos[0].bytes,photoFiles[0].bytes,
 'Portable kit decrypts the original photo BYTE contents');
eq(recoveredKit.proof.completePrivateKitDecryptedInMemory,true,
 'One operation verifies records and all photos in memory');
eq(recoveredKit.proof.verifiedPhotoFiles,1,
 'Portable kit verifies count of real photo byte objects');
eq(recoveredKit.proof.recordsPersisted,false,
 'No false claim of database restore from merely opening private kit');
eq(recoveredKit.proof.hostedRecoveryPerformed,false,
 'No false claim of actual hosted R2 or D1 recovery');
const kitRefuse=async(fn,label)=>{
 await assert.rejects(fn,/FIRE PRIVATE RECOVERY KIT REFUSED/,label);checks++;
};
await kitRefuse(()=>openNumberedV2PrivateRecoveryKit({
 kit,passphrase:'wrong long passphrase for the synthetic owner'
}),'Wrong password prevents opening both encrypted halves');
const changedKit=clone(kit);changedKit.sealedPhotoBytes.items[0].ciphertextBase64=
 (changedKit.sealedPhotoBytes.items[0].ciphertextBase64[0]==='A'?'B':'A')+
 changedKit.sealedPhotoBytes.items[0].ciphertextBase64.slice(1);
await kitRefuse(()=>openNumberedV2PrivateRecoveryKit({
 kit:changedKit,passphrase:syntheticPassphrase
}),'One tampered photo invalidates the complete kit');
const brokenKit=clone(kit);delete brokenKit.sealedRecords;
await kitRefuse(()=>openNumberedV2PrivateRecoveryKit({
 kit:brokenKit,passphrase:syntheticPassphrase
}),'Missing original records half refuses private recovery');
const injectedKit=clone(kit);injectedKit.archive=archive.archive;
await kitRefuse(()=>openNumberedV2PrivateRecoveryKit({
 kit:injectedKit,passphrase:syntheticPassphrase
}),'Plaintext or unreviewed fields cannot be slipped into private kit');
const alternativeKit=await createNumberedV2PrivateRecoveryKit({
 archive:alternative,files:photoFiles,passphrase:syntheticPassphrase
});
const crossMixed=clone(kit);crossMixed.sealedRecords=alternativeKit.sealedRecords;
await kitRefuse(()=>openNumberedV2PrivateRecoveryKit({
 kit:crossMixed,passphrase:syntheticPassphrase
}),'Photos from original customer record snapshot cannot pair with another valid backup');
const missingOriginal=await assert.rejects(()=>createNumberedV2PrivateRecoveryKit({
 archive:archive.archive,files:[],passphrase:syntheticPassphrase
}),/FIRE PHOTO VAULT V2 REFUSED/,
 'Cannot assemble complete kit when even one image is missing');checks++;
const zeroPhotoRecords=clone(archive.archive.records);
zeroPhotoRecords.tables.customer_photos=[];
const zeroArchive=(await buildNumberedRecordsV2({
 records:zeroPhotoRecords,identities:archive.archive.identities
})).archive;
const zeroKit=await createNumberedV2PrivateRecoveryKit({
 archive:zeroArchive,files:[],passphrase:syntheticPassphrase
});
const zeroOpened=await openNumberedV2PrivateRecoveryKit({
 kit:zeroKit,passphrase:syntheticPassphrase
});
eq(zeroOpened.photos,[],'Photo-free customers recover with explicit encrypted empty manifest');
eq(zeroOpened.archive,zeroArchive,'Photo-free private kit still preserves complete records');
console.log('PASS '+checks+'/'+checks+
 ' NEW portable encrypted full-records-plus-photo-BYTES private kit roundtrip and fail-closed checks.');



// NEW owner-only local REVIEW primitive uses exactly the same portable
// encrypted kit as the future gated browser route. It must return counts only,
// never decrypted IDs, records, signed names, passphrase or photo byte arrays.
const {inspectLocalEncryptedRecoveryKit,FIRE_PRIVATE_REVIEW_MAX_FILE_BYTES}
 =await import('../lib/numbered-records-v2-local-review.mjs');
const privateKitText=JSON.stringify(kit);
const preview=await inspectLocalEncryptedRecoveryKit({
 text:privateKitText,passphrase:syntheticPassphrase
});
eq(preview.validEncryptedRecordsAndPhotos,true,
 'Local kit review verifies records, refund agreement and all photo bytes');
eq(preview.recordTables,21,'Owner preview reports exact 21 preserved data families');
eq(preview.customers,2,'Owner preview counts customers without names');
eq(preview.estimates,2,'Owner preview reports estimates without saved identifiers');
eq(preview.verifiedPhotoFiles,1,'Owner preview verifies original image bytes');
eq(preview.filesUploaded,false,'Owner preview never uploads the private kit');
eq(preview.recordsRestored,false,'Local review is never represented as a hosted restore');
eq(preview.photosRestored,false,'Local review never claims image restore to R2');
eq(preview.releaseApproved,false,'Owner review is not permission to release');
eq(Object.values(preview).some(v=>v instanceof Uint8Array),false,
 'Owner preview never returns image bytes');
eq(JSON.stringify(preview).includes(sourcePhoto.object_key),false,
 'Owner preview never returns sensitive object keys');
eq(JSON.stringify(preview).includes('Synthetic Customer'),false,
 'Owner preview never returns signed customer name');
eq(JSON.stringify(preview).includes('cs_test'),false,
 'Owner preview never returns payment processor details');
eq(JSON.stringify(preview).includes(syntheticPassphrase),false,
 'Owner preview never persists or returns the passphrase');
const reviewReject=async(fn,label)=>{
 await assert.rejects(fn,/FIRE LOCAL RECOVERY REVIEW REFUSED/,label);checks++;
};
await reviewReject(()=>inspectLocalEncryptedRecoveryKit({
 text:privateKitText,passphrase:'wrong long recovery passphrase - synthetic'
}),'Owner local review refuses incorrect decryption without data leakage');
await reviewReject(()=>inspectLocalEncryptedRecoveryKit({
 text:JSON.stringify(changedKit),passphrase:syntheticPassphrase
}),'Owner local review refuses corrupted encrypted photo bytes');
await reviewReject(()=>inspectLocalEncryptedRecoveryKit({
 text:'{"incomplete":true}',passphrase:syntheticPassphrase
}),'Owner local review refuses unrelated JSON');
await reviewReject(()=>inspectLocalEncryptedRecoveryKit({
 text:'not valid JSON',passphrase:syntheticPassphrase
}),'Owner local review refuses malformed JSON');
eq(FIRE_PRIVATE_REVIEW_MAX_FILE_BYTES>0&&FIRE_PRIVATE_REVIEW_MAX_FILE_BYTES<128*1024*1024,true,
 'Local review uses a bounded file size rather than partially processing backups');
console.log('PASS '+checks+'/'+checks+
 ' NEW owner-local private kit inspection verifies encrypted data but returns safe counts only.');



// NEW REAL PROVIDER-BINDING SHAPE: prepare() + batch() on source D1,
// exact read-only R2 .get(object_key). No remote providers, owner data,
// uploads, or writes. A second FULL DB read catches mid-export changes.
const {captureEncryptedNumberedV2PrivateKitFromProviders}
 =await import('../lib/numbered-records-v2-source-export.mjs');
const d1Source=d1Double(tables);
const stablePhotoHead=()=>({etag:'synthetic-r2-etag-v1',
 size:sourcePhoto.size_bytes,httpMetadata:{contentType:sourcePhoto.content_type}});
const goodR2={
 reads:[],heads:[],
 async head(key){this.heads.push(key);return stablePhotoHead();},
 async get(key){
  this.reads.push(key);
  if(key!==sourcePhoto.object_key)return null;
  return{etag:'synthetic-r2-etag-v1',size:photoFiles[0].bytes.byteLength,
   httpMetadata:{contentType:sourcePhoto.content_type},
   async arrayBuffer(){return new Uint8Array(photoFiles[0].bytes).buffer;}};
 }
};
const providerKit=await captureEncryptedNumberedV2PrivateKitFromProviders({
 db:d1Source.db,bucket:goodR2,passphrase:syntheticPassphrase,now:()=>time
});
eq(providerKit.proof.databaseReadBatches,2,
 'Before-and-after D1 batches detect incomplete source changes');
eq(d1Source.calls.batches,2,'Exactly two provider-style readonly D1 batches');
eq(goodR2.reads,[sourcePhoto.object_key],
 'R2 gets only the original photo key bound to saved D1 metadata');
eq(goodR2.heads,[sourcePhoto.object_key],
 'R2 HEAD rechecks every original photo after complete database recapture');
eq(providerKit.proof.photoObjectHeadsRechecked,1,
 'The encrypted export attests a final original-photo ETag recheck');
eq(providerKit.proof.providerWritesPerformed,false,
 'Provider capture never writes to R2/D1');
eq(providerKit.proof.providerAtomicPhotoSnapshotGuaranteed,false,
 'One logical source review is not falsely claimed atomic across D1 and R2');
const providerOpened=await openNumberedV2PrivateRecoveryKit({
 kit:providerKit.kit,passphrase:syntheticPassphrase
});
eq(providerOpened.photos[0].bytes,photoFiles[0].bytes,
 'Actual R2-shaped image bytes survive encrypted private export and unseal');
eq(providerOpened.archive.records.tables.auth_rate_limits[0].attempts,2,
 'Actual D1-shaped capture includes authentication throttling counters');
const providerReject=async(fn,label)=>{
 await assert.rejects(fn,/FIRE v2 SOURCE EXPORT REFUSED|FIRE v2 FINANCIAL INTEGRITY REFUSED|FIRE PHOTO VAULT V2 REFUSED/,label);
 checks++;
};
await providerReject(()=>captureEncryptedNumberedV2PrivateKitFromProviders({
 db:d1Double(tables).db,bucket:{get:async()=>null,head:stablePhotoHead},
 passphrase:syntheticPassphrase,now:()=>time
}),'Missing R2 image refuses the entire records backup');
await providerReject(()=>captureEncryptedNumberedV2PrivateKitFromProviders({
 db:d1Double(tables).db,bucket:{head:stablePhotoHead,get:async()=>({
  etag:'synthetic-r2-etag-v1',size:sourcePhoto.size_bytes,httpMetadata:{contentType:'image/png'},
  async arrayBuffer(){return photoFiles[0].bytes.buffer;}
 })},passphrase:syntheticPassphrase,now:()=>time
}),'R2 object type mismatched to D1 metadata refuses backup');
await providerReject(()=>captureEncryptedNumberedV2PrivateKitFromProviders({
 db:d1Double(tables).db,bucket:{head:stablePhotoHead,get:async()=>({
  etag:'synthetic-r2-etag-v1',size:sourcePhoto.size_bytes-1,httpMetadata:{contentType:sourcePhoto.content_type},
  async arrayBuffer(){return photoFiles[0].bytes.buffer;}
 })},passphrase:syntheticPassphrase,now:()=>time
}),'R2 object size mismatch refuses backup');
const alteredSource=clone(tables),racingD1=d1Double(alteredSource);
const oldBatch=racingD1.db.batch;
racingD1.db.batch=async statements=>{
 if(racingD1.calls.batches===1)alteredSource.customer_notes[0].body='altered during photo read';
 return oldBatch(statements);
};
await providerReject(()=>captureEncryptedNumberedV2PrivateKitFromProviders({
 db:racingD1.db,bucket:{head:stablePhotoHead,get:async()=>({
  etag:'synthetic-r2-etag-v1',size:sourcePhoto.size_bytes,httpMetadata:{contentType:sourcePhoto.content_type},
  async arrayBuffer(){return photoFiles[0].bytes.buffer;}
 })},passphrase:syntheticPassphrase,now:()=>time
}),'Customer/financial record changes during R2 fetch block stale private kit');
eq(racingD1.calls.batches,2,'Race detector performs second complete D1 review');
await providerReject(()=>captureEncryptedNumberedV2PrivateKitFromProviders({
 db:d1Double(tables).db,bucket:{
  get:async()=>({
   ...stablePhotoHead(),async arrayBuffer(){return photoFiles[0].bytes.buffer;}
  }),
  head:async()=>({...stablePhotoHead(),etag:'different-same-size-etag'})
 },
 passphrase:syntheticPassphrase,now:()=>time
}),'R2 image replaced with same-size content after read refuses private kit');
await providerReject(()=>captureEncryptedNumberedV2PrivateKitFromProviders({
 db:d1Double(tables).db,bucket:{get:async()=>({...stablePhotoHead(),
   async arrayBuffer(){return photoFiles[0].bytes.buffer;}})},
 passphrase:syntheticPassphrase,now:()=>time
}),'R2 bucket lacking final HEAD support refuses unverified export');
await providerReject(()=>captureEncryptedNumberedV2PrivateKitFromProviders({
 db:d1Double(tables).db,bucket:null,passphrase:syntheticPassphrase,now:()=>time
}),'Missing actual R2 binding never produces a partial photos-omitted kit');
console.log('PASS '+checks+'/'+checks+
 ' NEW actual D1/R2-shaped encrypted export, missing photo, changed metadata and source-race checks.');
