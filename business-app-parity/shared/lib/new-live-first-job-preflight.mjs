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
import {immutableNumberingTriggersReady} from './numbered-immutable-trigger-contract.mjs';
import {immutableDepositHistoryTriggersReady,REQUIRED_DEPOSIT_IMMUTABILITY_TRIGGER_NAMES} from './deposit-immutability-contract.mjs';
import {verifyNewLiveFinancialIndexes} from './new-live-financial-index-contract.mjs';
import {verifyNewLiveNamedIndexAndViewInventory} from './new-live-index-view-contract.mjs';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS,assertNewLiveMigrationJournal} from './new-live-migration-journal.mjs';
import {NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES} from './numbered-records-v2-preflight.mjs';

const stop=reason=>{throw Error('FIRE NEW LIVE clean start BLOCKED: '+reason);};
const expected=Object.freeze([...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES,'auth_rate_limits']);
const REQUIRED_TRIGGERS=Object.freeze([
 'fire_customer_numbers_no_update','fire_customer_numbers_no_delete',
 'fire_job_numbers_no_update','fire_job_numbers_no_delete',
 'fire_job_estimate_links_no_update','fire_job_estimate_links_no_delete',
 ...REQUIRED_DEPOSIT_IMMUTABILITY_TRIGGER_NAMES
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
 if(triggers.length!==REQUIRED_TRIGGERS.length ||
    new Set(triggers).size!==triggers.length ||
    REQUIRED_TRIGGERS.some(name=>!triggers.includes(name)))
  stop('unknown, missing or duplicated immutable numbering/deposit trigger');
 // A trigger with the correct name could still do nothing or run AFTER a
 // modification. Require exact reviewed aborting SQL on the bound D1.
 try{await immutableNumberingTriggersReady(db);}
 catch{stop('immutable customer/job trigger SQL does not match approved schema');}
 // Signed agreements and deposit-policy exceptions are evidence: a physical
 // database cannot be considered ready if their append-only barriers are
 // absent, AFTER instead of BEFORE, or replaced by named no-op triggers.
 try{await immutableDepositHistoryTriggersReady(db);}
 catch{stop('append-only deposit audit/signed agreement SQL differs from reviewed migration');}
 // A brand-new production DB cannot contain synthetic customers, saved
 // estimates, payments, tasks, photos, notifications, previous jobs, etc.
 // Fail closed on any nonempty table. One query per known safe hard-coded name,
 // no user-controllable SQL identifiers or mutation.
 for(const table of expected){
  const row=await one(db,'SELECT COUNT(*) AS n FROM "'+table+'"');
  if(naturalCount(row?.n,table)!==0)
   stop('prelaunch DB contains records in '+table+'; do not reset or delete them');
 }
 // Require exact source-reviewed D1 migration names and ordered IDs alongside
 // immutable trigger definitions, not merely a nonempty journal. This remains
 // a source-bound read, NOT provider-attested physical execution provenance.
 const migrationJournal=await one(db,'SELECT COUNT(*) AS n FROM "d1_migrations"');
 if(naturalCount(migrationJournal?.n,'D1 migration journal')!==EXPECTED_NEW_LIVE_D1_MIGRATIONS.length)
  stop('D1 migration journal must contain exactly the reviewed 26 independent migrations');
 try{await assertNewLiveMigrationJournal(db);}
 catch{stop('D1 migration journal names, IDs or order disagree with reviewed source');}
 // Physical refund/Stripe idempotency and invoice/checkout uniqueness must
 // match source-reviewed SQL, not merely the names in d1_migrations.
 // Fail closed if a D1 has the right journal but its partial indexes are
 // missing, non-unique, scoped to the wrong table or implemented as no-ops.
 try{await verifyNewLiveFinancialIndexes(db);}
 catch{stop('bound D1 financial refund/payment/index contract is incomplete or altered');}
 // Extra named indexes can add unreviewed UNIQUE constraints and reject a
 // real owner customer/estimate save despite a valid 26-row migration journal.
 // A foreign VIEW likewise is not created by any of the reviewed 26 files.
 // SQLite's automatic primary-key indexes have null SQL and are ignored.
 try{await verifyNewLiveNamedIndexAndViewInventory(db);}
 catch{stop('unreviewed SQLite index or view detected; first LIVE activation blocked');}
 // AUTOINCREMENT can retain a high-water even after deleting all rows. That
 // would make a visibly empty NEW LIVE start at #0002 or higher. Do not use
 // DELETE FROM sqlite_sequence; the owner requires untouched inspection.
 const seq=await one(db,
  "SELECT COUNT(*) AS n FROM sqlite_sequence WHERE name IN "+
  "('fire_job_numbers','fire_customer_numbers')");
 if(naturalCount(seq?.n,'number serial history')!==0)
  stop('permanent serial history is not clean; Job #0001 cannot be claimed');
 // This app-bound source journal check is not independent proof of actual
 // migration execution, D1 UUID, rollback or owner release authorization.
 return Object.freeze({
  target:'independent-live',firstJobNumberExpected:'0001',
  expectedOperationalTables:expected.length,tableRecordsAllEmpty:true,
  jobAndCustomerSequencesEmpty:true,requiredImmutabilityTriggersPresent:true,
  immutableDepositHistoryTriggersVerified:true,
  exactSourceMigrationJournalMatched:true,
  physicalFinancialIndexesMatched:true,
  reviewedNamedIndexesAndNoViewsVerified:true,
  physicalD1IdentityVerified:false,orderedMigrationsVerified:false,
  isolatedRestoreVerified:false,ownerApprovedRelease:false,
  gate4Accepted:false,gate5Accepted:false,gate7Accepted:false,
  gate10Accepted:false,remoteWritesPerformed:false
 });
}
