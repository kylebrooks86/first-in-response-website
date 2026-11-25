// Local review only. No transport, credentials, deployable config or provider writes.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyGate9NoAssetsDarkSource} from './prepare_gate9_noassets_dark_source.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const SOURCE='673b167cc73998d8766af7a0fbad33462b5953fa';
const PIN='4797b4c6a34a9615bac2e93839a0c3da9e9756e725bc7b131076c2ff31361b71';
const ACCOUNT='acct_1ULRIG7ND12rd1wI';
const ORIGIN='https://fire-stripe-test-20261101.kyle-bfc.workers.dev';
const need=(x)=>{if(!x)throw Error('G9_ACTIVATION_REVIEW_STOP')};
export function reviewActivation(root){
 const proof=verifyGate9NoAssetsDarkSource(root,PIN);
 need(proof.sourceSha===SOURCE&&proof.filesVerified===240&&proof.clientAssets===41&&proof.serverModules===193&&proof.receiptPinVerified);
 const entry=readFileSync(join(root,'server/fire-gate9-noassets-entry.mjs'),'utf8');
 const before='env.FIRE_STRIPE_MODE!=="disabled"||';
 need(entry.split(before).length===2);
 const after='env.FIRE_STRIPE_MODE!=="test"||\n     env.FIRE_STRIPE_EXPECTED_ACCOUNT_ID!=="'+ACCOUNT+'"||\n     env.SITE_ORIGIN!=="'+ORIGIN+'"||';
 const proposed=entry.replace(before,after);
 need(proposed.includes('env?.FIRE_GATE9_PRIVATE_ACTIVATION!=="owner-approved"')&&proposed.includes('env.FIRE_ACCESS_REQUIRED!=="enabled"'));
 return {status:'G9_TEST_ACTIVATION_ENTRY_REVIEW_ONLY',sourceSha:SOURCE,baselineReceiptSha256:PIN,baselineEntrySha256:sha(entry),proposedEntrySha256:sha(proposed),proposedEntry:proposed,proposedBindings:{FIRE_STRIPE_MODE:'test',FIRE_STRIPE_EXPECTED_ACCOUNT_ID:ACCOUNT,FIRE_GATE9_PRIVATE_ACTIVATION:'blocked'},requiredNewSecretName:'STRIPE_RESTRICTED_KEY',providerContacted:false,uploadAuthorized:false,activationAuthorized:false,requestSendable:false,gate9Accepted:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{need(process.argv.length===4);const out=reviewActivation(resolve(process.argv[2]));writeFileSync(resolve(process.argv[3]),JSON.stringify(out,null,2)+'\n',{flag:'wx',mode:0o600});console.log('G9 ACTIVATION ENTRY REVIEW CREATED; BASELINE PIN VERIFIED; NO PROVIDER ACTION');}
 catch{console.error('G9_ACTIVATION_REVIEW_STOP');process.exitCode=1;}
}
