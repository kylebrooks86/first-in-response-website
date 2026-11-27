/**
 * FIRE NEW LIVE — precise D1 initialized-journal/sequence remote evidence.
 *
 * Default mode is strictly OFFLINE. With --capture + existing Wrangler JS path,
 * reads ONLY the previously established NEW LIVE D1 and reports strictly
 * sanitized metadata. No SQL mutation, migrations, Worker deploy/route,
 * Access/Stripe/R2 operation, lock deletion or completion receipt creation.
 * A MATCH is NOT authorization to retry migrations. Separate capture commands
 * are not a transactional snapshot.
 */
import {existsSync,lstatSync,readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {pinnedNewLiveAccountEnvironment,newLiveResultRows}
 from './owner_new_live_initial_schema_one_shot.mjs';
import {validateAttemptLock,validateLockedConfig,verifyPhysicalIdentity}
 from './owner_new_live_attempt_readonly_reconcile.mjs';
import {assessNewLiveInitializedJournalRecoveryEvidence}
 from './new_live_initialized_journal_recovery_guard.mjs';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS}
 from './shared/lib/new-live-migration-journal.mjs';

const OUT=join(homedir(),'FIRE-NEW-LIVE-ONE-SHOT-SCHEMA-20261114');
const LOCK=join(OUT,'new-live-remote-attempt-lock.json');
const RECEIPT=join(OUT,'new-live-physical-schema-receipt.json');
const CONFIG=join(OUT,'source-reviewed-26-migrations','wrangler.json');
const DB='fire-fullapp-new-live-db';
const STOP='FIRE_NEW_LIVE_JOURNAL_SCHEMA_READ_ONLY_STOP';
const refuse=()=>{throw Error(STOP+': preserve lock; no migration retry');};
const SQL=Object.freeze({
 catalog:"SELECT type,name,sql FROM sqlite_master WHERE type IN ('table','view','index','trigger') ORDER BY type,name",
 journal:'SELECT id,name FROM "d1_migrations" ORDER BY id',
 highwater:'SELECT name,seq FROM sqlite_sequence ORDER BY name'
});
function localJson(path){
 if(!existsSync(path))refuse();
 const stat=lstatSync(path);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>16000||stat.size<2)refuse();
 try{return JSON.parse(readFileSync(path,'utf8'));}
 catch{refuse();}
}
function readOwnerEvidence(){
 const lock=localJson(LOCK);
 const cfg=localJson(CONFIG);
 try{validateAttemptLock(lock);validateLockedConfig(cfg);}catch{refuse();}
 if(existsSync(RECEIPT))refuse();
 if(EXPECTED_NEW_LIVE_D1_MIGRATIONS.length!==26)refuse();
 return {lock,cfg};
}
function runReadOnly(js,args){
 // Defensive runtime command allowlist: ONLY version, one D1 info and the
 // three literal SELECT statements for the same pinned D1/config.
 const key=args.join('\u001f');
 const allowed=new Set([
  ['--version'].join('\u001f'),
  ['d1','info',DB,'--json','--config',CONFIG].join('\u001f'),
  ...Object.values(SQL).map(sql=>
   ['d1','execute',DB,'--remote','--json','--config',CONFIG,'--command',sql].join('\u001f'))
 ]);
 if(!allowed.has(key))refuse();
 const proc=spawnSync(process.execPath,[js,...args],{
  cwd:join(OUT,'source-reviewed-26-migrations'),
  env:pinnedNewLiveAccountEnvironment(process.env),
  encoding:'utf8',windowsHide:true,timeout:90000,maxBuffer:2*1024*1024
 });
 if(proc.error||proc.signal||proc.status!==0||typeof proc.stdout!=='string'||
    proc.stdout.length>200000)refuse();
 return proc.stdout;
}
function parseInfo(raw){
 try{
  const obj=JSON.parse(raw);
  verifyPhysicalIdentity(obj);
  return obj;
 }catch{refuse();}
}
function parseResults(raw){
 try{return newLiveResultRows(JSON.parse(raw));}
 catch{refuse();}
}
export function summariseObservedJournalMetadata({objects,journal,sequence,lock,config,info}){
 // Pure transform; no provider calls. Guard itself enforces source contract.
 const result=assessNewLiveInitializedJournalRecoveryEvidence({
  originalAttemptLock:lock,dedicatedD1Config:config,liveD1Info:info,
  sqliteMasterRows:objects,journalRows:journal,sequenceRows:sequence,
  originalLockPreserved:true,completionReceiptPresent:false,
  ownerApprovedNewWrite:false,sourceReviewSqlCount:26
 });
 return Object.freeze({
  result:'FIRE_NEW_LIVE_INITIALIZED_JOURNAL_EMPTY_READ_ONLY_MATCH_NO_RETRY',
  observedAppliedMigrationRows:result.observedAppliedMigrationRows,
  observedSqliteSequenceRows:result.observedSqliteSequenceRows,
  observedApplicationSchemaObjects:result.observedApplicationSchemaObjects,
  exactJournalDdlAndUniqueIndexMatched:result.journalDdlAndUniqueIndexMatched,
  physicalNewLiveIdentityMatched:result.exactPhysicalD1IdentityMatched,
  originalAttemptLockPreserved:result.originalLockPreserved,
  priorRemoteCommandAcknowledged:false,
  multipleProviderReadsNotAtomicSnapshot:true,
  noDatabaseWritePerformed:true,completionReceiptCreated:false,
  migrationRetryPermitted:false,ownerAuthorizedNewMutation:false,
  gate5Accepted:false,newLiveReady:false
 });
}
async function capture(jsPath){
 if(process.env.CI||process.env.GITHUB_ACTIONS)refuse();
 const {lock,cfg}=readOwnerEvidence();
 if(typeof jsPath!=='string'||!jsPath.trim())refuse();
 const js=resolve(jsPath);
 if(!existsSync(js)||!lstatSync(js).isFile()||lstatSync(js).isSymbolicLink())refuse();
 if(!/\b4\.92\.0\b/.test(runReadOnly(js,['--version'])))refuse();
 const info=parseInfo(runReadOnly(js,['d1','info',DB,'--json','--config',CONFIG]));
 const read=sql=>parseResults(runReadOnly(js,
  ['d1','execute',DB,'--remote','--json','--config',CONFIG,'--command',sql]));
 return summariseObservedJournalMetadata({
  objects:read(SQL.catalog),journal:read(SQL.journal),
  sequence:read(SQL.highwater),lock,config:cfg,info
 });
}
const main=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 try{
  if(process.argv.length===2){
   console.log('FIRE_NEW_LIVE_INITIALIZED_JOURNAL_OFFLINE_ONLY_NO_PROVIDER');
  }else if(process.argv.length===4&&process.argv[2]==='--capture'){
   console.log(JSON.stringify(await capture(process.argv[3]),null,2));
  }else refuse();
 }catch{
  console.error(STOP+': preserve existing attempt lock; no migration retry');
  process.exitCode=1;
 }
}
