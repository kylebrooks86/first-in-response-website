/**
 * FIRE NEW LIVE lost-ack / one-shot migration reconciliation — READ ONLY.
 *
 * Preserves the already-created owner attempt lock. It NEVER calls "d1 migrations
 * apply", executes mutation SQL, creates a receipt, deploys a Worker, or changes
 * Cloudflare. Default (no arguments) is OFFLINE and makes ZERO provider calls.
 * The --capture mode reads ONLY the existing NEW LIVE physical D1. A 26/26
 * migration journal is merely a prerequisite: the source's full read-only
 * refund/index/immutable-number/zero-record/#0001 inspection must pass too.
 *
 * A successful reconciliation does NOT transform an uncertain migration command
 * into a provider-confirmed successful migration, prove provider route/access
 * isolation or authorize retry, activation, Stripe, billing, R2, or cutover.
 */
import {existsSync,lstatSync,readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {REVIEWED_RELEASE_D1_TARGETS} from './prepare_independent_d1_migration_workspace.mjs';
import {pinnedNewLiveAccountEnvironment,newLiveResultRows,bindReadOnlyNewLiveSelect}
 from './owner_new_live_initial_schema_one_shot.mjs';
import {inspectNewLiveFirstJobCleanStart}
 from './shared/lib/new-live-first-job-preflight.mjs';

const OUT=join(homedir(),'FIRE-NEW-LIVE-ONE-SHOT-SCHEMA-20261114');
const LOCK=join(OUT,'new-live-remote-attempt-lock.json');
const RECEIPT=join(OUT,'new-live-physical-schema-receipt.json');
const CONFIG=join(OUT,'source-reviewed-26-migrations','wrangler.json');
const LIVE=REVIEWED_RELEASE_D1_TARGETS['independent-live'];
const STOP='FIRE_NEW_LIVE_ATTEMPT_READ_ONLY_STOP';
const fail=message=>{throw Error(STOP+': '+message);};

function safeLocalJson(path,limit=20000){
 if(!existsSync(path))fail('required protected local evidence not found; do not recreate it');
 const st=lstatSync(path);
 if(!st.isFile()||st.isSymbolicLink()||st.size>limit||st.size<2)
  fail('local evidence is not a regular, bounded file');
 try{return JSON.parse(readFileSync(path,'utf8'));}
 catch{fail('local evidence JSON invalid; do not replace it');}
}
export function validateAttemptLock(lock){
 if(!lock||typeof lock!=='object'||Array.isArray(lock)||
    lock.target!=='independent-live'||
    lock.database_name!==LIVE.database_name||
    lock.database_id!==LIVE.database_id||
    lock.state!=='REMOTE_COMMAND_RESULT_UNCONFIRMED_NO_AUTOMATIC_RETRY'||
    lock.sourceMigrationCount!==26||
    lock.physicalIdentityConfirmed!==true||
    lock.initialApplicationTables!==0||
    typeof lock.createdAt!=='string'||!Number.isFinite(Date.parse(lock.createdAt)))
  fail('existing lock differs from reviewed first-try NEW LIVE lock; preserve file');
 return true;
}
export function validateLockedConfig(config){
 const arr=config?.d1_databases;
 if(!Array.isArray(arr)||arr.length!==1)fail('dedicated D1 config must contain ONLY NEW LIVE');
 const item=arr[0];
 if(!item||item.binding!=='DB'||item.database_name!==LIVE.database_name||
    item.database_id!==LIVE.database_id||item.migrations_dir!=='migrations'||
    item.migrations_table!=='d1_migrations')
  fail('D1 config is not pinned to reviewed NEW LIVE UUID');
 return true;
}
export function verifyPhysicalIdentity(info){
 const uuid=info?.uuid??info?.id??info?.database_id;
 if(!info||info.name!==LIVE.database_name||uuid!==LIVE.database_id)
  fail('remote physical D1 identity did not match reviewed NEW LIVE UUID');
 return true;
}
export function classifyRemoteInventory(rows,journalCount){
 if(!Array.isArray(rows)||rows.length>1000)
  fail('unexpected or missing SQLite object inventory');
 const names=new Set();
 for(const o of rows){
  if(!o||typeof o.name!=='string'||typeof o.type!=='string'||
     !['table','index','trigger','view'].includes(o.type)||names.has(o.name))
   fail('unrecognized or duplicate SQLite object inventory');
  names.add(o.name);
 }
 const hasJournal=names.has('d1_migrations');
 const appObjects=rows.filter(o=>!['_cf_KV','_cf_METADATA','d1_migrations'].includes(o.name));
 if(!hasJournal){
  if(journalCount!==null)fail('journal count contradicts physical table inventory');
  return Object.freeze({state:appObjects.length===0?
    'NO_JOURNAL_AND_NO_APPLICATION_OBJECTS_SEEN':
    'APPLICATION_OBJECTS_WITHOUT_JOURNAL_NEEDS_INVESTIGATION',
    journalCount:null,applicationObjectCount:appObjects.length,fullSchemaVerified:false});
 }
 if(!Number.isSafeInteger(journalCount)||journalCount<0)
  fail('provider migration journal count missing or invalid');
 // The Wrangler migration journal uses AUTOINCREMENT. SQLite can create its
 // internal sqlite_sequence catalog table as soon as the journal is created,
 // before even one source SQL migration is recorded. This is an observed-name
 // classification, NOT proof that the database is pristine or retryable.
 const onlyInternalSequence=appObjects.length===1&&
  appObjects[0].name==='sqlite_sequence'&&appObjects[0].type==='table';
 const state=journalCount===26?'COMPLETE_JOURNAL_FULL_SOURCE_PROOF_PENDING':
  journalCount===0&&onlyInternalSequence?'ZERO_JOURNAL_SQLITE_SEQUENCE_ONLY_NO_RETRY':
  journalCount===0?'ZERO_JOURNAL_ROWS_NEEDS_INVESTIGATION':
  journalCount<26?'INCOMPLETE_JOURNAL_DO_NOT_RETRY':
   'UNEXPECTED_EXTRA_JOURNAL_ROWS_DO_NOT_RETRY';
 return Object.freeze({state,journalCount,applicationObjectCount:appObjects.length,
  onlyInternalSqliteSequenceObserved:onlyInternalSequence,
  fullSchemaVerified:false});
}
function localPreflight(){
 const lock=safeLocalJson(LOCK,10000);
 validateAttemptLock(lock);
 // No completion receipt exists in the owner's observed checkpoint. If one
 // appears later, STOP rather than silently overwriting or trusting it.
 if(existsSync(RECEIPT))fail('completion receipt now present; inspect it separately, never overwrite');
 validateLockedConfig(safeLocalJson(CONFIG));
 return Object.freeze({lockPreserved:true,completionReceiptPresent:false,
  databaseName:LIVE.database_name,expectedPhysicalUuid:LIVE.database_id,
  cloudflareReadPerformed:false,remoteWritePerformed:false,
  migrationRetryAllowed:false,gate5Accepted:false,productionReady:false});
}
function cliJson(wrangler,args){
 const result=spawnSync(process.execPath,[wrangler,...args],{
  cwd:join(OUT,'source-reviewed-26-migrations'),
  env:pinnedNewLiveAccountEnvironment(process.env),
  encoding:'utf8',timeout:90000,maxBuffer:2*1024*1024,windowsHide:true
 });
 if(result.error||result.signal||result.status!==0||typeof result.stdout!=='string')
  fail('read-only provider command unavailable; credentials and raw output suppressed');
 try{return JSON.parse(result.stdout.trim());}
 catch{fail('read-only provider JSON format unsupported; no state inferred');}
}
function sourceReadDb(wrangler){
 const execute=sql=>newLiveResultRows(cliJson(wrangler,[
  'd1','execute',LIVE.database_name,'--remote','--json',
  '--config',CONFIG,'--command',bindReadOnlyNewLiveSelect(sql)
 ]));
 return Object.freeze({
  execute,
  db:{prepare(sql){
   return {
    bind(...args){
     return {first:async()=>executeBound(sql,args)[0]??null,
      all:async()=>({results:executeBound(sql,args)})};
    },
    first:async()=>execute(sql)[0]??null,
    all:async()=>({results:execute(sql)})
   };
   function executeBound(s,args){
    return newLiveResultRows(cliJson(wrangler,[
     'd1','execute',LIVE.database_name,'--remote','--json',
     '--config',CONFIG,'--command',bindReadOnlyNewLiveSelect(s,args)
    ]));
   }
  }}
 });
}
async function capture(wranglerPath){
 if(process.env.CI||process.env.GITHUB_ACTIONS)
  fail('provider capture is prohibited in CI; mocks test classification only');
 if(typeof wranglerPath!=='string'||!wranglerPath.trim())
  fail('exact existing reviewed Wrangler 4.92.0 JS file path required');
 const cli=resolve(wranglerPath);
 if(!existsSync(cli)||!lstatSync(cli).isFile()||lstatSync(cli).isSymbolicLink())
  fail('local Wrangler JS missing or linked; no install/login attempted');
 const v=spawnSync(process.execPath,[cli,'--version'],{
  encoding:'utf8',timeout:20000,windowsHide:true
 });
 if(v.status!==0||!/\b4\.92\.0\b/.test(v.stdout??''))
  fail('reviewed existing Wrangler 4.92.0 version required; no installation requested');
 verifyPhysicalIdentity(cliJson(cli,[
  'd1','info',LIVE.database_name,'--json','--config',CONFIG]));
 const {execute,db}=sourceReadDb(cli);
 const rows=execute("SELECT type,name FROM sqlite_master WHERE type IN ('table','view','index','trigger') AND (name NOT GLOB 'sqlite_*' OR name='sqlite_sequence') ORDER BY type,name");
 const journal=rows.some(o=>o.name==='d1_migrations');
 const count=journal?execute('SELECT COUNT(*) AS n FROM "d1_migrations"')[0]?.n:null;
 const overview=classifyRemoteInventory(rows,count);
 let proof=false;
 if(overview.state==='COMPLETE_JOURNAL_FULL_SOURCE_PROOF_PENDING'){
  try{
   const verified=await inspectNewLiveFirstJobCleanStart(db,{
    FIRE_ENV:'new-live-prelaunch',
    FIRE_JOB_NUMBERS_CANDIDATE:'owner-approved-schema-v1',
    FIRE_CUSTOMER_NUMBERS_CANDIDATE:'owner-approved-schema-v1'
   });
   proof=verified.exactSourceMigrationJournalMatched===true&&
    verified.physicalFinancialIndexesMatched===true&&
    verified.reviewedNamedIndexesAndNoViewsVerified===true&&
    verified.tableRecordsAllEmpty===true&&
    verified.jobAndCustomerSequencesEmpty===true&&
    verified.firstJobNumberExpected==='0001';
  }catch{
   // Do not expose arbitrary provider or SQL error text or infer migration state.
   proof=false;
  }
 }
 return {result:proof?'PHYSICAL_NEW_LIVE_SCHEMA_AND_CLEAN_0001_READ_ONLY_MATCH':
  overview.state==='COMPLETE_JOURNAL_FULL_SOURCE_PROOF_PENDING'?
    'TWENTY_SIX_JOURNAL_ROWS_BUT_FULL_SCHEMA_NOT_VERIFIED':
    overview.state,
  databaseName:LIVE.database_name,physicalD1UuidMatched:true,
  journalCount:overview.journalCount,
  applicationObjectCount:overview.applicationObjectCount,
  exactSourceSchemaAndFirstJobCleanStartVerified:proof,
  migrationRemoteCommandSuccessAttested:false,
  oneShotAttemptLockPreserved:true,oneShotCompletionReceiptCreated:false,
  d1ReadOnly:true,cloudflareWorkerModified:false,d1Modified:false,
  migrationRetryAllowed:false,gate4Accepted:false,gate5Accepted:false,
  productionReady:false};
}
const isMain=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 try{
  if(process.argv.length!==2&&
     !(process.argv.length===4&&process.argv[2]==='--capture'))
   fail('usage: node owner_new_live_attempt_readonly_reconcile.mjs [--capture PINNED_WRANGLER_JS]');
  const baseline=localPreflight();
  if(process.argv.length===2){
   console.log(JSON.stringify({result:'OFFLINE_LOCK_PRESERVED_NO_CLOUDFLARE_REQUEST',...baseline},null,2));
  }else{
   const result=await capture(process.argv[3]);
   console.log(JSON.stringify(result,null,2));
  }
 }catch{
  console.error(STOP+': preserve original lock and stop; NO migration retry');
  process.exitCode=1;
 }
}
