/**
 * Source-only PREPARATION for the first creation of a DR Worker with NO
 * public workers.dev route, NO Version URLs, and NO custom route.
 *
 * Do not execute a remote "wrangler deploy" with this tool. First creation
 * would be a provider WRITE and a 100%-deployed version, even with public
 * routes disabled. It requires a NEW exact owner authorization.
 *
 * Input: the UNMODIFIED, independently SHA256-verified & extracted PR268
 * source-only PREHOST archive (GitHub artifact 14101977692).
 * Output: a NEW private folder; only the Wrangler config and new receipt differ.
 */
import {createHash} from 'node:crypto';
import {cpSync,existsSync,lstatSync,readFileSync,readdirSync,mkdirSync,writeFileSync}
 from 'node:fs';
import {resolve,join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const PARENT_SHA='22c68e2f2b0b2a2144385c8d27ff9dc3596c7953';
export const PARENT_ARTIFACT_ID=14101977692;
export const PARENT_ZIP_SHA256='ae3f0078b15376ed861d7c0c47e4943f88b700f528e5c65c2e8f5ae9de7761d4';
const PHYSICAL_DR_D1='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';
const DR_NAME='fire-fullapp-dr';
const DR_ORIGIN='https://fire-fullapp-dr.kyle-bfc.workers.dev';
const stop=(reason)=>{throw Error('FIRE DR dark-first-create BLOCKED: '+reason);};
const sha=(b)=>createHash('sha256').update(b).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const empty=(v)=>v===null||v===undefined||
 (Array.isArray(v)&&v.length===0)||
 (v&&typeof v==='object'&&!Array.isArray(v)&&Object.values(v).every(empty));

function exactOrdinaryPaths(root){
 if(!existsSync(root)||lstatSync(root).isSymbolicLink()||
    !lstatSync(root).isDirectory())stop('source must be a plain extracted archive directory');
 const paths=[];
 function visit(folder){
  for(const entry of readdirSync(folder).sort()){
   const full=join(folder,entry),st=lstatSync(full);
   if(st.isSymbolicLink())stop('linked source is not accepted');
   if(st.isDirectory()){visit(full);continue;}
   if(st.nlink!==1)stop('hardlinked source is not accepted');
   if(!st.isFile())stop('not a normal release source file');
   paths.push(relative(root,full).replaceAll('\\','/'));
  }
 }
 visit(root);
 return paths;
}
const json=(p)=>{try{return JSON.parse(readFileSync(p,'utf8'));}catch{stop('missing or unreadable immutable release receipt/config');}};
export function reviewBoundPrehost(input){
 const root=resolve(input),paths=exactOrdinaryPaths(root);
 const prehost=json(join(root,'dr-physical-prehost-source-receipt.json'));
 const configBytes=readFileSync(join(root,'server','wrangler.json'));
 const cfg=json(join(root,'server','wrangler.json'));
 if(prehost.kind!=='FIRE_DR_PREHOST_EXISTING_PHYSICAL_D1_BINDING_SOURCE_ONLY_V1'||
    prehost.fromSourceSha!=='37d94452772459334466e37010067395acafc696'||
    prehost.priorGitHubArtifactId!==14101337096||
    prehost.independentlyPinnedPriorArtifactZipSha256!=='f61b28b6b0f8e669f9863be995cf7d56d527a51d012ee9e77083fb260c059719'||
    prehost.originalPublicAssetCount!==41||
    prehost.originalPublicAssetsSha256Verified!==true||
    prehost.originalSourceServerModulesUnchanged!==true||
    prehost.physicalDRDatabaseId!==PHYSICAL_DR_D1||
    prehost.originalDR26MigrationsPreviouslyOwnerAccepted!==true||
    prehost.cloudflareWorkerExistsIndependentlyVerified!==false||
    prehost.cloudflareFirstWorkerCreationAuthorized!==false||
    prehost.workerDeployed!==false||prehost.workerUploaded!==false||
    prehost.physicalD1BindingDeployed!==false||
    prehost.ownerLoginEnabled!==false||
    prehost.providerContacted!==false||
    prehost.newConfigSha256!==sha(configBytes)||
    !/^[a-f0-9]{64}$/.test(prehost.oldNoAssetsSourceReceiptSha256))
  stop('wrong original provider-unmodified prehost proof or evidence state');
 if(cfg.name!==DR_NAME||cfg.main!=='fire-noassets-entry.mjs'||
    cfg.no_bundle!==true||cfg.find_additional_modules!==true||
    cfg.workers_dev!==true||cfg.preview_urls!==undefined||
    cfg.routes!==undefined||cfg.route!==undefined||
    cfg.assets!==undefined||cfg.legacy_env!==undefined||
    cfg.account_id!==undefined||cfg.zone_id!==undefined||cfg.env!==undefined||
    !same(cfg.d1_databases,[{binding:'DB',database_name:'fire-fullapp-dr-db',database_id:PHYSICAL_DR_D1}])||
    !same(cfg.r2_buckets,[])||
    !same(cfg.secrets?.required,['FIRE_DR_PASSWORD_HASH','FIRE_DR_SESSION_SECRET'])||
    !same(Object.entries(cfg.vars||{}).sort(),Object.entries({
      FIRE_ENV:'isolated-dr',SITE_ORIGIN:DR_ORIGIN,
      FIRE_DR_AUTH_ENABLED:'blocked',FIRE_PHOTO_STORAGE_MODE:'owner-device-zip'
    }).sort())||
    !empty(cfg.kv_namespaces)||!empty(cfg.services)||!empty(cfg.durable_objects)||
    !empty(cfg.queues)||!empty(cfg.triggers)||!empty(cfg.unsafe)||
    !empty(cfg.workflows)||!empty(cfg.dispatch_namespaces)||
    !empty(cfg.analytics_engine_datasets)||!empty(cfg.hyperdrive)||
    !empty(cfg.send_email)||!empty(cfg.tail_consumers))
  stop('unexpected physical D1, route, preview, provider, login, or storage binding');
 const original=paths.filter(p=>p.startsWith('server/')&&p!=='server/wrangler.json')
  .map(path=>({path,sha256:sha(readFileSync(join(root,path)))}));
 if(original.length<200||prehost.copiedServerModulesSha256!==sha(Buffer.from(JSON.stringify(original))))
  stop('one or more compiled QA-master server/static module bytes differ');
 return {root,paths,cfg,prehost,serverHashes:original};
}
export function prepareDarkFirstCreateDR(source,destination){
 const original=reviewBoundPrehost(source),out=resolve(destination);
 if(existsSync(out)||out===original.root||
    out.startsWith(original.root+sep)||original.root.startsWith(out+sep))
  stop('choose a NEW absent, disjoint output directory');
 // Do not change the trusted SSR Worker or embedded 41 static binary modules.
 mkdirSync(out,{recursive:false,mode:0o700});
 cpSync(join(original.root,'server'),join(out,'server'),
  {recursive:true,errorOnExist:true,force:false});
 const next=structuredClone(original.cfg);
 // A FIRST deploy still installs an active version. Disabling BOTH routes
 // prevents normal public workers.dev and version/preview URL exposure.
 next.workers_dev=false;
 next.preview_urls=false;
 // No routes or cron, no R2 and no authentication. The first creation must
 // never be mistaken for a zero-percent inactive version upload.
 if(next.routes||next.route||next.assets||next.r2_buckets.length||
    next.vars.FIRE_DR_AUTH_ENABLED!=='blocked')
  stop('unsafe output configuration');
 const conf=join(out,'server','wrangler.json');
 writeFileSync(conf,JSON.stringify(next,null,2)+'\n',{flag:'w'});
 const copied=original.serverHashes.map(x=>({path:x.path,
  sha256:sha(readFileSync(join(out,x.path)))}));
 if(!same(copied,original.serverHashes))stop('immutable QA-master bytes changed');
 const receipt={
  kind:'FIRE_DR_FIRST_CREATE_DARK_ROUTES_DISABLED_SOURCE_ONLY_V1',
  parentPR:268,parentSourceSha:PARENT_SHA,
  requiredParentArtifactId:PARENT_ARTIFACT_ID,
  independentlyRequiredParentZipSha256:PARENT_ZIP_SHA256,
  originalPrehostReceiptSha256:sha(readFileSync(join(original.root,
   'dr-physical-prehost-source-receipt.json'))),
  originalPrehostConfigSha256:sha(readFileSync(join(original.root,'server','wrangler.json'))),
  originalCompiledServerModulesSha256:original.prehost.copiedServerModulesSha256,
  finalWranglerConfigSha256:sha(readFileSync(conf)),
  worker:DR_NAME,drPhysicalD1:PHYSICAL_DR_D1,
  cloudflareWorkersDevRoute:false,cloudflareVersionPreviewUrls:false,
  customRoutesPresent:false,scheduledTriggersPresent:false,
  originalQaMasterModulesUnchanged:true,
  existingDR26MigrationsAcceptedPreviously:true,
  ownerAuthEnabled:false,usesR2:false,
  newFirstWorkerCreateAuthorized:false,firstProviderDeployPerformed:false,
  workerExistsVerified:false,providerAccountIdentityVerified:false,
  d1BindingPhysicallyHostedVerified:false,
  hostedRuntimeAndPrivateRoutingVerified:false,
  requiresFreshExactOwnerAuthorization:true,
  note:'SOURCE PREPARATION ONLY. Never run first wrangler deploy on behalf of owner. A first deploy would create a live version with no public routes, NOT a 0%-traffic upload.'
 };
 writeFileSync(join(out,'dark-first-create-source-receipt.json'),
  JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
 return {status:'DR_NO_PUBLIC_ROUTE_FIRST_CREATE_REVIEW_PACKAGE_ONLY',
  worker:DR_NAME,assetsUploadRequired:false,workersDev:false,previewUrls:false,
  ownerAuthEnabled:false,providerCalled:false,deployed:false,output:out};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==4)stop('usage: VERIFIED_EXTRACTED_PR268_ARCHIVE NEW_ABSENT_OUTPUT');
  console.log(JSON.stringify(prepareDarkFirstCreateDR(...process.argv.slice(2)),null,2));
 }catch(e){console.error(String(e.message));process.exitCode=1;}
}
