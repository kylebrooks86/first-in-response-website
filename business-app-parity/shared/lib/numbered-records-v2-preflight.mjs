/** FIRE versioned numbered-record recovery: SOURCE-ONLY, no side effects.
 *
 * Does NOT turn on a live/QA backup or restore endpoint. Reject a snapshot
 * if ANY core v1 records table or permanent number history is missing.
 * Cloud/local photo blobs, extra feature-specific tables, encrypted archive
 * custody, physical D1/Worker binding, and real recovery rehearsal are NOT
 * proven by this core records contract. Keep legacy JSON HTTP 409 lock.
 */
import {validateNumberedIdentityArchive,planNumberedIdentityRestore,
  NUMBERED_IDENTITY_ARCHIVE_FORMAT,NUMBERED_IDENTITY_ARCHIVE_VERSION
} from './numbered-identity-archive.mjs';
import {assertBackupIntegrity} from '../scripts/records-backup-integrity.mjs';

export const NUMBERED_RECORDS_V2_FORMAT='fire-numbered-core-records-snapshot';
export const NUMBERED_RECORDS_V2_VERSION=2;
export const NUMBERED_CORE_TABLES=Object.freeze([
 'customers','estimates','customer_notes','invoices','invoice_items','invoice_revisions',
 'payment_checkout_sessions','payment_refunds','deposit_policy_events',
 'deposit_agreement_snapshots','estimate_items','payments','customer_photos',
 'customer_messages','notifications','message_templates','estimate_change_requests',
 'tasks','expenses','job_reports'
]);
export const NUMBERED_IDENTITY_TABLES=Object.freeze([
 'fire_customer_numbers','fire_job_numbers','fire_job_estimate_links'
]);
const fail=reason=>{throw new Error('FIRE numbered records v2 blocked: '+reason);};
const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const isOwn=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const keyOf=table=>table==='message_templates'?'key':
 table==='deposit_agreement_snapshots'?'event_id':'id';
const identityKeyOf=table=>table==='fire_customer_numbers'?'customer_id':
 table==='fire_job_numbers'?'root_estimate_id':'estimate_id';
const asSortedJson=value=>{
 if(Array.isArray(value))return '['+value.map(asSortedJson).join(',')+']';
 if(isRecord(value))return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+asSortedJson(value[key])).join(',')+'}';
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 fail('non-JSON data cannot be trusted for a lossless restore');
};

export function validateNumberedCoreRecordsV2(snapshot){
 if(!isRecord(snapshot)||snapshot.format!==NUMBERED_RECORDS_V2_FORMAT||
   snapshot.version!==NUMBERED_RECORDS_V2_VERSION||
   snapshot.allTablesComplete!==true||snapshot.truncated!==false||
   !isRecord(snapshot.tables)||!isRecord(snapshot.highWater))
    fail('format, completeness, tables or high-water evidence missing');
 const expected=new Set([...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES]);
 for(const name of Object.keys(snapshot.tables))
   if(!expected.has(name))fail('unexpected/unverified table '+name);
 for(const name of expected)
   if(!isOwn(snapshot.tables,name)||!Array.isArray(snapshot.tables[name]))
     fail('required table '+name+' is absent or partial');
 for(const [table,list] of Object.entries(snapshot.tables)){
   const seen=new Set();
   const key=NUMBERED_IDENTITY_TABLES.includes(table)?identityKeyOf(table):keyOf(table);
   for(const row of list){
     if(!isRecord(row)||typeof row[key]!=='string'&&!NUMBERED_IDENTITY_TABLES.includes(table)||
        !isOwn(row,key)||row[key]===null||row[key]==='')
       fail('invalid primary identity in '+table);
     if(seen.has(row[key]))fail('duplicate identity in '+table);
     seen.add(row[key]);
     // Do not silently discard columns or accept values the archive cannot
     // serialize faithfully (undefined, NaN, binary objects, functions).
     asSortedJson(row);
   }
 }
 // Runs actual legacy deposit audit, agreement, refund ledger and relationship
 // checks before the candidate can be considered internally consistent.
 try{assertBackupIntegrity(Object.fromEntries(NUMBERED_CORE_TABLES.map(t=>[t,snapshot.tables[t]])));}
 catch(err){fail('legacy record relationships, audit or refund ledger invalid');}
 const identity={
   format:NUMBERED_IDENTITY_ARCHIVE_FORMAT,version:NUMBERED_IDENTITY_ARCHIVE_VERSION,
   allTablesComplete:true,truncated:false,
   customers:snapshot.tables.customers,estimates:snapshot.tables.estimates,
   fire_customer_numbers:snapshot.tables.fire_customer_numbers,
   fire_job_numbers:snapshot.tables.fire_job_numbers,
   fire_job_estimate_links:snapshot.tables.fire_job_estimate_links,
   highWater:snapshot.highWater
 };
 let counts;
 try{counts=validateNumberedIdentityArchive(identity);}
 catch{fail('immutable identity ownership, coverage or high-water invalid');}
 return Object.freeze({
   ...counts,coreTables:NUMBERED_CORE_TABLES.length,
   identityTables:NUMBERED_IDENTITY_TABLES.length,
   coreRows:NUMBERED_CORE_TABLES.reduce((n,t)=>n+snapshot.tables[t].length,0),
   requiresAdditionalTableAndPhotoCoverage:true,hostedWritesPerformed:false
 });
}

/** Compare immutable source and destination; cannot produce executable SQL.
 * Replaying a different financial record with the same ID is a CONFLICT,
 * never a last-write-wins merge. This is deliberately stricter than v1
 * ordinary record restore; a future real restore must prove all other tables.
 */
export function planNumberedCoreRecordsV2Restore(source,destination){
 const a=validateNumberedCoreRecordsV2(source);
 const b=validateNumberedCoreRecordsV2(destination);
 const sourceIdentity={format:NUMBERED_IDENTITY_ARCHIVE_FORMAT,version:1,
   allTablesComplete:true,truncated:false,...Object.fromEntries(
     [...NUMBERED_IDENTITY_TABLES,'customers','estimates'].map(t=>[t,source.tables[t]])),
   highWater:source.highWater};
 const destIdentity={...sourceIdentity,...Object.fromEntries(
     [...NUMBERED_IDENTITY_TABLES,'customers','estimates'].map(t=>[t,destination.tables[t]])),
   highWater:destination.highWater};
 let identityPlan;
 try{identityPlan=planNumberedIdentityRestore(sourceIdentity,destIdentity);}
 catch{fail('immutable numbering or serial collision in destination');}
 const additions={};
 for(const table of NUMBERED_CORE_TABLES){
   const key=keyOf(table),existing=new Map(destination.tables[table].map(row=>[row[key],row]));
   let count=0;
   for(const row of source.tables[table]){
     const prior=existing.get(row[key]);
     if(prior){
       if(asSortedJson(prior)!==asSortedJson(row))
         fail('conflicting existing core record in '+table);
     }else{count++;}
   }
   additions[table]=count;
 }
 return Object.freeze({
   sourceCoreRows:a.coreRows,destinationCoreRows:b.coreRows,
   insertCoreRecords:Object.freeze(additions),
   insertCustomerNumbers:identityPlan.insertedCustomerNumbers,
   insertJobNumbers:identityPlan.insertedJobNumbers,
   insertJobLinks:identityPlan.insertedJobLinks,
   customerHighWater:identityPlan.customerHighWater,
   jobHighWater:identityPlan.jobHighWater,
   requiresOwnerApprovedAtomicRestore:true,
   requiresCompleteSupplementalTableAndPhotoEvidence:true,
   hostedWritesPerformed:false
 });
}
