/**
 * FIRE G4-04 STAGING active-version/Stripe-dependency preflight.
 * ONLY two narrowly scoped Cloudflare GETs; never logs a raw API response,
 * bearer token, binding value, hostname, or customer data. No provider writes.
 * Previous four-target bindings evidence is accepted and never repeated here.
 */
import {pathToFileURL} from 'node:url';
import {dirname,join,resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {ACCOUNT_ID,TARGETS,evaluateHostedBindings} from './owner_g4_hosted_binding_names_readonly.mjs';

const target=TARGETS.staging;
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=()=>{throw Error('STAGING SERVING READ-ONLY STOP: incomplete or inconsistent provider evidence')};
const pathBase='/client/v4/accounts/'+ACCOUNT_ID+'/workers/scripts/'+target.worker;
function responseResult(reply){
 if(!object(reply)||reply.success!==true||!Array.isArray(reply.errors)||reply.errors.length||
    !object(reply.result))fail();
 return reply.result;
}
export function evaluateStagingServing(deploymentResponse,versionResponse){
 const d=responseResult(deploymentResponse);
 if(!Array.isArray(d.deployments)||d.deployments.length!==1)fail();
 const active=d.deployments[0];
 if(!object(active)||!uuid.test(active.id)||!Array.isArray(active.versions)||
    active.versions.length!==1||!object(active.versions[0])||
    active.versions[0].percentage!==100||!uuid.test(active.versions[0].version_id))fail();
 if(deploymentResponse.result_info!==undefined){
   const p=deploymentResponse.result_info;
   if(!object(p)||(p.page!==undefined&&p.page!==1)||
      (p.count!==undefined&&p.count!==1)||
      (p.total_count!==undefined&&(!Number.isSafeInteger(p.total_count)||p.total_count<1)))fail();
 }
 const versionId=active.versions[0].version_id;
 const v=responseResult(versionResponse);
 if(v.id!==versionId||!object(v.resources)||!Array.isArray(v.resources.bindings))fail();
 const bindingCheck=evaluateHostedBindings('staging',{
   success:true,errors:[],result:{bindings:v.resources.bindings}
 });
 const stripeMode=v.resources.bindings.filter(x=>x.name==='FIRE_STRIPE_MODE');
 const paymentModeExplicitlyDisabled=stripeMode.length===1&&
   stripeMode[0].type==='plain_text'&&stripeMode[0].text==='disabled';
 const paymentModeNotEnabled=stripeMode.length===0||paymentModeExplicitlyDisabled;
 // FIRE_STRIPE_MODE=disabled is a configuration flag, never a payment
 // credential. Report it separately via paymentModeNotEnabled; do not
 // mistake its mere presence for an unexpected Stripe secret to remove.
 const unexpectedPaymentCredentialBindings=v.resources.bindings.filter(b=>
   b.name!=='FIRE_STRIPE_MODE'&&
   /^(?:STRIPE_|PAYMENT_|FIRE_STRIPE_)/.test(b.name)
 ).length;
 return Object.freeze({
   result:'FIRE_STAGING_SERVING_VERSION_METADATA_READ_ONLY',
   worker:target.worker,activeDeploymentId:active.id,activeVersionId:versionId,
   activeTrafficPercent:100,providerDeploymentVersionMetadataExamined:true,
   versionScopedD1IdentityMatches:bindingCheck.expectedDBIdentityMatches,
   versionScopedAuthNamePresence:bindingCheck.expectedAuthSecretNamePresence,
   versionScopedMissingAuthCount:bindingCheck.missingExpectedAuthSecretNameCount,
   versionScopedUnexpectedPaymentBindingCount:unexpectedPaymentCredentialBindings,
   versionScopedR2Count:bindingCheck.r2BindingCount,
   versionScopedWrongTargetAuthCount:bindingCheck.wrongTargetAuthSecretCount,
   paymentModeExplicitlyDisabled,paymentModeNotEnabled,
   requiresConfigRemediation:!bindingCheck.expectedDBIdentityMatches||
      bindingCheck.missingExpectedAuthSecretNameCount>0||
      unexpectedPaymentCredentialBindings>0||
      bindingCheck.r2BindingCount>0||bindingCheck.wrongTargetAuthSecretCount>0||
      !bindingCheck.expectedAuthSecretTypesValid||bindingCheck.unreviewedBindingTypeCount>0||
      !paymentModeNotEnabled,
   // Metadata is not served executable-byte attestation or nonowner Access proof.
   servingCodeBytesVerified:false,accessEnforcementVerified:false,
   secretValuesExposed:false,providerDataMutated:false,
   stripeDependencyCleared:false,gate4Accepted:false,releaseAuthorized:false
 });
}
async function onlyGet(token,path){
 if(!path.startsWith(pathBase+'/')||path.includes('..')||path.includes('?')&&
    path!==pathBase+'/deployments?page=1&per_page=1')fail();
 const url=new URL(path,'https://api.cloudflare.com');
 if(url.origin!=='https://api.cloudflare.com')fail();
 const r=await fetch(url,{method:'GET',redirect:'error',cache:'no-store',
   headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
 if(!r.ok)fail();
 const body=await r.text();
 if(body.length>120000)fail();
 try{return JSON.parse(body)}catch{fail()}
}
export async function captureStagingServing({token,request=onlyGet}={}){
 if(typeof token!=='string'||token.length<20||token.length>4096||/\s/.test(token)||
    typeof request!=='function')fail();
 const d=await request(token,pathBase+'/deployments?page=1&per_page=1');
 const root=responseResult(d);
 if(!Array.isArray(root.deployments)||root.deployments.length!==1||
    !object(root.deployments[0])||!Array.isArray(root.deployments[0].versions)||
    root.deployments[0].versions.length!==1||
    !uuid.test(root.deployments[0].versions[0]?.version_id))fail();
 const version=await request(token,pathBase+'/versions/'+root.deployments[0].versions[0].version_id);
 return Object.freeze({
   ...evaluateStagingServing(d,version),
   directCloudflareReadOnlyApi:request===onlyGet,
   getRequestCount:2,noLoginAttempt:true,cloudflareWrites:false
 });
}
/**
 * Optional already-authenticated Wrangler session fallback. Reuses only the
 * pinned, locally cached CLI and never invokes a login, install or browser.
 * No credentials, stdout, stderr or provider errors are ever logged.
 * Kept self-contained so the owner still needs ONLY the original two files.
 */
export function parseExistingSessionTokenResponse(raw){
 let parsed;try{parsed=JSON.parse(raw)}catch{fail()}
 if(!object(parsed)||!['oauth','api_token'].includes(parsed.type)||
    typeof parsed.token!=='string'||parsed.token.length<20||
    parsed.token.length>4096||/\s/.test(parsed.token))fail();
 return parsed.token;
}
function readExistingSessionToken(){
 const candidates=[
  join(dirname(process.execPath),'node_modules','npm','bin','npx-cli.js'),
  join(dirname(process.execPath),'..','lib','node_modules','npm','bin','npx-cli.js')
 ];
 const npx=candidates.find(existsSync);
 if(!npx)fail();
 const env={...process.env,CLOUDFLARE_CF_FETCH_ENABLED:'false',
  WRANGLER_SEND_METRICS:'false',npm_config_offline:'true',
  npm_config_yes:'false',npm_config_audit:'false',npm_config_fund:'false'};
 // The session fallback must not accidentally inherit an unreviewed token.
 delete env.CLOUDFLARE_API_TOKEN;
 let r;try{
  r=spawnSync(process.execPath,
   [npx,'--no-install','wrangler@4.162.0','auth','token','--json'],{
    encoding:'utf8',timeout:20000,maxBuffer:65536,windowsHide:true,
    shell:false,stdio:['ignore','pipe','pipe'],env
   });
 }catch{fail()}
 if(!r||r.error||r.signal||r.status!==0||
    typeof r.stdout!=='string')fail();
 return parseExistingSessionTokenResponse(r.stdout);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 if(args.length===0){
   console.log(JSON.stringify({result:'OFFLINE_NO_PROVIDER',target:'staging',
     providerContacted:false,gate4Accepted:false,readOnlyCaptureOption:'--capture',
     existingSessionCaptureOption:'--capture-existing-session'}));
 }else if(args.length===1&&
           (args[0]==='--capture'||args[0]==='--capture-existing-session')){
   try{
     if(process.platform!=='win32'||!process.stdin.isTTY||!process.stdout.isTTY||
       process.env.CI||process.env.GITHUB_ACTIONS)fail();
     const token=args[0]==='--capture-existing-session'?
       readExistingSessionToken():process.env.CLOUDFLARE_API_TOKEN;
     const receipt=await captureStagingServing({token});
     console.log(JSON.stringify(receipt,null,2));
     if(receipt.requiresConfigRemediation)process.exitCode=2;
   }catch{
     console.error('STAGING SERVING READ-ONLY STOP: no full version-bound receipt; no Cloudflare write or login');
     process.exitCode=1;
   }
 }else{
   console.error('STAGING SERVING READ-ONLY STOP: unapproved arguments');
   process.exitCode=1;
 }
}