/**
 * FIRE NEW LIVE post-lock one-shot *SOURCE-ONLY* checks.
 * No Wrangler, Cloudflare, D1, Worker, paid R2 or Stripe calls, ever in CI.
 */
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,existsSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {
 requireNewPostlockConsent,validateRecoveryPreservation,
 validateRecoveryLocalSqlPackage,createDistinctRecoveryOneShotLock
} from './owner_new_live_postlock_recovery_once_separately_approved.mjs';
const live='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662';
const orig={
 target:'independent-live',database_name:'fire-fullapp-new-live-db',
 database_id:live,state:'REMOTE_COMMAND_RESULT_UNCONFIRMED_NO_AUTOMATIC_RETRY',
 sourceMigrationCount:26,physicalIdentityConfirmed:true,
 initialApplicationTables:0,createdAt:'2026-11-14T23:30:00.000Z'
};
const complete={oldLock:orig,oldReceipt:false,newLock:false,newReceipt:false};
const reviewed={
 savedWorkspaceVerified:true,target:'independent-live',reviewedSqlFiles:26,
 database_id:live,remoteMigrationAttempted:false
};
const proof={
 result:'INITIALIZED_JOURNAL_EMPTY_SOURCE_MIGRATIONS_NOT_VERIFIED',
 observedAppliedMigrationRows:0,observedSqliteSequenceRows:0,
 observedApplicationSchemaObjects:0,secondMigrationExecutionPermitted:false,
 exactPhysicalD1IdentityMatched:true
};
const flag='--execute-separately-approved-new-live-postlock-recovery-20261114';
let n=0;
const ok=(v,why)=>{assert.ok(v,why);n++};
const block=(cb,why)=>{assert.throws(cb,/FIRE_NEW_LIVE_POSTLOCK_RECOVERY_STOP/,why);n++};
ok(requireNewPostlockConsent(flag,{stdinTTY:true,stdoutTTY:true},{})===true,
 'exact NEW flag + synthetic owner TTY satisfies PURE precondition, never does remote write');
for(const bad of [undefined,'continue','approve','--exact-new-live-26-migrations-separately-authorized',
 '--execute-approved-dr-only',flag.toUpperCase(),flag+' '])
 block(()=>requireNewPostlockConsent(bad,{stdinTTY:true,stdoutTTY:true},{}),
  'old approval, missing, wrong target, extra characters or generic continue blocked');
for(const io of [{stdinTTY:false,stdoutTTY:true},{stdinTTY:true,stdoutTTY:false},{}])
 block(()=>requireNewPostlockConsent(flag,io,{}),'non-owner noninteractive machine blocked');
for(const env of [{CI:'true'},{GITHUB_ACTIONS:'true'},{TF_BUILD:'1'}])
 block(()=>requireNewPostlockConsent(flag,{stdinTTY:true,stdoutTTY:true},env),
  'CI/automations cannot execute NEW LIVE postlock recovery');
ok(validateRecoveryPreservation(complete),'old lock must be preserved with no prior new recovery lock');
for(const patch of [
 {oldLock:null},{oldReceipt:true},{newLock:true},{newReceipt:true},
 {oldLock:{...orig,target:'independent-dr'}},
 {oldLock:{...orig,state:'COMPLETE'}},
 {oldLock:{...orig,database_id:'5e55c5b7-cd67-4c8f-a52e-40f71b5d3145'}}
])block(()=>validateRecoveryPreservation({...complete,...patch}),
 'missing/altered old lock or existing original/new receipt/attempt blocks remote');
ok(validateRecoveryLocalSqlPackage(reviewed),'only reviewed physical NEW LIVE 26 SQL package allowed');
for(const patch of [
 {savedWorkspaceVerified:false},{target:'independent-dr'},{target:undefined},
 {reviewedSqlFiles:25},{database_id:'wrong'},
 {remoteMigrationAttempted:true}
])block(()=>validateRecoveryLocalSqlPackage({...reviewed,...patch}),
 'bad source, non-live, fewer SQL files or prior source operation blocked');
const folder=mkdtempSync(join(tmpdir(),'fire-live-postlock-recovery-src-'));
try{
 const attempt=join(folder,'new-postlock-attempt.json');
 const original='a'.repeat(64);
 for(const bad of [
  {...proof,result:'COMPLETE'}, {...proof,observedAppliedMigrationRows:1},
  {...proof,observedSqliteSequenceRows:3},{...proof,observedApplicationSchemaObjects:1},
  {...proof,secondMigrationExecutionPermitted:true},
  {...proof,exactPhysicalD1IdentityMatched:false}
 ])block(()=>createDistinctRecoveryOneShotLock(join(folder,'should-not-exist-'+n+'.json'),original,bad),
   'unexpected prewrite state must never create a recovery attempt lock');
 const status=createDistinctRecoveryOneShotLock(attempt,original,proof);
 ok(status.recoveryLockCreatedBeforeRemoteCommand===true&&
    status.recoveryWriteAttemptedByThisFunction===false&&
    status.remoteRetryAllowed===false,
    'durably created NEW isolated lock is NOT a remote command');
 const bytes=readFileSync(attempt);
 const state=JSON.parse(bytes.toString());
 ok(state.oldAttemptLockSha256===original&&
    state.priorCommandResultAttested===false&&
    state.newRemoteWriteResultAttested===false&&
    state.sourceMigrationCount===26,
    'original provenance saved without manufacturing old completion receipt');
 ok(existsSync(attempt),'durable new lock exists');
 if(process.platform!=='win32')ok((statSync(attempt).mode&0o777)===0o600,
   'one-shot recovery lock permissions owner-only');
 block(()=>createDistinctRecoveryOneShotLock(attempt,original,proof),
   'lost remote ACK or prior local attempt forbids SECOND run');
 ok(bytes.equals(readFileSync(attempt)),'old created recovery lock never overwritten');
 block(()=>createDistinctRecoveryOneShotLock(join(folder,'bad-hash.json'),'invalid',proof),
   'unknown old lock provenance must fail');
}finally{rmSync(folder,{recursive:true,force:true});}
const code=readFileSync(fileURLToPath(new URL('./owner_new_live_postlock_recovery_once_separately_approved.mjs',import.meta.url)),'utf8');
for(const required of [
 'FIRE_NEW_LIVE_POSTLOCK_RECOVERY_SOURCE_DRY_RUN_NO_CLOUDFLARE',
 'OWNER_PHRASE',
 'createDistinctRecoveryOneShotLock(NEW_LOCK',
 'validateRecoveryPreservation(',
 'assessNewLiveInitializedJournalRecoveryEvidence(',
 'inspectNewLiveFirstJobCleanStart(',
 "writeFileSync(NEW_RECEIPT,",
 'gate5Accepted:false',
 'pinnedNewLiveAccountEnvironment(',
 'verifySavedIndependentD1MigrationWorkspace(',
 'oldAttemptLockSha256'
])ok(code.includes(required),'reviewed guard/receipt/source marker present '+required);
ok(!code.includes('unlinkSync(')&&!code.includes('renameSync(')&&
   !code.includes('rmSync(')&&!code.includes('rmdirSync('),
   'no deletion or rename of ANY original or recovery lock');
ok(code.indexOf('createDistinctRecoveryOneShotLock(NEW_LOCK')<
   code.indexOf("wrangler(js,['d1','migrations','apply'"),
   'durably create independent owner lock BEFORE any possible Cloudflare migration');
ok(code.indexOf('inspectNewLiveFirstJobCleanStart(')<
   code.indexOf('writeFileSync(NEW_RECEIPT,'),
   'new SUCCESS receipt only after full source pinned postwrite readback');
console.log('PASS '+n+'/'+n+' NEW LIVE distinct post-lock one-shot SOURCE offline guards. NO PROVIDER/WRITE.');
