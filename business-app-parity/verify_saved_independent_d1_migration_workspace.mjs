/**
 * Verify one REAL, already-saved FIRE independent D1 migration workspace.
 *
 * Strict local disk verification. Reads only; NEVER contacts Cloudflare,
 * executes SQL, applies D1 migrations, creates resources, or deploys Workers.
 * This is required again on the final saved folder immediately before any
 * independently authorized remote migration; generation-time tests alone
 * cannot establish that the owner's saved files survived unchanged.
 */
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {lstatSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {REVIEWED_RELEASE_D1_TARGETS} from './prepare_independent_d1_migration_workspace.mjs';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS} from './shared/lib/new-live-migration-journal.mjs';
import {assertReviewedIndependentD1SqlBlobs,REVIEWED_INDEPENDENT_D1_SQL_BLOBS,gitSqlBlobSha1}
 from './reviewed_independent_d1_sql_blobs.mjs';

const fail=reason=>{throw Error('FIRE SAVED independent D1 workspace BLOCKED: '+reason);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const checkedStat=(path,kind)=>{
 let stat;
 try{stat=lstatSync(path);}catch{fail('required saved '+kind+' is missing or unreadable');}
 if(stat.isSymbolicLink()||(kind==='file'?!stat.isFile():!stat.isDirectory()))
  fail('unexpected symbolic link or non-'+kind+' in saved release workspace');
 return stat;
};
const isRealFile=path=>checkedStat(path,'file');
const isRealDir=path=>checkedStat(path,'directory');
const exactList=(actual,expected)=>isDeepStrictEqual(actual.sort(),expected.slice().sort());
const readJson=path=>{isRealFile(path);return JSON.parse(readFileSync(path,'utf8'));};

export function verifySavedIndependentD1MigrationWorkspace(target,folder){
 const expected=REVIEWED_RELEASE_D1_TARGETS[target];
 if(!expected)fail('unrecognized target; must be independent-dr or independent-live');
 if(typeof folder!=='string'||!folder.trim())fail('saved workspace folder required');
 const dir=resolve(folder);
 isRealDir(dir);
 if(!exactList(readdirSync(dir),
   ['READ_ME_FIRST.txt','wrangler.json','source-hashes.json','migrations']))
  fail('missing or extra saved workspace files');
 const migrationsDir=join(dir,'migrations');
 isRealDir(migrationsDir);
 if(!exactList(readdirSync(migrationsDir),EXPECTED_NEW_LIVE_D1_MIGRATIONS))
  fail('missing, unexpected or reordered SQL migration files');
 const config=readJson(join(dir,'wrangler.json'));
 if(!isDeepStrictEqual(config,{
  d1_databases:[{
   binding:'DB',database_name:expected.database_name,
   database_id:expected.database_id,
   migrations_dir:'migrations',migrations_table:'d1_migrations'
  }]
 }))fail('saved Wrangler config does not pin approved D1; no extra R2, routes, secrets or services');
 const receipt=readJson(join(dir,'source-hashes.json'));
 const expectedKeys=['target','database_name','database_id','workerBinding',
  'migrationCount','migrationJournal','migrations','remoteMigrationAuthorized',
  'remoteMigrationAttempted','workerBindingDeployed','physicalD1SchemaVerified',
  'gate4Accepted','gate5Accepted','gate10Accepted'];
 if(!exactList(Object.keys(receipt),expectedKeys)||
    receipt.target!==target||
    receipt.database_name!==expected.database_name||
    receipt.database_id!==expected.database_id||
    receipt.workerBinding!=='DB'||
    receipt.migrationCount!==26||
    receipt.migrationJournal!=='d1_migrations'||
    receipt.remoteMigrationAuthorized!==false||
    receipt.remoteMigrationAttempted!==false||
    receipt.workerBindingDeployed!==false||
    receipt.physicalD1SchemaVerified!==false||
    receipt.gate4Accepted!==false||
    receipt.gate5Accepted!==false||
    receipt.gate10Accepted!==false||
    !Array.isArray(receipt.migrations)||receipt.migrations.length!==26)
  fail('receipt fabricated or release-approval state inconsistent');
 const files=EXPECTED_NEW_LIVE_D1_MIGRATIONS.map(name=>{
  const path=join(migrationsDir,name);
  isRealFile(path);
  return {name,bytes:readFileSync(path)};
 });
 // An attacker/operator must not be able to recalculate SHA-256 receipts for
 // modified SQL and make the migration work area appear reviewed.
 assertReviewedIndependentD1SqlBlobs(files);
 for(let i=0;i<files.length;i++){
  const row=receipt.migrations[i],file=files[i],reviewed=REVIEWED_INDEPENDENT_D1_SQL_BLOBS[i];
  if(!row||!isDeepStrictEqual(Object.keys(row).sort(),
      ['filename','sha256','reviewedGitBlobSha1'].sort())||
     row.filename!==file.name||row.sha256!==sha(file.bytes)||
     row.reviewedGitBlobSha1!==reviewed.gitBlobSha1||
     gitSqlBlobSha1(file.bytes)!==reviewed.gitBlobSha1)
    fail('saved SQL source receipt mismatch at '+file.name);
 }
 isRealFile(join(dir,'READ_ME_FIRST.txt'));
 const readme=readFileSync(join(dir,'READ_ME_FIRST.txt'),'utf8');
 if(!readme.includes('Expected database: '+expected.database_name)||
    !readme.includes('Expected physical UUID: '+expected.database_id)||
    !readme.includes('NO remote migration'))
  fail('saved release safety notice missing or target mismatch');
 return Object.freeze({
  target,database_name:expected.database_name,database_id:expected.database_id,
  reviewedSqlFiles:26,sourceIntegrityVerified:true,savedWorkspaceVerified:true,
  cloudflareContacted:false,remoteMigrationAttempted:false,
  remoteMigrationAuthorized:false,physicalD1SchemaVerified:false,
  workerDeploymentAuthorized:false,gate4Accepted:false,gate5Accepted:false,
  gate10Accepted:false
 });
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 try{
  if(process.argv.length!==4)
   fail('usage: node verify_saved_independent_d1_migration_workspace.mjs independent-dr|independent-live EXISTING_SAVED_FOLDER');
  console.log(JSON.stringify(
   verifySavedIndependentD1MigrationWorkspace(process.argv[2],process.argv[3]),null,2));
 }catch(error){console.error(String(error.message));process.exitCode=1;}
}
