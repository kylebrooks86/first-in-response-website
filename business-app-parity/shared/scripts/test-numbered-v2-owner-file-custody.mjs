/** Actual native WebCrypto source-only 23-table FIRE owner file test.
 * No browser download, D1, provider, photo restore or customer records.
 */
import assert from 'node:assert/strict';
import {NUMBERED_RECORDS_V2_FORMAT,NUMBERED_RECORDS_V2_VERSION,
 NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES} from '../lib/numbered-records-v2-preflight.mjs';
import {prepareNumberedV2OwnerFile,verifySavedNumberedV2OwnerFile,
 inspectExistingProtectedNumberedV2File} from '../lib/numbered-v2-owner-file-custody.mjs';

const date='2026-11-15T00:00:00.000Z';
const sample=()=>{
 const tables=Object.fromEntries([...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES].map(t=>[t,[]]));
 tables.customers=[{id:'synthetic-customer',name:'FIRE Synthetic',email:'synthetic@example.invalid',phone:'',address:'Synthetic address',created_at:date}];
 tables.estimates=[{id:'synthetic-job',customer_id:'synthetic-customer',status:'draft',subtotal_cents:46000,total_cents:46000,deposit_cents:23000,created_at:date}];
 tables.fire_customer_numbers=[{customer_id:'synthetic-customer',customer_number:7,created_at:date}];
 tables.fire_job_numbers=[{root_estimate_id:'synthetic-job',job_number:11,created_at:date}];
 tables.fire_job_estimate_links=[{estimate_id:'synthetic-job',job_number:11}];
 return {format:NUMBERED_RECORDS_V2_FORMAT,version:NUMBERED_RECORDS_V2_VERSION,
  allTablesComplete:true,truncated:false,tables,
  rowCounts:Object.fromEntries(Object.entries(tables).map(([t,r])=>[t,r.length])),
  highWater:{customer:13,job:19}};
};
const phrase='Synthetic FIRE protected core records passphrase 2026';
let n=0;
const ok=(condition,msg)=>{assert.ok(condition,msg);n++};
const blocked=async(p,msg)=>{await assert.rejects(p,/blocked/,msg);n++};
const archive=sample(),before=JSON.stringify(archive);
const prepared=await prepareNumberedV2OwnerFile(archive,phrase,phrase,new Date(date));
ok(prepared.filename==='FIRE-numbered-v2-CORE-ONLY-2026-11-15T00-00-00-000Z.firerecords',
 'Filename safely distinguishes records-only file from real customer/photo backups');
ok(prepared.blob.size===prepared.sizeBytes&&/^[a-f0-9]{64}$/.test(prepared.sha256),
 'Prepared file is an authenticated encrypted Blob with SHA-256 of its exact bytes');
ok(prepared.savedFileReadbackVerified===false&&prepared.offDeviceCustodyVerified===false&&
 prepared.photoBytesIncluded===false&&prepared.gate7Accepted===false,
 'In-memory preparation never claims file save or complete Gate7');
const saved=new Blob([await prepared.blob.arrayBuffer()],{type:'application/octet-stream'});
const receipt=await verifySavedNumberedV2OwnerFile(prepared,saved,phrase);
ok(receipt.selectedSavedFileByteIdentical&&receipt.savedFileAuthenticatedAndCoreValidated&&
 receipt.sourceAndSavedRecordContentIdentical,'Owner-selected saved bytes authenticate exactly');
ok(receipt.encryptedFileSha256===prepared.sha256&&receipt.numberOfPermanentIdentityTables===3,
 'Saved-file fingerprint is bound to 23 original tables and immutable serials');
ok(receipt.independentOffDeviceCustodyVerified===false&&receipt.gate7Accepted===false&&
 receipt.sameInstantPhotoPairVerified===false&&receipt.isolatedRestoreVerified===false,
 'Even genuine selected-file readback never pretends full independent recovery');
const inspected=await inspectExistingProtectedNumberedV2File(saved,phrase);
ok(inspected.numberedCoreValidated&&inspected.currentSourceSnapshotCompared===false&&
 !('snapshot' in inspected),'Post-reload inspection cannot prove file matches current application records');
ok(JSON.stringify(archive)===before,'No source customer or financial value was mutated');

await blocked(prepareNumberedV2OwnerFile(archive,phrase,'a different 16 character phrase'),
 'Mismatched confirmation blocks before encrypting owner record');
await blocked(prepareNumberedV2OwnerFile(archive,'short','short'),
 'Weak recovery passphrase cannot generate an archive');
await blocked(prepareNumberedV2OwnerFile(archive,phrase,phrase,new Date(NaN)),
 'Invalid filename date cannot produce an owner file');
const badSnapshot=sample();badSnapshot.rowCounts.customers=99;
await blocked(prepareNumberedV2OwnerFile(badSnapshot,phrase,phrase),
 'Bad count and schema cannot be saved as protected records');
const badHighWater=sample();badHighWater.highWater.job=1;
await blocked(prepareNumberedV2OwnerFile(badHighWater,phrase,phrase),
 'Lost immutable Job # serial high-water rejected');

await blocked(verifySavedNumberedV2OwnerFile(prepared,saved,'different strong passphrase for test'),
 'Saved encrypted file requires its original independent passphrase');
const bytes=new Uint8Array(await prepared.blob.arrayBuffer());
const changed=bytes.slice();changed[40]^=1;
await blocked(verifySavedNumberedV2OwnerFile(prepared,new Blob([changed]),phrase),
 'Changed ciphertext refused even when length and filename look correct');
await blocked(verifySavedNumberedV2OwnerFile(prepared,new Blob([bytes.slice(0,-1)]),phrase),
 'Truncated file cannot pass saved-file review');
await blocked(verifySavedNumberedV2OwnerFile(prepared,new Blob([bytes,Uint8Array.from([0])]),phrase),
 'Appended bytes cannot pass file readback');
const substitute=await prepareNumberedV2OwnerFile(archive,phrase,phrase);
await blocked(verifySavedNumberedV2OwnerFile(prepared,substitute.blob,phrase),
 'Different valid encryption of SAME records cannot impersonate the prepared file');
const alteredSource={...prepared,sha256:'0'.repeat(64)};
await blocked(verifySavedNumberedV2OwnerFile(alteredSource,saved,phrase),
 'Tampered in-memory expected fingerprint cannot prove file custody');
await blocked(verifySavedNumberedV2OwnerFile({blob:prepared.blob},saved,phrase),
 'Missing preparation receipt blocks any fake verified-saved claim');
await blocked(inspectExistingProtectedNumberedV2File(saved,'a wrong but long enough recovery secret'),
 'Old owner-file inspection refuses wrong passphrase');
ok(JSON.stringify(archive)===before,'Failure paths never modify original records');
console.log('PASS '+n+'/'+n+
 ' native source-only encrypted numbered owner-file save/readback tests; no hosted or filesystem operation.');
