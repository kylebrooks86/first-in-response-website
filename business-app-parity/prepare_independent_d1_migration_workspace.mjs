/**
 * Assemble the exact reviewed 26 FIRE independent D1 migrations for Wrangler.
 *
 * LOCAL FILE CREATION ONLY. No network, Cloudflare calls, migrations, Worker
 * changes, bindings, deployment, authentication or authorization is performed.
 * Requires a new, target-scoped owner approval before any remote migration.
 */
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS} from './shared/lib/new-live-migration-journal.mjs';
import {assertReviewedIndependentD1SqlBlobs,canonicalReviewedSqlBytes,REVIEWED_INDEPENDENT_D1_SQL_BLOBS}
 from './reviewed_independent_d1_sql_blobs.mjs';

const ROOT=fileURLToPath(new URL('.',import.meta.url));
const TARGETS=Object.freeze({
 'independent-dr':{
  database_name:'fire-fullapp-dr-db',
  database_id:'5e55c5b7-cd67-4c8f-a52e-40f71b5d3145'
 },
 'independent-live':{
  database_name:'fire-fullapp-new-live-db',
  database_id:'0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662'
 }
});
const fail=reason=>{throw Error('FIRE independent D1 migration workspace BLOCKED: '+reason)};
export const REVIEWED_RELEASE_D1_TARGETS=TARGETS;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const migrationName=name=>/^\d{4}_[a-z0-9_]+\.sql$/.test(name);

export function prepareIndependentD1MigrationWorkspace(target,outputDir){
 const resource=TARGETS[target];
 if(!resource)fail('only reviewed independent-dr or independent-live is allowed');
 if(typeof outputDir!=='string'||!outputDir.trim())fail('explicit new local output directory required');
 const out=resolve(outputDir);
 if(existsSync(out))fail('output exists; refuse overwrite or reuse');
 const expected=EXPECTED_NEW_LIVE_D1_MIGRATIONS;
 if(expected.length!==26||new Set(expected).size!==26||
    expected.some((name,i)=>!migrationName(name)||Number(name.slice(0,4))!==i))
  fail('source migration manifest is not exactly ordered 0000 through 0025');
 const baseDir=join(ROOT,'adapters','doomsday','drizzle');
 const baseFiles=readdirSync(baseDir).filter(name=>name.endsWith('.sql')).sort();
 if(baseFiles.length!==25||baseFiles.some((name,i)=>name!==expected[i]))
  fail('reviewed 25 base migration files are missing, unexpected or out of order');
 const finalName=expected[25],addonDir=join(ROOT,'adapters',target,'drizzle');
 const addonFiles=readdirSync(addonDir).filter(name=>name.endsWith('.sql')).sort();
 if(addonFiles.length!==1||addonFiles[0]!==finalName)
  fail('target must have only its reviewed independent numbered migration 0025');
 // A Windows Acer checkout can convert canonical Git LF source files to
 // CRLF. Compare ONLY the original exact reviewed Git blob identities after
 // newline normalization, never trust edited SQL or raw worktree bytes.
 const dr=canonicalReviewedSqlBytes(finalName,
  readFileSync(join(ROOT,'adapters','independent-dr','drizzle',finalName)));
 const live=canonicalReviewedSqlBytes(finalName,
  readFileSync(join(ROOT,'adapters','independent-live','drizzle',finalName)));
 if(!dr.equals(live))fail('DR and NEW LIVE permanent-number migration content has diverged');
 const files=expected.map((name,i)=>({
  name,
  bytes:canonicalReviewedSqlBytes(name,readFileSync(join(i===25?addonDir:baseDir,name)))
 }));
 // A new, unreviewed SQL edit must fail BEFORE the workspace is created.
 // Matching filenames or matching DR/LIVE copies alone cannot authorize it.
 assertReviewedIndependentD1SqlBlobs(files);
 const config={
  d1_databases:[{
   binding:'DB',database_name:resource.database_name,
   database_id:resource.database_id,
   migrations_dir:'migrations',
   migrations_table:'d1_migrations'
  }]
 };
 const manifest={
  target,database_name:resource.database_name,database_id:resource.database_id,
  workerBinding:'DB',migrationCount:26,
  migrationJournal:'d1_migrations',migrations:files.map(f=>({
   filename:f.name,sha256:hash(f.bytes),
   reviewedGitBlobSha1:REVIEWED_INDEPENDENT_D1_SQL_BLOBS[files.indexOf(f)].gitBlobSha1
  })),
  remoteMigrationAuthorized:false,remoteMigrationAttempted:false,
  workerBindingDeployed:false,physicalD1SchemaVerified:false,
  gate4Accepted:false,gate5Accepted:false,gate10Accepted:false
 };
 // Assemble a brand-new, dedicated workspace. NEVER touch the owner’s
 // existing Wrangler project/config or the source migration directories.
 mkdirSync(out,{recursive:false,mode:0o700});
 mkdirSync(join(out,'migrations'),{mode:0o700});
 for(const file of files)
  writeFileSync(join(out,'migrations',file.name),file.bytes,{flag:'wx',mode:0o600});
 writeFileSync(join(out,'wrangler.json'),JSON.stringify(config,null,2)+'\n',
  {flag:'wx',mode:0o600});
 writeFileSync(join(out,'source-hashes.json'),JSON.stringify(manifest,null,2)+'\n',
  {flag:'wx',mode:0o600});
 writeFileSync(join(out,'READ_ME_FIRST.txt'),
  'FIRE '+target+' independent D1: LOCAL migration workspace ONLY.\n'+
  'Expected database: '+resource.database_name+'\n'+
  'Expected physical UUID: '+resource.database_id+'\n'+
  'Exactly 26 ordered migration files; config uses DB and migrations_dir=migrations.\n'+
  'NO remote migration, schema inspection, Worker binding or deployment has occurred.\n'+
  'DO NOT run Wrangler remote apply, execute, or create commands without a NEW\n'+
  'exact target-scoped owner authorization and independently confirmed empty target.\n'+
  'Do not substitute QA/STAGING/Stripe TEST/DR for NEW LIVE or enable R2/billing.\n',
  {flag:'wx',mode:0o600});
 return Object.freeze({
  target,database_name:resource.database_name,database_id:resource.database_id,
  migrationCount:26,sourceHashes:manifest.migrations,
  localWorkspacePrepared:true,remoteOperationAttempted:false,
  remoteMigrationAuthorized:false,providerSchemaVerified:false,
  workerDeploymentAuthorized:false
 });
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 try{
  if(process.argv.length!==4)fail('usage: node prepare_independent_d1_migration_workspace.mjs independent-dr|independent-live NEW_EMPTY_DIRECTORY');
  const result=prepareIndependentD1MigrationWorkspace(process.argv[2],process.argv[3]);
  console.log(JSON.stringify({
   target:result.target,database_name:result.database_name,
   database_id:result.database_id,migrationCount:result.migrationCount,
   localWorkspacePrepared:true,remoteOperationAttempted:false,
   remoteMigrationAuthorized:false,providerSchemaVerified:false,
   workerDeploymentAuthorized:false
  },null,2));
 }catch(error){console.error(String(error.message));process.exitCode=1;}
}
