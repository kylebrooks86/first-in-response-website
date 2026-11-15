/** Source-only NEW LIVE migration guard tests. NEVER spawn Wrangler or touch Cloudflare. */
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,statSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
 requireNewLiveApprovalSentinel,requireLocalOwnerInteractiveNewLiveSession,
 requireTypedNewLiveMigrationConfirmation,pinnedNewLiveAccountEnvironment,
 requireIndependentNewLiveInfo,requireEmptyPhysicalNewLive,
 newLiveResultRows,bindReadOnlyNewLiveSelect,
 createOneShotNewLiveAttemptLock,safeNewLiveCommandError,newLiveWranglerStdio,
 newLiveMigrationWorkerOperationScope,
 applyNewLiveInitialSchemaAfterSeparateApproval
} from './owner_new_live_initial_schema_one_shot.mjs';

const live='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662';
const dr='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';
const correctLive={name:'fire-fullapp-new-live-db',uuid:live};
const correctDr={name:'fire-fullapp-dr-db',uuid:dr};
let count=0;
const ok=(v,why)=>{assert.ok(v,why);count++;};
const block=(fn,why)=>{assert.throws(fn,/FIRE NEW LIVE remote migration BLOCKED:/,why);count++;};
const blockAsync=async(fn,why)=>{await assert.rejects(fn,/FIRE NEW LIVE remote migration BLOCKED:/,why);count++;};
const tmp=mkdtempSync(join(tmpdir(),'fire-new-live-approval-guard-'));
try{
 block(()=>requireNewLiveApprovalSentinel(undefined),'a generic continue is not remote consent');
 block(()=>requireNewLiveApprovalSentinel('--execute-approved-dr-only'),'DR consent cannot authorize LIVE');
 block(()=>requireNewLiveApprovalSentinel('--execute-approved-live-only'),'near-match flag fails');
 ok(requireNewLiveApprovalSentinel('--exact-new-live-26-migrations-separately-authorized'),
  'only exact future owner-authorized operation flag recognized');
 await blockAsync(()=>applyNewLiveInitialSchemaAfterSeparateApproval('/fake/path',undefined),
  'public exported executor without explicit owner scope never opens Wrangler');
 const ownerTTY={stdinTTY:true,stdoutTTY:true};
 ok(requireLocalOwnerInteractiveNewLiveSession({},ownerTTY),
  'only an actual interactive terminal with no CI flags is eligible for owner approval');
 for(const raw of [
  {CI:'true'},{CI:'1'},{GITHUB_ACTIONS:'true'},
  {GITLAB_CI:'true'},{TF_BUILD:'1'},{BUILDKITE:'true'},
  {CIRCLECI:'true'},{JENKINS_URL:'https://jenkins.local'},
  {TEAMCITY_VERSION:'2026'}
 ])block(()=>requireLocalOwnerInteractiveNewLiveSession(raw,ownerTTY),
  'CI, Work automations and non-owner hosted execution cannot reach Cloudflare');
 for(const io of [
  {stdinTTY:false,stdoutTTY:true},{stdinTTY:true,stdoutTTY:false},
  {stdinTTY:false,stdoutTTY:false},{},null
 ])block(()=>requireLocalOwnerInteractiveNewLiveSession({},io),
  'piped or missing interactive owner terminal refuses migration');
 const typed='FIRE NEW LIVE APPLY 26 '+live;
 ok(requireTypedNewLiveMigrationConfirmation(typed),
  'exact NEW LIVE database UUID and exact 26 migration phrase accepted only as additional owner safeguard');
 for(const wrong of [
  typed+' ',typed.toLowerCase(),typed.replace('26','25'),
  typed.replace(live,dr),typed.replace('LIVE','DR'),undefined,'yes',''
 ])block(()=>requireTypedNewLiveMigrationConfirmation(wrong),
  'wrong database/number/target/blank/case/padded one-shot approval rejected');
 await blockAsync(()=>applyNewLiveInitialSchemaAfterSeparateApproval('/fake/path',
  '--exact-new-live-26-migrations-separately-authorized'),
  'public exported executor cannot reach Wrangler from a headless CI test even with the correct flag');
 ok(JSON.stringify(newLiveWranglerStdio(true))===
    JSON.stringify(['inherit','inherit','inherit']),
  'owner-authorized Wrangler migration gets a real terminal to confirm provider 26-SQL apply');
 ok(newLiveWranglerStdio(false)==='pipe',
  'read-only Wrangler JSON probes remain captured, not printed to terminal');
 block(()=>newLiveWranglerStdio('true'),
  'unexpected write mode cannot silently request an interactive migration');
 const pinned=pinnedNewLiveAccountEnvironment({SAFE:'yes'});
 ok(pinned.CLOUDFLARE_ACCOUNT_ID==='bfc00939cfb2f8dfd8581a7a7f5f1307'&&
    pinned.SAFE==='yes'&&pinned.WRANGLER_SEND_METRICS==='false'&&
    pinned.CLOUDFLARE_CF_FETCH_ENABLED===undefined,
  'only already physically established FIRE account selected, no new login');
 for(const env of [
  {CLOUDFLARE_ACCOUNT_ID:'wrong'},{CF_ACCOUNT_ID:'wrong'},
  {CLOUDFLARE_ACCOUNT_ID:'bfc00939cfb2f8dfd8581a7a7f5f1307',CF_ACCOUNT_ID:'wrong'}
 ])block(()=>pinnedNewLiveAccountEnvironment(env),'wrong account stops before any provider contact');
 ok(requireIndependentNewLiveInfo(correctLive,correctDr).target==='independent-live',
  'separate existing physical NEW LIVE and DR identities match reviewed UUIDs');
 for(const [a,b] of [
  [{name:'fire-fullapp-dr-db',uuid:dr},correctDr],
  [correctLive,{name:'fire-fullapp-dr-db',uuid:live}],
  [{...correctLive,uuid:dr},correctDr],
  [{...correctLive,uuid:'8ccfb1f8-1657-4074-b1b2-47de78f95003'},correctDr],
  [{...correctLive,uuid:'afb2c05a-d794-4a9a-b580-924ce01c26ad'},correctDr],
  [{...correctLive,uuid:'dba421ba-fc66-4cf8-9c31-51616f8249ba'},correctDr],
  [null,correctDr],[correctLive,[]]
 ])block(()=>requireIndependentNewLiveInfo(a,b),'missing/colliding/QA/STAGING/TEST/DR D1 stops');
 ok(requireEmptyPhysicalNewLive([]).initialNewLiveApplicationTables===0,
  'newly created empty physical D1 may pass only an empty source inventory');
 const providerRows=[
  {name:'_cf_KV',type:'table',sql:'CREATE TABLE _cf_KV (key TEXT PRIMARY KEY, value BLOB) WITHOUT ROWID'},
  {name:'_cf_METADATA',type:'table',sql:'CREATE TABLE _cf_METADATA (key INTEGER PRIMARY KEY, value BLOB)'}
 ];
 ok(requireEmptyPhysicalNewLive(providerRows).providerMetadataObjects===2,
  'only exact Cloudflare-owned metadata allowed');
 for(const row of [
  {name:'customers',type:'table',sql:'CREATE TABLE customers(id TEXT)'},
  {name:'fire_job_numbers',type:'table',sql:'CREATE TABLE fire_job_numbers(id TEXT)'},
  {name:'d1_migrations',type:'table',sql:'CREATE TABLE d1_migrations(id INTEGER)'},
  {name:'sqlite_sequence',type:'table',sql:'CREATE TABLE sqlite_sequence(name,seq)'},
  {name:'sqliteX_backup',type:'table',sql:'CREATE TABLE sqliteX_backup(payload TEXT)'},
  {name:'extra_index',type:'index',sql:'CREATE INDEX extra_index ON customers(id)'},
  {name:'trigger',type:'trigger',sql:'CREATE TRIGGER trigger AFTER INSERT ON foo BEGIN SELECT 1; END'},
  {name:'view',type:'view',sql:'CREATE VIEW view AS SELECT 1'},
  {name:'_cf_KV',type:'table',sql:'CREATE TABLE _cf_KV (unsafe TEXT)'}
 ])block(()=>requireEmptyPhysicalNewLive([row]),
   'preexisting operational object, prior numbering or forged provider metadata blocks install');
 block(()=>requireEmptyPhysicalNewLive([providerRows[0],providerRows[0]]),
   'duplicate provider-owned metadata cannot pass');
 block(()=>requireEmptyPhysicalNewLive([{name:'customers',type:'table',sql:null}]),
   'malformed physical schema inventory blocks');
 ok(newLiveResultRows([{success:true,results:[{n:0}]}])[0].n===0,
  'one successful provider SELECT result');
 for(const p of [[],{},[{}],[{success:false,results:[]}],
  [{success:true,results:null}],
  [{success:true,results:[]},{success:true,results:[]}]])
  block(()=>newLiveResultRows(p),'no failed, ambiguous or missing provider read');
 ok(bindReadOnlyNewLiveSelect('SELECT name FROM sqlite_master WHERE name=?',["O'Brien"])===
  "SELECT name FROM sqlite_master WHERE name='O''Brien'",'safe escaping of read-only SQL bind');
 ok(bindReadOnlyNewLiveSelect('SELECT COUNT(*) AS n FROM "jobs"')===
  'SELECT COUNT(*) AS n FROM "jobs"','reviewed fixed SELECT remains unchanged');
 for(const [sql,args] of [
  ['DELETE FROM jobs',[]],['UPDATE jobs SET id=1',[]],
  ['PRAGMA table_info(jobs)',[]],['SELECT 1; DELETE FROM jobs',[]],
  ['SELECT 1 -- extra',[]],['SELECT 1 /* extra */',[]],
  ['SELECT ?',[]],['SELECT 1',['unused']],['SELECT ?',[null]],
  ['SELECT ?',[1.2]],['SELECT ?',[Number.MAX_SAFE_INTEGER+1]]
 ])block(()=>bindReadOnlyNewLiveSelect(sql,args),
  'write, multi-SQL, malformed parameters or invalid SELECT blocked');
 const lock=join(tmp,'new-live-remote-attempt-lock.json');
 const safe={target:'independent-live',physicalIdentityConfirmed:true,
  initialApplicationTables:0,migrationCount:26};
 for(const preflight of [
  {...safe,target:'independent-dr'}, {...safe,initialApplicationTables:1},
  {...safe,migrationCount:25},{...safe,physicalIdentityConfirmed:false}
 ])block(()=>createOneShotNewLiveAttemptLock(join(tmp,'should-not-exist-'+
  JSON.stringify(preflight.target||preflight.migrationCount)+Math.random()+'.json'),
   preflight),'no lock claimed without exact 26/26 clean LIVE preflight');
 const lockState=createOneShotNewLiveAttemptLock(lock,safe);
 ok(lockState.lockWrittenBeforeRemoteOperation===true&&
    lockState.lockFlushedBeforeRemoteOperation===true&&
    lockState.remoteOperationAttemptedByLock===false,
  'exclusive owner lock is fully written and fsynced before any simulated remote action');
 const firstLockBytes=readFileSync(lock);
 const lockReceipt=JSON.parse(firstLockBytes);
 const workerScope=newLiveMigrationWorkerOperationScope();
 ok(workerScope.workerCreationPerformedByThisMigration===false&&
    workerScope.workerDeploymentPerformedByThisMigration===false&&
    workerScope.ownerLoginChangedByThisMigration===false&&
    workerScope.existingWorkerRuntimeIndependentlyRecheckedByThisMigration===false,
  'schema installer reports only its own non-worker operations, not that the already-created dark Worker does not exist');
 ok(Object.keys(workerScope).every(k=>lockReceipt[k]===workerScope[k])&&
    !Object.hasOwn(lockReceipt,'cloudflareWorkerDeployed')&&
    !Object.hasOwn(lockReceipt,'ownerLoginEnabled'),
  'durable one-shot lock cannot falsely attest global dark Worker deployment or owner login state');
 ok(existsSync(lock)&&JSON.parse(firstLockBytes).state===
  'REMOTE_COMMAND_RESULT_UNCONFIRMED_NO_AUTOMATIC_RETRY','lock records uncertain result');
 ok((statSync(lock).mode&0o777)===0o600,'owner-only lock file permissions on Linux');
 block(()=>createOneShotNewLiveAttemptLock(lock,safe),
  'must refuse a second attempt after lost ACK, crash or completed run');
 ok(readFileSync(lock).equals(firstLockBytes),
  'rejected duplicate attempt cannot overwrite any original locked bytes');
 const p=safeNewLiveCommandError({status:1,stderr:'timeout'},[
  'd1','migrations','apply','fire-fullapp-new-live-db','--remote']);
 ok(p.couldHaveWritten===true&&p.category==='NETWORK'&&
    !JSON.stringify(p).includes('timeout'),
    'remote write uncertainty is reported without leaking raw stderr/credentials');
 const q=safeNewLiveCommandError({status:1,stderr:'Permission denied'},[
  'd1','info','fire-fullapp-new-live-db']);
 ok(q.couldHaveWritten===false&&q.category==='DENIED',
    'read-only failed provider identity never claims a write');
 console.log('PASS '+count+'/'+count+
  ' NEW LIVE one-shot physical migration SOURCE guards: identity, empty Job #0001,'+
  ' exact SQL, account, lost ACK lock, authorization and no DR/Cloudflare write.');
}finally{rmSync(tmp,{recursive:true,force:true});}
