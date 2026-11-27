/**
 * One-time OWNER-AUTHORIZED FIRE DR initial D1 schema installation.
 * Authorization: existing DR ONLY, after verified empty; 2026-11-13.
 * Run exclusively from owner-authenticated Acer, never CI/Work browser.
 * NO database create, QA/STAGING/NEW LIVE write, Worker deploy, Stripe,
 * R2, subscription, backup restore, Cloudflare plan or Git merge.
 */
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,lstatSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareIndependentD1MigrationWorkspace,REVIEWED_RELEASE_D1_TARGETS} from './prepare_independent_d1_migration_workspace.mjs';
import {verifySavedIndependentD1MigrationWorkspace} from './verify_saved_independent_d1_migration_workspace.mjs';
import {inspectNewLiveFirstJobCleanStart} from './shared/lib/new-live-first-job-preflight.mjs';

const TARGET='independent-dr';
const DR=REVIEWED_RELEASE_D1_TARGETS[TARGET];
const LIVE=REVIEWED_RELEASE_D1_TARGETS['independent-live'];
const ROOT=join(homedir(),'FIRE-DR-GATE5-APPROVED-20261113');
const WORKSPACE=join(ROOT,'reviewed-sql');
const ATTEMPT=join(ROOT,'ONE-SHOT-REMOTE-MIGRATION-ATTEMPT.json');
const PROOF=join(ROOT,'POST-MIGRATION-DR-READBACK.json');
const stop=message=>{throw Error('FIRE DR migration BLOCKED: '+message);};
const safeSave=(file,data)=>writeFileSync(file,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
const readJSON=(text,context)=>{
 try{return JSON.parse(text.trim());}catch{stop(context+' is not machine-readable JSON');}
};
export function requireD1Identity(list){
 if(!Array.isArray(list))stop('provider D1 list is not an array');
 const rows=list.map(item=>({
  name:typeof item?.name==='string'?item.name:null,
  uuid:typeof (item?.uuid??item?.id)==='string'?(item.uuid??item.id):null
 }));
 const dr=rows.filter(item=>item.name===DR.database_name);
 const live=rows.filter(item=>item.name===LIVE.database_name);
 if(dr.length!==1||dr[0].uuid!==DR.database_id)
  stop('wrong/missing DR physical database UUID');
 if(live.length!==1||live[0].uuid!==LIVE.database_id)
  stop('NEW LIVE UUID not independently present in the same account');
 if(rows.filter(item=>item.uuid===DR.database_id).length!==1||
    rows.filter(item=>item.uuid===LIVE.database_id).length!==1)
  stop('database UUID collision or ambiguous inventory');
 return {drName:DR.database_name,drUuid:DR.database_id,newLiveUuid:LIVE.database_id};
}
export function rowsFromD1Json(output){
 if(!Array.isArray(output)||output.length!==1||output[0]?.success!==true||
    !Array.isArray(output[0].results))stop('remote SELECT lacked one successful result');
 return output[0].results;
}
// Match only the two documented D1-owned metadata tables. A user table,
// index, view, trigger or foreign provider metadata is an immediate STOP.
// The source-backed physical first-use inspector validates these too.
const metadata={
 _cf_KV:/^CREATE\s+TABLE\s+(?:_cf_KV|"_cf_KV"|\[_cf_KV\])\s*\(\s*(?:key|"key"|\[key\])\s+TEXT\s+PRIMARY\s+KEY\s*,\s*(?:value|"value"|\[value\])\s+BLOB\s*\)\s+WITHOUT\s+ROWID\s*;?$/i,
 _cf_METADATA:/^CREATE\s+TABLE\s+(?:_cf_METADATA|"_cf_METADATA"|\[_cf_METADATA\])\s*\(\s*(?:key|"key"|\[key\])\s+INTEGER\s+PRIMARY\s+KEY\s*,\s*(?:value|"value"|\[value\])\s+BLOB\s*\)\s*;?$/i
};
export function requireCompletelyEmptyDR(schema){
 if(!Array.isArray(schema))stop('physical schema inventory not returned');
 const names=new Set();
 for(const row of schema){
  if(!row||typeof row.name!=='string'||typeof row.type!=='string'||
     typeof row.sql!=='string'||names.has(row.name))stop('unverifiable sqlite_master object');
  names.add(row.name);
  if(row.type!=='table'||!Object.hasOwn(metadata,row.name)||
     !metadata[row.name].test(row.sql))
   stop('DR contains a nonempty/unapproved schema object: '+row.name);
 }
 return {noApplicationTablesIndexesViewsOrTriggers:true,
  verifiedCloudflareMetadataOnly:true};
}
const quote=value=>{
 if(typeof value==='string')return "'"+value.replaceAll("'","''")+"'";
 if(typeof value==='number'&&Number.isSafeInteger(value))return String(value);
 stop('unsupported read-only bound value');
};
export function readOnlyBoundSql(sql,values=[]){
 if(typeof sql!=='string'||!/^\s*SELECT\b/i.test(sql)||sql.includes(';')||
    !Array.isArray(values))stop('only a single SELECT is allowed in source readback');
 let idx=0;
 const text=sql.replaceAll('?',()=>idx<values.length?quote(values[idx++]):stop('missing bind'));
 if(idx!==values.length)stop('extra bound values');
 return text;
}
function execWrangler(wrangler,args,cwd,interactive=false){
 const result=spawnSync(process.execPath,[wrangler,...args],{
  cwd,encoding:interactive?undefined:'utf8',
  stdio:interactive?'inherit':'pipe',
  timeout:interactive?600000:90000,maxBuffer:8*1024*1024,
  env:{...process.env,WRANGLER_SEND_METRICS:'false'}
 });
 if(result.error||result.signal||result.status!==0)
  stop('Wrangler '+args.slice(0,3).join(' ')+' failed or has uncertain status; NEVER auto-retry a remote migration');
 return interactive?null:result.stdout;
}
export async function executeOwnerApprovedDRMigration(installedWrangler){
 if(typeof installedWrangler!=='string'||!installedWrangler.trim())stop('installed Wrangler path required');
 const cli=resolve(installedWrangler);
 if(!existsSync(cli)||!lstatSync(cli).isFile())stop('installed Wrangler JS not found');
 if(existsSync(ATTEMPT))stop('this approval already initiated a remote migration; no replay');
 const version=execWrangler(cli,['--version'],fileURLToPath(new URL('.',import.meta.url)));
 if(!/\b4\.92\.0\b/.test(version))stop('expected reviewed Wrangler 4.92.0');
 mkdirSync(ROOT,{recursive:true,mode:0o700});
 if(!existsSync(WORKSPACE))prepareIndependentD1MigrationWorkspace(TARGET,WORKSPACE);
 const reviewed=verifySavedIndependentD1MigrationWorkspace(TARGET,WORKSPACE);
 if(!reviewed.savedWorkspaceVerified||reviewed.database_id!==DR.database_id||
    reviewed.reviewedSqlFiles!==26)stop('saved 26 SQL file identity is not verified');
 const config=join(WORKSPACE,'wrangler.json');
 const json=(args)=>readJSON(execWrangler(cli,args,WORKSPACE),args.slice(0,3).join(' '));
 const identity=requireD1Identity(json(['d1','list','--json','--config',config]));
 const select=(query)=>rowsFromD1Json(json([
  'd1','execute',DR.database_name,'--remote','--json','--config',config,'--command',query
 ]));
 const before=select("SELECT type,name,sql FROM sqlite_master WHERE type IN ('table','view','index','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type,name");
 const empty=requireCompletelyEmptyDR(before);
 // The local marker is created BEFORE the first remotely mutating command.
 // A timed-out apply may have partially committed; only read-only diagnosis
 // is permitted after that point, never an automatic repeat.
 safeSave(ATTEMPT,{
  approval:'owner, 2026-11-13, exactly one empty DR D1 26-migration apply',
  physicalTarget:identity,emptyBefore:empty,migrationFiles:26,
  attemptedAt:new Date().toISOString(),outcome:'UNCONFIRMED_UNTIL_READBACK',
  newLiveWorkerStripeR2Untouched:true
 });
 console.log('FIRE: target/UUID/empty schema/26 reviewed SQL confirmed. Starting ONE approved DR-only migration.');
 execWrangler(cli,['d1','migrations','apply',DR.database_name,'--remote','--config',config],WORKSPACE,true);
 // The full physical source-schema contract uses only SELECTs, including 26
 // migration journal rows, 36 named indexes, eight exact DDL constraints,
 // immutable triggers, zero business records and job/customer #0001.
 // Its "NEW LIVE" name is reused solely as a schema oracle on DR.
 let queryCount=0;
 const physicalRead=async(sql,values=[])=>{
  queryCount++;
  return select(readOnlyBoundSql(sql,values));
 };
 const db={prepare(sql){
  const statement=values=>({
   first:async()=>((await physicalRead(sql,values))[0]??null),
   all:async()=>({results:await physicalRead(sql,values)}),
   bind:(...args)=>statement(args)
  });
  return statement([]);
 }};
 const proof=await inspectNewLiveFirstJobCleanStart(db,{
  FIRE_ENV:'new-live-prelaunch',
  FIRE_JOB_NUMBERS_CANDIDATE:'owner-approved-schema-v1',
  FIRE_CUSTOMER_NUMBERS_CANDIDATE:'owner-approved-schema-v1'
 });
 if(!proof.tableRecordsAllEmpty||!proof.exactSourceMigrationJournalMatched||
    !proof.physicalFinancialIndexesMatched||!proof.reviewedNamedIndexesAndNoViewsVerified||
    !proof.jobAndCustomerSequencesEmpty||proof.firstJobNumberExpected!=='0001')
  stop('post-apply physical DR source schema does not match 26 migrations');
 safeSave(PROOF,{target:'independent-dr',databaseName:DR.database_name,databaseId:DR.database_id,
  applied26:true,physicallyReadBack:true,readQueries:queryCount,
  sourceSchema:proof,verifiedAt:new Date().toISOString(),
  newLiveUntouched:true,hostedWorkerDeployed:false,
  gate5FullyAccepted:false,releaseStillBlocked:true});
 console.log('FIRE_DR_26_MIGRATIONS_PHYSICALLY_VERIFIED');
 console.log('DR '+DR.database_name+' UUID '+DR.database_id+
  '; 26 source migrations + immutable customer/job/financial schema verified.');
 console.log('Evidence: '+PROOF);
 return {target:'independent-dr',verified:true,readQueries:queryCount};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==4||process.argv[3]!=='--execute-approved-dr-only')
   stop('usage: node owner_approved_dr_d1_migrate_20261113.mjs INSTALLED_WRANGLER_JS --execute-approved-dr-only');
  await executeOwnerApprovedDRMigration(process.argv[2]);
 }catch(error){console.error(String(error.message));process.exitCode=1;}
}
