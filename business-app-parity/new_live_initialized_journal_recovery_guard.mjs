/**
 * FIRE independent NEW LIVE — pure, fail-closed inspection contract for a
 * previously abandoned 26-migration attempt with an initialized EMPTY journal.
 *
 * NO Cloudflare tool, SQL execution, D1 mutation, lock deletion, receipt
 * creation, deployment, Stripe, payment or R2. This only evaluates supplied
 * already read-only metadata. SUCCESS never authorizes a retry.
 *
 * Real owner readback Nov 14 observed only sqlite_sequence outside the empty
 * d1_migrations journal; the remaining journal DDL, autoindex and sequence
 * high-water have NOT YET been physically verified. Do not manufacture them.
 */
import {
 validateAttemptLock,validateLockedConfig,verifyPhysicalIdentity
} from './owner_new_live_attempt_readonly_reconcile.mjs';

const refuse=()=>{throw Error('FIRE_NEW_LIVE_POSTLOCK_RECOVERY_GUARD_REFUSED');};
const compact=s=>typeof s==='string'
 ? s.replace(/["\x60\[\]]/g,'').trim().replace(/\s+/g,' ')
 : null;
const migrationDdl=/^CREATE TABLE d1_migrations\s*\(\s*id INTEGER PRIMARY KEY AUTOINCREMENT\s*,\s*name TEXT UNIQUE\s*,\s*applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL\s*\)\s*;?$/i;
const internalDdl=/^CREATE TABLE sqlite_sequence\s*\(\s*name\s*,\s*seq\s*\)\s*;?$/i;
const providerDdl=Object.freeze({
 _cf_KV:/^CREATE TABLE _cf_KV\s*\(\s*key TEXT PRIMARY KEY\s*,\s*value BLOB\s*\)\s*WITHOUT ROWID\s*;?$/i,
 _cf_METADATA:/^CREATE TABLE _cf_METADATA\s*\(\s*key INTEGER PRIMARY KEY\s*,\s*value BLOB\s*\)\s*;?$/i
});

export function assessNewLiveInitializedJournalRecoveryEvidence(input){
 if(!input||typeof input!=='object'||Array.isArray(input))refuse();
 try {
  validateAttemptLock(input.originalAttemptLock);
  validateLockedConfig(input.dedicatedD1Config);
  verifyPhysicalIdentity(input.liveD1Info);
 }catch{refuse();}
 if(input.completionReceiptPresent!==false||input.sourceReviewSqlCount!==26||
    input.originalLockPreserved!==true||
    input.ownerApprovedNewWrite!==false)refuse();
 const objects=input.sqliteMasterRows;
 const journal=input.journalRows;
 const sequence=input.sequenceRows;
 if(!Array.isArray(objects)||objects.length<3||objects.length>12||
    !Array.isArray(journal)||journal.length!==0||
    !Array.isArray(sequence)||sequence.length!==0)refuse();
 const seen=new Set();
 let journalFound=false,internalFound=false,autoIndexFound=false;
 for(const o of objects){
  if(!o||typeof o.name!=='string'||typeof o.type!=='string'||
     seen.has(o.name))refuse();
  seen.add(o.name);
  const ddl=compact(o.sql);
  if(o.name==='d1_migrations'){
   if(o.type!=='table'||!migrationDdl.test(ddl??''))refuse();
   journalFound=true;
  }else if(o.name==='sqlite_sequence'){
   if(o.type!=='table'||!internalDdl.test(ddl??''))refuse();
   internalFound=true;
  }else if(o.name==='sqlite_autoindex_d1_migrations_1'){
   if(o.type!=='index'||o.sql!==null)refuse();
   autoIndexFound=true;
  }else if(Object.hasOwn(providerDdl,o.name)){
   if(o.type!=='table'||!providerDdl[o.name].test(ddl??''))refuse();
  }else refuse(); // No unknown indexes, views, triggers or app schema.
 }
 if(!journalFound||!internalFound||!autoIndexFound)refuse();
 return Object.freeze({
  result:'INITIALIZED_JOURNAL_EMPTY_SOURCE_MIGRATIONS_NOT_VERIFIED',
  target:'independent-live',
  exactPhysicalD1IdentityMatched:true,
  observedAppliedMigrationRows:0,
  observedSqliteSequenceRows:0,
  observedApplicationSchemaObjects:0,
  journalDdlAndUniqueIndexMatched:true,
  originalLockPreserved:true,
  originalRemoteCommandResultAttested:false,
  newWriteAuthorized:false,
  anyMigrationAppliedByThisAssessment:false,
  secondMigrationExecutionPermitted:false,
  gate5Accepted:false,
  productionReady:false
 });
}
