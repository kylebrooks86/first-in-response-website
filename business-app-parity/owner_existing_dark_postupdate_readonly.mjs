/**
 * FIRE existing DARK DR / NEW LIVE — READ ONLY post-code-update reconciliation.
 *
 * Unlike historical first-create and pre-update version guards, this reads a
 * NEW serving version only if a durable local update attempt lock exists.
 *
 * OFFLINE default:
 *   node owner_existing_dark_postupdate_readonly.mjs dr
 * OWNER ACER AFTER A SEPARATELY APPROVED CODE UPDATE:
 *   node owner_existing_dark_postupdate_readonly.mjs --capture dr EXPECTED_NEW_VERSION_UUID
 * OWNER ACER AFTER AN INTERRUPTED/UNCERTAIN UPDATE (READ ONLY, no retry):
 *   node owner_existing_dark_postupdate_readonly.mjs --reconcile dr
 *
 * The optional expected version must come from the original owner CLI result.
 * A changed version without that exact match is UNATTRIBUTED and cannot
 * establish which source is served. NO provider writes, SQL, login, new Worker,
 * Stripe, R2, Access, DNS, routing, migration or release approval.
 */
import {existsSync,readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {homedir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {TARGETS} from './owner_existing_dark_code_update_once_approved.mjs';
import {verifyCurrentDarkHostedEvidence} from './owner_current_dark_postcreate_readonly.mjs';
const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
const SOURCE='15bd714c435a585f695ed7166cf06d2c31ea1a8e';
const stop=s=>{throw Error('FIRE DARK POSTUPDATE READONLY STOP: '+s)};
const uuid=s=>typeof s==='string'&&
 /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(s);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const parse=(reply,label)=>{
 if(!reply||reply.code!==0||typeof reply.stdout!=='string'||reply.stdout.length>1000000)
  stop(label+' provider metadata command failed');
 try{return JSON.parse(reply.stdout.trim())}catch{stop(label+' metadata is not standalone JSON')}
};
const workspace=target=>join(homedir(),'Documents',
 'FIRE-EXISTING-DARK-UPDATE-'+target.toUpperCase()+'-'+SOURCE.slice(0,8));

export function verifyExistingDarkAttempt(target,record){
 const spec=TARGETS[target];
 if(!spec||!obj(record)||
  record.action!=='EXISTING_DARK_WORKER_CODE_UPDATE_ONLY'||
  record.target!==target||record.worker!==spec.name||
  record.predecessorVersion!==spec.previousVersion||
  record.physicalD1!==spec.uuid||record.sourceSha!==SOURCE||
  record.reviewedZipSha256!==spec.sha||
  record.status!=='UNKNOWN_IF_INTERRUPTED_NO_RETRY'||
  typeof record.timeUtc!=='string'||!Number.isFinite(Date.parse(record.timeUtc)))
  stop('original exact current-source dark Worker attempt lock missing/altered');
 return Object.freeze({target,validExistingWorkerAttempt:true});
}
export function verifyExistingDarkPostUpdate(target,record,replies,expectedNewVersion=null){
 const spec=TARGETS[target];
 verifyExistingDarkAttempt(target,record);
 if(expectedNewVersion!==null&&
   (!uuid(expectedNewVersion)||expectedNewVersion===spec.previousVersion))
  stop('expected NEW provider version must be exact and differ from predecessor');
 // Reuse the already accepted strict six-response Cloudflare parser:
 // owner account membership, physical D1 list/info, sole 100%-serving version,
 // unique version listing, immutable binding identity, FOUR exact dark vars,
 // exactly one DB and absolutely NO unknown R2/Access/Stripe/KV bindings.
 const accepted=verifyCurrentDarkHostedEvidence(target,replies);
 const served=accepted.servingVersionId;
 const changed=served!==spec.previousVersion;
 if(expectedNewVersion&&expectedNewVersion!==served)
  stop('provider serving version disagrees with the independently supplied new version');
 const matched=changed&&expectedNewVersion===served;
 return Object.freeze({
  result:matched?'FIRE_DARK_POSTUPDATE_NEW_VERSION_READONLY_MATCH':
   changed?'FIRE_DARK_POSTUPDATE_UNATTRIBUTED_VERSION_CHANGE':
   'FIRE_DARK_POSTUPDATE_PREDECESSOR_STILL_SERVING',
  target,worker:spec.name,servingVersionId:served,
  predecessorVersionId:spec.previousVersion,
  physicalD1Uuid:spec.uuid,reviewedSourceSha:SOURCE,
  archivedSourceZipSha256:spec.sha,
  actualHostedNewVersionObserved:changed,
  expectedNewVersionMatched:matched,
  ownerAccountAndPhysicalD1ReadbackVerified:true,
  hostedDarkAuthVerified:true,hostedExactlyOneVersionAt100Percent:true,
  providerOperationAttemptedByThisCheck:false,remoteDataModified:false,
  hostedCompiledSourceBytesCryptographicallyVerified:false,
  routingAndPreviewPoliciesIndependentlyReverified:false,
  hostedOwnerAndNonownerLoginTested:false,
  crossCustomerIsolationTested:false,recordsAndPhotosRestored:false,
  stripeTestPaymentsVerified:false,gate4Accepted:false,
  gate5Accepted:false,gate6Accepted:false,gate7Accepted:false,
  gate9Accepted:false,gate10Accepted:false,productionReady:false
 });
}
function run(args){
 const locations=[
  join(dirname(process.execPath),'node_modules','npm','bin','npx-cli.js'),
  join(dirname(process.execPath),'..','lib','node_modules','npm','bin','npx-cli.js')
 ];
 const npmCli=locations.find(existsSync);
 if(!npmCli)stop('existing npm CLI unavailable; no installs or sign-in retries');
 const r=spawnSync(process.execPath,[npmCli,'--no-install','wrangler@4.162.0',...args],{
  encoding:'utf8',timeout:90000,maxBuffer:1000000,windowsHide:true,shell:false,
  env:{...process.env,CLOUDFLARE_ACCOUNT_ID:ACCOUNT,WRANGLER_SEND_METRICS:'false'}
 });
 if(r.error)stop('read-only provider call uncertain: '+r.error.message);
 return {code:r.status,stdout:String(r.stdout||''),stderr:String(r.stderr||'')};
}
function capture(target,expected=null){
 if(process.platform!=='win32'||!process.stdin.isTTY||!process.stdout.isTTY||
    process.env.CI||process.env.GITHUB_ACTIONS||process.env.TF_BUILD)
  stop('only existing authenticated owner Acer Windows, no CI or browser');
 if(process.env.CLOUDFLARE_ACCOUNT_ID&&process.env.CLOUDFLARE_ACCOUNT_ID!==ACCOUNT)
  stop('wrong Cloudflare account selected');
 const spec=TARGETS[target];
 const file=join(workspace(target),'REMOTE-UPDATE-ATTEMPT-LOCK.json');
 if(!existsSync(file))stop('no matching durable existing-Worker UPDATE lock; no postupdate claim');
 let lock;
 try{lock=JSON.parse(readFileSync(file,'utf8'))}catch{stop('attempt lock unreadable; never recreate it');}
 verifyExistingDarkAttempt(target,lock);
 const v=run(['--version']);
 if(v.code!==0||v.stdout.trim()!=='4.162.0')
  stop('require already installed Wrangler 4.162.0, no install');
 // Re-check ONLY the changed hosted version and immutable owner/D1 bindings.
 // Accepted prior first-creation host proof is not being replayed.
 const replies={
  whoami:run(['whoami','--json']),
  d1Info:run(['d1','info',spec.db,'--json']),
  versionsList:run(['versions','list','--name',spec.name,'--json']),
  deploymentStatus:run(['deployments','status','--name',spec.name,'--json'])
 };
 const deployment=parse(replies.deploymentStatus,'deployment');
 if(!obj(deployment)||!Array.isArray(deployment.versions)||
    deployment.versions.length!==1||
    deployment.versions[0]?.percentage!==100)
  stop('no exact 100-percent single serving deployment');
 const served=deployment.versions[0].version_id??deployment.versions[0].id;
 if(!uuid(served))stop('new version UUID missing or invalid');
 replies.versionDetail=run(['versions','view',served,'--name',spec.name,'--json']);
 replies.d1List=run(['d1','list','--json']);
 const result=verifyExistingDarkPostUpdate(target,lock,replies,expected);
 console.log(JSON.stringify(result,null,2));
}
const invoked=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(invoked){
 const [mode,target,expected,...rest]=process.argv.slice(2);
 try{
  if(rest.length||!TARGETS[target])stop('choose exact dr or new-live');
  if(mode==='--capture'&&expected&&uuid(expected)){
   capture(target,expected);
  }else if(mode==='--reconcile'&&expected===undefined){
   capture(target);
  }else if(mode==='inspect'&&expected===undefined){
   console.log(JSON.stringify({result:'FIRE_POSTUPDATE_READONLY_NO_PROVIDER',
    target,providerContacted:false,ownerAuthorizedToPublish:false,
    onlyUseAfterFutureActualUpdateAttempt:true,gate4Accepted:false},null,2));
  }else stop('usage: inspect dr|new-live OR --capture TARGET EXPECTED_NEW_VERSION_UUID OR --reconcile TARGET');
 }catch(e){console.error(e.message);process.exitCode=1;}
}
