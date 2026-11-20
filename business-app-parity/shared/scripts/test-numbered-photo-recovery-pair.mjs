/** Synthetic-only FIRE Gate7 v2 records + photo paired-recovery preflight. */
import assert from 'node:assert/strict';
import {NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES,
 NUMBERED_RECORDS_V2_FORMAT,NUMBERED_RECORDS_V2_VERSION}
 from '../lib/numbered-records-v2-preflight.mjs';
import {sealNumberedRecordAndPhotoRecoveryPair,
 compareNumberedRecordAndPhotoPairSeals} from '../lib/numbered-photo-recovery-pair.mjs';
let n=0;
const ok=(value,message)=>{assert.ok(value,message);n++};
const blocked=async(promise,why)=>{await assert.rejects(promise,/blocked/,why);n++};
const sample=()=>{
 const tables=Object.fromEntries([...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES].map(t=>[t,[]]));
 const date='2026-11-01T00:00:00Z';
 tables.customers=[{id:'synthetic-c1',name:'Test customer',created_at:date}];
 tables.estimates=[{id:'synthetic-e1',customer_id:'synthetic-c1',created_at:date,status:'draft',total_cents:100}];
 tables.fire_customer_numbers=[{customer_id:'synthetic-c1',customer_number:1,created_at:date}];
 tables.fire_job_numbers=[{root_estimate_id:'synthetic-e1',job_number:1,created_at:date}];
 tables.fire_job_estimate_links=[{estimate_id:'synthetic-e1',job_number:1}];
 return {format:NUMBERED_RECORDS_V2_FORMAT,version:NUMBERED_RECORDS_V2_VERSION,
  allTablesComplete:true,truncated:false,tables,
  rowCounts:Object.fromEntries(Object.entries(tables).map(([t,v])=>[t,v.length])),
  highWater:{customer:1,job:1}};
};
const photo=(id='photo-1')=>({id,customerId:'synthetic-c1',category:'before',
 caption:'Synthetic before only',filename:'synthetic.jpg',contentType:'image/jpeg',
 sizeBytes:3,createdAt:'2026-11-01T00:00:00Z',
 blob:new Blob([Uint8Array.from([1,2,3])],{type:'image/jpeg'})});
const original=sample(),one=photo();
const seal=await sealNumberedRecordAndPhotoRecoveryPair(original,[one]);
ok(seal.customerCount===1&&seal.photoCount===1&&seal.numberedJobCount===1,'linked synthetic numbered records and photograph');
ok(seal.customerHighWater===1&&seal.jobHighWater===1,'permanent serials sealed');
ok(seal.physicallyStoredBackupVerified===false&&seal.gate7Accepted===false,'never fake recovery gate');
ok(/^[0-9a-f]{64}$/.test(seal.pairSha256),'cryptographic paired digest exists');

// A photo's jobId must be an immutable numbered-job root estimate ID in
// the SAME snapshot, not a display number, an unrelated estimate or arbitrary
// syntactically valid string. A customer's photos cannot claim another
// customer's numbered job even when both customers exist in the archive.
const linked={...one,jobId:'synthetic-e1'};
const linkedSeal=await sealNumberedRecordAndPhotoRecoveryPair(original,[linked]);
ok(linkedSeal.photosSha256!==seal.photosSha256&&linkedSeal.pairSha256!==seal.pairSha256,
 'Valid job-linked photo binds its numbered-job identity into the paired recovery digest');
await assert.rejects(sealNumberedRecordAndPhotoRecoveryPair(original,[{...one,jobId:'0001'}]),
 /unknown numbered job root estimate/);
n++; // A human-readable job number is not an immutable job identifier.
await assert.rejects(sealNumberedRecordAndPhotoRecoveryPair(original,[{...one,jobId:'other-estimate'}]),
 /unknown numbered job root estimate/);
n++;
const otherCustomer=sample();
otherCustomer.tables.customers.push({id:'synthetic-c2',name:'Other customer',created_at:'2026-11-01T00:00:00Z'});
otherCustomer.tables.estimates.push({id:'synthetic-e2',customer_id:'synthetic-c2',created_at:'2026-11-01T00:00:00Z',status:'draft',total_cents:100});
otherCustomer.tables.fire_customer_numbers.push({customer_id:'synthetic-c2',customer_number:2,created_at:'2026-11-01T00:00:00Z'});
otherCustomer.tables.fire_job_numbers.push({root_estimate_id:'synthetic-e2',job_number:2,created_at:'2026-11-01T00:00:00Z'});
otherCustomer.tables.fire_job_estimate_links.push({estimate_id:'synthetic-e2',job_number:2});
otherCustomer.highWater={customer:2,job:2};
otherCustomer.rowCounts=Object.fromEntries(Object.entries(otherCustomer.tables).map(([table,rows])=>[table,rows.length]));
await assert.rejects(
 sealNumberedRecordAndPhotoRecoveryPair(otherCustomer,[{...one,jobId:'synthetic-e2'}]),
 /photo numbered job belongs to another customer/);
n++;
ok((await sealNumberedRecordAndPhotoRecoveryPair(otherCustomer,[{...one,jobId:'synthetic-e1'}])).photoCount===1,
 'Same snapshot with multiple customers accepts only correctly owned job-linked photos');

const amendedJob=sample();
amendedJob.tables.estimates.push({id:'synthetic-e1-change',customer_id:'synthetic-c1',
 created_at:'2026-11-01T00:00:00Z',status:'draft',total_cents:100});
amendedJob.tables.fire_job_estimate_links.push({estimate_id:'synthetic-e1-change',job_number:1});
amendedJob.rowCounts=Object.fromEntries(Object.entries(amendedJob.tables).map(([table,rows])=>[table,rows.length]));
ok((await sealNumberedRecordAndPhotoRecoveryPair(amendedJob,[{...one,jobId:'synthetic-e1-change'}])).photoCount===1,
 'Additional estimate linked to the SAME numbered job and customer is a valid photo association');


const reordered=structuredClone(original);
const matching=await sealNumberedRecordAndPhotoRecoveryPair(reordered,[one]);
ok((await compareNumberedRecordAndPhotoPairSeals(seal,matching)).sourceAndDestinationMatch,'unchanged synthetic isolated copy agrees');
const altered=structuredClone(original);altered.tables.estimates[0].total_cents=200;
const alteredSeal=await sealNumberedRecordAndPhotoRecoveryPair(altered,[one]);
await blocked(Promise.resolve().then(()=>compareNumberedRecordAndPhotoPairSeals(seal,alteredSeal)),
 'changed estimate cents must not pass paired restore');
const changedPhoto={...one,blob:new Blob([Uint8Array.from([1,8,3])],{type:'image/jpeg'})};
const changedSeal=await sealNumberedRecordAndPhotoRecoveryPair(original,[changedPhoto]);
await blocked(Promise.resolve().then(()=>compareNumberedRecordAndPhotoPairSeals(seal,changedSeal)),
 'changed original photo bytes invalidate the recovery pair');
// Equal-looking seals are NOT enough: the domain-separated pair digest must
// truly bind the records and photo digests. Reject forged identical headers.
const forgedPair={...seal,pairSha256:'0'.repeat(64)};
await blocked(compareNumberedRecordAndPhotoPairSeals(forgedPair,forgedPair),
 'identically forged pair fingerprints cannot be accepted');
const forgedRecords={...seal,recordsSha256:'1'.repeat(64)};
await blocked(compareNumberedRecordAndPhotoPairSeals(forgedRecords,forgedRecords),
 'identically altered records digest with stale pair is invalid');
const forgedPhotos={...seal,photosSha256:'2'.repeat(64)};
await blocked(compareNumberedRecordAndPhotoPairSeals(forgedPhotos,forgedPhotos),
 'identically altered photo digest with stale pair is invalid');
for(const tamper of [
 {...seal,pairSha256:'invalid'},
 {...seal,recordsSha256:'invalid'},
 {...seal,photosSha256:'invalid'},
 {...seal,physicallyStoredBackupVerified:true},
 {...seal,independentRestoreVerified:true},
 {...seal,gate7Accepted:true},
 {...seal,unapprovedProviderClaim:true},
 {...seal,photoCount:-1},
 {...seal,customerHighWater:1.5},
]){
 await blocked(compareNumberedRecordAndPhotoPairSeals(tamper,tamper),
  'malformed or invented provider/custody evidence must fail before acceptance');
}
const changedHigh=structuredClone(original);changedHigh.highWater.job=2;
const changedHighSeal=await sealNumberedRecordAndPhotoRecoveryPair(changedHigh,[one]);
await blocked(Promise.resolve().then(()=>compareNumberedRecordAndPhotoPairSeals(seal,changedHighSeal)),
 'consumed job-number history may not disappear or change');
await blocked(sealNumberedRecordAndPhotoRecoveryPair(original,[one,one]),
 'duplicate photo identifiers');
await blocked(sealNumberedRecordAndPhotoRecoveryPair(original,[{...one,customerId:'unknown'}]),
 'orphan photo to nonexistent D1 customer');
await blocked(sealNumberedRecordAndPhotoRecoveryPair(original,[{...one,sizeBytes:4}]),
 'photo byte length does not match');
await blocked(sealNumberedRecordAndPhotoRecoveryPair(original,[{...one,contentType:'image/svg+xml'}]),
 'unsafe image type');
const hosted=structuredClone(original);
hosted.tables.customer_photos=[{id:'old-hosted',customer_id:'synthetic-c1',
 category:'before',object_key:'customers/synthetic-c1/old-hosted.jpg'}];
hosted.rowCounts.customer_photos=1;
await blocked(sealNumberedRecordAndPhotoRecoveryPair(hosted,[one]),
 'R2-hosted photo metadata cannot masquerade as restored local ZIP');
const empty=sample(),emptySeal=await sealNumberedRecordAndPhotoRecoveryPair(empty,[]);
ok(emptySeal.photoCount===0&&emptySeal.gate7Accepted===false,
 'no-photo prelaunch candidate does not fabricate full restore');
console.log('PASS '+n+'/'+n+' synthetic numbered records and device-photo paired-recovery integrity cases; no remote or local writes.');
