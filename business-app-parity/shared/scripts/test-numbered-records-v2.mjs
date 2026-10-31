/** Focused NEW source-only archive builder/reader verification.
 * Synthetic fixtures; no owner data, Cloudflare, Stripe or hosted DB.
 * Intentionally does not rerun the existing broad app QA test suite.
 */
import assert from 'node:assert/strict';
import {buildNumberedRecordsV2,inspectNumberedRecordsV2,
  FIRE_NUMBERED_RECORDS_FORMAT,FIRE_NUMBERED_RECORDS_TABLES}
  from '../lib/numbered-records-v2.mjs';
import {NUMBERED_IDENTITY_ARCHIVE_FORMAT,NUMBERED_IDENTITY_ARCHIVE_VERSION}
  from '../lib/numbered-identity-archive.mjs';

let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const blocked=async(fn,label)=>{await assert.rejects(fn,/REFUSED|Unsafe FIRE numbered-identity archive/,label);checks++;};
const copy=v=>structuredClone(v);
const customers=[
 {id:'c1',created_at:'2026-10-01T10:00:00Z',name:'Synthetic A',email:null},
 {id:'c2',created_at:'2026-10-02T10:00:00Z',name:'Synthetic B',email:null}
];
const estimates=[
 {id:'e1',customer_id:'c1',created_at:'2026-10-03T10:00:00Z',total_cents:2500},
 {id:'e2',customer_id:'c1',created_at:'2026-10-04T10:00:00Z',total_cents:2500},
 {id:'e3',customer_id:'c2',created_at:'2026-10-05T10:00:00Z',total_cents:5000}
];
const tables=Object.fromEntries(FIRE_NUMBERED_RECORDS_TABLES.map(k=>[k,[]]));
tables.customers=customers;
tables.estimates=estimates;
tables.invoice_items=[{id:'ii1',invoice_id:'i1',name:'Window wash',total_cents:2500}];
tables.invoices=[{id:'i1',estimate_id:'e1',customer_id:'c1',total_cents:2500}];
tables.invoice_revisions=[{id:'ir1',invoice_id:'i1',total_cents:2500}];
tables.payments=[{id:'p1',estimate_id:'e1',provider_id:'cs_synthetic',amount_cents:2500}];
tables.payment_refunds=[{id:'r1',payment_id:'p1',estimate_id:'e1',amount_cents:1000}];
tables.deposit_policy_events=[{id:'d1',estimate_id:'e1',deposit_cents:1000}];
tables.deposit_agreement_snapshots=[{event_id:'d1',estimate_id:'e1',digest:'synthetic'}];
const records={format:'fire-app-records-backup',version:1,
 exportedAt:'2026-10-31T20:00:00.000Z',
 includes:{databaseRecords:true,photoMetadata:true,photoFiles:false,
   invoiceRevisionHistory:true,paymentCheckoutSessionSafety:true,
   paymentRefundHistory:true,depositPolicyAuditHistory:true,
   signedDepositAgreementHistory:true},
 warning:'Customer photo files are stored separately and are not included in this JSON backup.',
 tables};
const identities={
 format:NUMBERED_IDENTITY_ARCHIVE_FORMAT,version:NUMBERED_IDENTITY_ARCHIVE_VERSION,
 allTablesComplete:true,truncated:false,
 customers:customers.map(({id,created_at})=>({id,created_at})),
 estimates:estimates.map(({id,customer_id,created_at})=>({id,customer_id,created_at})),
 fire_customer_numbers:[
  {customer_number:2,customer_id:'c1',created_at:customers[0].created_at},
  {customer_number:5,customer_id:'c2',created_at:customers[1].created_at}
 ],
 fire_job_numbers:[
  {job_number:3,root_estimate_id:'e1',created_at:estimates[0].created_at},
  {job_number:8,root_estimate_id:'e3',created_at:estimates[2].created_at}
 ],
 fire_job_estimate_links:[
  {estimate_id:'e1',job_number:3},
  {estimate_id:'e2',job_number:3},
  {estimate_id:'e3',job_number:8}
 ],
 highWater:{customer:7,job:10}
};
const built=await buildNumberedRecordsV2({records,identities});
eq(built.archive.format,FIRE_NUMBERED_RECORDS_FORMAT,'Archive is numbered records v2');
eq(built.archive.version,2,'Archive format version is 2');
eq(built.archive.photoFilesIncluded,false,'Separate photo-file vault still required');
eq(built.archive.tableCounts.payments,1,'Payment rows retained');
eq(built.archive.tableCounts.payment_refunds,1,'Refund rows retained');
eq(built.archive.tableCounts.deposit_agreement_snapshots,1,'Signed audit rows retained');
eq(built.summary.customerNumbers,2,'Customer serial count retained');
eq(built.summary.jobNumbers,2,'Distinct job number count retained');
eq(built.summary.jobLinks,3,'Estimate revision links retained');
eq(built.summary.customerHighWater,7,'Customer high-water preserved, not max()');
eq(built.summary.jobHighWater,10,'Job high-water preserved, not max()');
eq(built.summary.actualRestoreImplemented,false,'No false claim of deployed restoration');
const verified=await inspectNumberedRecordsV2(JSON.parse(JSON.stringify(built.archive)));
eq(verified,built.summary,'Cross-process JSON roundtrip verifies without data disclosure');
const changed=copy(built.archive);changed.records.tables.payment_refunds[0].amount_cents=1200;
await blocked(()=>inspectNumberedRecordsV2(changed),'Altering a refund must fail checksum');
const counts=copy(built.archive);counts.tableCounts.invoice_revisions=0;
await blocked(()=>inspectNumberedRecordsV2(counts),'Omitting invoice revisions must fail row count');
const extra=copy(built.archive);extra.records.tables.hidden_new_table=[];
await blocked(()=>inspectNumberedRecordsV2(extra),'Unreviewed table addition cannot be silently skipped');
const noRefund=copy(records);delete noRefund.tables.payment_refunds;
await blocked(()=>buildNumberedRecordsV2({records:noRefund,identities}),'Missing refund table refused at build');
const missingSigned=copy(records);missingSigned.includes.signedDepositAgreementHistory=false;
await blocked(()=>buildNumberedRecordsV2({records:missingSigned,identities}),'Missing signed audit marker refused');
const mismatch=copy(identities);mismatch.estimates[0].customer_id='c2';
await blocked(()=>buildNumberedRecordsV2({records,identities:mismatch}),'Saved estimate ownership mismatch refused');
const missingNumber=copy(identities);missingNumber.fire_customer_numbers.pop();
await blocked(()=>buildNumberedRecordsV2({records,identities:missingNumber}),'Missing permanent Customer number refused');
const missingLink=copy(identities);missingLink.fire_job_estimate_links.pop();
await blocked(()=>buildNumberedRecordsV2({records,identities:missingLink}),'Missing Job revision link refused');
const changedSeq=copy(identities);changedSeq.highWater.job=7;
await blocked(()=>buildNumberedRecordsV2({records,identities:changedSeq}),'Consumed Job serial reuse prevented');
const badPhoto=copy(built.archive);badPhoto.photoFilesIncluded=true;
await blocked(()=>inspectNumberedRecordsV2(badPhoto),'False photo-file inclusion claim refused');
const missingArchive=copy(built.archive);delete missingArchive.records;
await blocked(()=>inspectNumberedRecordsV2(missingArchive),'Truncated records envelope refused');
const v1=copy(built.archive);v1.version=1;
await blocked(()=>inspectNumberedRecordsV2(v1),'Wrong version refused');
const extraProperty=copy(records);extraProperty.serviceLocationSnapshots={};
await blocked(()=>buildNumberedRecordsV2({records:extraProperty,identities}),'Property/snapshot extensions require separate review');
eq(built.archive.records.tables.invoices[0].total_cents,2500,'Invoice amount preserved');
eq(built.archive.records.tables.payment_refunds[0].amount_cents,1000,'Refund amount preserved');
eq(built.archive.identities.fire_job_estimate_links[1].job_number,3,'Same job serial retained across revisions');
// The original inputs must not be shared mutable references with the archive.
customers[0].name='Changed AFTER package build';
eq(built.archive.records.tables.customers[0].name,'Synthetic A','Content is detached from caller');
console.log('PASS '+checks+'/'+checks+' focused NEW numbered-records v2 pack/read/immutability/refusal checks. No hosted resources, deployment, migration, payments or photo files.');



// Distinct new scope: the actual read-only transactional D1 batch adapter.
// This is an isolated in-process D1 double. NO owner or hosted D1 was accessed.
const {captureNumberedRecordsV2FromD1,FIRE_NUMBERED_V2_READ_TABLES}=
  await import('../lib/numbered-records-v2-d1-read.mjs');
const baseRows=copy(built.archive.records.tables);
const identityTables={
 fire_customer_numbers:copy(identities.fire_customer_numbers),
 fire_job_numbers:copy(identities.fire_job_numbers),
 fire_job_estimate_links:copy(identities.fire_job_estimate_links)
};
function d1Double({missingSequence=false,badReply=false}={}){
 const calls={batches:0,sql:[]};
 const db={
  prepare(sql){calls.sql.push(sql);return{sql};},
  async batch(prepared){
   calls.batches++;
   return prepared.map((item,i)=>{
    if(i===FIRE_NUMBERED_V2_READ_TABLES.length){
      return{success:true,results:missingSequence?[]:[
        {name:'fire_customer_numbers',seq:7},{name:'fire_job_numbers',seq:10}]};
    }
    const table=FIRE_NUMBERED_V2_READ_TABLES[i];
    if(badReply&&table==='payment_refunds')return{success:false,results:[]};
    return{success:true,results:copy(baseRows[table]??identityTables[table])};
   });
  }
 };
 return{db,calls};
}
const reader=d1Double();
const fromDb=await captureNumberedRecordsV2FromD1({
 db:reader.db,integrityVerifier:async tables=>{
  eq(tables.payment_refunds.length,1,'Read adapter passes refunds to external integrity review');
  eq(tables.deposit_agreement_snapshots.length,1,'Read adapter passes signed audit to external review');
  return true;
 },now:()=>records.exportedAt
});
eq(reader.calls.batches,1,'All 20 legacy and three numbered tables/sequence read in one D1 batch');
eq(reader.calls.sql.length,FIRE_NUMBERED_V2_READ_TABLES.length+1,'Exact read-only table inventory plus sequence');
eq(reader.calls.sql.every(x=>x.startsWith('SELECT ')),true,'No write SQL is prepared');
eq((await inspectNumberedRecordsV2(fromDb.archive)).jobHighWater,10,
 'One-batch snapshot preserves real job allocator high water');
eq(fromDb.archive.records.tables.payment_refunds[0].amount_cents,1000,
 'One-batch archive retains exact refund amount');
await blocked(()=>captureNumberedRecordsV2FromD1({
 db:d1Double().db,now:()=>records.exportedAt
}),'No financial/agreement integrity gate means no read');
await blocked(()=>captureNumberedRecordsV2FromD1({
 db:d1Double({missingSequence:true}).db,integrityVerifier:()=>true,now:()=>records.exportedAt
}),'Unobservable permanent number allocator must stop');
await blocked(()=>captureNumberedRecordsV2FromD1({
 db:d1Double({badReply:true}).db,integrityVerifier:()=>true,now:()=>records.exportedAt
}),'A failed D1 result must block the archive');
await blocked(()=>captureNumberedRecordsV2FromD1({
 db:d1Double().db,integrityVerifier:()=>false,now:()=>records.exportedAt
}),'No affirmative document/finance validation must block archiving');
console.log('PASS '+checks+'/'+checks+' NEW v2 content and transactional D1 read-only adapter checks (synthetic only).');
