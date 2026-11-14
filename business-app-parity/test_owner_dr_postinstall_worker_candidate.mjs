/** FIRE DR completed physical D1 receipt -> inert Worker manifest. OFFLINE ONLY. */
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareIndependentD1MigrationWorkspace} from './prepare_independent_d1_migration_workspace.mjs';
import {reviewOwnerDRPostinstallReceipt,reviewOwnerDRPostinstallFiles}
 from './review_owner_dr_postinstall_worker_candidate.mjs';

const dir=mkdtempSync(join(tmpdir(),'fire-dr-accepted-owner-postinstall-'));
const owner=join(dir,'owner'),saved=join(owner,'pinned-26-migrations-canonical-v2');
const DR_ID='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';
let checks=0;
const check=(ok,msg)=>{assert.ok(ok,msg);checks++;};
const original={
 name:'fire-fullapp-dr',workers_dev:true,
 secrets:{required:['FIRE_DR_PASSWORD_HASH','FIRE_DR_SESSION_SECRET']},
 vars:{FIRE_ENV:'isolated-dr',
  SITE_ORIGIN:'https://fire-fullapp-dr.kyle-bfc.workers.dev',
  FIRE_DR_AUTH_ENABLED:'blocked'},
 d1_databases:[{binding:'DB',database_name:'fire-fullapp-dr-db',
  database_id:'00000000-0000-4000-8000-000000000000'}],
 r2_buckets:[]
};
const lock={
 target:'independent-dr',name:'fire-fullapp-dr-db',uuid:DR_ID,
 startedAt:'2026-11-14T03:21:00.000Z',migrationCount:26,
 exactSavedSourceReviewed:true,attemptState:'STARTED_RESULT_UNCONFIRMED',
 physicalIdentity:{
  target:'independent-dr',name:'fire-fullapp-dr-db',uuid:DR_ID,
  separateLiveName:'fire-fullapp-new-live-db',
  readOnlyIdentityVerified:true,method:'two-independent-d1-info'
 },
 physicalInitialSchema:{
  noApplicationTables:true,noMigrationsApplied:true,
  noUnreviewedObjects:true,providerMetadataObjects:1
 },
 newLiveUntouched:true,qaUntouched:true,stagingUntouched:true,
 noPaidR2:true,noWorkerDeploy:true,noStripeOperation:true
};
const receipt={
 target:'independent-dr',name:'fire-fullapp-dr-db',uuid:DR_ID,
 checkedAt:'2026-11-14T03:26:00.000Z',migrationCount:26,
 remoteCommandReturnedSuccess:true,physicalDRReadbackVerified:true,
 postMigrationReadQueries:22,firstJobExpectedInCleanDR:'0001',
 sourceSchemaProof:{
  target:'independent-live',
  firstJobNumberExpected:'0001',exactSourceMigrationJournalMatched:true,
  physicalFinancialIndexesMatched:true,
  reviewedNamedIndexesAndNoViewsVerified:true,
  tableRecordsAllEmpty:true,jobAndCustomerSequencesEmpty:true,
  requiredImmutabilityTriggersPresent:true
 },
 newLiveUntouched:true,qaUntouched:true,stagingUntouched:true,
 noPaidR2:true,noWorkerDeploy:true,noStripeOperation:true,
 gate4Accepted:false,gate5FullyAccepted:false,
 gate7Accepted:false,gate10Accepted:false,newLiveNoGo:true
};
const review=(changes={})=>reviewOwnerDRPostinstallReceipt({
 lock:changes.lock??lock,
 receipt:changes.receipt??receipt,
 compiledDR:changes.compiled??original,
 workspace:saved
});
const reject=(changes,label)=>{
 assert.throws(()=>review(changes),/BLOCKED/);
 checks++;
};
try{
 mkdirSync(owner);
 prepareIndependentD1MigrationWorkspace('independent-dr',saved);
 const success=review();
 check(success.config.name==='fire-fullapp-dr'&&success.config.workers_dev===true,
  'Review creates correct independent inactive DR Worker, not NEW LIVE');
 check(success.config.d1_databases.length===1&&
  success.config.d1_databases[0].database_id===DR_ID,
  'Prepared DR Worker can bind only already-installed exact physical DR D1');
 check(success.config.vars.FIRE_DR_AUTH_ENABLED==='blocked'&&
  success.config.vars.FIRE_PHOTO_STORAGE_MODE==='owner-device-zip'&&
  success.config.r2_buckets.length===0,
  'No unapproved owner login, R2, cloud photo storage or paid binding');
 check(success.sourceEvidence.physicalDRSchemaReceiptAcceptedFromOwner===true&&
  success.sourceEvidence.physicalD1SchemaReadbackFromPriorOwnerRun===true&&
  success.sourceEvidence.drWorkerDeployed===false&&
  success.sourceEvidence.gate5FullyAccepted===false&&
  success.sourceEvidence.newLiveNoGo===true,
  'Distinguish accepted past DR schema readback from undeployed Worker and open gate');
 check(success.sourceEvidence.ownerApprovedDeployment===false&&
  success.sourceEvidence.cloudflareAccessVerified===false&&
  success.sourceEvidence.cloudflareProviderContactedByThisTool===false,
  'Owner migration approval is not reused as Worker deploy/auth approval');
 check(original.d1_databases[0].database_id==='00000000-0000-4000-8000-000000000000',
  'Underlying compiled placeholder manifest is not mutated');
 // Only the exact owner Acer terminal-saved receipts from the prior
 // one-shot remote install may unlock an inert source-only manifest.
 for(const [key,value] of [
  ['migrationCount',25],['migrationCount','26'],
  ['remoteCommandReturnedSuccess',false],
  ['physicalDRReadbackVerified',false],
  ['firstJobExpectedInCleanDR','0002'],
  ['newLiveNoGo',false],['newLiveUntouched',false],
  ['noPaidR2',false],['noWorkerDeploy',false],
  ['gate5FullyAccepted',true],['postMigrationReadQueries',0],
  ['uuid','0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662'],
  ['name','fire-fullapp-new-live-db']
 ]){
  reject({receipt:{...receipt,[key]:value}},
   'Reject false / inconsistent receipt field '+key);
 }
 for(const key of [
  'exactSourceMigrationJournalMatched','physicalFinancialIndexesMatched',
  'reviewedNamedIndexesAndNoViewsVerified','tableRecordsAllEmpty',
  'jobAndCustomerSequencesEmpty','requiredImmutabilityTriggersPresent'
 ]){
  reject({receipt:{...receipt,sourceSchemaProof:{
    ...receipt.sourceSchemaProof,[key]:false
   }}},'Missing physical proof '+key+' blocks Worker handoff');
 }
 reject({receipt:{...receipt,sourceSchemaProof:{...receipt.sourceSchemaProof,
  firstJobNumberExpected:'0002'}}},'Physical first-job numbering must remain #0001');
 reject({receipt:{...receipt,checkedAt:'2026-11-14T02:00:00.000Z'}},
  'Cannot accept a schema receipt dated before the remote attempt');
 for(const [key,value] of [
  ['target','independent-live'],['migrationCount',25],
  ['attemptState','not-started'],['exactSavedSourceReviewed',false],
  ['newLiveUntouched',false],['noStripeOperation',false]
 ]){
  reject({lock:{...lock,[key]:value}},'One-shot initial source scope changed');
 }
 reject({lock:{...lock,physicalIdentity:{...lock.physicalIdentity,
   uuid:'0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662'}}},
  'DR identity cannot point to LIVE');
 reject({lock:{...lock,physicalIdentity:{...lock.physicalIdentity,
   readOnlyIdentityVerified:false}}},'No remote identity proof');
 reject({lock:{...lock,physicalInitialSchema:{...lock.physicalInitialSchema,
   noApplicationTables:false}}},'DR initial schema must have been physically empty');
 reject({compiled:{...original,d1_databases:[{...original.d1_databases[0],
   database_id:DR_ID}]}},'Cannot accept a source already bound to a hosted D1');
 reject({compiled:{...original,r2_buckets:[{binding:'PHOTOS',bucket_name:'not-approved'}]}},
   'No cloud photo subscription');
 reject({compiled:{...original,vars:{...original.vars,FIRE_DR_AUTH_ENABLED:'owner-approved'}}},
   'No silent DR owner authentication enablement');
 reject({compiled:{...original,name:'fire-fullapp-new-live'}},
   'No DR/LIVE Worker impersonation');

 // Real CLI paths include the already saved same owner receipt, migration
 // source workspace and actual placeholder config. No Wrangler invocation.
 const compiled=join(dir,'compiled-inert-dr.json');
 const destination=join(dir,'reviewed-post-schema-dr.json');
 writeFileSync(join(owner,'remote-one-shot-attempt.json'),JSON.stringify(lock));
 writeFileSync(join(owner,'dr-physical-schema-receipt.json'),JSON.stringify(receipt));
 writeFileSync(compiled,JSON.stringify(original));
 const result=reviewOwnerDRPostinstallFiles(owner,compiled,destination);
 const written=JSON.parse(readFileSync(destination,'utf8'));
 check(result.providerContacted===false&&result.workerDeployed===false&&
  result.remoteMigrationReplayed===false&&existsSync(destination),
  'Actual owner CLI creates only local candidate, no D1/Worker provider operation');
 check(written.sourceEvidence.existingOwnerReceiptSha256?.length===64&&
  written.sourceEvidence.existingOwnerAttemptSha256?.length===64&&
  written.sourceEvidence.reviewedInertCompiledManifestSha256?.length===64,
  'Output records exact existing owner evidence byte hashes, no raw secrets');
 check(written.config.vars.FIRE_DR_AUTH_ENABLED==='blocked'&&
  written.sourceEvidence.gate5FullyAccepted===false,
  'Disk output remains inert; successful source handoff never claims release gate');
 assert.throws(()=>reviewOwnerDRPostinstallFiles(owner,compiled,destination),/BLOCKED/);
 checks++;
 const unexpected=join(owner,'new-artifact.json');
 assert.throws(()=>reviewOwnerDRPostinstallFiles(owner,compiled,unexpected),/BLOCKED/);
 checks++;
 writeFileSync(join(owner,'remote-one-shot-attempt.json'),
  JSON.stringify({...lock,attemptState:'FAILED_AND_UNCERTAIN'}));
 assert.throws(()=>reviewOwnerDRPostinstallFiles(owner,compiled,join(dir,'never.json')),/BLOCKED/);
 checks++;
 const migration=join(saved,'migrations','0000_wise_namora.sql');
 writeFileSync(migration,Buffer.concat([readFileSync(migration),Buffer.from('-- unreviewed\n')]));
 reject({},'Tampered prior migration SQL must never be treated as reviewed first install');
 console.log('PASS '+checks+'/'+checks+
  ' ACTUAL owner DR completed-migration receipt -> inert no-R2 DR Worker candidate and tamper/refusal fixtures; no Cloudflare calls.');
}finally{rmSync(dir,{recursive:true,force:true});}
