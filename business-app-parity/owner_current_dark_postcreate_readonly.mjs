/**
 * Current QA-master DR / NEW LIVE: hosted first-creation READ-ONLY attestation.
 *
 * Default:
 *   node owner_current_dark_postcreate_readonly.mjs dr
 *       prints a dry-run notice; NO provider commands.
 *
 * After a separately approved first-create has actually completed:
 *   node owner_current_dark_postcreate_readonly.mjs --capture dr|new-live
 *       runs only six Wrangler GET/metadata operations in an existing
 *       authenticated owner Windows session. No sign-in retries, deploy,
 *       SQL, secrets, Access, routing, Stripe, R2 or Cloudflare mutation.
 *
 * Never infer full Gate 4/5/6/7/9/10 acceptance from metadata alone.
 */
import {existsSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {
 verifyOwnerAccountReadback,verifyPhysicalD1InfoReadback,
 verifyCreatedWorkerListReadback
} from './owner_current_first_create_provider_evidence.mjs';

const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
const SOURCE='e27b39df06c1ed4ff63cd437e39fd3e314142eec';
export const TARGETS=Object.freeze({
 dr:Object.freeze({worker:'fire-fullapp-dr',db:'fire-fullapp-dr-db',
  uuid:'5e55c5b7-cd67-4c8f-a52e-40f71b5d3145',env:'isolated-dr',
  auth:'FIRE_DR_AUTH_ENABLED'}),
 'new-live':Object.freeze({worker:'fire-fullapp-new-live',db:'fire-fullapp-new-live-db',
  uuid:'0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662',env:'new-live-prelaunch',
  auth:'FIRE_NEW_LIVE_AUTH_ENABLED'})
});
const stop=why=>{throw Error('FIRE CURRENT DARK HOSTED READBACK STOP: '+why)};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function parsed(reply,label){
 if(!reply||reply.code!==0||typeof reply.stdout!=='string'||reply.stdout.length>1000000)
  stop(label+' command failed or exceeded bounded JSON');
 try{
  const x=JSON.parse(reply.stdout.trim());
  if(!x||typeof x!=='object')stop(label+' not structured JSON');
  return x;
 }catch(e){
  if(String(e.message).startsWith('FIRE CURRENT DARK'))throw e;
  stop(label+' stdout not standalone JSON');
 }
}
function exactIdentity(x,expected,label){
 if(!object(x))stop(label+' missing structured identity');
 const ids=['id','version_id','versionId'].filter(k=>x[k]!==undefined&&x[k]!==null).map(k=>x[k]);
 if(!ids.length||ids.some(id=>id!==expected)||!uuid(expected))
  stop(label+' ID missing, conflicting or unexpected');
}
function activeVersion(reply,worker){
 const x=parsed(reply,'deployment status');
 if(!object(x)||!Array.isArray(x.versions)||x.versions.length!==1)
  stop('deployment must contain exactly one serving version');
 const entry=x.versions[0],v=entry&&entry.version_id!==undefined?entry.version_id:entry?.id;
 if(!uuid(v)||!object(entry)||entry.percentage!==100||
    (entry.id!==undefined&&entry.version_id!==undefined&&entry.id!==entry.version_id))
  stop('deployment version identity or serving percentage is not exact');
 if(x.name!==undefined&&x.name!==worker)stop('deployment belongs to another Worker');
 return v;
}
function exactBoundBindings(version,expected,spec){
 const root=Object.hasOwn(version,'bindings'),nested=object(version.resources)&&
  Object.hasOwn(version.resources,'bindings');
 if(root===nested)stop('hosted binding location absent or ambiguous');
 const items=root?version.bindings:version.resources.bindings;
 if(!Array.isArray(items)||items.length!==5)stop('hosted bindings count differs from dark config');
 const expectedVars={
  FIRE_ENV:spec.env,FIRE_PHOTO_STORAGE_MODE:'owner-device-zip',
  SITE_ORIGIN:'https://'+spec.worker+'.kyle-bfc.workers.dev',
  [spec.auth]:'blocked'
 };
 const names=new Map();
 for(const b of items){
  if(!object(b)||typeof b.name!=='string'||names.has(b.name))
   stop('duplicate or invalid hosted binding');
  names.set(b.name,b);
 }
 if(names.size!==5||![...names.keys()].every(k=>k==='DB'||Object.hasOwn(expectedVars,k)))
  stop('hosted Worker contains unknown binding (possible secrets or other resource)');
 const db=names.get('DB');
 if(!db||!['d1','d1_database'].includes(db.type))stop('actual hosted D1 binding missing');
 const dbIDs=['id','database_id'].filter(k=>db[k]!==undefined&&db[k]!==null).map(k=>db[k]);
 if(!dbIDs.length||dbIDs.some(v=>v!==spec.uuid))
  stop('hosted Worker D1 does not match independently migrated exact target');
 if(db.database_name!==undefined&&db.database_name!==spec.db)
  stop('hosted D1 name differs');
 for(const [name,value] of Object.entries(expectedVars)){
  const b=names.get(name);
  if(!b||b.type!=='plain_text'||b.text!==value)
   stop('hosted Worker has altered, missing or activated dark variable '+name);
 }
 if(expected!==spec.uuid)stop('opposite-environment database configured');
}
function inventoryMatch(reply,spec){
 const inventory=parsed(reply,'D1 inventory');
 if(!Array.isArray(inventory)||inventory.length>10000)
  stop('D1 inventory must be a bounded exact array');
 const named=inventory.filter(x=>object(x)&&x.name===spec.db);
 const byID=inventory.filter(x=>object(x)&&(x.uuid===spec.uuid||x.id===spec.uuid));
 if(named.length!==1||byID.length!==1||named[0]!==byID[0]||
    (named[0].uuid!==undefined&&named[0].uuid!==spec.uuid)||
    (named[0].id!==undefined&&uuid(named[0].id)&&named[0].id!==spec.uuid))
  stop('D1 provider inventory does not uniquely map correct name to physical UUID');
}
export function verifyCurrentDarkHostedEvidence(target,replies){
 const spec=TARGETS[target];
 if(!spec||!object(replies))stop('target or six read-only replies missing');
 verifyOwnerAccountReadback(replies.whoami,ACCOUNT);
 verifyPhysicalD1InfoReadback(replies.d1Info,spec.db,spec.uuid);
 verifyCreatedWorkerListReadback(replies.versionsList);
 const list=parsed(replies.versionsList,'versions list');
 const versions=Array.isArray(list)?list:Array.isArray(list.versions)?list.versions:list.items;
 if(!Array.isArray(versions))stop('version inventory not structured');
 const deployed=activeVersion(replies.deploymentStatus,spec.worker);
 const hits=versions.filter(v=>object(v)&&[v.id,v.version_id,v.versionId].includes(deployed));
 if(hits.length!==1)stop('active deployed version not uniquely in provider version inventory');
 exactIdentity(hits[0],deployed,'version listing');
 const detail=parsed(replies.versionDetail,'version detail');
 exactIdentity(detail,deployed,'version detail');
 if(detail.name!==undefined&&detail.name!==spec.worker)stop('version detail Worker differs');
 exactBoundBindings(detail,spec.uuid,spec);
 inventoryMatch(replies.d1List,spec);
 return Object.freeze({
  result:'FIRE_CURRENT_DARK_PROVIDER_VERSION_AND_D1_BOUND_READONLY_MATCH',
  target,worker:spec.worker,servingVersionId:deployed,
  physicalD1Uuid:spec.uuid,reviewedSourcePackageSha:SOURCE,
  identityAndPhysicalBindingProviderReadbackVerified:true,
  darkAuthDisabledInHostedVariables:true,
  deploymentModifiedByThisCheck:false,databaseModifiedByThisCheck:false,
  hostedSourceBytesVerified:false,publicRouteAbsenceProviderVerified:false,
  accessPolicyProviderVerified:false,hostedNonownerDenialVerified:false,
  hostedCustomerPrivacyVerified:false,fullPhotoRecoveryVerified:false,
  stripeTestEventsVerified:false,gate4Accepted:false,gate5Accepted:false,
  gate6Accepted:false,gate7Accepted:false,gate9Accepted:false,gate10Accepted:false,
  productionReady:false
 });
}
function readOnlyWrangler(args){
 const npmCli=[
  join(dirname(process.execPath),'node_modules','npm','bin','npx-cli.js'),
  join(dirname(process.execPath),'..','lib','node_modules','npm','bin','npx-cli.js')
 ].find(existsSync);
 if(!npmCli)stop('installed Node/npm CLI unavailable; do not reauthenticate or install');
 const response=spawnSync(process.execPath,[npmCli,'--no-install','wrangler@4.162.0',...args],{
  encoding:'utf8',timeout:90000,maxBuffer:1000000,windowsHide:true,shell:false,
  env:{...process.env,CLOUDFLARE_ACCOUNT_ID:ACCOUNT,WRANGLER_SEND_METRICS:'false'}
 });
 if(response.error)stop('read-only provider command failed: '+response.error.message);
 return {code:response.status,stdout:String(response.stdout||''),stderr:String(response.stderr||'')};
}
function capture(target){
 if(process.platform!=='win32'||!process.stdin.isTTY||!process.stdout.isTTY||
    process.env.CI||process.env.GITHUB_ACTIONS||process.env.TF_BUILD)
  stop('owner-only existing authenticated Windows session required; no remote CI');
 if(process.env.CLOUDFLARE_ACCOUNT_ID&&process.env.CLOUDFLARE_ACCOUNT_ID!==ACCOUNT)
  stop('selected Cloudflare account conflicts with accepted owner account');
 const s=TARGETS[target];
 const version=readOnlyWrangler(['--version']);
 if(version.code!==0||version.stdout.trim()!=='4.162.0')
  stop('exact installed Wrangler v4.162.0 required (no installation/retry)');
 const whoami=readOnlyWrangler(['whoami','--json']);
 verifyOwnerAccountReadback(whoami,ACCOUNT);
 const d1Info=readOnlyWrangler(['d1','info',s.db,'--json']);
 verifyPhysicalD1InfoReadback(d1Info,s.db,s.uuid);
 const versionsList=readOnlyWrangler(['versions','list','--name',s.worker,'--json']);
 verifyCreatedWorkerListReadback(versionsList);
 const deploymentStatus=readOnlyWrangler(['deployments','status','--name',s.worker,'--json']);
 const serving=activeVersion(deploymentStatus,s.worker);
 const versionDetail=readOnlyWrangler(['versions','view',serving,'--name',s.worker,'--json']);
 const d1List=readOnlyWrangler(['d1','list','--json']);
 const proof=verifyCurrentDarkHostedEvidence(target,{
  whoami,d1Info,versionsList,deploymentStatus,versionDetail,d1List
 });
 console.log(JSON.stringify(proof,null,2));
}
const invoked=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(invoked){
 const args=process.argv.slice(2);
 try{
  if(args.length===1&&TARGETS[args[0]]){
   console.log(JSON.stringify({result:'DRY_RUN_NO_PROVIDER',target:args[0],
    providerContacted:false,gate4Accepted:false},null,2));
  }else if(args.length===2&&args[0]==='--capture'&&TARGETS[args[1]]){
   capture(args[1]);
  }else stop('usage: node SCRIPT dr|new-live OR SCRIPT --capture dr|new-live');
 }catch(e){console.error(e.message);process.exitCode=1;}
}
