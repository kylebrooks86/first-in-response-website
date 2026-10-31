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
