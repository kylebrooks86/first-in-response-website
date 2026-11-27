/** FIRE Gate7: actual native WebCrypto + verified v2 core records file.
 * Disposable JS objects only; no Worker, D1, Stripe, filesystem or real data.
 */
import assert from 'node:assert/strict';
import {NUMBERED_RECORDS_V2_FORMAT,NUMBERED_RECORDS_V2_VERSION,
 NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES} from '../lib/numbered-records-v2-preflight.mjs';
import {protectNumberedCoreV2Records,verifyProtectedNumberedCoreV2Records}
 from '../lib/protected-numbered-v2-records.mjs';

let checks=0;
const check=(ok,description)=>{assert.ok(ok,description);checks++;};
const rejects=async(p,description)=>{await assert.rejects(p,/blocked/,description);checks++;};
const phrase='Synthetic FIRE offline recovery secret only 2026';
const sample=()=>{
 const tables=Object.fromEntries([...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES].map(name=>[name,[]]));
 const time='2026-11-15T00:00:00.000Z';
 tables.customers=[{id:'synthetic-customer',name:'Synthetic FIRE 🔥 Customer',email:'synthetic@example.invalid',
  phone:'',address:'100 Imaginary Street',lead_source:'Referral',created_at:time}];
 tables.estimates=[{id:'synthetic-estimate',customer_id:'synthetic-customer',status:'draft',
  subtotal_cents:46000,total_cents:46000,deposit_cents:23000,created_at:time}];
 tables.fire_customer_numbers=[{customer_number:7,customer_id:'synthetic-customer',created_at:time}];
 tables.fire_job_numbers=[{job_number:11,root_estimate_id:'synthetic-estimate',created_at:time}];
 tables.fire_job_estimate_links=[{estimate_id:'synthetic-estimate',job_number:11}];
 return {format:NUMBERED_RECORDS_V2_FORMAT,version:NUMBERED_RECORDS_V2_VERSION,
  allTablesComplete:true,truncated:false,tables,
  rowCounts:Object.fromEntries(Object.entries(tables).map(([key,value])=>[key,value.length])),
  highWater:{customer:12,job:15}};
};
const snapshot=sample(),original=JSON.stringify(snapshot);
const protectedFile=await protectNumberedCoreV2Records(snapshot,phrase);
check(protectedFile instanceof Blob&&protectedFile.type==='application/octet-stream',
 'Actual encrypted Blob is generated, not an unprotected JSON response');
const raw=new Uint8Array(await protectedFile.arrayBuffer()),rawText=new TextDecoder().decode(raw);
check(rawText.startsWith('FIRERN02')&&!rawText.includes('synthetic@example.invalid')&&
 !rawText.includes('Synthetic FIRE')&&!rawText.includes('synthetic-estimate'),
 'Encrypted file has a domain-separated header and no plaintext customer/financial values');
const receipt=await verifyProtectedNumberedCoreV2Records(protectedFile,phrase);
check(JSON.stringify(receipt.snapshot)===original,'Every source record and serial high-water survives decryption');
check(receipt.encryptedFileAuthenticated===true&&receipt.numberedCoreValidated===true&&
 receipt.includedCoreTables===20&&receipt.includedPermanentIdentityTables===3,
 'Verified file authenticates the actual 20 core plus 3 immutable numbering tables');
check(receipt.gate7Accepted===false&&receipt.databaseWritesPerformed===false&&
 receipt.photoBytesIncluded===false&&receipt.independentOffDeviceCustodyVerified===false&&
 receipt.isolatedD1RestoreVerified===false&&receipt.supplementalSchemaCoverageVerified===false,
 'No synthetic source or file readback can falsely accept physical Gate7 or photo recovery');
const second=await protectNumberedCoreV2Records(snapshot,phrase);
check(Buffer.compare(Buffer.from(await second.arrayBuffer()),Buffer.from(raw))!==0,
 'Each export gets independently randomized salt and authenticated IV');
check(JSON.stringify(snapshot)===original,'Encryption and readback did not modify source records');
await rejects(verifyProtectedNumberedCoreV2Records(protectedFile,'Different synthetic recovery phrase 2026'),
 'Wrong passphrase must fail with no recovery');
await rejects(protectNumberedCoreV2Records(snapshot,'short'),
 'Weak passphrase cannot encrypt owner records');
await rejects(verifyProtectedNumberedCoreV2Records(new Blob([JSON.stringify(snapshot)]),phrase),
 'Unencrypted JSON cannot be mistaken for protected owner records');
const altered=(offset,value)=>{
 const bytes=raw.slice();bytes[offset]^=value;return new Blob([bytes],{type:'application/octet-stream'});
};
for(const [index,label] of [[0,'wrong archive domain'],[8,'changed PBKDF2 salt'],
 [24,'changed authenticated nonce'],[36,'changed declared byte count'],
 [40,'changed ciphertext'],[raw.length-1,'changed GCM tag']]){
 await rejects(verifyProtectedNumberedCoreV2Records(altered(index,1),phrase),
  'Reject '+label+' without trusting customer data');
}
await rejects(verifyProtectedNumberedCoreV2Records(new Blob([raw.slice(0,-1)]),phrase),
 'Truncated authenticated records bytes refuse recovery');
await rejects(verifyProtectedNumberedCoreV2Records(new Blob([raw,Uint8Array.from([0])]),phrase),
 'Appended data cannot be ignored after an otherwise valid record file');
await rejects(verifyProtectedNumberedCoreV2Records(new Blob([new Uint8Array(5_000_100)]),phrase),
 'Oversized record file rejected before attempting PBKDF2 or JSON');
const extras={...sample(),unreviewed:{value:'secret'}};
await rejects(protectNumberedCoreV2Records(extras,phrase),
 'Unexpected top-level manifest values cannot be silently hidden in a protected file');
const badCount=sample();badCount.rowCounts.customers=2;
await rejects(protectNumberedCoreV2Records(badCount,phrase),
 'Invalid table counts must fail before encryption');
const badSerial=sample();badSerial.highWater.customer=6;
await rejects(protectNumberedCoreV2Records(badSerial,phrase),
 'Permanent numbering/high-water cannot be forged during encryption');
const missing=sample();delete missing.tables.payment_refunds;
await rejects(protectNumberedCoreV2Records(missing,phrase),
 'Missing financial/refund table prevents producing a deceptively valid archive');
check(JSON.stringify(snapshot)===original,
 'No reject or tamper case modified source business data');
console.log('PASS '+checks+'/'+checks+
 ' actual WebCrypto numbered-v2 protected records custody checks, synthetic only; no provider, file write or restore.');
