/**
 * FIRE owner DR: consume the ALREADY COMPLETED one-shot physical D1 migration
 * receipt without doing, offering, or replaying any Cloudflare operation.
 *
 * The prior DR migration is permanent history. This prepares a strictly inert
 * source-only Worker manifest (AUTH BLOCKED; NO R2; NO deployment) so later
 * release steps cannot mistake an old signed-off SQL check for authorization
 * to recreate DR or publish NEW LIVE.
 *
 * CLI: node review_owner_dr_postinstall_worker_candidate.mjs
 *      EXISTING_OWNER_DR_RECEIPTS_DIRECTORY
 *      EXACT_BUILT_INERT_DR_WRANGLER_JSON
 *      NEW_OUTPUT_JSON_FILE
 *
 * No network, no Wrangler, no local/remote schema write, no Stripe/Worker/R2.
 */
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifySavedIndependentD1MigrationWorkspace} from './verify_saved_independent_d1_migration_workspace.mjs';
import {prepareReviewedIndependentManifest} from './prepare_new_independent_release_manifest.mjs';

const stop=reason=>{throw Error('FIRE DR POST-INSTALL BLOCKED: '+reason);};
const EXPECTED_DB='fire-fullapp-dr-db';
const EXPECTED_ID='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';
const EXPECTED_LIVE='fire-fullapp-new-live-db';
const EXACT_WORKSPACE='pinned-26-migrations-canonical-v2';
const RECEIPT='dr-physical-schema-receipt.json';
const LOCK='remote-one-shot-attempt.json';
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
const sha256=raw=>createHash('sha256').update(raw).digest('hex');
const validDate=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(s);
const requiredTrue=(v,keys,label)=>{
 if(!v||typeof v!=='object'||Array.isArray(v)||
    keys.some(key=>v[key]!==true))stop(label+' required truth values missing');
};
const requiredFalse=(v,keys,label)=>{
 if(!v||typeof v!=='object'||Array.isArray(v)||
    keys.some(key=>v[key]!==false))stop(label+' required false values missing');
};
const exactTarget=(v,label)=>{
 if(!v||typeof v!=='object'||Array.isArray(v)||
    v.target!=='independent-dr'||v.name!==EXPECTED_DB||v.uuid!==EXPECTED_ID)
  stop(label+' DR identity/UUID mismatch');
};
export function reviewOwnerDRPostinstallReceipt({lock,receipt,workspace,compiledDR}){
 // Physical provider readback was accepted from owner's Acer; this LOCAL
 // document review cannot re-attest Cloudflare or prove a Worker deployment.
 exactTarget(lock,'one-shot lock');
 exactTarget(receipt,'successful physical receipt');
 if(!validDate(lock.startedAt)||!validDate(receipt.checkedAt)||
    Date.parse(receipt.checkedAt)<Date.parse(lock.startedAt))
  stop('one-shot attempt and successful physical receipt timeline invalid');
 if(lock.attemptState!=='STARTED_RESULT_UNCONFIRMED'||
    lock.migrationCount!==26||lock.exactSavedSourceReviewed!==true||
    receipt.migrationCount!==26||
    receipt.remoteCommandReturnedSuccess!==true||
    receipt.physicalDRReadbackVerified!==true||
    !Number.isSafeInteger(receipt.postMigrationReadQueries)||
    receipt.postMigrationReadQueries<1||
    receipt.firstJobExpectedInCleanDR!=='0001'||
    receipt.newLiveNoGo!==true)
  stop('owner one-shot migration receipt incomplete or not physically verified');
 requiredTrue(lock,['newLiveUntouched','qaUntouched','stagingUntouched',
  'noPaidR2','noWorkerDeploy','noStripeOperation'],'one-shot immutable scope');
 requiredTrue(receipt,['newLiveUntouched','qaUntouched','stagingUntouched',
  'noPaidR2','noWorkerDeploy','noStripeOperation'],'physical receipt immutable scope');
 requiredFalse(receipt,['gate4Accepted','gate5FullyAccepted','gate7Accepted',
  'gate10Accepted'],'provider gate closure must remain explicit');
 const identity=lock.physicalIdentity;
 if(!identity||identity.target!=='independent-dr'||
    identity.name!==EXPECTED_DB||identity.uuid!==EXPECTED_ID||
    identity.separateLiveName!==EXPECTED_LIVE||
    identity.readOnlyIdentityVerified!==true||
    identity.method!=='two-independent-d1-info')
  stop('physical owner DR and separate NEW LIVE identity proof not retained');
 const initial=lock.physicalInitialSchema;
 requiredTrue(initial,['noApplicationTables','noMigrationsApplied',
   'noUnreviewedObjects'],'original empty DR');
 if(!Number.isSafeInteger(initial.providerMetadataObjects)||
    initial.providerMetadataObjects<0||initial.providerMetadataObjects>2)
  stop('physical first-use provider-owned schema object count invalid');
 const schema=receipt.sourceSchemaProof;
 if(!schema||typeof schema!=='object'||Array.isArray(schema)||
    schema.firstJobNumberExpected!=='0001')
  stop('actual DR post-migration numbering proof missing');
 requiredTrue(schema,['exactSourceMigrationJournalMatched',
  'physicalFinancialIndexesMatched','reviewedNamedIndexesAndNoViewsVerified',
  'tableRecordsAllEmpty','jobAndCustomerSequencesEmpty',
  'requiredImmutabilityTriggersPresent'],'actual DR schema/journal/finance/empty-state proof');
 if(typeof workspace!=='string'||!workspace)stop('existing canonical saved SQL path required');
 const verified=verifySavedIndependentD1MigrationWorkspace('independent-dr',workspace);
 if(!verified.sourceIntegrityVerified||!verified.savedWorkspaceVerified||
    verified.reviewedSqlFiles!==26||verified.database_id!==EXPECTED_ID||
    verified.remoteMigrationAttempted!==false)
  stop('canonical saved SQL source receipt differs from reviewed 26-file DR');
 if(!compiledDR||typeof compiledDR!=='object'||Array.isArray(compiledDR))
  stop('actual inert compiled DR Worker config required');
 const review=prepareReviewedIndependentManifest('independent-dr',compiledDR,{
  databaseId:EXPECTED_ID,
  photoStorageMode:'owner-device-zip',
  resourceAttestation:'owner-checked-independent-dr',
  enableAuth:false
 });
 const cfg=review.config;
 if(cfg.name!=='fire-fullapp-dr'||cfg.workers_dev!==true||
    cfg.d1_databases.length!==1||
    cfg.d1_databases[0].database_id!==EXPECTED_ID||
    cfg.d1_databases[0].database_name!==EXPECTED_DB||
    cfg.vars.FIRE_ENV!=='isolated-dr'||
    cfg.vars.FIRE_DR_AUTH_ENABLED!=='blocked'||
    cfg.vars.FIRE_PHOTO_STORAGE_MODE!=='owner-device-zip'||
    cfg.r2_buckets.length!==0||
    review.evidence.ownerApprovedDeployment!==false||
    review.evidence.remoteOperationAttempted!==false)
  stop('compiled DR Worker candidate violates safe inactive no-R2 scope');
 return Object.freeze({
  config:cfg,
  sourceEvidence:{
    state:'DR_PHYSICAL_SCHEMA_ACCEPTED__WORKER_NOT_DEPLOYED',
    physicalDRSchemaReceiptAcceptedFromOwner:true,
    physicalDatabase:EXPECTED_DB,
    databaseId:EXPECTED_ID,
    reviewedMigrationCount:26,
    physicalD1SchemaReadbackFromPriorOwnerRun:true,
    originalEmptyPhysicalDRProof:true,
    expectedFirstDRJob:'0001',
    newLiveSchemaDeploymentApproved:false,
    ownerAuthenticationEnabled:false,
    drWorkerDeployed:false,
    cloudflareProviderContactedByThisTool:false,
    remoteMigrationReplayed:false,
    ownerApprovedDeployment:false,
    cloudflareAccessVerified:false,
    independentPhotoRestoreVerified:false,
    noR2SubscriptionOrBinding:true,
    noStripeWrite:true,
    gate4Accepted:false,gate5FullyAccepted:false,gate6Accepted:false,
    gate7Accepted:false,gate9Accepted:false,gate10Accepted:false,
    newLiveNoGo:true
  }
 });
}
function readOwnerFile(p){
 if(!existsSync(p)||!lstatSync(p).isFile()||lstatSync(p).isSymbolicLink())
  stop('existing plain owner evidence file missing, redirected or not regular');
 try{return {value:JSON.parse(readFileSync(p,'utf8')),sha256:sha256(readFileSync(p))};}
 catch{stop('owner evidence JSON invalid');}
}
export function reviewOwnerDRPostinstallFiles(ownerDir,compiledPath,output){
 if(typeof ownerDir!=='string'||!ownerDir||
    typeof compiledPath!=='string'||!compiledPath||
    typeof output!=='string'||!output)stop('three explicit file paths required');
 const directory=resolve(ownerDir),source=resolve(compiledPath),destination=resolve(output);
 if(!existsSync(directory)||!lstatSync(directory).isDirectory()||
    lstatSync(directory).isSymbolicLink())
  stop('owner source evidence directory missing or linked');
 if(existsSync(destination)||destination===source||destination.startsWith(directory+'/')||
    destination.startsWith(directory+'\\'))
  stop('new distinct output only; never overwrite earlier owner evidence');
 const lock=readOwnerFile(join(directory,LOCK)),receipt=readOwnerFile(join(directory,RECEIPT));
 const compiled=readOwnerFile(source);
 const workspace=join(directory,EXACT_WORKSPACE);
 const review=reviewOwnerDRPostinstallReceipt({
  lock:lock.value,receipt:receipt.value,workspace,compiledDR:compiled.value
 });
 const report={...review,sourceEvidence:{
  ...review.sourceEvidence,
  existingOwnerReceiptSha256:receipt.sha256,
  existingOwnerAttemptSha256:lock.sha256,
  reviewedInertCompiledManifestSha256:compiled.sha256
 }};
 if(!existsSync(dirname(destination)))stop('output parent folder must already exist');
 writeFileSync(destination,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 return {status:report.sourceEvidence.state,output:destination,
  providerContacted:false,workerDeployed:false,remoteMigrationReplayed:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==5)
   stop('usage: node review_owner_dr_postinstall_worker_candidate.mjs EXISTING_OWNER_RECEIPTS_DIR EXACT_BUILT_INERT_DR_WRANGLER_JSON NEW_OUTPUT_JSON');
  const result=reviewOwnerDRPostinstallFiles(...process.argv.slice(2));
  console.log('FIRE DR post-schema owner receipt + inert Worker candidate: REVIEWED, NOT DEPLOYED');
  console.log(JSON.stringify(result,null,2));
 }catch(e){console.error(String(e.message));process.exitCode=1;}
}
