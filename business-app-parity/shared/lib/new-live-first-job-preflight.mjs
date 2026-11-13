/**
 * FIRE NEW LIVE #0001 PRE-ACTIVATION read-only D1 inspection.
 *
 * Call ONLY before initial production activation on the independently mapped
 * NEW LIVE database, NOT on every login or after the first live job exists.
 * No writes, no migrations, no secrets, no billing/provider clients.
 * It cannot establish the actual Cloudflare binding/UUID: separate owner-
 * authenticated provider attestation of the target remains mandatory.
 */
import {JOB_NUMBER_FLAG,jobNumberingReady} from './job-numbering.mjs';
import {CUSTOMER_NUMBER_FLAG,customerNumberingReady} from './customer-numbering.mjs';
import {NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES} from './numbered-records-v2-preflight.mjs';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS,assertNewLiveMigrationJournal} from './new-live-migration-journal.mjs';

const stop=reason=>{throw Error('FIRE NEW LIVE clean start BLOCKED: '+reason);};
const expected=Object.freeze([...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES,'auth_rate_limits']);
const REQUIRED_TRIGGERS=Object.freeze([
 'fire_customer_numbers_no_update','fire_customer_numbers_no_delete',
 'fire_job_numbers_no_update','fire_job_numbers_no_delete',
 'fire_job_estimate_links_no_update','fire_job_estimate_links_no_delete'
]);
// D1's documented provider-owned metadata tables are not customer records.
// Only these exact definitions are exempt; unknown _cf_* or sqliteX tables
// must block activation instead of being silently omitted.
const PROVIDER_DDL=Object.freeze({
 _cf_KV:/^CREATE\s+TABLE\s+(?:_cf_KV|"_cf_KV"|`_cf_KV`|\[_cf_KV\])\s*\(\s*(?:key|"key"|`key`|\[key\])\s+TEXT\s+PRIMARY\s+KEY\s*,\s*(?:value|"value"|`value`|\[value\])\s+BLOB\s*\)\s+WITHOUT\s+ROWID\s*;?$/i,
 _cf_METADATA:/^CREATE\s+TABLE\s+(?:_cf_METADATA|"_cf_METADATA"|`_cf_METADATA`|\[_cf_METADATA\])\s*\(\s*(?:key|"key"|`key`|\[key\])\s+INTEGER\s+PRIMARY\s+KEY\s*,\s*(?:value|"value"|`value`|\[value\])\s+BLOB\s*\)\s*;?$/i
});
async function one(db,sql,params=[]){
 if(!db||typeof db.prepare!=='function')stop('independent physical D1 reader missing');
 const prepared=db.prepare(sql);
 if(!prepared||typeof prepared.first!=='function')stop('D1 read interface missing');
 const query=params.length?prepared.bind(...params):prepared;
 return query.first();
}
function naturalCount(value,label){
 if(value===undefined||value===null||typeof value==='boolean'||
    typeof value==='string'&&!/^(0|[1-9][0-9]*)$/.test(value)||
    typeof value!=='string'&&typeof value!=='number')
  stop(label+' count was missing or malformed');
 const count=typeof value==='number'?value:Number(value);
 if(!Number.isSafeInteger(count)||count<0)stop(label+' returned an invalid count');
 return count;
}
export async function inspectNewLiveFirstJobCleanStart(db,vars){
 if(vars?.FIRE_ENV!=='new-live-prelaunch'||vars?.FIRE_JOB_NUMBERS_CANDIDATE!==JOB_NUMBER_FLAG||
    vars?.FIRE_CUSTOMER_NUMBERS_CANDIDATE!==CUSTOMER_NUMBER_FLAG)
  stop('target is not an explicitly numbered NEW LIVE candidate');
 // First validate app-numbering source, ownership links and immutable triggers.
 try{if(!await jobNumberingReady(db,vars))stop('permanent number controls disabled');}
 catch{stop('physical permanent Job # schema or ownership is not ready');}
 // Customer #0001 must be just as safe as Job #0001. Merely finding the
 // table is insufficient: require the owner's explicit feature flag,
 // immutable triggers and complete historical customer identity coverage.
 try{if(!await customerNumberingReady(db,vars))stop('permanent Customer # controls disabled');}
 catch{stop('physical permanent Customer # schema or ownership is not ready');}
 // Explicitly inspect names before SELECTing anything: missing supplemental
 // tables, new unknown feature tables, or an incomplete migration cannot be
 // passed off as a clean and recoverable production schema.
 const schema=await one(db,
  "SELECT GROUP_CONCAT(name || CHAR(31) || COALESCE(sql,''), CHAR(30)) AS entries FROM sqlite_master "+
  "WHERE type='table' AND lower(substr(name,1,7)) <> 'sqlite_'");
 if(!schema||typeof schema.entries!=='string')stop('schema table inventory unavailable');
 const entries=schema.entries.split(String.fromCharCode(30)).map(item=>{
  const parts=item.split(String.fromCharCode(31));
  if(parts.length!==2||!parts[0]||!parts[1])stop('incomplete table definition');
  return {name:parts[0],sql:parts[1]};
 });
 if(new Set(entries.map(item=>item.name)).size!==entries.length)
  stop('duplicate schema inventory');
 const known=new Set([...expected,'d1_migrations']);
 const appTables=[];
 for(const item of entries){
  if(Object.hasOwn(PROVIDER_DDL,item.name)){
   if(!PROVIDER_DDL[item.name].test(item.sql))
    stop('unrecognized Cloudflare provider metadata schema');
  }else appTables.push(item.name);
 }
 if(appTables.length!==expected.length+1||!appTables.includes('d1_migrations')||
    appTables.some(name=>!known.has(name)))
  stop('unexpected or missing application tables; full migration/schema review required');
 const trig=await one(db,
  "SELECT GROUP_CONCAT(name, ',') AS names FROM sqlite_master WHERE type='trigger'");
 if(!trig||typeof trig.names!=='string')stop('immutable trigger inventory unavailable');
 const triggers=trig.names.split(',').filter(Boolean);
 if(REQUIRED_TRIGGERS.some(name=>!triggers.includes(name)))
  stop('required immutable customer/job numbering trigger missing');
 // A brand-new production DB cannot contain synthetic customers, saved
 // estimates, payments, tasks, photos, notifications, previous jobs, etc.
 // Fail closed on any nonempty table. One query per known safe hard-coded name,
 // no user-controllable SQL identifiers or mutation.
 for(const table of expected){
  const row=await one(db,'SELECT COUNT(*) AS n FROM "'+table+'"');
  if(naturalCount(row?.n,table)!==0)
   stop('prelaunch DB contains records in '+table+'; do not reset or delete them');
 }
 // A merely populated journal cannot establish that the reviewed 25
 // migrations were applied to THIS D1 in their required order. Reject old,
 // skipped, extra, renamed, or duplicated migrations before first use.
 // This is a read-only app-binding check, NOT provider-attested provenance.
 const migrationJournal=await one(db,'SELECT COUNT(*) AS n FROM "d1_migrations"');
 if(naturalCount(migrationJournal?.n,'D1 migration journal')!==EXPECTED_NEW_LIVE_D1_MIGRATIONS.length)
  stop('D1 migration journal must contain exactly the reviewed 25 migrations');
 try{await assertNewLiveMigrationJournal(db);}
 catch{stop('D1 migration journal names, IDs or order disagree with reviewed source');}
 // AUTOINCREMENT can retain a high-water even after deleting all rows. That
 // would make a visibly empty NEW LIVE start at #0002 or higher. Do not use
 // DELETE FROM sqlite_sequence; the owner requires untouched inspection.
 const seq=await one(db,
  "SELECT COUNT(*) AS n FROM sqlite_sequence WHERE name IN "+
  "('fire_job_numbers','fire_customer_numbers')");
 if(naturalCount(seq?.n,'number serial history')!==0)
  stop('permanent serial history is not clean; Job #0001 cannot be claimed');
 // Source-pinned ordered journal identity was validated above. This does
 // NOT attest provider UUID, migration SQL execution or independent
 // source-to-physical-DB provenance. G5 remains separately blocked.
 return Object.freeze({
  target:'independent-live',firstJobNumberExpected:'0001',
  expectedOperationalTables:expected.length,tableRecordsAllEmpty:true,
  jobAndCustomerSequencesEmpty:true,requiredImmutabilityTriggersPresent:true,
  exactSourceMigrationJournalMatched:true,
  physicalD1IdentityVerified:false,orderedMigrationsVerified:false,
  isolatedRestoreVerified:false,ownerApprovedRelease:false,
  gate4Accepted:false,gate5Accepted:false,gate7Accepted:false,
  gate10Accepted:false,remoteWritesPerformed:false
 });
}
