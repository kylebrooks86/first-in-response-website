/** 
 * FIRE G9 - owner-only, one-shot, INACTIVE TEST version upload.
 * Authorization: Issue #19 comment 7173488079. NO deployment/activation.
 * Required private process environment variables:
 * CLOUDFLARE_API_TOKEN and FIRE_G9_RESTRICTED_TEST_KEY.
 * Usage: node owner_gate9_activation_inactive_once_20261125.mjs "C:\absolute\sealed-review-folder"
 */
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,realpathSync,lstatSync} from 'node:fs';
import {resolve,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {uploadOneInactiveTestVersion} from './gate9_private_test_activation_version_upload.mjs';

const WORKER='fire-stripe-test-20261101';
const PREV='96e32262-fa33-4f04-a161-bee11f0353e2';
const DB='dba421ba-fc66-4cf8-9c31-51616f8249ba';
const STRIPE='acct_1ULRIG7ND12rd1wI';
const ORIGIN='https://fire-stripe-test-20261101.kyle-bfc.workers.dev';
const PIN='9ab0785724f1f9cd2b0254ec662545a5881ed2d6f62951fc4016d3c35c801481';
const SOURCE='33f24500d9b6af665c4fa1e2e1e588e92227c70e';
const LOCK='gate9-one-inactive-provider-attempt-consumed-20261125.json';
const fail=code=>{throw Error('G9_ONCE_STOP_'+code)};
const must=(condition,code)=>{if(!condition)fail(code)};
function wranglerJson(args) {
  const win=process.platform==='win32';
  const cmd=win?'cmd.exe':'wrangler';
  const cmdargs=win?['/d','/s','/c','wrangler.cmd '+args.join(' ')]:args;
  const p=spawnSync(cmd,cmdargs,{encoding:'utf8',windowsHide:true,shell:false,timeout:30000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
  must(!p.error&&p.status===0&&typeof p.stdout==='string','WRANGLER_READ');
  try{return JSON.parse(p.stdout.trim())}catch{fail('WRANGLER_JSON')}
}
function servingState(){
  const s=wranglerJson(['deployments','status','--name',WORKER,'--json']);
  must(Array.isArray(s.versions)&&s.versions.length===1,'SERVING_SHAPE');
  return {accountId:'bfc00939cfb2f8dfd8581a7a7f5f1307',worker:WORKER,
    activeVersion:s.versions[0].version_id,activePercentage:Number(s.versions[0].percentage)};
}
function predecessorDetails(){
  const v=wranglerJson(['versions','view',PREV,'--name',WORKER,'--json']);
  must(v?.id===PREV&&Array.isArray(v?.resources?.bindings),'PREDECESSOR_READ');
  return v;
}
async function cloudflareTokenTarget(token){
  const url='https://api.cloudflare.com/client/v4/accounts/bfc00939cfb2f8dfd8581a7a7f5f1307/workers/workers/'+WORKER+'/versions/'+PREV;
  let r;
  try{r=await fetch(url,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)})}
  catch{fail('CF_TOKEN_READ')}
  must(r.ok,'CF_TOKEN_SCOPE_OR_ACCOUNT');
  let v;try{v=await r.json()}catch{fail('CF_TOKEN_JSON')}
  must(v?.success===true&&v?.result?.id===PREV,'CF_TOKEN_WRONG_TARGET');
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
function verifyUploadedVersion(id){
  must(/^[a-f0-9-]{36}$/i.test(id)&&id!==PREV,'NEW_ID');
  const v=wranglerJson(['versions','view',id,'--name',WORKER,'--json']);
  must(v?.id===id&&Array.isArray(v?.resources?.bindings),'NEW_VERSION_READ');
  const bindings=v.resources.bindings;
  const byName=name=>bindings.filter(x=>x?.name===name);
  const plain=(name,text)=>byName(name).length===1&&byName(name)[0].type==='plain_text'&&byName(name)[0].text===text;
  const secrets=bindings.filter(x=>x.type==='secret_text').map(x=>x.name).sort();
  const expected=['FIRE_ACCESS_AUD','FIRE_ACCESS_OWNER_EMAIL','FIRE_ACCESS_TEAM_DOMAIN','STRIPE_RESTRICTED_KEY','STRIPE_WEBHOOK_SECRET'].sort();
  must(bindings.filter(x=>x.type==='d1').length===1&&byName('DB').length===1&&byName('DB')[0].id===DB,'NEW_D1');
  must(secrets.length===expected.length&&expected.every((x,i)=>secrets[i]===x),'NEW_SECRETS');
  must(plain('FIRE_ENV','cloudflare-staging')&&plain('SITE_ORIGIN',ORIGIN)&&
    plain('FIRE_ACCESS_REQUIRED','enabled')&&plain('FIRE_STRIPE_MODE','test')&&
    plain('FIRE_STRIPE_EXPECTED_ACCOUNT_ID',STRIPE)&&plain('FIRE_GATE9_PRIVATE_ACTIVATION','owner-approved'),'NEW_VARS');
  must(!bindings.some(x=>['r2','r2_bucket','assets','kv_namespace','service'].includes(x.type)),'NEW_STORAGE');
  const now=servingState();
  must(now.activeVersion===PREV&&now.activePercentage===100,'ACTIVE_PREDECESSOR_CHANGED');
}
export async function main(args=process.argv.slice(2)){
  must(args.length===1&&isAbsolute(args[0]),'PACKAGE_PATH');
  const root=resolve(args[0]);
  must(existsSync(root)&&lstatSync(root).isDirectory()&&!lstatSync(root).isSymbolicLink()&&
    realpathSync(root)===root,'PACKAGE_ROOT');
  const receipt=JSON.parse(readFileSync(join(root,'activation-review-receipt.json'),'utf8'));
  must(receipt?.sourceSha===SOURCE&&receipt?.worker===WORKER&&receipt?.d1===DB&&
    receipt?.account===STRIPE&&receipt?.rollbackVersion===PREV,'PACKAGE_IDENTITY');
  const lock=join(root,LOCK);
  must(!existsSync(lock),'ATTEMPT_ALREADY_CONSUMED');
  const token=process.env.CLOUDFLARE_API_TOKEN, key=process.env.FIRE_G9_RESTRICTED_TEST_KEY;
  must(typeof token==='string'&&token.length>10&&!/\s/.test(token),'CLOUDFLARE_TOKEN');
  must(typeof key==='string'&&/^rk_test_[A-Za-z0-9]+$/.test(key),'RESTRICTED_TEST_KEY');
  await cloudflareTokenTarget(token); // read-only scoped token check BEFORE any one-shot reservation
  const predecessor=predecessorDetails();
  const prior=servingState();
  must(prior.activeVersion===PREV&&prior.activePercentage===100,'PREVIOUS_SERVING_DRIFT');
  // No provider POST can occur until the inherited bindings, package receipt,
  // sandbox identity and live serving state match. Atomic local lock is written
  // immediately before the one and only provider POST; never auto-retry.
  const result=await uploadOneInactiveTestVersion({
    packageRoot:root,receiptPin:PIN,restrictedKey:key,predecessor,
    readServingState:async()=>prior,
    verifyStripeAccount:stripeAccount,
    permissionGate:async x=>x.action==='create-one-inactive-test-version'&&
      x.worker===WORKER&&x.receiptPin===PIN&&x.predecessor===PREV,
    reserveOnce:async()=>{
      try{
        writeFileSync(lock,JSON.stringify({worker:WORKER,sourceSha:SOURCE,
          authorizedIssue19Comment:7173488079,receiptPin:PIN,previousVersion:PREV,
          attemptedAt:new Date().toISOString(),status:'CONSUMED_DO_NOT_RETRY'},null,2)+'\n',{flag:'wx',mode:0o600});
        return true;
      }catch{return false}
    },
    tokenProvider:async()=>token,fetchImpl:fetch
  });
  verifyUploadedVersion(result.newVersion);
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
