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
import {NUMBERED_CORE_TABLES,NUMBERED_IDENTITY_TABLES} from './numbered-records-v2-preflight.mjs';

const stop=reason=>{throw Error('FIRE NEW LIVE clean start BLOCKED: '+reason);};
const expected=Object.freeze([...NUMBERED_CORE_TABLES,...NUMBERED_IDENTITY_TABLES,'auth_rate_limits']);
const REQUIRED_TRIGGERS=Object.freeze([
 'fire_customer_numbers_no_update','fire_customer_numbers_no_delete',
 'fire_job_numbers_no_update','fire_job_numbers_no_delete',
 'fire_job_estimate_links_no_update','fire_job_estimate_links_no_delete'
]);
const D1_READER_ONLY=Symbol('FIRE new-live read-only');
async function one(db,sql,params=[]){
 if(!db||typeof db.prepare!=='function')stop('independent physical D1 reader missing');
 const prepared=db.prepare(sql);
 if(!prepared||typeof prepared.first!=='function')stop('D1 read interface missing');
 const query=params.length?prepared.bind(...params):prepared;
 return query.first();
}
function naturalCount(value,label){
 const count=typeof value==='number'?value:Number(value);
 if(!Number.isSafeInteger(count)||count<0)stop(label+' returned an invalid count');
 return count;
}
export async function inspectNewLiveFirstJobCleanStart(db,vars){
 if(vars?.FIRE_ENV!=='new-live-prelaunch'||vars?.FIRE_JOB_NUMBERS_CANDIDATE!==JOB_NUMBER_FLAG)
  stop('target is not an explicitly numbered NEW LIVE candidate');
 // First validate app-numbering source, ownership links and immutable triggers.
 try{if(!await jobNumberingReady(db,vars))stop('permanent number controls disabled');}
 catch{stop('physical permanent Job # schema or ownership is not ready');}
 // Explicitly inspect names before SELECTing anything: missing supplemental
 // tables, new unknown feature tables, or an incomplete migration cannot be
 // passed off as a clean and recoverable production schema.
 const tables=await one(db,
  "SELECT GROUP_CONCAT(name, ',') AS names FROM sqlite_master "+
  "WHERE type='table' AND name NOT LIKE 'sqlite_%'");
 if(!tables||typeof tables.names!=='string')stop('schema table inventory unavailable');
 const found=tables.names.split(',').filter(Boolean);
 if(new Set(found).size!==found.length)stop('duplicate schema inventory');
 const known=new Set(expected);
 if(found.length!==expected.length||found.some(name=>!known.has(name)))
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
 // AUTOINCREMENT can retain a high-water even after deleting all rows. That
 // would make a visibly empty NEW LIVE start at #0002 or higher. Do not use
 // DELETE FROM sqlite_sequence; the owner requires untouched inspection.
 const seq=await one(db,
  "SELECT COUNT(*) AS n FROM sqlite_sequence WHERE name IN "+
  "('fire_job_numbers','fire_customer_numbers')");
 if(naturalCount(seq?.n,'number serial history')!==0)
  stop('permanent serial history is not clean; Job #0001 cannot be claimed');
 // No schema/data migration journal is validated by this helper; gating
 // production still requires independent ordered migration provenance.
 return Object.freeze({
  target:'independent-live',firstJobNumberExpected:'0001',
  expectedOperationalTables:expected.length,tableRecordsAllEmpty:true,
  jobAndCustomerSequencesEmpty:true,requiredImmutabilityTriggersPresent:true,
  physicalD1IdentityVerified:false,orderedMigrationsVerified:false,
  isolatedRestoreVerified:false,ownerApprovedRelease:false,
  gate4Accepted:false,gate5Accepted:false,gate7Accepted:false,
  gate10Accepted:false,remoteWritesPerformed:false
 });
}
