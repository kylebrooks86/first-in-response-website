/**
 * FIRE G4-04 owner-only provider metadata collection: four pinned Workers,
 * account-level GET /workers/scripts/:name/settings only.
 * No secrets/vars values, HTTP bodies, token, binding IDs or customer data
 * are printed, saved, sent to ChatGPT, or written to disk.
 * This script never claims active-serving-version parity or Gate 4 acceptance.
 * Default and import mode are offline. Opt-in Windows TTY capture only.
 */
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const ACCOUNT_ID='bfc00939cfb2f8dfd8581a7a7f5f1307';
export const TARGETS=Object.freeze({
  qa:Object.freeze({worker:'fire-fullapp-qa-20261016',database:'8ccfb1f8-1657-4074-b1b2-47de78f95003',
    secrets:['FIRE_QA_PASSWORD_HASH','FIRE_QA_SESSION_SECRET']}),
  staging:Object.freeze({worker:'fire-app-independent-staging',database:'afb2c05a-d794-4a9a-b580-924ce01c26ad',
    secrets:['FIRE_ADMIN_PASSWORD_HASH','FIRE_SESSION_SECRET']}),
  dr:Object.freeze({worker:'fire-fullapp-dr',database:'5e55c5b7-cd67-4c8f-a52e-40f71b5d3145',
    secrets:['FIRE_DR_PASSWORD_HASH','FIRE_DR_SESSION_SECRET']}),
  'new-live':Object.freeze({worker:'fire-fullapp-new-live',database:'0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662',
    secrets:['FIRE_NEW_LIVE_PASSWORD_HASH','FIRE_NEW_LIVE_SESSION_SECRET']})
});
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const stop=()=>{throw Error('FIRE G4 HOSTED BINDINGS READ-ONLY STOP: incomplete provider metadata')};
const id=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9-]{27,}$/.test(x);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const safeErrors=x=>x==null||(Array.isArray(x)&&x.length===0);

export function evaluateHostedBindings(target,response){
  const expected=TARGETS[target];
  if(!expected||!obj(response)||response.success!==true||!safeErrors(response.errors)||
    !own(response,'result')||!obj(response.result)||!Array.isArray(response.result.bindings))stop();
  const bindings=response.result.bindings;
  if(bindings.length>120)stop();
  const seen=new Set();
  for(const b of bindings){
    if(!obj(b)||typeof b.name!=='string'||!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(b.name)||
      typeof b.type!=='string'||b.type.length>64||seen.has(b.name))stop();
    seen.add(b.name);
  }
  const db=bindings.filter(b=>b.name==='DB');
  const dbBinding=db.length===1&&db[0].type==='d1'?db[0]:null;
  // Cloudflare has deprecated "id" in favor of "database_id". If both
  // appear and conflict, do not accept the physical database identity.
  const dbId=dbBinding?.database_id??dbBinding?.id;
  const dbIdConsistent=dbBinding&&
    (!own(dbBinding,'database_id')||!own(dbBinding,'id')||dbBinding.database_id===dbBinding.id);
  const physicalDBIdentityMatches=!!dbBinding&&!!dbIdConsistent&&
    typeof dbId==='string'&&dbId===expected.database;
  const expectedSecretPresence=Object.fromEntries(expected.secrets.map(name=>[
    name,bindings.some(b=>b.name===name&&b.type==='secret_text')
  ]));
  const wrongTargetAuthSecretCount=bindings.filter(b=>
    /(?:_PASSWORD_HASH|_SESSION_SECRET|_PIN_HASH|_PIN_PEPPER)$/.test(b.name)&&
    !expected.secrets.includes(b.name)&&
    // Additional mode-specific PIN bindings are optional and cannot attest Access.
    !['FIRE_PIN_HASH','FIRE_PIN_PEPPER','FIRE_QA_PIN_HASH','FIRE_QA_PIN_PEPPER'].includes(b.name)
  ).length;
  const providerStorageBindings=bindings.filter(b=>/^(?:r2_bucket|r2_bucket_jurisdictional)$/.test(b.type)).length;
  const unexpectedPaymentCredentialBindings=bindings.filter(b=>
    /^(?:STRIPE_|PAYMENT_|FIRE_STRIPE_)/.test(b.name)).length;
  const misTypedExpected=expected.secrets.some(name=>
    bindings.some(b=>b.name===name&&b.type!=='secret_text'));
  const unexpectedBindingTypes=bindings.filter(b=>
    !['d1','secret_text','plain_text','json','secret_key'].includes(b.type)).length;
  return Object.freeze({
    target,worker:expected.worker,
    scriptLevelSettingsReadback:true,readOnlyProviderMetadata:true,
    totalBindingCount:bindings.length,
    expectedDBBindingPresent:!!dbBinding,
    expectedDBIdentityMatches:physicalDBIdentityMatches,
    expectedAuthSecretNamePresence:expectedSecretPresence,
    expectedAuthSecretTypesValid:!misTypedExpected,
    wrongTargetAuthSecretCount,
    unexpectedPaymentCredentialBindings,
    r2BindingCount:providerStorageBindings,
    unreviewedBindingTypeCount:unexpectedBindingTypes,
    // This endpoint is not version-pinned; don't infer currently served bytes.
    servingVersionSettingsVerified:false,
    effectiveCloudflareAccessVerified:false,
    secretValuesReadOrDisplayed:false,
    storageSubscriptionActivated:false,
    providerDataMutated:false,
    gate4Accepted:false,productionReady:false
  });
}
async function onlyGet(token,path){
  const url=new URL(path,'https://api.cloudflare.com');
  if(url.origin!=='https://api.cloudflare.com'||!/^\/client\/v4\/accounts\/[a-f0-9]{32}\/workers\/scripts\/[a-z0-9-]+\/settings$/.test(url.pathname))
    stop();
  const res=await fetch(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{Authorization:'Bearer '+token}});
  if(!res.ok)stop();
  const body=await res.text();
  if(body.length>150000)stop();
  try{return JSON.parse(body)}catch{stop()}
}
export async function captureHostedBindingNames({token,request=onlyGet}={}){
  if(typeof token!=='string'||token.length<20||/\s/.test(token))stop();
  const result=[];
  for(const name of ['qa','staging','dr','new-live']){
    const cfg=TARGETS[name];
    const path='/client/v4/accounts/'+ACCOUNT_ID+'/workers/scripts/'+cfg.worker+'/settings';
    // Don't leak a whole Worker config if a provider error is thrown.
    const response=await request(token,path);
    result.push(evaluateHostedBindings(name,response));
  }
  return Object.freeze({
    result:'FIRE_G4_BINDING_NAMES_READ_ONLY_CAPTURE',
    accountScoped:true,targets:result,
    targetCount:result.length,
    providerReadbackVerified:request===onlyGet,
    noSecretValuesOutput:true,
    cloudflareWrites:false,providerDataMutated:false,
    servingWorkerVersionProof:false,accessEnforcementProof:false,
    gate4Accepted:false,releaseAuthorized:false
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);
  if(args.length===0){
    console.log(JSON.stringify({result:'OFFLINE_NO_PROVIDER',
      targetNames:Object.keys(TARGETS),providerContacted:false,gate4Accepted:false}));
  }else if(args.length===1&&args[0]==='--capture'){
    try{
      if(process.platform!=='win32'||!process.stdin.isTTY||!process.stdout.isTTY||
        process.env.CI||process.env.GITHUB_ACTIONS)stop();
      const proof=await captureHostedBindingNames({token:process.env.CLOUDFLARE_API_TOKEN});
      console.log(JSON.stringify(proof,null,2));
      if(proof.targets.some(x=>!x.expectedDBIdentityMatches||
         x.r2BindingCount!==0||x.wrongTargetAuthSecretCount>0||
         x.unexpectedPaymentCredentialBindings>0||!x.expectedAuthSecretTypesValid))
        process.exitCode=2;
    }catch{console.error('FIRE G4 HOSTED BINDINGS READ-ONLY STOP: no verified complete four-target receipt');process.exitCode=1;}
  }else{console.error('FIRE G4 HOSTED BINDINGS READ-ONLY STOP: unapproved arguments');process.exitCode=1;}
}
