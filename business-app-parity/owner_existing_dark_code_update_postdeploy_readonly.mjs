/**
 * FIRE existing DARK DR/NEW LIVE CODE-ONLY post-update hosted attestation.
 * Pure default mode, no provider calls. --capture requires one known NEW
 * immutable Cloudflare version supplied privately on the owner's Acer.
 * Reuses the strict D1, account, one-serving-version, five-binding validator.
 *
 * Never claim remotely served source-byte parity from version metadata.
 * Never enable login, routes, Access, Stripe or paid Cloudflare products.
 */
import {existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {verifyCurrentDarkHostedEvidence} from './owner_current_dark_postcreate_readonly.mjs';
import {TARGETS} from './owner_existing_dark_code_update_once_approved.mjs';

const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
const SOURCE='15bd714c435a585f695ed7166cf06d2c31ea1a8e';
const fail=s=>{throw Error('FIRE EXISTING DARK POSTUPDATE READBACK STOP: '+s)};
const uuid=s=>typeof s==='string'&&
 /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(s);

export function verifyExistingDarkPostUpdate(target,expectedVersion,replies){
 const spec=TARGETS[target];
 if(!spec||!uuid(expectedVersion)||expectedVersion===spec.previousVersion)
  fail('target and NEW exact immutable version required, not old predecessor');
 // This established function verifies all six complete authenticated metadata
 // replies, one 100% serving version, exact Worker, exact physical D1
 // DB/UUID, four blocked plain-text variables, and ZERO other bindings.
 const checked=verifyCurrentDarkHostedEvidence(target,replies);
 if(checked.servingVersionId!==expectedVersion||
    checked.physicalD1Uuid!==spec.uuid||
    checked.worker!==spec.name||
    checked.identityAndPhysicalBindingProviderReadbackVerified!==true||
    checked.darkAuthDisabledInHostedVariables!==true)
  fail('new active version, Worker, blocked authentication or physical D1 mismatch');
 // Deliberately do NOT propagate the original first-create validator's
 // older reviewedSourcePackageSha: its version check does not prove bytes.
 return Object.freeze({
  result:'FIRE_EXISTING_DARK_NEW_VERSION_PHYSICAL_READBACK_PASS',
  worker:spec.name,target,newServingVersion:expectedVersion,
  oldPredecessorVersion:spec.previousVersion,
  physicalD1Uuid:spec.uuid,qaMasterSourceCandidateSha:SOURCE,
  singleServingVersionReadOnlyObserved:true,
  postUpdatePhysicalD1BindingVerified:true,
  hostedDarkAuthenticationVariablesVerified:true,
  hostedNoR2OrExtraResourceBindingsVerified:true,
  hostedSourceBytesVerified:false,
  actualWorkerSourceShaVerified:false,
  accessPolicyVerified:false,
  ownerOrNonownerAccessVerified:false,
  crossEnvironmentFunctionalParityVerified:false,
  completeRecordAndPhotoRecoveryVerified:false,
  signedStripeTestVerified:false,
  publicRouteAbsencePostUpdateVerified:false,
  releaseOrGate4Accepted:false,productionReady:false,
  providerWritePerformedByVerifier:false
 });
}

function command(args){
 // Explicit allow-list: never accept an arbitrary wrangler instruction.
 const staticCommands=[
  ['--version'],['whoami','--json'],['d1','list','--json']
 ];
 const spec=TARGETS[currentTarget];
 const permitted=staticCommands.some(a=>JSON.stringify(args)===JSON.stringify(a))||
  JSON.stringify(args)===JSON.stringify(['d1','info',spec.db,'--json'])||
  JSON.stringify(args)===JSON.stringify(['versions','list','--name',spec.name,'--json'])||
  JSON.stringify(args)===JSON.stringify(['deployments','status','--name',spec.name,'--json'])||
  JSON.stringify(args)===JSON.stringify(['versions','view',currentVersion,'--name',spec.name,'--json']);
 if(!permitted)fail('unreviewed provider action refused');
 const npmCli=[
  join(dirname(process.execPath),'node_modules','npm','bin','npx-cli.js'),
  join(dirname(process.execPath),'..','lib','node_modules','npm','bin','npx-cli.js')
 ].find(existsSync);
 if(!npmCli)fail('existing npm CLI missing; do not install/relogin');
 const r=spawnSync(process.execPath,[npmCli,'--no-install','wrangler@4.162.0',...args],{
  encoding:'utf8',timeout:90000,maxBuffer:1000000,windowsHide:true,shell:false,
  env:{...process.env,CLOUDFLARE_ACCOUNT_ID:ACCOUNT,WRANGLER_SEND_METRICS:'false'}
 });
 if(r.error)fail('read-only provider result unavailable; stop without retrying writes');
 return {code:r.status,stdout:String(r.stdout||''),stderr:String(r.stderr||'')};
}
let currentTarget=null,currentVersion=null;
function capture(target,newVersion){
 if(process.platform!=='win32'||!process.stdin.isTTY||!process.stdout.isTTY||
    process.env.CI||process.env.GITHUB_ACTIONS||process.env.TF_BUILD)
  fail('only existing owner Acer authenticated interactive session may capture');
 if(process.env.CLOUDFLARE_ACCOUNT_ID&&process.env.CLOUDFLARE_ACCOUNT_ID!==ACCOUNT)
  fail('Cloudflare account mismatch; no switch or sign-in retry');
 currentTarget=target;currentVersion=newVersion;
 const s=TARGETS[target];
 if(!s||!uuid(newVersion)||newVersion===s.previousVersion)
  fail('exact NEW provider version and known already-created target required');
 const cli=command(['--version']);
 if(cli.code!==0||cli.stdout.trim()!=='4.162.0')
  fail('installed Wrangler must be exact 4.162.0; never install automatically');
 // One bounded provider GET of each necessary metadata record; NO D1 SQL.
 // No response body, token, account email or raw binding JSON is printed.
 const status=command(['deployments','status','--name',s.name,'--json']);
 let active;
 try{
  if(status.code!==0||status.stdout.length>1000000)fail('deployment status unavailable');
  const parsed=JSON.parse(status.stdout);
  if(!Array.isArray(parsed.versions)||parsed.versions.length!==1||
     parsed.versions[0].percentage!==100||
     (parsed.name!==undefined&&parsed.name!==s.name))
   fail('unexpected multi-version rollout, different Worker or non-100% serving');
  active=parsed.versions[0].version_id??parsed.versions[0].id;
 }catch(e){
  if(String(e.message).startsWith('FIRE EXISTING DARK POSTUPDATE'))throw e;
  fail('invalid version metadata; refuse further provider requests');
 }
 if(active!==newVersion)fail('new version is not serving exactly; no retry/publish');
 const replies={
  deploymentStatus:status,
  whoami:command(['whoami','--json']),
  d1Info:command(['d1','info',s.db,'--json']),
  versionsList:command(['versions','list','--name',s.name,'--json']),
  versionDetail:command(['versions','view',newVersion,'--name',s.name,'--json']),
  d1List:command(['d1','list','--json'])
 };
 const proof=verifyExistingDarkPostUpdate(target,newVersion,replies);
 console.log(JSON.stringify(proof,null,2));
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(invoked){
 const [mode,target,newVersion,...rest]=process.argv.slice(2);
 try{
  if(rest.length||!TARGETS[target]||!uuid(newVersion)||newVersion===TARGETS[target].previousVersion||
     !['inspect','--capture'].includes(mode))
   fail('use inspect|--capture dr|new-live EXACT_NEW_HOSTED_VERSION');
  if(mode==='inspect'){
   console.log(JSON.stringify({result:'SOURCE_ONLY_READONLY_POSTUPDATE_PREVIEW',
    target,expectedNewVersion:newVersion,oldVersion:TARGETS[target].previousVersion,
    qaMasterSourceCandidateSha:SOURCE,providerContacted:false,gate4Accepted:false},null,2));
  }else capture(target,newVersion);
 }catch(e){console.error(String(e.message));process.exitCode=1;}
}
