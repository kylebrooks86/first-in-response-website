/**
 * FIRE NEW LIVE — owner-gated, one-shot physical D1 initial schema installer.
 *
 * CODE ONLY until owner separately approves the *exact* future Cloudflare
 * write. DO NOT invoke via CI, unattended jobs, Work, or generic "continue".
 * Unlike the completed DR install, NEW LIVE is still an empty physical DB.
 * This tool never creates a DB, Worker, route, R2 bucket, token, Stripe object
 * or owner account. No automatic retry after a remote command or lost ACK.
 *
 * The owner-approved initial DR installer is a separate, preserved artifact;
 * this source is NEW LIVE ONLY, with an entirely separate one-shot lock.
 */
import {spawnSync} from 'node:child_process';
import {existsSync,lstatSync,mkdirSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareIndependentD1MigrationWorkspace,REVIEWED_RELEASE_D1_TARGETS}
 from './prepare_independent_d1_migration_workspace.mjs';
import {verifySavedIndependentD1MigrationWorkspace}
 from './verify_saved_independent_d1_migration_workspace.mjs';
import {inspectNewLiveFirstJobCleanStart}
 from './shared/lib/new-live-first-job-preflight.mjs';

const ROOT=fileURLToPath(new URL('.',import.meta.url));
const TARGET='independent-live';
const LIVE=REVIEWED_RELEASE_D1_TARGETS[TARGET];
const DR=REVIEWED_RELEASE_D1_TARGETS['independent-dr'];
const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
const OUT=join(homedir(),'FIRE-NEW-LIVE-ONE-SHOT-SCHEMA-20261114');
const WORK=join(OUT,'source-reviewed-26-migrations');
const LOCK=join(OUT,'new-live-remote-attempt-lock.json');
const RECEIPT=join(OUT,'new-live-physical-schema-receipt.json');
const APPROVAL_SENTINEL='--exact-new-live-26-migrations-separately-authorized';
const stop=s=>{throw Error('FIRE NEW LIVE remote migration BLOCKED: '+s);};

export function requireNewLiveApprovalSentinel(actual){
 if(actual!==APPROVAL_SENTINEL)
  stop('exact future owner approval is required; code review is not Cloudflare authorization');
 return true;
}
export function pinnedNewLiveAccountEnvironment(raw=process.env){
 if(raw.CLOUDFLARE_ACCOUNT_ID&&raw.CLOUDFLARE_ACCOUNT_ID!==ACCOUNT)
  stop('Cloudflare account differs from physically established FIRE account');
 if(raw.CF_ACCOUNT_ID&&raw.CF_ACCOUNT_ID!==ACCOUNT)
  stop('alternate Cloudflare account differs from physically established FIRE account');
 return {...raw,CLOUDFLARE_ACCOUNT_ID:ACCOUNT,WRANGLER_SEND_METRICS:'false',
  CLOUDFLARE_CF_FETCH_ENABLED:'false'};
}
export function requireIndependentNewLiveInfo(liveInfo,drInfo){
 const exact=(info,res)=>{
  if(!info||typeof info!=='object'||Array.isArray(info))stop('missing provider D1 identity');
  const uuid=info.uuid??info.id??info.database_id;
  if(info.name!==res.database_name||uuid!==res.database_id)
   stop('provider returned wrong physical D1 name/UUID');
  return {name:info.name,uuid};
 };
 const live=exact(liveInfo,LIVE),dr=exact(drInfo,DR);
 if(live.uuid===dr.uuid)stop('NEW LIVE and DR must never reuse physical D1');
 return Object.freeze({target:TARGET,live,dr,
  identitiesReadFromTargetedD1Info:true,providerMigrationNotYetStarted:true});
}
// Reject everything except exact, documented Cloudflare provider metadata.
// In particular sqlite_sequence, sqliteX_, views, indexes, triggers, a partial
// d1_migrations journal, and *any* prior customer or job must prevent writing.
const providerDDL=Object.freeze({
 _cf_KV:/^CREATE TABLE _cf_KV\s*\(\s*key TEXT PRIMARY KEY\s*,\s*value BLOB\s*\)\s*WITHOUT ROWID\s*;?$/i,
 _cf_METADATA:/^CREATE TABLE _cf_METADATA\s*\(\s*key INTEGER PRIMARY KEY\s*,\s*value BLOB\s*\)\s*;?$/i
});
export function requireEmptyPhysicalNewLive(rows){
 if(!Array.isArray(rows))stop('missing physical sqlite_master inventory');
 const names=new Set();
 for(const row of rows){
  if(!row||typeof row.name!=='string'||typeof row.type!=='string'||
     typeof row.sql!=='string'||names.has(row.name))
   stop('malformed/duplicated physical SQLite object');
  names.add(row.name);
  if(row.type!=='table'||!Object.hasOwn(providerDDL,row.name))
   stop('NEW LIVE has existing application/number/journal/index/view/trigger: '+row.name);
  const normalized=row.sql.replace(/["\x60\[\]]/g,'').trim().replace(/\s+/g,' ');
  if(!providerDDL[row.name].test(normalized))
   stop('unexpected Cloudflare provider metadata SQL');
 }
 return Object.freeze({initialNewLiveApplicationTables:0,
  initialMigrationJournalPresent:false,previousCustomerAndJobHistoryAbsent:true,
  providerMetadataObjects:rows.length});
}
export function newLiveResultRows(payload){
 if(!Array.isArray(payload)||payload.length!==1||
    payload[0]?.success!==true||!Array.isArray(payload[0]?.results))
  stop('provider did not return one successful read-only D1 statement');
 return payload[0].results;
}
export function bindReadOnlyNewLiveSelect(sql,args=[]){
 if(typeof sql!=='string'||!/^SELECT\b/i.test(sql.trim())||
    sql.includes(';')||sql.includes('--')||sql.includes('/*')||
    !Array.isArray(args))stop('refusing non-read-only or multicommand SQL');
 let i=0;
 const out=sql.replace(/\?/g,()=>{
  if(i>=args.length)stop('missing read-only D1 bind argument');
  const value=args[i++];
  if(typeof value==='string')return "'"+value.replaceAll("'","''")+"'";
  if(typeof value==='number'&&Number.isSafeInteger(value))return String(value);
  stop('unexpected read-only SQL bind type');
 });
 if(i!==args.length)stop('unused read-only D1 bind arguments');
 return out;
}
export function createOneShotNewLiveAttemptLock(lockPath,preflight){
 // Must be durable BEFORE the first possible remote migration mutation. Once
 // written, even a transport failure or process crash cannot trigger retry.
 if(!preflight||preflight.target!==TARGET||!preflight.physicalIdentityConfirmed||
    preflight.initialApplicationTables!==0||preflight.migrationCount!==26)
  stop('NEW LIVE one-shot attempt cannot begin without exact clean preflight');
 try{
  writeFileSync(lockPath,JSON.stringify({
   target:TARGET,database_name:LIVE.database_name,database_id:LIVE.database_id,
   state:'REMOTE_COMMAND_RESULT_UNCONFIRMED_NO_AUTOMATIC_RETRY',
   createdAt:new Date().toISOString(),
   sourceMigrationCount:26,physicalIdentityConfirmed:true,
   initialApplicationTables:0,firstJobNumber0001NotYetVerified:true,
   cloudflareWorkerDeployed:false,ownerLoginEnabled:false,
   stripeAndR2Untouched:true
  },null,2)+'\n',{flag:'wx',mode:0o600});
 }catch{stop('prior migration attempt/lock exists or secure lock failed; DO NOT RETRY');}
 return {lockWrittenBeforeRemoteOperation:true,remoteOperationAttemptedByLock:false};
}
const safeParse=(stdout,step)=>{
 if(typeof stdout!=='string')stop(step+' did not return JSON');
 try{return JSON.parse(stdout.trim());}
 catch{stop(step+' provider response was not valid JSON');}
};
export function safeNewLiveCommandError(run,args){
 const msg=[run?.stdout,run?.stderr,run?.error?.message]
  .filter(v=>typeof v==='string').join('\n');
 const remoteWrite=args.slice(0,3).join(' ')==='d1 migrations apply';
 const reason=/(401|authentication|login required|not logged in)/i.test(msg)?'AUTH':
  /(403|forbidden|permission|10000)/i.test(msg)?'DENIED':
  /(network|timeout|ECONNRESET|ENOTFOUND|fetch failed)/i.test(msg)?'NETWORK':
  /(unknown|invalid|missing|required|parse)/i.test(msg)?'ARGUMENT_OR_CONFIG':'UNKNOWN';
 return Object.freeze({
  operation:remoteWrite?'ONE_SHOT_NEW_LIVE_REMOTE_WRITE':'READ_ONLY_PREFLIGHT',
  category:reason,exitCode:Number.isInteger(run?.status)?run.status:'unknown',
  couldHaveWritten:remoteWrite,
  instruction:remoteWrite?'DO NOT RETRY; consult the existing attempt lock and read-only provider evidence':
   'STOP without performing any remote write'
 });
}
function wrangler(js,args,{cwd=WORK,write=false}={}){
 const proc=spawnSync(process.execPath,[js,...args],{
  cwd,env:pinnedNewLiveAccountEnvironment(process.env),
  stdio:write?['ignore','inherit','inherit']:'pipe',
  encoding:write?undefined:'utf8',timeout:write?600000:90000,
  maxBuffer:8*1024*1024
 });
 if(proc.error||proc.signal||proc.status!==0){
  const classified=safeNewLiveCommandError(proc,args);
  stop(JSON.stringify(classified));
 }
 return write?'':proc.stdout;
}
export async function applyNewLiveInitialSchemaAfterSeparateApproval(pinnedWrangler,approvalFlag){
 requireNewLiveApprovalSentinel(approvalFlag);
 if(typeof pinnedWrangler!=='string'||!pinnedWrangler.trim())
  stop('exact locally installed reviewed Wrangler JS path required');
 const js=resolve(pinnedWrangler);
 if(!existsSync(js)||!lstatSync(js).isFile()||lstatSync(js).isSymbolicLink())
  stop('reviewed local Wrangler JS is unavailable or is linked');
 if(!/\b4\.92\.0\b/.test(wrangler(js,['--version'],{cwd:ROOT})))
  stop('migration installer requires already proven Wrangler 4.92.0');
 mkdirSync(OUT,{recursive:true,mode:0o700});
 if(existsSync(LOCK)||existsSync(RECEIPT))
  stop('prior NEW LIVE attempt or completion exists; never reapply migrations');
 if(!existsSync(WORK))prepareIndependentD1MigrationWorkspace(TARGET,WORK);
 const checked=verifySavedIndependentD1MigrationWorkspace(TARGET,WORK);
 if(checked.savedWorkspaceVerified!==true||checked.reviewedSqlFiles!==26||
    checked.database_id!==LIVE.database_id||
    checked.remoteMigrationAttempted!==false)
  stop('source SQL/physical DB binding does not match reviewed 26 original Git blobs');
 const config=join(WORK,'wrangler.json');
 const query=args=>safeParse(wrangler(js,args),args.slice(0,3).join(' '));
 // Query ONLY new specific target identities. Do NOT retry old account-wide
 // D1-list failures or replay accepted DR migration or device evidence.
 const identity=requireIndependentNewLiveInfo(
  query(['d1','info',LIVE.database_name,'--json','--config',config]),
  query(['d1','info',DR.database_name,'--json','--config',config]));
 const schema=newLiveResultRows(query([
  'd1','execute',LIVE.database_name,'--remote','--json','--config',config,
  '--command',"SELECT type,name,sql FROM sqlite_master WHERE type IN ('table','view','index','trigger') AND (name NOT GLOB 'sqlite_*' OR name='sqlite_sequence') ORDER BY type,name"
 ]));
 const empty=requireEmptyPhysicalNewLive(schema);
 createOneShotNewLiveAttemptLock(LOCK,{target:TARGET,
  physicalIdentityConfirmed:identity.identitiesReadFromTargetedD1Info,
  initialApplicationTables:empty.initialNewLiveApplicationTables,
  migrationCount:checked.reviewedSqlFiles});
 wrangler(js,['d1','migrations','apply',LIVE.database_name,'--remote','--config',config],
  {write:true});
 // Only post-write readbacks below. If any fail, the lock prevents retry.
 let reads=0;
 const read=async(sql,args)=>{
  reads++;
  return newLiveResultRows(query([
   'd1','execute',LIVE.database_name,'--remote','--json','--config',config,
   '--command',bindReadOnlyNewLiveSelect(sql,args)]));
 };
 const db={prepare(sql){
  const binded=(args=[])=>({
   bind:(...a)=>binded(a),
   first:async()=>((await read(sql,args))[0]??null),
   all:async()=>({results:await read(sql,args)})
  });
  return binded();
 }};
 const result=await inspectNewLiveFirstJobCleanStart(db,{
  FIRE_ENV:'new-live-prelaunch',
  FIRE_JOB_NUMBERS_CANDIDATE:'owner-approved-schema-v1',
  FIRE_CUSTOMER_NUMBERS_CANDIDATE:'owner-approved-schema-v1'
 });
 if(result.exactSourceMigrationJournalMatched!==true||
    result.physicalFinancialIndexesMatched!==true||
    result.reviewedNamedIndexesAndNoViewsVerified!==true||
    result.tableRecordsAllEmpty!==true||
    result.jobAndCustomerSequencesEmpty!==true||
    result.firstJobNumberExpected!=='0001')
  stop('NEW LIVE physical numbered/refund/empty schema review not accepted; lock remains');
 const receipt={
  target:TARGET,name:LIVE.database_name,database_id:LIVE.database_id,
  checkedAt:new Date().toISOString(),migrationCount:26,physicalIdentity:identity,
  remoteMigrationCommandReturnedSuccess:true,
  icsSourceSqlMigrationJournalVerified:true,
  exactFinancialAndNumberingSchemaVerified:true,
  physicalFirstJobExpected:'0001',physicalFirstCustomerExpected:'0001',
  physicalNewLiveReadback:result,postMigrationReadOnlyStatements:reads,
  drDatabaseUntouched:true,qaAndStagingUntouched:true,
  noStripePaymentOrRefund:true,noR2OrPaidCloudflare:true,
  workerCreated:false,workerDeployed:false,ownerLoginEnabled:false,
  liveActivationAuthorized:false,gate4FullyAccepted:false,
  gate5FullyAccepted:false,gate7Accepted:false,
  gate9Accepted:false,gate10Accepted:false
 };
 writeFileSync(RECEIPT,JSON.stringify(receipt,null,2)+'\n',
  {flag:'wx',mode:0o600});
 console.log('NEW LIVE physically verified 26/26 source schema; Job #0001 only EXPECTED, NO first job created, NO Worker deployed.');
 return receipt;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==4)
   stop('usage: node owner_new_live_initial_schema_one_shot.mjs PINNED_WRANGLER_JS --exact-new-live-26-migrations-separately-authorized');
  await applyNewLiveInitialSchemaAfterSeparateApproval(process.argv[2],process.argv[3]);
 }catch(e){console.error(String(e.message));process.exitCode=1;}
}
