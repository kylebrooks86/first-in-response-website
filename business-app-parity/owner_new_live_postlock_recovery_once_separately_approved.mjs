/**
 * FIRE NEW LIVE: separate post-lock schema recovery, NEW ONE-SHOT ONLY.
 *
 * SOURCE-CODE CANDIDATE, NEVER EXECUTED IN CI/CHAT. Its CLI --execute mode
 * must NOT be invoked without NEW explicit owner approval of this exact NEW
 * one-time remote write. The prior initial migration approval is consumed.
 *
 * CRITICAL: Preserve the preexisting original attempt lock forever; NEVER
 * rename/delete it, overwrite its receipt, or infer original command success.
 * Only target: fire-fullapp-new-live-db, not DR, QA, STAGING or legacy.
 * Zero paid Cloudflare/R2/Stripe/Worker operations, no automatic retry.
 */
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {
 closeSync,existsSync,fsyncSync,lstatSync,openSync,readFileSync,writeFileSync,writeSync
} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifySavedIndependentD1MigrationWorkspace}
 from './verify_saved_independent_d1_migration_workspace.mjs';
import {REVIEWED_RELEASE_D1_TARGETS}
 from './prepare_independent_d1_migration_workspace.mjs';
import {
 bindReadOnlyNewLiveSelect,newLiveResultRows,pinnedNewLiveAccountEnvironment,
 requireLocalOwnerInteractiveNewLiveSession
} from './owner_new_live_initial_schema_one_shot.mjs';
import {
 validateAttemptLock,validateLockedConfig,verifyPhysicalIdentity
} from './owner_new_live_attempt_readonly_reconcile.mjs';
import {assessNewLiveInitializedJournalRecoveryEvidence}
 from './new_live_initialized_journal_recovery_guard.mjs';
import {inspectNewLiveFirstJobCleanStart}
 from './shared/lib/new-live-first-job-preflight.mjs';

const ROOT=resolve(fileURLToPath(new URL('.',import.meta.url)));
const OUT=join(homedir(),'FIRE-NEW-LIVE-ONE-SHOT-SCHEMA-20261114');
const WORK=join(OUT,'source-reviewed-26-migrations');
const CONFIG=join(WORK,'wrangler.json');
const OLD_LOCK=join(OUT,'new-live-remote-attempt-lock.json');
const OLD_RECEIPT=join(OUT,'new-live-physical-schema-receipt.json');
const NEW_LOCK=join(OUT,'new-live-postlock-recovery-attempt-lock.json');
const NEW_RECEIPT=join(OUT,'new-live-postlock-recovery-physical-receipt.json');
const LIVE=REVIEWED_RELEASE_D1_TARGETS['independent-live'];
const DB=LIVE.database_name;
const START_FLAG='--execute-separately-approved-new-live-postlock-recovery-20261114';
const OWNER_PHRASE='FIRE NEW LIVE POSTLOCK RECOVERY APPLY 26 '+LIVE.database_id;
const fail=()=>{throw Error('FIRE_NEW_LIVE_POSTLOCK_RECOVERY_STOP: preserve BOTH attempt locks; NEVER retry');};
const SQL=Object.freeze({
 catalog:"SELECT type,name,sql FROM sqlite_master WHERE type IN ('table','view','index','trigger') ORDER BY type,name",
 journal:'SELECT id,name FROM "d1_migrations" ORDER BY id',
 highwater:'SELECT name,seq FROM sqlite_sequence ORDER BY name'
});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export function requireNewPostlockConsent(flag,io,env){
 if(flag!==START_FLAG)fail();
 try{requireLocalOwnerInteractiveNewLiveSession(env,io);}
 catch{fail();}
 return true;
}
export function validateRecoveryPreservation({oldLock,oldReceipt,newLock,newReceipt}){
 // Do not accept a prior recovery attempt even if the new receipt is absent:
 // an ACK could have been lost after a write. No automatic retries, ever.
 if(!oldLock||oldReceipt===true||newLock===true||newReceipt===true)fail();
 try{validateAttemptLock(oldLock);}catch{fail();}
 return true;
}
export function validateRecoveryLocalSqlPackage(review){
 if(!review||review.savedWorkspaceVerified!==true||
    review.target!=='independent-live'||
    review.reviewedSqlFiles!==26||
    review.database_id!==LIVE.database_id||
    review.remoteMigrationAttempted!==false)fail();
 return true;
}
export function createDistinctRecoveryOneShotLock(path,preservedLockHash,preflight){
 if(typeof path!=='string'||!path.trim()||
    typeof preservedLockHash!=='string'||!/^[a-f0-9]{64}$/.test(preservedLockHash)||
    preflight?.result!=='INITIALIZED_JOURNAL_EMPTY_SOURCE_MIGRATIONS_NOT_VERIFIED'||
    preflight.observedAppliedMigrationRows!==0||
    preflight.observedSqliteSequenceRows!==0||
    preflight.observedApplicationSchemaObjects!==0||
    preflight.secondMigrationExecutionPermitted!==false||
    preflight.exactPhysicalD1IdentityMatched!==true)fail();
 const record={
  operation:'NEW_POSTLOCK_26_SQL_RESCUE_ONE_SHOT',
  oldAttemptLockSha256:preservedLockHash,
  oldAttemptLockPreserved:true,
  priorCommandResultAttested:false,
  state:'NEW_REMOTE_COMMAND_RESULT_UNCONFIRMED_NO_RETRY',
  target:'independent-live',database_name:DB,database_id:LIVE.database_id,
  sourceMigrationCount:26,observedPrewriteAppliedRows:0,
  ownerSeparateAuthorizationRequired:true,
  beforeNewRemoteCommand:new Date().toISOString(),
  newRemoteWriteResultAttested:false,gate5Accepted:false,
  productionReady:false
 };
 const bytes=Buffer.from(JSON.stringify(record,null,2)+'\n','utf8');
 // Durable, exclusive and NEVER deleted. Existing new lock blocks all retries.
 let fd;
 try{
  fd=openSync(path,'wx',0o600);
  let pos=0;
  while(pos<bytes.length){
   const n=writeSync(fd,bytes,pos,bytes.length-pos,pos);
   if(!Number.isInteger(n)||n<=0)fail();
   pos+=n;
  }
  fsyncSync(fd);
 }catch{fail();}
 finally{if(fd!==undefined)closeSync(fd);}
 return Object.freeze({recoveryLockCreatedBeforeRemoteCommand:true,
  recoveryWriteAttemptedByThisFunction:false,
  oldAttemptLockPreserved:true,remoteRetryAllowed:false});
}
/**
 * Final offline-only receipt gate. A successful migration journal is not enough:
 * the AFTER-write D1 identity must still match the original physical NEW LIVE
 * UUID, and neither permanent attempt lock may have been replaced or changed.
 * No remote call, receipt, or file mutation occurs in this validator.
 */
export function verifyPostlockReceiptEvidence({
 originalLockBefore,originalLockAfter,recoveryLockBefore,recoveryLockAfter,
 recoveryLockRecord,physicalInfo,originalReceiptPresent,recoveryReceiptPresent
}){
 const validBytes=value=>Buffer.isBuffer(value)&&value.length>=2&&value.length<=20000;
 if(!validBytes(originalLockBefore)||!validBytes(originalLockAfter)||
    !validBytes(recoveryLockBefore)||!validBytes(recoveryLockAfter)||
    !originalLockBefore.equals(originalLockAfter)||
    !recoveryLockBefore.equals(recoveryLockAfter)||
    originalReceiptPresent!==false||recoveryReceiptPresent!==false)fail();
 const lock=recoveryLockRecord;
 if(!lock||typeof lock!=='object'||Array.isArray(lock)||
    lock.operation!=='NEW_POSTLOCK_26_SQL_RESCUE_ONE_SHOT'||
    lock.target!=='independent-live'||lock.database_name!==DB||
    lock.database_id!==LIVE.database_id||lock.sourceMigrationCount!==26||
    lock.oldAttemptLockSha256!==hash(originalLockBefore)||
    lock.oldAttemptLockPreserved!==true||
    lock.state!=='NEW_REMOTE_COMMAND_RESULT_UNCONFIRMED_NO_RETRY'||
    lock.priorCommandResultAttested!==false||
    lock.newRemoteWriteResultAttested!==false||
    lock.gate5Accepted!==false||lock.productionReady!==false)fail();
 try{verifyPhysicalIdentity(physicalInfo);}catch{fail();}
 return Object.freeze({
  postWriteLivePhysicalIdentityRetested:true,
  originalAndRecoveryLocksByteForBytePreserved:true,
  initialRemoteCommandResultStillUnattested:true,
  gate5Accepted:false,productionReady:false
 });
}
function existingLocalJson(path){
 if(!existsSync(path))fail();
 const stat=lstatSync(path);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>20000)fail();
 try{return JSON.parse(readFileSync(path,'utf8'));}
 catch{fail();}
}
function wrangler(js,args,{write=false,postRead=false}={}){
 if(write&&postRead)fail();
 const readonly=[['--version'],['d1','info',DB,'--json','--config',CONFIG],
   ...Object.values(SQL).map(sql=>
    ['d1','execute',DB,'--remote','--json','--config',CONFIG,'--command',sql])];
 const check=arr=>arr.join('\u001f')===args.join('\u001f');
 const preRead=readonly.some(check);
 const validPostRead=postRead&&args.length===9&&
  args.slice(0,8).join('\u001f')===
    ['d1','execute',DB,'--remote','--json','--config',CONFIG,'--command'].join('\u001f')&&
  typeof args[8]==='string'&&
  bindReadOnlyNewLiveSelect(args[8])===args[8];
 const writeOnly=write&&check(['d1','migrations','apply',DB,'--remote','--config',CONFIG]);
 if(!(writeOnly||!write&&(preRead||validPostRead)))fail();
 const result=spawnSync(process.execPath,[js,...args],{
  cwd:WORK,env:pinnedNewLiveAccountEnvironment(process.env),
  stdio:write?['inherit','inherit','inherit']:'pipe',
  encoding:write?undefined:'utf8',
  timeout:write?600000:90000,maxBuffer:2*1024*1024,windowsHide:!write
 });
 if(result.error||result.signal||result.status!==0)fail();
 return write?true:result.stdout;
}
function parseProviderInfo(raw){
 try{const obj=JSON.parse(raw);verifyPhysicalIdentity(obj);return obj;}
 catch{fail();}
}
function parseRows(raw){
 try{return newLiveResultRows(JSON.parse(raw));}
 catch{fail();}
}
async function demandSeparateOwnerConfirmation(){
 const rl=createInterface({input:process.stdin,output:process.stdout});
 try{
  const prompt=[
   'SEPARATE NEW AUTHORIZATION REQUIRED: prior one-shot was consumed.',
   'This is a NEW remote 26-SQL write to ONLY '+DB,
   'Physical D1 '+LIVE.database_id+'; original lock stays FOREVER.',
   'NO Worker, Stripe, R2, paid service, DR/QA/STAGING or LIVE activation.',
   'DO NOT proceed without EXPLICIT separate owner consent for this action.',
   'Type EXACTLY: '+OWNER_PHRASE,
   '> '
  ].join('\n');
  if((await rl.question(prompt))!==OWNER_PHRASE)fail();
 }finally{rl.close();}
}
// The separately authorized owner recovery fully APPLIED 26/26 NEW LIVE
// migrations on Nov 14, 2026 (real Cloudflare receipt #6889484598).
// Both attempt locks and the successful receipt were encrypted and saved
// off-Acer (Issue #19 #6891448726). Do not allow this consumed remote
// recovery entrypoint to run from a fresh machine with missing local locks.
async function runPostlockOneShot(jsPath,flag){
 fail(); // permanently retired: already applied; even exact old flag is spent
 requireNewPostlockConsent(flag,{
  stdinTTY:process.stdin?.isTTY===true,stdoutTTY:process.stdout?.isTTY===true
 },process.env);
 // Require interactive explicit owner confirmation before ANY Cloudflare calls.
 await demandSeparateOwnerConfirmation();
 if(typeof jsPath!=='string'||!jsPath.trim())fail();
 const js=resolve(jsPath);
 if(!existsSync(js)||!lstatSync(js).isFile()||lstatSync(js).isSymbolicLink())fail();
 // Reject symlink/malformed preserved original lock BEFORE reading raw bytes.
 const oldLock=existingLocalJson(OLD_LOCK);
 const oldBytes=readFileSync(OLD_LOCK);
 validateRecoveryPreservation({
  oldLock,oldReceipt:existsSync(OLD_RECEIPT),
  newLock:existsSync(NEW_LOCK),newReceipt:existsSync(NEW_RECEIPT)
 });
 validateLockedConfig(existingLocalJson(CONFIG));
 const verified=verifySavedIndependentD1MigrationWorkspace('independent-live',WORK);
 validateRecoveryLocalSqlPackage(verified);
 const version=wrangler(js,['--version']);
 if(!/\b4\.92\.0\b/.test(version??''))fail();
 const info=parseProviderInfo(wrangler(js,['d1','info',DB,'--json','--config',CONFIG]));
 const read=sql=>parseRows(wrangler(js,
  ['d1','execute',DB,'--remote','--json','--config',CONFIG,'--command',sql]));
 // The physical read-only owner checkpoint is accepted and is NOT repeated
 // for forensic reasons. These are NEW final immediately pre-write checks,
 // necessary because remote data could have changed after that checkpoint.
 const report=assessNewLiveInitializedJournalRecoveryEvidence({
  originalAttemptLock:oldLock,dedicatedD1Config:existingLocalJson(CONFIG),
  liveD1Info:info,sqliteMasterRows:read(SQL.catalog),
  journalRows:read(SQL.journal),sequenceRows:read(SQL.highwater),
  originalLockPreserved:true,completionReceiptPresent:false,
  ownerApprovedNewWrite:false,sourceReviewSqlCount:verified.reviewedSqlFiles
 });
 // Recheck original locks right before any new exclusive lock creation.
 if(existsSync(OLD_RECEIPT)||existsSync(NEW_LOCK)||existsSync(NEW_RECEIPT)||
    hash(readFileSync(OLD_LOCK))!==hash(oldBytes))fail();
 createDistinctRecoveryOneShotLock(NEW_LOCK,hash(oldBytes),report);
 // Capture exact new lock bytes BEFORE any remote mutation. An altered lock
 // cannot back a success receipt, even if the schema/journal later match.
 existingLocalJson(NEW_LOCK);
 const newLockBytes=readFileSync(NEW_LOCK);
 // The newly created recovery lock MUST remain even if Wrangler times out,
 // fails, prompts cancel, or says success before post-write verification.
 wrangler(js,['d1','migrations','apply',DB,'--remote','--config',CONFIG],{write:true});
 // Readback ONLY. A failed response means STOP, never retry automatically.
 let readCount=0;
 const db={prepare(sql){
  const bound=(args=[])=>({
   bind:(...next)=>bound(next),
   first:async()=>((await select(sql,args))[0]??null),
   all:async()=>({results:await select(sql,args)})
  });
  return bound();
 }};
 const select=async(sql,args=[])=>{
  readCount++;
  const safe=bindReadOnlyNewLiveSelect(sql,args);
  return parseRows(wrangler(js,
   ['d1','execute',DB,'--remote','--json','--config',CONFIG,'--command',safe],{postRead:true}));
 };
 // For all source-reviewed migrations, deposits, refund/idempotency financial
 // indexes, immutable numbers and zero rows / first future Job #0001.
 const final=await inspectNewLiveFirstJobCleanStart(db,{
  FIRE_ENV:'new-live-prelaunch',
  FIRE_JOB_NUMBERS_CANDIDATE:'owner-approved-schema-v1',
  FIRE_CUSTOMER_NUMBERS_CANDIDATE:'owner-approved-schema-v1'
 });
 if(!final||final.exactSourceMigrationJournalMatched!==true||
    final.physicalFinancialIndexesMatched!==true||
    final.reviewedNamedIndexesAndNoViewsVerified!==true||
    final.tableRecordsAllEmpty!==true||
    final.jobAndCustomerSequencesEmpty!==true||
    final.firstJobNumberExpected!=='0001')fail();
 // Re-attest the exact physical NEW LIVE UUID AFTER successful remote SQL
 // validation, before issuing any positive receipt. Also reject changed locks.
 const postWriteInfo=parseProviderInfo(wrangler(js,['d1','info',DB,'--json','--config',CONFIG]));
 const finalCustody=verifyPostlockReceiptEvidence({
  originalLockBefore:oldBytes,originalLockAfter:readFileSync(OLD_LOCK),
  recoveryLockBefore:newLockBytes,recoveryLockAfter:readFileSync(NEW_LOCK),
  recoveryLockRecord:existingLocalJson(NEW_LOCK),physicalInfo:postWriteInfo,
  originalReceiptPresent:existsSync(OLD_RECEIPT),
  recoveryReceiptPresent:existsSync(NEW_RECEIPT)
 });
 const receipt={
  operation:'NEW_POSTLOCK_26_SQL_RESCUE_ONE_SHOT',
  originalFailedOrUnknownAttemptAcknowledged:false,
  originalAttemptLockSha256:hash(oldBytes),
  originalLockPreserved:true,
  separateNewRemoteMigrationCommandReturnedSuccess:true,
  databaseName:DB,physicalDatabaseId:LIVE.database_id,
  appliedMigrationRowsVerified:26,
  exactSourceSchemaAndFinancialIndexesVerified:true,
  firstFutureJobExpected:'0001',firstFutureCustomerExpected:'0001',
  operationalCustomerJobRecordsAbsent:true,
  readOnlyValidationStatements:readCount,
  ownerAuthActivated:false,workerCreatedOrDeployed:false,
  noStripePaymentChanges:true,noR2OrPaidCloudflare:true,
  recoveryLockPreserved:true,
  postWriteLivePhysicalIdentityRetested:finalCustody.postWriteLivePhysicalIdentityRetested,
  bothOriginalAndRecoveryLocksUnchanged:finalCustody.originalAndRecoveryLocksByteForBytePreserved,
  gate4Accepted:false,gate5Accepted:false,gate7Accepted:false,
  productionReady:false,liveActivationAuthorized:false,
  checkedAt:new Date().toISOString()
 };
 // Distinct successful recovery receipt. Never create/overwrite the
 // ORIGINAL initial-installer receipt or claim prior command success.
 writeFileSync(NEW_RECEIPT,JSON.stringify(receipt,null,2)+'\n',
  {flag:'wx',mode:0o600});
 console.log('FIRE_NEW_LIVE_SEPARATELY_AUTHORIZED_POSTLOCK_SCHEMA_MATCH_26_OF_26_NO_DEPLOY');
 return Object.freeze(receipt);
}
const main=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 try{
  if(process.argv.length===2){
   console.log('FIRE_NEW_LIVE_POSTLOCK_RECOVERY_SOURCE_DRY_RUN_NO_CLOUDFLARE');
  }else if(process.argv.length===4){
   await runPostlockOneShot(process.argv[2],process.argv[3]);
  }else fail();
 }catch{
  console.error('FIRE_NEW_LIVE_POSTLOCK_RECOVERY_STOP: no retry; preserve original + recovery locks/receipts');
  process.exitCode=1;
 }
}
