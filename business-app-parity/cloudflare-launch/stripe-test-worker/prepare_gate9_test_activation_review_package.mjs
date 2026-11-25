// Separate offline-only TEST activation entry generation. No provider transport.
// Preserve the original disabled candidate and never use its spent upload path.
import {readFileSync,writeFileSync,mkdirSync,existsSync,lstatSync,copyFileSync} from 'node:fs';
import {join,resolve,dirname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {reviewActivationCandidate} from './review_gate9_test_activation_candidate.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const stop=()=>{throw Error('GATE9_ACTIVATION_PACKAGE_STOP');};
const guardText="const WORKER='fire-stripe-test-20261101';\nconst ACCOUNT='acct_1ULRIG7ND12rd1wI';\nconst DB='dba421ba-fc66-4cf8-9c31-51616f8249ba';\nconst ORIGIN='https://fire-stripe-test-20261101.kyle-bfc.workers.dev';\nfunction testActivationGuard(env,request){\n if(!env||env.FIRE_GATE9_PRIVATE_ACTIVATION!=='owner-approved'||\n env.FIRE_ENV!=='cloudflare-staging'||env.FIRE_STRIPE_MODE!=='test'||\n env.FIRE_ACCESS_REQUIRED!=='enabled'||env.SITE_ORIGIN!==ORIGIN||\n env.FIRE_STRIPE_EXPECTED_ACCOUNT_ID!==ACCOUNT||env.STRIPE_SECRET_KEY!==undefined||\n !/^rk_test_[A-Za-z0-9]+$/.test(env.STRIPE_RESTRICTED_KEY||'')||\n !/^whsec_[A-Za-z0-9]+$/.test(env.STRIPE_WEBHOOK_SECRET||'')||\n !env.FIRE_ACCESS_AUD||!env.FIRE_ACCESS_OWNER_EMAIL||!env.FIRE_ACCESS_TEAM_DOMAIN||\n !env.DB||env.BUCKET!==undefined||env.ASSETS!==undefined)return false;\n try{return new URL(request.url).origin===ORIGIN}catch{return false}\n}\n";
const entry= 'import server from "./index.js";\nimport manifest from "./fire-inline-assets/manifest.mjs";\nimport {serveBundledAsset} from "./fire-inline-assets/runtime.mjs";\n'+guardText+
'\nexport default Object.freeze({async fetch(request,env,ctx){\n'+
' if(!testActivationGuard(env,request))return new Response(null,{status:404,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});\n'+
' const direct=serveBundledAsset(request,manifest);if(direct)return direct;\n'+
' return server.fetch(request,{...env,ASSETS:{fetch(input){const req=input instanceof Request?input:new Request(input);return Promise.resolve(serveBundledAsset(req,manifest)||new Response(null,{status:404}));}}},ctx);\n}});\n';
export function prepareActivationReviewPackage(input,pin,output){
 const from=resolve(input),to=resolve(output);
 if(existsSync(to)||to===from||to.startsWith(from+sep)||from.startsWith(to+sep))stop();
 const reviewed=reviewActivationCandidate(from,pin);
 const receipt=JSON.parse(readFileSync(join(from,'gate9-noassets-dark-source-receipt.json'),'utf8'));
 const config=JSON.parse(readFileSync(join(from,'server/wrangler.json'),'utf8'));
 if(config.main!=='fire-gate9-noassets-entry.mjs'||config.vars.FIRE_GATE9_PRIVATE_ACTIVATION!=='blocked')stop();
 mkdirSync(to,{mode:0o700});
 const inventory=[];
 for(const row of receipt.savedInventory){
  if(!row.path.startsWith('server/')||row.path==='server/wrangler.json'||row.path==='server/fire-gate9-noassets-entry.mjs')continue;
  if(row.path.includes('..')||row.path.includes('\\'))stop();
  const src=join(from,row.path),dst=join(to,row.path);
  if(lstatSync(src).isSymbolicLink()||hash(readFileSync(src))!==row.sha256)stop();
  mkdirSync(dirname(dst),{recursive:true});copyFileSync(src,dst);
  inventory.push({path:row.path,sha256:hash(readFileSync(dst)),bytes:row.bytes});
 }
 const entryPath='server/fire-gate9-test-activation-entry.mjs';
 writeFileSync(join(to,entryPath),entry,{flag:'wx'});
 inventory.push({path:entryPath,sha256:hash(entry),bytes:Buffer.byteLength(entry)});
 // Deliberately not named wrangler.json; no runnable upload configuration.
 const proposal={...config,main:'fire-gate9-test-activation-entry.mjs',vars:{...config.vars,...reviewed.proposedChanges},secrets:{required:reviewed.requiredPrivateBindingNames}};
 writeFileSync(join(to,'activation-config.REVIEW-ONLY.json'),JSON.stringify(proposal,null,2)+'\n',{flag:'wx'});
 const proof={...reviewed,status:'GATE9_ACTIVATION_ENTRY_PACKAGED_REVIEW_ONLY',entrySha256:hash(entry),
 configSha256:hash(readFileSync(join(to,'activation-config.REVIEW-ONLY.json'))),inventory,inventoryDigest:hash(JSON.stringify(inventory)),
 activationAuthorized:false,uploadAuthorized:false,providerContacted:false};
 writeFileSync(join(to,'activation-review-receipt.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
 return {status:proof.status,sourceSha:proof.sourceSha,files:inventory.length,entrySha256:proof.entrySha256,inventoryDigest:proof.inventoryDigest,providerContacted:false,activationAuthorized:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==5)stop();console.log(JSON.stringify(prepareActivationReviewPackage(...process.argv.slice(2)),null,2))}
 catch{console.error('GATE9_ACTIVATION_PACKAGE_STOP: no provider action; preserve input and partial output');process.exitCode=1}
}
