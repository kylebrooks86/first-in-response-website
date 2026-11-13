/**
 * Exercise the EXACT independently reviewed FIRE 26-file D1 migration workspace
 * with the real pinned Wrangler CLI on a DISPOSABLE LOCAL D1 only.
 *
 * Security: fixed '--local', separate temporary --persist-to path, no CLI shell,
 * no credentials, no provider network, no --remote option from caller.
 * Does not touch existing QA/STAGING/DR/NEW LIVE physical resources or files.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,lstatSync,mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {prepareIndependentD1MigrationWorkspace} from './prepare_independent_d1_migration_workspace.mjs';
import {verifySavedIndependentD1MigrationWorkspace} from './verify_saved_independent_d1_migration_workspace.mjs';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS} from './shared/lib/new-live-migration-journal.mjs';
import {inspectNewLiveFirstJobCleanStart} from './shared/lib/new-live-first-job-preflight.mjs';

const fail=message=>{throw Error('FIRE actual Wrangler LOCAL D1 migration rehearsal BLOCKED: '+message);};
const target='independent-live',database='fire-fullapp-new-live-db';
function findLocalSqlite(dir){
 const found=[];
 const visit=(folder)=>{
  for(const entry of readdirSync(folder,{withFileTypes:true})){
   const pathname=join(folder,entry.name);
   if(entry.isSymbolicLink())fail('unexpected local state symlink');
   if(entry.isDirectory())visit(pathname);
   else if(entry.isFile()&&/\.sqlite$/.test(entry.name))found.push(pathname);
  }
 };
 visit(dir);
 // Wrangler can create its own local metadata SQLite alongside the D1
 // database. Identify the reviewed D1 by its exact 26-entry migration journal,
 // not by the number or order of files in the private persistence directory.
 if(found.length===0)fail('Wrangler produced no local SQLite files');
 const matches=[],inventory=[];
 for(const file of found){
  const db=new DatabaseSync(file,{readOnly:true});
  try{
   const names=db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='d1_migrations'").get().n;
   if(names===0){inventory.push('no-journal');continue;}
   const rows=db.prepare('SELECT id,name FROM d1_migrations ORDER BY id').all();
   inventory.push('journal='+rows.length);
   if(rows.length===EXPECTED_NEW_LIVE_D1_MIGRATIONS.length&&
      rows.every((r,i)=>r.id===i+1&&r.name===EXPECTED_NEW_LIVE_D1_MIGRATIONS[i]))
    matches.push(file);
  }finally{db.close();}
 }
 if(matches.length!==1)
  fail('expected exactly one local D1 with all 26 reviewed migrations; observed '+inventory.join(','));
 return matches[0];
}
function adaptSqlite(db){
 return {prepare(sql){
  // Source-reviewed fixed SELECTs only; this adapter issues no writes.
  if(typeof sql!=='string'||!/^\s*SELECT\b/i.test(sql))
   fail('preflight attempted a non-SELECT statement');
  const statement=db.prepare(sql);
  return {
   first:async()=>statement.get()??null,
   all:async()=>({results:statement.all()}),
   bind(...args){return {
    first:async()=>statement.get(...args)??null,
    all:async()=>({results:statement.all(...args)})
   };}
  };
 }};
}
export async function rehearseRealWranglerLocalD1Migrations(wranglerBinary){
 if(typeof wranglerBinary!=='string'||!wranglerBinary.trim()||
    !existsSync(wranglerBinary)||!lstatSync(wranglerBinary).isFile())
  fail('explicit installed pinned Wrangler CLI file required');
 const temp=mkdtempSync(join(tmpdir(),'fire-real-wrangler-local-d1-'));
 const workspace=join(temp,'reviewed-workspace');
 const persistence=join(temp,'separate-local-state');
 try{
  prepareIndependentD1MigrationWorkspace(target,workspace);
  const check=verifySavedIndependentD1MigrationWorkspace(target,workspace);
  assert.equal(check.savedWorkspaceVerified,true);
  assert.equal(check.remoteMigrationAuthorized,false);
  const config=join(workspace,'wrangler.json');
  const args=[
   resolve(wranglerBinary),'d1','migrations','apply',database,
   '--local','--persist-to',persistence,'--config',config
  ];
  const run=spawnSync(process.execPath,args,{
   cwd:workspace,encoding:'utf8',timeout:180000,
   maxBuffer:8*1024*1024,
   env:{
    PATH:process.env.PATH??'',
    HOME:process.env.HOME??'',
    CI:'true',CLOUDFLARE_CF_FETCH_ENABLED:'false',
    WRANGLER_SEND_METRICS:'false'
   }
  });
  if(run.error)fail('Wrangler local execution did not complete: '+run.error.message);
  if(run.status!==0)
   fail('Wrangler --local apply failed (no remote action): '+
    String(run.stdout??'').slice(-2500)+' '+String(run.stderr??'').slice(-2000));
  const sqliteFile=findLocalSqlite(persistence);
  const db=new DatabaseSync(sqliteFile,{readOnly:true});
  try{
   const rows=db.prepare('SELECT id,name FROM d1_migrations ORDER BY id').all();
   assert.equal(rows.length,26);
   assert.deepEqual(rows.map(r=>String(r.name)),EXPECTED_NEW_LIVE_D1_MIGRATIONS);
   // The D1 owner-login/financial/immutable-numbering pre-activation verifier
   // reads the ACTUAL Wrangler-migrated SQLite, not a hand-crafted mock.
   const proof=await inspectNewLiveFirstJobCleanStart(adaptSqlite(db),{
    FIRE_ENV:'new-live-prelaunch',
    FIRE_JOB_NUMBERS_CANDIDATE:'owner-approved-schema-v1',
    FIRE_CUSTOMER_NUMBERS_CANDIDATE:'owner-approved-schema-v1'
   });
   assert.equal(proof.firstJobNumberExpected,'0001');
   assert.equal(proof.tableRecordsAllEmpty,true);
   assert.equal(proof.exactSourceMigrationJournalMatched,true);
   assert.equal(proof.physicalFinancialIndexesMatched,true);
   assert.equal(proof.jobAndCustomerSequencesEmpty,true);
   assert.equal(proof.ownerApprovedRelease,false);
   assert.equal(proof.physicalD1IdentityVerified,false);
   const integrity=db.prepare('PRAGMA integrity_check').get();
   assert.equal(integrity.integrity_check,'ok');
   return Object.freeze({
    migrationCount:rows.length,
    all26ReviewedNames:true,
    immutableNumberingAndFinancialIndexesVerified:true,
    freshFirstJobNumberExpected:'0001',
    sqliteIntegrity:'ok',
    actualWranglerLocalApply:true,
    remoteDatabaseContacted:false,cloudflareD1Written:false,
    ownerApprovedRelease:false,gate5Accepted:false
   });
  }finally{db.close();}
 }finally{
  rmSync(temp,{recursive:true,force:true});
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==3)fail('usage: node --experimental-sqlite test_real_wrangler_independent_d1_local.mjs INSTALLED_WRANGLER_CLI_JS');
  console.log(JSON.stringify(await rehearseRealWranglerLocalD1Migrations(process.argv[2])));
 }catch(error){console.error(error.stack??String(error));process.exitCode=1;}
}
