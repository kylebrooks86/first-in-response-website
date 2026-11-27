// Offline-only activation delta review. Never produces a deployable Wrangler config.
// The old disabled package and one-shot uploader remain unchanged.
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {verifyGate9NoAssetsDarkSource} from './prepare_gate9_noassets_dark_source.mjs';
const WORKER='fire-stripe-test-20261101';
const ACCOUNT='acct_1ULRIG7ND12rd1wI';
const DB='dba421ba-fc66-4cf8-9c31-51616f8249ba';
const ORIGIN='https://fire-stripe-test-20261101.kyle-bfc.workers.dev';
const SOURCE='33f24500d9b6af665c4fa1e2e1e588e92227c70e';
const PREDECESSOR='96e32262-fa33-4f04-a161-bee11f0353e2';
const stop=()=>{throw Error('GATE9_ACTIVATION_REVIEW_STOP');};
const hash=x=>createHash('sha256').update(x).digest('hex');
export function testActivationGuard(env,request){
 if(!env||env.FIRE_GATE9_PRIVATE_ACTIVATION!=='owner-approved'||
 env.FIRE_ENV!=='cloudflare-staging'||env.FIRE_STRIPE_MODE!=='test'||
 env.FIRE_ACCESS_REQUIRED!=='enabled'||env.SITE_ORIGIN!==ORIGIN||
 env.FIRE_STRIPE_EXPECTED_ACCOUNT_ID!==ACCOUNT||env.STRIPE_SECRET_KEY!==undefined||
 !/^rk_test_[A-Za-z0-9]+$/.test(env.STRIPE_RESTRICTED_KEY||'')||
 !/^whsec_[A-Za-z0-9]+$/.test(env.STRIPE_WEBHOOK_SECRET||'')||
 !env.FIRE_ACCESS_AUD||!env.FIRE_ACCESS_OWNER_EMAIL||!env.FIRE_ACCESS_TEAM_DOMAIN||
 !env.DB||env.BUCKET!==undefined||env.ASSETS!==undefined)return false;
 try{return new URL(request.url).origin===ORIGIN}catch{return false}
}
export function reviewActivationCandidate(folder,pin){
 if(!/^[a-f0-9]{64}$/.test(pin||''))stop();
 const proof=verifyGate9NoAssetsDarkSource(folder,pin);
 if(proof.sourceSha!==SOURCE||proof.worker!==WORKER||!proof.receiptPinVerified)stop();
 const config=JSON.parse(readFileSync(join(folder,'server/wrangler.json'),'utf8'));
 if(config.d1_databases?.length!==1||config.d1_databases[0].database_id!==DB||
 config.vars.SITE_ORIGIN!==ORIGIN||config.vars.FIRE_STRIPE_MODE!=='disabled'||
 config.vars.FIRE_GATE9_PRIVATE_ACTIVATION!=='blocked')stop();
 const guardSource=testActivationGuard.toString();
 return {status:'GATE9_OFFLINE_ACTIVATION_DELTA_REVIEWED_NOT_DEPLOYABLE',
 sourceSha:SOURCE,disabledPackageReceipt:pin,worker:WORKER,d1:DB,account:ACCOUNT,
 origin:ORIGIN,rollbackVersion:PREDECESSOR,guardSourceSha256:hash(guardSource),
 proposedChanges:{FIRE_STRIPE_MODE:'test',FIRE_STRIPE_EXPECTED_ACCOUNT_ID:ACCOUNT,
 FIRE_GATE9_PRIVATE_ACTIVATION:'blocked'},
 requiredPrivateBindingNames:[...config.secrets.required,'STRIPE_RESTRICTED_KEY'],
 forbiddenBindingNames:['STRIPE_SECRET_KEY','BUCKET'],
 runtimeGuardReviewRequired:true,providerBindingVerificationRequired:true,
 signingSecretVerificationRequired:true,activationAuthorized:false,
 uploadAuthorized:false,providerContacted:false,gate9Accepted:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==4)stop();console.log(JSON.stringify(reviewActivationCandidate(process.argv[2],process.argv[3]),null,2))}
 catch{console.error('GATE9_ACTIVATION_REVIEW_STOP: exact newly compiled source and independently pinned disabled package required');process.exitCode=1}
}
