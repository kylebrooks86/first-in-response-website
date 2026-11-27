/** 
 * FIRE G9 - owner-only, one-shot, INACTIVE TEST version upload.
 * Authorization: Issue #19 comment 7199064695. NO deployment/activation.
 * Required private process environment variables:
 * CLOUDFLARE_API_TOKEN and FIRE_G9_RESTRICTED_TEST_KEY.
 * Usage: node owner_gate9_activation_inactive_once_20261126.mjs "C:\absolute\sealed-review-folder"
 */
import {readFileSync,writeFileSync,existsSync,realpathSync,lstatSync} from 'node:fs';
import {resolve,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {uploadOneInactiveTestVersion,WORKER_ID,prepareModules} from './gate9_private_test_activation_version_upload_v2.mjs';

const WORKER='fire-stripe-test-20261101';
const PREV='96e32262-fa33-4f04-a161-bee11f0353e2';
const DB='dba421ba-fc66-4cf8-9c31-51616f8249ba';
const STRIPE='acct_1ULRIG7ND12rd1wI';
const ORIGIN='https://fire-stripe-test-20261101.kyle-bfc.workers.dev';
const PIN='9ab0785724f1f9cd2b0254ec662545a5881ed2d6f62951fc4016d3c35c801481';
const SOURCE='33f24500d9b6af665c4fa1e2e1e588e92227c70e';
const OLD_LOCK='gate9-one-inactive-provider-attempt-consumed-20261125.json';
const LOCK='gate9-one-inactive-provider-attempt-consumed-20261126.json';
const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
const API='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/workers/';
const PRIOR_INACTIVE='85ac79f2-dd9a-48e1-831b-de2211e48cfa';
const fail=code=>{throw Error('G9_ONCE_STOP_'+code)};
const must=(condition,code)=>{if(!condition)fail(code)};
async function get(token,path){
  const res=await fetch(API+path,{method:'GET',redirect:'error',cache:'no-store',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
  must(res.ok,'CF_READ');
  const j=await res.json();must(j.success===true&&j.result,'CF_RESULT');return j.result;
}
async function servingState(token){
  const d=await get(token,'scripts/'+WORKER+'/deployments?page=1&per_page=1');
  const s=d.deployments?.[0]?.versions;
  must(Array.isArray(s)&&s.length===1,'SERVING_SHAPE');
  return {accountId:ACCOUNT,worker:WORKER,activeVersion:s[0].version_id,activePercentage:s[0].percentage};
}
async function readVersion(token,id){
  must(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id),'VERSION_ID');
  const v=await get(token,'scripts/'+WORKER+'/versions/'+id);
  must(v.id===id&&Array.isArray(v.resources?.bindings),'VERSION_READ');return v;
}
async function preflight(token){
  for(const id of [WORKER,WORKER_ID]){
    const w=await get(token,'workers/'+id);
    must(w.id===WORKER_ID&&w.name===WORKER,'WORKER_IDENTITY');
  }
  const list=await get(token,'scripts/'+WORKER+'/versions?page=1&per_page=10');
  must(Array.isArray(list.items)&&list.items[0]?.id===PRIOR_INACTIVE,'NEWER_VERSION_REVIEW_REQUIRED');
  const sub=await get(token,'scripts/'+WORKER+'/subdomain');
  must(sub.previews_enabled===false,'PREVIEW_ENABLED');
}
async function stripeAccount(key){
  let r;
  try{r=await fetch('https://api.stripe.com/v1/account',{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(20000)})}
  catch{fail('STRIPE_ACCOUNT_READ')}
  must(r.ok,'STRIPE_ACCOUNT_HTTP');
  let a;try{a=await r.json()}catch{fail('STRIPE_ACCOUNT_JSON')}
  must(a?.id===STRIPE,'STRIPE_ACCOUNT_MISMATCH');
  return a.id;
}
async function verifyUploadedVersion(token,id){
  must(/^[a-f0-9-]{36}$/i.test(id)&&id!==PREV,'NEW_ID');
  const v=await readVersion(token,id);
  must(v?.id===id&&Array.isArray(v?.resources?.bindings),'NEW_VERSION_READ');
  const bindings=v.resources.bindings;
  const byName=name=>bindings.filter(x=>x?.name===name);
  const plain=(name,text)=>byName(name).length===1&&byName(name)[0].type==='plain_text'&&byName(name)[0].text===text;
  const secrets=bindings.filter(x=>x.type==='secret_text').map(x=>x.name).sort();
  const expected=['FIRE_ACCESS_AUD','FIRE_ACCESS_OWNER_EMAIL','FIRE_ACCESS_TEAM_DOMAIN','STRIPE_RESTRICTED_KEY','STRIPE_WEBHOOK_SECRET'].sort();
  must(bindings.filter(x=>x.type==='d1').length===1&&byName('DB').length===1&&(byName('DB')[0].database_id??byName('DB')[0].id)===DB&&(!byName('DB')[0].database_id||!byName('DB')[0].id||byName('DB')[0].database_id===byName('DB')[0].id),'NEW_D1');
  must(secrets.length===expected.length&&expected.every((x,i)=>secrets[i]===x),'NEW_SECRETS');
  must(plain('FIRE_ENV','cloudflare-staging')&&plain('SITE_ORIGIN',ORIGIN)&&
    plain('FIRE_ACCESS_REQUIRED','enabled')&&plain('FIRE_STRIPE_MODE','test')&&
    plain('FIRE_STRIPE_EXPECTED_ACCOUNT_ID',STRIPE)&&plain('FIRE_GATE9_PRIVATE_ACTIVATION','owner-approved'),'NEW_VARS');
  must(bindings.length===12&&new Set(bindings.map(x=>x.name)).size===12&&bindings.every(x=>['d1','secret_text','plain_text'].includes(x.type)),'NEW_STORAGE');
  const now=await servingState(token);
  must(now.activeVersion===PREV&&now.activePercentage===100,'ACTIVE_PREDECESSOR_CHANGED');
}
export async function main(args=process.argv.slice(2)){
  must(process.platform==='win32'&&!process.env.CI&&!process.env.GITHUB_ACTIONS,'OWNER_WINDOWS');
  must(args.length===2&&args[1]==='--execute-authorized-7199064695'&&isAbsolute(args[0]),'PACKAGE_PATH_OR_CONSENT');
  const root=resolve(args[0]);
  must(existsSync(root)&&lstatSync(root).isDirectory()&&!lstatSync(root).isSymbolicLink()&&
    realpathSync(root)===root,'PACKAGE_ROOT');
  const receipt=JSON.parse(readFileSync(join(root,'activation-review-receipt.json'),'utf8'));
  must(receipt?.sourceSha===SOURCE&&receipt?.worker===WORKER&&receipt?.d1===DB&&
    receipt?.account===STRIPE&&receipt?.rollbackVersion===PREV,'PACKAGE_IDENTITY');
  const old=join(root,OLD_LOCK);
  must(existsSync(old)&&lstatSync(old).isFile()&&!lstatSync(old).isSymbolicLink(),'HISTORICAL_LOCK_REQUIRED');
  const lock=join(root,LOCK);
  must(!existsSync(lock),'ATTEMPT_ALREADY_CONSUMED');
  const token=process.env.CLOUDFLARE_API_TOKEN, key=process.env.FIRE_G9_RESTRICTED_TEST_KEY;
  must(typeof token==='string'&&token.length>10&&!/\s/.test(token),'CLOUDFLARE_TOKEN');
  must(typeof key==='string'&&/^rk_test_[A-Za-z0-9]+$/.test(key),'RESTRICTED_TEST_KEY');
  must(prepareModules(root,PIN).modules.length===237,'PACKAGE_MODULE_COUNT');
  await preflight(token);
  const predecessor=await readVersion(token,PREV);
  const prior=await servingState(token);
  must(prior.activeVersion===PREV&&prior.activePercentage===100,'PREVIOUS_SERVING_DRIFT');
  // No provider POST can occur until the inherited bindings, package receipt,
  // sandbox identity and live serving state match. Atomic local lock is written
  // immediately before the one and only provider POST; never auto-retry.
  const result=await uploadOneInactiveTestVersion({
    packageRoot:root,receiptPin:PIN,restrictedKey:key,predecessor,
    readServingState:async()=>servingState(token),
    verifyStripeAccount:stripeAccount,
    permissionGate:async x=>x.action==='create-one-inactive-test-version'&&
      x.worker===WORKER&&x.receiptPin===PIN&&x.predecessor===PREV,
    reserveOnce:async()=>{
      try{
        writeFileSync(lock,JSON.stringify({worker:WORKER,sourceSha:SOURCE,
          authorizedIssue19Comment:7199064695,receiptPin:PIN,previousVersion:PREV,
          attemptedAt:new Date().toISOString(),status:'CONSUMED_DO_NOT_RETRY'},null,2)+'\n',{flag:'wx',mode:0o600});
        return true;
      }catch{return false}
    },
    tokenProvider:async()=>token,fetchImpl:fetch
  });
  await verifyUploadedVersion(token,result.newVersion);
  console.log('G9_INACTIVE_TEST_VERSION_READBACK_PASS');
  console.log('NEW_INACTIVE_VERSION='+result.newVersion);
  console.log('SERVING_100_PERCENT_PREDECESSOR='+PREV);
  console.log('NO_ACTIVATION_NO_PAYMENT_NO_LIVE_CHANGE');
  return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{await main()}catch(e){
    const msg=typeof e?.message==='string'&&/^(G9_ONCE_STOP_|G9_UPLOAD_STOP_)[A-Z0-9_]+$/.test(e.message)?e.message:'G9_ONCE_STOP_UNVERIFIED';
    console.error(msg+'; NEVER AUTO-RETRY. If lock exists, reconcile provider state read-only.');
    process.exitCode=1;
  }finally{
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.FIRE_G9_RESTRICTED_TEST_KEY;
  }
}
