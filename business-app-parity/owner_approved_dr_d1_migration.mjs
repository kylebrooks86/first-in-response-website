/**
 * FIRE Gate 5 initial remote DR schema installation — OWNER APPROVED, DR ONLY.
 * The owner's November 13 authorization applies only to existing
 * fire-fullapp-dr-db when physically verified EMPTY immediately beforehand.
 *
 * Run ONLY from the owner's authenticated Acer, with reviewed pinned Wrangler.
 * No resources are created, no NEW LIVE/QA/STAGING/Stripe DB is modified,
 * no Worker deployed, R2 enabled, payment attempted or release activated.
 * A remote write is NEVER automatically retried, including after timeout.
 */
import {spawnSync} from 'node:child_process';
import {existsSync,lstatSync,mkdirSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareIndependentD1MigrationWorkspace,REVIEWED_RELEASE_D1_TARGETS} from './prepare_independent_d1_migration_workspace.mjs';
import {verifySavedIndependentD1MigrationWorkspace} from './verify_saved_independent_d1_migration_workspace.mjs';
import {inspectNewLiveFirstJobCleanStart} from './shared/lib/new-live-first-job-preflight.mjs';

const ROOT=fileURLToPath(new URL('.',import.meta.url));
const TARGET='independent-dr';
const DR=REVIEWED_RELEASE_D1_TARGETS[TARGET];
const LIVE=REVIEWED_RELEASE_D1_TARGETS['independent-live'];
const OUT=join(homedir(),'FIRE-DR-APPROVED-MIGRATION-20261113');
const WORK=join(OUT,'pinned-26-migrations');
const LOCK=join(OUT,'remote-one-shot-attempt.json');
const RECEIPT=join(OUT,'dr-physical-schema-receipt.json');
const stop=why=>{throw Error('FIRE DR Gate5 STOP: '+why);};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const noSecrets={
  newLiveUntouched:true,qaUntouched:true,stagingUntouched:true,
  noPaidR2:true,noWorkerDeploy:true,noStripeOperation:true
};

export function requirePinnedDRProviderIdentity(raw){
  if(!Array.isArray(raw))stop('D1 provider list must be an exact JSON array');
  const mapped=raw.map(v=>({
    name:typeof v?.name==='string'?v.name:null,
    uuid:typeof (v?.uuid??v?.id)==='string'?(v.uuid??v.id):null
  }));
  const dr=mapped.filter(v=>v.name===DR.database_name);
  const live=mapped.filter(v=>v.name===LIVE.database_name);
  if(dr.length!==1||dr[0].uuid!==DR.database_id)
    stop('physical DR database name/UUID mismatch; no schema writes');
  if(live.length!==1||live[0].uuid!==LIVE.database_id)
    stop('expected separate NEW LIVE identity unavailable; no schema writes');
  if(mapped.filter(v=>v.uuid===DR.database_id).length!==1||
     mapped.filter(v=>v.uuid===LIVE.database_id).length!==1)
    stop('physical D1 UUID duplicate or reused in this account');
  return Object.freeze({target:TARGET,name:DR.database_name,uuid:DR.database_id,
    separateLiveName:LIVE.database_name,readOnlyIdentityVerified:true});
}

// D1's only provider-owned metadata schemas accepted on a newly created DB.
// Normalizing identifiers is safe here because all non-provider object names
// are rejected, including tables, indexes, views, triggers and migration journal.
const providerDDL=Object.freeze({
  _cf_KV:/^CREATE TABLE _cf_KV\s*\(\s*key TEXT PRIMARY KEY\s*,\s*value BLOB\s*\)\s*WITHOUT ROWID\s*;?$/i,
  _cf_METADATA:/^CREATE TABLE _cf_METADATA\s*\(\s*key INTEGER PRIMARY KEY\s*,\s*value BLOB\s*\)\s*;?$/i
});
export function requirePhysicallyEmptyDRSchema(rows){
  if(!Array.isArray(rows))stop('no actual sqlite_master data returned');
  const names=new Set();
  for(const row of rows){
    if(!row||typeof row.name!=='string'||typeof row.type!=='string'||
       typeof row.sql!=='string'||names.has(row.name))
      stop('unrecognized/duplicated schema object in DR physical database');
    names.add(row.name);
    if(row.type!=='table'||!own(providerDDL,row.name))
      stop('DR is not an empty first-install database: '+row.name);
    const clean=row.sql.replace(/["\x60\[\]]/g,'').trim().replace(/\s+/g,' ');
    if(!providerDDL[row.name].test(clean))
      stop('unreviewed provider-owned D1 metadata schema: '+row.name);
  }
  return Object.freeze({noApplicationTables:true,noMigrationsApplied:true,
    noUnreviewedObjects:true,providerMetadataObjects:rows.length});
}
export function readOnlyWranglerRows(data){
  if(!Array.isArray(data)||data.length!==1||data[0]?.success!==true||
     !Array.isArray(data[0].results))
    stop('D1 remote read did not return one confirmed JSON result');
  return data[0].results;
}
export function readOnlyPreparedSql(sql,args=[]){
  if(typeof sql!=='string'||!/^\s*SELECT\b/i.test(sql)||sql.includes(';')||
     !Array.isArray(args)||sql.includes('--')||sql.includes('/*'))
    stop('post-migration verifier attempted a non-SELECT or multi-command SQL');
  let at=0;
  const final=sql.replace(/\?/g,()=>{
    if(at>=args.length)stop('read-only D1 bind value missing');
    const value=args[at++];
    if(typeof value==='number'&&Number.isSafeInteger(value))return String(value);
    if(typeof value==='string')return "'"+value.replaceAll("'","''")+"'";
    stop('read-only D1 bind value invalid');
  });
  if(at!==args.length)stop('extra read-only D1 bind values');
  return final;
}
function parseExactJson(output,description){
  if(typeof output!=='string')stop(description+' did not return JSON text');
  try{return JSON.parse(output.trim());}
  catch{stop(description+' returned non-JSON output; refusing unsafe assumptions');}
}
function wrangler(js,args,{inherit=false,cwd=WORK}={}){
  const run=spawnSync(process.execPath,[js,...args],{
    cwd,stdio:inherit?'inherit':'pipe',encoding:inherit?undefined:'utf8',
    timeout:inherit?600000:90000,maxBuffer:8*1024*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'}
  });
  if(run.error||run.signal||run.status!==0)
    stop('Wrangler '+args.slice(0,3).join(' ')+' stopped or result is uncertain; do not retry a remote write');
  return inherit?'':run.stdout;
}
const save=(file,record)=>writeFileSync(file,JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});

export async function ownerApprovedDRApply(pinnedWrangler){
  if(typeof pinnedWrangler!=='string'||!pinnedWrangler.trim())
    stop('explicit pinned Wrangler JS path is required');
  const js=resolve(pinnedWrangler);
  if(!existsSync(js)||!lstatSync(js).isFile())
    stop('pinned local Wrangler installation missing; no network installation authorized');
  if(!/\b4\.92\.0\b/.test(wrangler(js,['--version'],{cwd:ROOT})))
    stop('Wrangler version differs from reviewed 4.92.0; no remote operation');
  mkdirSync(OUT,{recursive:true,mode:0o700});
  if(existsSync(LOCK))stop('prior DR migration attempt recorded; do NOT retry without inspection');
  if(!existsSync(WORK))prepareIndependentD1MigrationWorkspace(TARGET,WORK);
  const verified=verifySavedIndependentD1MigrationWorkspace(TARGET,WORK);
  if(!verified.savedWorkspaceVerified||verified.reviewedSqlFiles!==26||
     verified.database_id!==DR.database_id||
     verified.remoteMigrationAttempted!==false)
    stop('saved exact 26 SQL migration files or binding do not match reviewed DR');
  const conf=join(WORK,'wrangler.json');
  const query=(args)=>parseExactJson(wrangler(js,args),args.slice(0,3).join(' '));
  const identity=requirePinnedDRProviderIdentity(query([
    'd1','list','--json','--config',conf
  ]));
  const before=readOnlyWranglerRows(query([
    'd1','execute',DR.database_name,'--remote','--json','--config',conf,
    '--command',"SELECT type,name,sql FROM sqlite_master WHERE type IN ('table','view','index','trigger') AND (name NOT LIKE 'sqlite_%' OR name='sqlite_sequence') ORDER BY type,name"
  ]));
  const empty=requirePhysicallyEmptyDRSchema(before);
  // A write may succeed and its command response may be lost. This unique
  // local lock is committed BEFORE the first possible remote modification.
  // Never automatically rerun remote migrations even if Wrangler errors.
  save(LOCK,{
    target:TARGET,name:DR.database_name,uuid:DR.database_id,
    startedAt:new Date().toISOString(),migrationCount:26,
    exactSavedSourceReviewed:true,physicalIdentity:identity,
    physicalInitialSchema:empty,attemptState:'STARTED_RESULT_UNCONFIRMED',
    ...noSecrets
  });
  wrangler(js,['d1','migrations','apply',DR.database_name,'--remote','--config',conf],
    {inherit:true});
  // Post-apply: same SOURCE-REVIEWED 26-migration SQL, trigger, index,
  // refund, Customer #, Job # and zero-record contract already exercised
  // with actual Wrangler --local, now against authenticated physical DR.
  // Reusing its NEW LIVE schema verifier does NOT contact NEW LIVE.
  let readCount=0;
  const remoteRead=async(sql,args)=>{
    const safe=readOnlyPreparedSql(sql,args);
    readCount++;
    return readOnlyWranglerRows(query([
      'd1','execute',DR.database_name,'--remote','--json','--config',conf,
      '--command',safe
    ]));
  };
  const db={prepare(sql){
    const cursor=args=>({
      bind:(...next)=>cursor(next),
      first:async()=>((await remoteRead(sql,args))[0]??null),
      all:async()=>({results:await remoteRead(sql,args)})
    });
    return cursor([]);
  }};
  const schema=await inspectNewLiveFirstJobCleanStart(db,{
    FIRE_ENV:'new-live-prelaunch',
    FIRE_JOB_NUMBERS_CANDIDATE:'owner-approved-schema-v1',
    FIRE_CUSTOMER_NUMBERS_CANDIDATE:'owner-approved-schema-v1'
  });
  if(schema.exactSourceMigrationJournalMatched!==true||
     schema.physicalFinancialIndexesMatched!==true||
     schema.reviewedNamedIndexesAndNoViewsVerified!==true||
     schema.tableRecordsAllEmpty!==true||
     schema.jobAndCustomerSequencesEmpty!==true||
     schema.firstJobNumberExpected!=='0001')
    stop('physical DR source/first-job parity verification did not pass');
  const receipt={
    target:TARGET,name:DR.database_name,uuid:DR.database_id,
    checkedAt:new Date().toISOString(),migrationCount:26,
    remoteCommandReturnedSuccess:true,
    physicalDRReadbackVerified:true,postMigrationReadQueries:readCount,
    sourceSchemaProof:schema,firstJobExpectedInCleanDR:'0001',
    ...noSecrets,
    gate4Accepted:false,gate5FullyAccepted:false,
    gate7Accepted:false,gate10Accepted:false,
    newLiveNoGo:true
  };
  save(RECEIPT,receipt);
  console.log('\nFIRE DR PHYSICAL 26-MIGRATION READBACK: CONFIRMED');
  console.log(JSON.stringify({name:DR.database_name,uuid:DR.database_id,
    migrations:26,physicalReadbackVerified:true,
    firstDRJobExpected:'0001',newLiveUntouched:true,
    gate5FullyAccepted:false},null,2));
  return receipt;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==4||process.argv[3]!=='--execute-approved-dr-only')
      stop('usage: node owner_approved_dr_d1_migration.mjs PATH_TO_PINNED_WRANGLER_JS --execute-approved-dr-only');
    await ownerApprovedDRApply(process.argv[2]);
  }catch(error){console.error(String(error.message));process.exitCode=1;}
}
