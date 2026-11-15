/**
 * FIRE current-source DR / NEW LIVE first-creation overlay — OFFLINE ONLY.
 *
 * A brand-new, deliberately dark Worker has no configured authentication
 * secrets. Wrangler validates secrets.required even if all requests are
 * blocked. Prepare an out-of-place copy with ONLY that future-only declaration
 * removed. This command has NO Wrangler, network, deploy, login or SQL path.
 *
 * node prepare_current_dark_first_create_overlay.mjs prepare dr|new-live VERIFIED_DARK_PACKAGE REVIEWED_SHA NEW_EMPTY_OUTPUT
 * node prepare_current_dark_first_create_overlay.mjs verify dr|new-live VERIFIED_DARK_PACKAGE REVIEWED_SHA SAVED_OUTPUT
 *
 * A later, exact owner-authorized provider first-creation requires a SEPARATE
 * reviewed tool and approval. Never treat this overlay as deployment consent.
 */
import {createHash} from 'node:crypto';
import {
  cpSync,existsSync,lstatSync,mkdirSync,readFileSync,readdirSync,writeFileSync
} from 'node:fs';
import {join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyCurrentDarkWorkerPackage} from './prepare_current_dark_worker_package.mjs';

const blocked=why=>{throw Error('FIRE PRIVATE FIRST CREATE BLOCKED: '+why);};
const hash=b=>createHash('sha256').update(b).digest('hex');
const shaFile=p=>hash(readFileSync(p));
const identical=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const isSha=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
const requirePlainDir=p=>{
 if(!existsSync(p)||lstatSync(p).isSymbolicLink()||!lstatSync(p).isDirectory())
  blocked('source/output directory must be an ordinary existing directory');
};
const listFiles=root=>{
 requirePlainDir(root);
 const names=[];
 function walk(dir){
  for(const name of readdirSync(dir).sort()){
   const full=join(dir,name),st=lstatSync(full);
   if(st.isSymbolicLink()||(!st.isDirectory()&&(!st.isFile()||st.nlink!==1)))
    blocked('link/special file not allowed');
   if(st.isDirectory())walk(full);
   else names.push(relative(root,full).split(sep).join('/'));
  }
 }
 walk(root);
 return names.sort();
};
const getJson=p=>{
 try{
  const x=JSON.parse(readFileSync(p,'utf8'));
  if(!x||typeof x!=='object'||Array.isArray(x))blocked('invalid object JSON');
  return x;
 }catch{blocked('missing or malformed JSON file');}
};
const targetSecretNames=target=>{
 if(target==='dr')return ['FIRE_DR_PASSWORD_HASH','FIRE_DR_SESSION_SECRET'];
 if(target==='new-live')return ['FIRE_NEW_LIVE_PASSWORD_HASH','FIRE_NEW_LIVE_SESSION_SECRET'];
 blocked('explicit dr or new-live target required');
};
function inspectOriginal(target,source,expectedSha){
 if(!isSha(expectedSha))blocked('exact 40-character reviewed SHA required');
 const original=verifyCurrentDarkWorkerPackage(target,source);
 if(original.compiledSourceSha!==expectedSha||original.sourceOnly!==true||
    original.providerContacted!==false||original.workerDeployed!==false||
    original.firstRequestAuthBlocked!==true||
    original.workersDev!==false||original.previewUrls!==false)
  blocked('original source/target or dark safety receipt mismatch');
 const cfg=getJson(join(source,'server/wrangler.json'));
 const secrets=targetSecretNames(target);
 if(!identical(cfg.secrets,{required:secrets}))
  blocked('only the exact future-only two-secret declaration can be removed');
 const normalized=structuredClone(cfg);
 delete normalized.secrets;
 // Preserve every other field, especially the pinned D1, exact runtime,
 // blocked login, disabled Worker URLs, no R2, no Stripe and no routes.
 return {original,source,config:cfg,overlayConfig:normalized};
}
const inventory=root=>listFiles(root).map(path=>({
 path,bytes:readFileSync(join(root,path)).length,sha256:shaFile(join(root,path))
}));
const overlayName='first-create-source-only-receipt.json';
const exactKeys=[
 'kind','target','worker','reviewedSourceSha','sourceDarkReceiptSha256',
 'originalWranglerConfigSha256','firstCreateWranglerConfigSha256',
 'originalServerFilesSha256','overlayServerFilesSha256','overlayServerFiles',
 'futureSecretDeclarationOnlyRemoved','originalCompiledModulesUnchanged',
 'allRequestsDeniedBeforeActivation','publicRoutesDisabled','paidStorageDisabled',
 'ownerAuthenticationEnabled','firstCreateAuthorized','providerContacted',
 'workerCreated','workerDeployed','physicalD1Queried','databaseMigrated',
 'stripeModified','hostedParityAccepted','gate4Accepted','gate5Accepted',
 'gate6Accepted','gate7Accepted','gate9Accepted','gate10Accepted'
].sort();
export function verifyCurrentDarkFirstCreateOverlay(target,sourceFolder,expectedSha,outputFolder){
 const source=resolve(sourceFolder),out=resolve(outputFolder);
 const inspected=inspectOriginal(target,source,expectedSha);
 if(out===source||out.startsWith(source+sep)||source.startsWith(out+sep))
  blocked('the output must be disjoint from the original reviewed source');
 requirePlainDir(out);
 const expected=listFiles(join(source,'server'));
 const found=listFiles(out);
 if(!identical(found,[overlayName,...expected.map(x=>'server/'+x)].sort()))
  blocked('overlay must contain ONLY copied Worker files and one source receipt');
 const originalCfg=join(source,'server/wrangler.json');
 const copiedCfg=join(out,'server/wrangler.json');
 const actualCfg=getJson(copiedCfg);
 if(!identical(actualCfg,inspected.overlayConfig)||actualCfg.secrets!==undefined)
  blocked('first-create overlay changed something other than future-only secrets');
 for(const rel of expected){
  if(rel==='wrangler.json')continue;
  if(shaFile(join(source,'server',rel))!==shaFile(join(out,'server',rel))||
     readFileSync(join(source,'server',rel)).length!==
     readFileSync(join(out,'server',rel)).length)
   blocked('QA-master SSR / 41 client Data modules / first-request guard changed');
 }
 const receipt=getJson(join(out,overlayName));
 if(!identical(Object.keys(receipt).sort(),exactKeys))
  blocked('source-only receipt contains missing or extra fields');
 const inv=inventory(join(out,'server'));
 const originalInv=inventory(join(source,'server'));
 const trusted=getJson(join(source,'current-dark-source-receipt.json'));
 if(receipt.kind!=='FIRE_EXACT_CURRENT_DARK_FIRST_CREATE_CONFIG_OVERLAY_V1'||
    receipt.target!==target||receipt.worker!==trusted.worker||
    receipt.reviewedSourceSha!==expectedSha||
    receipt.sourceDarkReceiptSha256!==shaFile(join(source,'current-dark-source-receipt.json'))||
    receipt.originalWranglerConfigSha256!==shaFile(originalCfg)||
    receipt.firstCreateWranglerConfigSha256!==shaFile(copiedCfg)||
    receipt.originalServerFilesSha256!==hash(Buffer.from(JSON.stringify(originalInv)))||
    receipt.overlayServerFilesSha256!==hash(Buffer.from(JSON.stringify(inv)))||
    !identical(receipt.overlayServerFiles,inv)||
    receipt.futureSecretDeclarationOnlyRemoved!==true||
    receipt.originalCompiledModulesUnchanged!==true||
    receipt.allRequestsDeniedBeforeActivation!==true||
    receipt.publicRoutesDisabled!==true||
    receipt.paidStorageDisabled!==true)
  blocked('overlay receipt identity/source-byte custody not exact');
 for(const key of [
  'ownerAuthenticationEnabled','firstCreateAuthorized','providerContacted',
  'workerCreated','workerDeployed','physicalD1Queried','databaseMigrated',
  'stripeModified','hostedParityAccepted','gate4Accepted','gate5Accepted',
  'gate6Accepted','gate7Accepted','gate9Accepted','gate10Accepted'
 ])if(receipt[key]!==false)blocked('overlay receipt falsely asserts provider/acceptance');
 return Object.freeze({
  status:'FIRE_CURRENT_DARK_FIRST_CREATE_CONFIG_ONLY_VERIFIED',
  target,reviewedSourceSha:expectedSha,filesVerified:inv.length,
  futureSecretsNotInjected:true,firstRequestDenied:true,
  noProviderCalls:true,deployed:false,firstCreationAuthorized:false
 });
}
export function prepareCurrentDarkFirstCreateOverlay(target,sourceFolder,expectedSha,outputFolder){
 const source=resolve(sourceFolder),out=resolve(outputFolder);
 const checked=inspectOriginal(target,source,expectedSha);
 if(existsSync(out)||out===source||out.startsWith(source+sep)||
    source.startsWith(out+sep))
  blocked('output must be NEW, absent and disjoint; never overwrite source');
 mkdirSync(out,{mode:0o700});
 cpSync(join(source,'server'),join(out,'server'),
  {recursive:true,force:false,errorOnExist:true});
 const configPath=join(out,'server/wrangler.json');
 writeFileSync(configPath,JSON.stringify(checked.overlayConfig,null,2)+'\n',
  {flag:'w',mode:0o600});
 // Never use a remote deployment or auth/Stripe action in this source-only tool.
 const originalCfg=join(source,'server/wrangler.json');
 const originalInv=inventory(join(source,'server'));
 const inv=inventory(join(out,'server'));
 const originalDarkReceipt=getJson(join(source,'current-dark-source-receipt.json'));
 const receipt={
  kind:'FIRE_EXACT_CURRENT_DARK_FIRST_CREATE_CONFIG_OVERLAY_V1',
  target,worker:originalDarkReceipt.worker,reviewedSourceSha:expectedSha,
  sourceDarkReceiptSha256:shaFile(join(source,'current-dark-source-receipt.json')),
  originalWranglerConfigSha256:shaFile(originalCfg),
  firstCreateWranglerConfigSha256:shaFile(configPath),
  originalServerFilesSha256:hash(Buffer.from(JSON.stringify(originalInv))),
  overlayServerFilesSha256:hash(Buffer.from(JSON.stringify(inv))),
  overlayServerFiles:inv,
  futureSecretDeclarationOnlyRemoved:true,
  originalCompiledModulesUnchanged:true,
  allRequestsDeniedBeforeActivation:true,
  publicRoutesDisabled:true,paidStorageDisabled:true,
  ownerAuthenticationEnabled:false,firstCreateAuthorized:false,
  providerContacted:false,workerCreated:false,workerDeployed:false,
  physicalD1Queried:false,databaseMigrated:false,stripeModified:false,
  hostedParityAccepted:false,
  gate4Accepted:false,gate5Accepted:false,gate6Accepted:false,
  gate7Accepted:false,gate9Accepted:false,gate10Accepted:false
 };
 writeFileSync(join(out,overlayName),JSON.stringify(receipt,null,2)+'\n',
  {flag:'wx',mode:0o600});
 return verifyCurrentDarkFirstCreateOverlay(target,source,expectedSha,out);
}
async function main(){
 const [mode,target,source,sha,out,...extra]=process.argv.slice(2);
 if(extra.length||!['prepare','verify'].includes(mode)||!source||!sha||!out)
  blocked('use prepare|verify dr|new-live EXISTING_SOURCE EXACT_COMMIT_SHA NEW_OR_EXISTING_OUTPUT');
 const result=mode==='prepare'?
  prepareCurrentDarkFirstCreateOverlay(target,source,sha,out):
  verifyCurrentDarkFirstCreateOverlay(target,source,sha,out);
 console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main()}catch(e){console.error(String(e.message));process.exitCode=1;}
}
