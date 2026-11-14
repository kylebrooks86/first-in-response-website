/**
 * FIRE NEW LIVE — self-contained, byte-verified physical D1 schema SOURCE.
 * Build a portable 26-SQL packet WITHOUT fetching a provider, installing,
 * running, or authorizing ANY migrations, Workers, billing or payments.
 * This is an off-Acer recovery/source custody option, NOT a deployment.
 */
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readFileSync,readdirSync,writeFileSync}
 from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareIndependentD1MigrationWorkspace,
 REVIEWED_RELEASE_D1_TARGETS} from './prepare_independent_d1_migration_workspace.mjs';
import {verifySavedIndependentD1MigrationWorkspace}
 from './verify_saved_independent_d1_migration_workspace.mjs';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS}
 from './shared/lib/new-live-migration-journal.mjs';

const TARGET='independent-live';
const LIVE=REVIEWED_RELEASE_D1_TARGETS[TARGET];
const DR=REVIEWED_RELEASE_D1_TARGETS['independent-dr'];
const SOURCE_HEAD='84556f277f188b90b59faa781c8fbf74d9ac9d69';
const PREHOST_HEAD='5ee13df420ce17bf9f1aac92413e1922acc3cee1';
const PREHOST_ZIP_SHA256='2e39ba98473db784997ce4280d8701e1cced76fa1246b14a10e0c7eeb9487223';
const stop=why=>{throw Error('FIRE NEW LIVE portable 26 SQL source BLOCKED: '+why);};
const sha=b=>createHash('sha256').update(b).digest('hex');
const ownPlainDir=p=>existsSync(p)&&lstatSync(p).isDirectory()&&!lstatSync(p).isSymbolicLink();
export function verifyNewLivePortableSchemaPacket(location){
 const out=resolve(location);
 if(!ownPlainDir(out))stop('portable source folder missing, linked or not ordinary');
 const actual=readdirSync(out).sort();
 if(JSON.stringify(actual)!==JSON.stringify(
   ['OWNER_READ_ME_FIRST.txt','new-live-schema-source','portable-schema-source-receipt.json'].sort()))
  stop('extra, missing or wrong portable package files');
 const schemaDir=join(out,'new-live-schema-source');
 const valid=verifySavedIndependentD1MigrationWorkspace(TARGET,schemaDir);
 if(!valid.sourceIntegrityVerified||!valid.savedWorkspaceVerified||
    valid.reviewedSqlFiles!==26||valid.database_id!==LIVE.database_id||
    valid.remoteMigrationAttempted!==false||
    valid.remoteMigrationAuthorized!==false)
  stop('one of 26 migration bytes, target identity, or saved source proof failed');
 const receiptPath=join(out,'portable-schema-source-receipt.json');
 const notePath=join(out,'OWNER_READ_ME_FIRST.txt');
 for(const f of [receiptPath,notePath]){
  const st=lstatSync(f);
  if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1)
   stop('linked/unsafe package evidence document');
 }
 const receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
 const origin=JSON.parse(readFileSync(join(schemaDir,'source-hashes.json'),'utf8'));
 const conf=readFileSync(join(schemaDir,'wrangler.json'));
 const note=readFileSync(notePath);
 if(receipt.kind!=='FIRE_NEW_LIVE_26_SQL_PORTABLE_SOURCE_ONLY_V1'||
    receipt.target!==TARGET||receipt.database_name!==LIVE.database_name||
    receipt.database_id!==LIVE.database_id||
    receipt.excludedDRDatabaseId!==DR.database_id||
    receipt.reviewedMigrationCount!==26||
    receipt.reviewedSQLSourceHead!==SOURCE_HEAD||
    receipt.separateWorkerPrehostHead!==PREHOST_HEAD||
    receipt.separateWorkerPrehostZipSHA256!==PREHOST_ZIP_SHA256||
    receipt.originalMigrationManifestSHA256!==sha(readFileSync(join(schemaDir,'source-hashes.json')))||
    receipt.wranglerBindingConfigSHA256!==sha(conf)||
    receipt.ownerNoticeSHA256!==sha(note)||
    receipt.remoteMigrationAuthorized!==false||
    receipt.remoteMigrationAttempted!==false||
    receipt.cloudflareContacted!==false||
    receipt.workerDeployed!==false||
    receipt.stripeContacted!==false||
    receipt.paidR2Required!==false||
    receipt.hostedNewLive26MigrationsVerified!==false||
    receipt.physicalFirstJob0001Verified!==false||
    receipt.newLiveAppAuthenticationEnabled!==false||
    receipt.newLiveDeploymentApproved!==false||
    receipt.gatesClosedByThisSourcePacket!==0||
    !Array.isArray(receipt.sqlFiles)||receipt.sqlFiles.length!==26)
  stop('one or more receipt scopes, source hashes or release locks differ');
 for(let i=0;i<EXPECTED_NEW_LIVE_D1_MIGRATIONS.length;i++){
  const row=receipt.sqlFiles[i],base=origin.migrations[i],
        p=join(schemaDir,'migrations',EXPECTED_NEW_LIVE_D1_MIGRATIONS[i]);
  if(row?.filename!==base?.filename||row.filename!==EXPECTED_NEW_LIVE_D1_MIGRATIONS[i]||
     row.sha256!==base?.sha256||row.reviewedGitBlobSha1!==base?.reviewedGitBlobSha1||
     row.sha256!==sha(readFileSync(p)))
   stop('SQL bytes/filenames/Git review order changed');
 }
 const notice=note.toString('utf8');
 if(!notice.includes('NOT AUTHORIZATION')||
    !notice.includes('26 original SQL')||
    !notice.includes('NO REMOTE COMMAND')||
    !notice.includes('Job #0001')||
    !notice.includes('NO R2'))
  stop('operator remote-write safety notice missing');
 return {status:'EXACT_26_REVIEWED_NEW_LIVE_SQL_SOURCE_CUSTODY_VERIFIED',
   database_name:LIVE.database_name,database_id:LIVE.database_id,
   sqlFiles:26,sourceReviewed:true,cloudflareContacted:false,
   schemaMigrated:false,firstJob0001Verified:false,remoteWriteApproved:false};
}
export function prepareNewLivePortableSchemaPacket(destination){
 if(typeof destination!=='string'||!destination.trim())
  stop('new absent destination required');
 const out=resolve(destination);
 if(existsSync(out))stop('refuse overwriting an earlier signed source packet');
 mkdirSync(out,{recursive:false,mode:0o700});
 const schemaDir=join(out,'new-live-schema-source');
 const source=prepareIndependentD1MigrationWorkspace(TARGET,schemaDir);
 const proof=verifySavedIndependentD1MigrationWorkspace(TARGET,schemaDir);
 if(!proof.savedWorkspaceVerified||source.migrationCount!==26)
  stop('original source workspace did not verify after physical copy');
 const note=[
  'FIRST IN RESPONSE EXTERIORS — NEW LIVE independent D1 schema custody',
  '',
  'NOT AUTHORIZATION. SOURCE-ONLY PACKAGE. NO REMOTE COMMAND was executed.',
  'These are the 26 original SQL migration files, pinned to original Git blobs.',
  'Target is EXISTING fire-fullapp-new-live-db with UUID '+LIVE.database_id+'.',
  'Do not substitute QA, STAGING, TEST or DR D1 ('+DR.database_id+').',
  'The independent Worker no-R2 source is separately stored and NOT deployed.',
  'NO R2, NO paid Cloudflare, NO Stripe activation or customer import.',
  "Job #0001 is an owner-required clean future LIVE start, NOT VERIFIED here.",
  'No app login, public route, preview route or payment processing enabled.',
  'Do NOT run Wrangler migrations apply, remote execute, create, deploy,',
  'Stripe TEST/LIVE, Git merge or any live change from this packet alone.',
  'A new exact owner authorization and immediate provider identity + empty',
  'schema verification are mandatory before any remote one-shot migration.',
  'A lost acknowledgement or timeout is NOT permission to retry a remote write.',
  'See GitHub Issue #19 and the reviewed one-shot owner installer before action.',
  ''
 ].join('\n');
 writeFileSync(join(out,'OWNER_READ_ME_FIRST.txt'),note,{flag:'wx',mode:0o600});
 const manifestBytes=readFileSync(join(schemaDir,'source-hashes.json'));
 const manifest=JSON.parse(manifestBytes);
 const receipt={
  kind:'FIRE_NEW_LIVE_26_SQL_PORTABLE_SOURCE_ONLY_V1',
  target:TARGET,database_name:LIVE.database_name,database_id:LIVE.database_id,
  excludedDRDatabaseId:DR.database_id,
  reviewedSQLSourceHead:SOURCE_HEAD,
  separateWorkerPrehostHead:PREHOST_HEAD,
  separateWorkerPrehostZipSHA256:PREHOST_ZIP_SHA256,
  reviewedMigrationCount:26,
  sqlFiles:manifest.migrations,
  originalMigrationManifestSHA256:sha(manifestBytes),
  wranglerBindingConfigSHA256:sha(readFileSync(join(schemaDir,'wrangler.json'))),
  ownerNoticeSHA256:sha(Buffer.from(note)),
  remoteMigrationAuthorized:false,remoteMigrationAttempted:false,
  cloudflareContacted:false,workerDeployed:false,stripeContacted:false,
  paidR2Required:false,hostedNewLive26MigrationsVerified:false,
  physicalFirstJob0001Verified:false,newLiveAppAuthenticationEnabled:false,
  newLiveDeploymentApproved:false,gatesClosedByThisSourcePacket:0
 };
 writeFileSync(join(out,'portable-schema-source-receipt.json'),
  JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
 return verifyNewLivePortableSchemaPacket(out);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==3)stop('usage: NEW_ABSENT_LOCAL_SOURCE_PACKET_FOLDER');
  console.log(JSON.stringify(prepareNewLivePortableSchemaPacket(process.argv[2]),null,2));
 }catch(e){console.error(String(e.message));process.exitCode=1;}
}
