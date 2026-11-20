/**
 * FIRE existing DARK DR / NEW LIVE Worker QA-source CODE UPDATE.
 * The Workers already EXIST: this is NEVER a first-create tool.
 *
 * Offline, default: node owner_existing_dark_code_update_once_approved.mjs inspect dr|new-live EXACT_OWNER_SAVED_ZIP
 * REMOTE WRITE: --publish is reserved for a separate, explicit owner approval
 * bound to target, exact source, current Worker version, exact D1 and code-only
 * scope. This script itself grants NO approval and NEVER auto-retries.
 *
 * Owner-private CLI output contains no credentials, URLs/tokens or D1 rows.
 * NO SQL, Access changes, secrets setup, Stripe, R2, DNS, routes or cutover.
 */
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,openSync,writeSync,fsyncSync,closeSync,mkdirSync,rmSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {homedir} from 'node:os';
import {inflateRawSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {pathToFileURL} from 'node:url';
import {verifyCurrentDarkHostedEvidence} from './owner_current_dark_postcreate_readonly.mjs';

const stop=s=>{throw Error('FIRE EXISTING DARK UPDATE STOP: '+s)};
const hash=b=>createHash('sha256').update(b).digest('hex');
const SOURCE='15bd714c435a585f695ed7166cf06d2c31ea1a8e';
const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
export const TARGETS=Object.freeze({
 dr:Object.freeze({name:'fire-fullapp-dr',env:'isolated-dr',db:'fire-fullapp-dr-db',
  uuid:'5e55c5b7-cd67-4c8f-a52e-40f71b5d3145',auth:'FIRE_DR_AUTH_ENABLED',
  previousVersion:'b7c42773-5a93-4c6c-91d2-83cdb8e857d9',
  bytes:3140291,sha:'eee57f2a5f98c4c9aa84c881818414094868bae5fef41d45c339073e269ecfb0'}),
 'new-live':Object.freeze({name:'fire-fullapp-new-live',env:'new-live-prelaunch',db:'fire-fullapp-new-live-db',
  uuid:'0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662',auth:'FIRE_NEW_LIVE_AUTH_ENABLED',
  previousVersion:'adb5fd7c-ddd0-4e97-87e7-6a4045d42d09',
  bytes:3142402,sha:'8c19774e4e11f08c011c5e274d815ab341e287cdcf714cce1c647a782b75d67c'})
});
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let n=0;n<8;n++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
const crc32=b=>{let c=-1;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^-1)>>>0};
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hex64=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

function readStrictZip(path,spec){
 const zip=readFileSync(path);
 if(zip.length!==spec.bytes||hash(zip)!==spec.sha)
  stop('the exact frozen owner-private archive SHA256 or byte size differs');
 let end=-1;
 for(let k=zip.length-22;k>=Math.max(0,zip.length-65557);k--){
  if(zip.readUInt32LE(k)===0x06054b50&&k+22+zip.readUInt16LE(k+20)===zip.length){end=k;break;}
 }
 if(end<0||zip.readUInt16LE(end+4)!==0||zip.readUInt16LE(end+6)!==0||
    zip.readUInt16LE(end+8)!==zip.readUInt16LE(end+10))stop('invalid/multipart ZIP');
 const count=zip.readUInt16LE(end+10),size=zip.readUInt32LE(end+12);
 let p=zip.readUInt32LE(end+16),total=0;
 if(count!==243||p+size!==end)stop('unexpected number of files or ZIP64/central directory');
 const files=new Map();
 for(let i=0;i<count;i++){
  if(p+46>end||zip.readUInt32LE(p)!==0x02014b50)stop('malformed ZIP index');
  const flags=zip.readUInt16LE(p+8),method=zip.readUInt16LE(p+10),
   crc=zip.readUInt32LE(p+16),compressed=zip.readUInt32LE(p+20),
   expanded=zip.readUInt32LE(p+24),n=zip.readUInt16LE(p+28),
   extra=zip.readUInt16LE(p+30),comment=zip.readUInt16LE(p+32),
   ext=zip.readUInt32LE(p+38),local=zip.readUInt32LE(p+42),next=p+46+n+extra+comment;
  if(next>end||n<5)stop('invalid ZIP file name/entry length');
  const pathName=zip.subarray(p+46,p+46+n).toString('utf8');
  if(!/^(?:first-create-source-only-receipt\.json|server\/[A-Za-z0-9._~/-]+)$/.test(pathName)||
     pathName.includes('//')||pathName.split('/').some(s=>s==='.'||s==='..')||
     files.has(pathName)||![0,8].includes(method)||(flags&1)!==0||
     (ext>>>16&0xf000)!==0x8000||expanded>10_000_000||compressed>4_000_000)
    stop('unsafe or unreviewed ZIP member');
  if(local+30>p||zip.readUInt32LE(local)!==0x04034b50)stop('bad local ZIP record');
  const ln=zip.readUInt16LE(local+26),le=zip.readUInt16LE(local+28),start=local+30+ln+le;
  if(zip.subarray(local+30,local+30+ln).toString('utf8')!==pathName||
     start+compressed>p||start+compressed>zip.length)stop('ZIP local/central mismatch');
  const b=method===0?zip.subarray(start,start+compressed):
   inflateRawSync(zip.subarray(start,start+compressed),{maxOutputLength:10_000_000});
  if(b.length!==expanded||crc32(b)!==crc)stop('ZIP data digest invalid');
  total+=expanded;if(total>30_000_000)stop('ZIP expanded size exceeded');
  files.set(pathName,Buffer.from(b));p=next;
 }
 if(p!==end||files.size!==count)stop('ZIP directory incomplete');
 return files;
}

/** Exact offline QA-master source and current dark-target, private, no-R2 review. */
export function inspectExistingDarkUpdateArchive(target,path){
 const spec=TARGETS[target];
 if(!spec||!path||!existsSync(path))stop('target must be dr/new-live and saved archive must exist');
 const files=readStrictZip(path,spec);
 let cfg,receipt;
 try{
  cfg=JSON.parse(files.get('server/wrangler.json'));
  receipt=JSON.parse(files.get('first-create-source-only-receipt.json'));
 }catch{stop('missing or malformed sealed config/receipt');}
 if(!obj(receipt)||receipt.kind!=='FIRE_EXACT_CURRENT_DARK_FIRST_CREATE_CONFIG_OVERLAY_V1'||
    receipt.target!==target||receipt.worker!==spec.name||receipt.reviewedSourceSha!==SOURCE||
    receipt.futureSecretDeclarationOnlyRemoved!==true||
    receipt.originalCompiledModulesUnchanged!==true||
    receipt.allRequestsDeniedBeforeActivation!==true||receipt.publicRoutesDisabled!==true||
    receipt.paidStorageDisabled!==true||
    !Array.isArray(receipt.overlayServerFiles)||receipt.overlayServerFiles.length!==242||
    !hex64(receipt.overlayServerFilesSha256)||
    !hex64(receipt.firstCreateWranglerConfigSha256)||
    hash(files.get('server/wrangler.json'))!==receipt.firstCreateWranglerConfigSha256)
  stop('QA source overlay provenance/claimed dark safety incorrect');
 const barred=['ownerAuthenticationEnabled','firstCreateAuthorized','providerContacted',
  'workerCreatedByOverlay','workerDeployedByOverlay','physicalD1Queried',
  'migrationPerformedByOverlay','stripeModified','hostedParityAccepted',
  'gate4Accepted','gate5Accepted','gate6Accepted','gate7Accepted','gate9Accepted','gate10Accepted'];
 if(barred.some(k=>receipt[k]!==false))stop('source-only receipt falsely claims provider work/release');
 const inventory=receipt.overlayServerFiles;
 const actual=[...files.entries()].filter(([k])=>k.startsWith('server/'))
  .map(([k,b])=>({path:k.slice(7),bytes:b.length,sha256:hash(b)}))
  .sort((a,b)=>a.path.localeCompare(b.path,'en'));
 // Pinned ZIP digest plus complete byte-by-byte inventory prevents unnoticed
 // compiled asset changes and wrong-target/source reuse.
 const inventoryByPath=new Map(inventory.map(v=>[v.path,v]));
 if(inventoryByPath.size!==242||actual.length!==242||actual.some(v=>{
  const expected=inventoryByPath.get(v.path);
  return !expected||expected.bytes!==v.bytes||expected.sha256!==v.sha256;
 })||hash(Buffer.from(JSON.stringify(inventory)))!==receipt.overlayServerFilesSha256)
  stop('compiled SSR / static Data bytes differ from reviewed source inventory');
 const exactVars={FIRE_ENV:spec.env,
  SITE_ORIGIN:'https://'+spec.name+'.kyle-bfc.workers.dev',
  [spec.auth]:'blocked',FIRE_PHOTO_STORAGE_MODE:'owner-device-zip'};
 if(!obj(cfg)||cfg.name!==spec.name||cfg.main!=='fire-noassets-entry.mjs'||
    cfg.workers_dev!==false||cfg.preview_urls!==false||
    cfg.assets!==undefined||cfg.routes!==undefined||cfg.route!==undefined||
    cfg.account_id!==undefined||cfg.zone_id!==undefined||cfg.secrets!==undefined||
    cfg.no_bundle!==true||cfg.find_additional_modules!==true||
    cfg.preserve_file_names!==true||
    !eq(cfg.rules,[{type:'ESModule',globs:['**/*.js','**/*.mjs']}])||
    !eq(cfg.d1_databases,[{binding:'DB',database_name:spec.db,database_id:spec.uuid}])||
    !eq(cfg.r2_buckets,[])||
    !eq(Object.entries(cfg.vars||{}).sort(),Object.entries(exactVars).sort()))
  stop('unsafe target Worker identity, route, vars, physical D1 or paid binding');
 const disallowed=['kv_namespaces','services','durable_objects','queues','workflows',
  'triggers','dispatch_namespaces','analytics_engine_datasets','hyperdrive',
  'send_email','mtls_certificates','pipelines','vpc_services','vpc_networks',
  'vectorize','ai_search','ai_search_namespaces','migrations','secrets_store_secrets'];
 if(disallowed.some(k=>cfg[k]!==undefined&&
    (Array.isArray(cfg[k])?cfg[k].length!==0:
     obj(cfg[k])?Object.values(cfg[k]).some(v=>Array.isArray(v)?v.length!==0:Boolean(v)):
     Boolean(cfg[k]))))stop('unexpected extra resource or migration binding');
 const entry=files.get('server/fire-noassets-entry.mjs')?.toString('utf8');
 const runtime=files.get('server/fire-inline-assets/runtime.mjs')?.toString('utf8');
 if(!entry?.includes('wrapInertDRWorker(server,manifest,"'+spec.env+'")')||
    !runtime?.includes('if(!approvedDR&&!approvedLive)')||
    !runtime?.includes('status:404')||
    !runtime?.includes("'Cache-Control':'private, no-store'")||
    !runtime?.includes('env.FIRE_NEW_LIVE_AUTH_ENABLED')||
    !runtime?.includes('env.FIRE_DR_AUTH_ENABLED')||
    [...files.keys()].filter(k=>/^server\/fire-inline-assets\/asset-\d{3}-[0-9a-f]{16}\.bin$/.test(k)).length!==41)
  stop('first-request lock, target-specific entry or complete QA assets missing');
 return Object.freeze({
  target,worker:spec.name,dbUuid:spec.uuid,existingServingVersion:spec.previousVersion,
  sourceSha:SOURCE,archiveSha256:spec.sha,filesVerified:files.size,
  syntheticQaMasterCompiledSource:true,sourceOnly:true,authBlocked:true,
  routesDisabled:true,r2Disabled:true,workerExistsAlready:true,
  providerContacted:false,workerUpdated:false,allowedToPublish:false
 });
}

function runWrangler(args){
 const npmCli=[
  join(dirname(process.execPath),'node_modules','npm','bin','npx-cli.js'),
  join(dirname(process.execPath),'..','lib','node_modules','npm','bin','npx-cli.js')
 ].find(existsSync);
 if(!npmCli)stop('reviewed local npm CLI missing; never install/auth retry');
 const r=spawnSync(process.execPath,[npmCli,'--no-install','wrangler@4.162.0',...args],{
  encoding:'utf8',timeout:90000,maxBuffer:1000000,windowsHide:true,shell:false,
  env:{...process.env,CLOUDFLARE_ACCOUNT_ID:ACCOUNT,WRANGLER_SEND_METRICS:'false'}
 });
 if(r.error)stop('Wrangler command uncertain: '+r.error.message);
 return {code:r.status,stdout:String(r.stdout||''),stderr:String(r.stderr||'')};
}
function getHostedState(target){
 const spec=TARGETS[target];
 const replies={
  whoami:runWrangler(['whoami','--json']),
  d1Info:runWrangler(['d1','info',spec.db,'--json']),
  versionsList:runWrangler(['versions','list','--name',spec.name,'--json']),
  deploymentStatus:runWrangler(['deployments','status','--name',spec.name,'--json']),
  versionDetail:null,d1List:null
 };
 let serving;
 try{const s=JSON.parse(replies.deploymentStatus.stdout);
  if(replies.deploymentStatus.code!==0||!Array.isArray(s.versions)||s.versions.length!==1||
     s.versions[0].percentage!==100)stop('not exactly one 100%-serving dark version');
  serving=s.versions[0].version_id??s.versions[0].id;
 }catch(e){if(String(e.message).startsWith('FIRE EXISTING'))throw e;
   stop('cannot parse dark Worker active version');}
 if(serving!==spec.previousVersion)stop('serving version drift; no update approved against current predecessor');
 replies.versionDetail=runWrangler(['versions','view',serving,'--name',spec.name,'--json']);
 replies.d1List=runWrangler(['d1','list','--json']);
 const proof=verifyCurrentDarkHostedEvidence(target,replies);
 if(proof.servingVersionId!==spec.previousVersion||proof.physicalD1Uuid!==spec.uuid||
    proof.darkAuthDisabledInHostedVariables!==true)
  stop('physical Worker/D1/disabled-auth mismatch');
 return proof;
}
function versionStillSame(reply,worker,expected){
 if(reply.code!==0)stop('last-moment active version read failed');
 let x;try{x=JSON.parse(reply.stdout)}catch{stop('last-moment status not JSON');}
 const versions=x?.versions;
 if(!Array.isArray(versions)||versions.length!==1||versions[0]?.percentage!==100||
    (versions[0]?.version_id??versions[0]?.id)!==expected||
    (x.name!==undefined&&x.name!==worker))
  stop('existing DARK Worker changed before attempt; no write');
 return true;
}
function writeLock(p,data){
 const fd=openSync(p,'wx',0o600);
 try{writeSync(fd,Buffer.from(JSON.stringify(data,null,2)+'\n'));fsyncSync(fd)}
 finally{closeSync(fd)}
}
async function publish(target,archive){
 // The owner must have separately and explicitly approved this exact action
 // in conversation. This is a manual interactive Acer tool, never an agent.
 if(process.platform!=='win32'||!process.stdin.isTTY||!process.stdout.isTTY||
    process.env.CI||process.env.GITHUB_ACTIONS||process.env.TF_BUILD)
  stop('remote update requires owner Acer Windows + NEW exact separate authorization');
 if(process.env.CLOUDFLARE_ACCOUNT_ID&&process.env.CLOUDFLARE_ACCOUNT_ID!==ACCOUNT)
  stop('unreviewed Cloudflare account selected');
 const spec=TARGETS[target];
 inspectExistingDarkUpdateArchive(target,archive);
 const home=join(homedir(),'Documents');
 const workspace=join(home,'FIRE-EXISTING-DARK-UPDATE-'+target.toUpperCase()+'-'+SOURCE.slice(0,8));
 if(existsSync(workspace))stop('prior update workspace/attempt exists; preserve it and NEVER restart blindly');
 const installed=runWrangler(['--version']);
 if(installed.code!==0||installed.stdout.trim()!=='4.162.0')
  stop('installed Wrangler must be 4.162.0; no install/retry');
 getHostedState(target);
 mkdirSync(workspace,{mode:0o700});
 const lock=join(workspace,'REMOTE-UPDATE-ATTEMPT-LOCK.json');
 try{
  // Always extract into a new script-owned folder; no overwriting source.
  const files=readStrictZip(archive,spec);
  for(const [path,bytes] of files){
   const dest=join(workspace,'verified-package',...path.split('/'));
   mkdirSync(dirname(dest),{recursive:true,mode:0o700});
   writeFileSync(dest,bytes,{flag:'wx',mode:0o600});
  }
  const cfg=join(workspace,'verified-package','server','wrangler.json');
  const dry=runWrangler(['deploy','--dry-run','--no-bundle',
    '--config',cfg,'--outdir',join(workspace,'dry-run')]);
  if(dry.code!==0)stop('offline Wrangler no-bundle dry-run failed; no provider write');
  const required='UPDATE EXISTING DARK '+target.toUpperCase()+' '+spec.previousVersion+' TO '+SOURCE;
  const rl=createInterface({input:process.stdin,output:process.stdout});
  let typed;try{typed=await rl.question('Type EXACT full approval phrase: '+required+'\n> ')}
  finally{rl.close()}
  if(typed!==required)stop('owner did not type exact fresh-version code-only approval');
  versionStillSame(runWrangler(['deployments','status','--name',spec.name,'--json']),
    spec.name,spec.previousVersion);
  // Exact on-disk attempt lock BEFORE ANY remotely mutating command.
  writeLock(lock,{
   target,action:'EXISTING_DARK_WORKER_CODE_UPDATE_ONLY',
   worker:spec.name,predecessorVersion:spec.previousVersion,
   physicalD1:spec.uuid,sourceSha:SOURCE,reviewedZipSha256:spec.sha,
   status:'UNKNOWN_IF_INTERRUPTED_NO_RETRY',timeUtc:new Date().toISOString()
  });
  const updated=runWrangler(['deploy','--no-bundle','--config',cfg]);
  if(updated.code!==0)stop('remote update outcome UNKNOWN; attempt lock retained; do NOT repeat');
  writeFileSync(join(workspace,'CLI-UPLOAD-REPORTED-SUCCESS.json'),JSON.stringify({
    target,worker:spec.name,sourceSha:SOURCE,physicalD1:spec.uuid,
    originalVersion:spec.previousVersion,cliSuccess:true,
    postdeployHostedVerification:false,hostedParityAccepted:false,
    gate4Accepted:false,gate10Accepted:false,timeUtc:new Date().toISOString()
  },null,2)+'\n',{flag:'wx',mode:0o600});
  console.log('CLI reports code-only update completed for existing DARK Worker.');
  console.log('STOP: preserve attempt lock and request one NEW-VERSION read-only binding/serving proof. No public activation, gate closure or retry.');
 }catch(e){
  if(!existsSync(lock))rmSync(workspace,{recursive:true,force:true});
  throw e;
 }
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(invoked){
 const [mode,target,archive,...rest]=process.argv.slice(2);
 try{
  if(rest.length||!['inspect','--publish'].includes(mode)||!TARGETS[target]||!archive)
   stop('usage: inspect|--publish dr|new-live EXISTING_SAVED_EXACT_ZIP');
  if(mode==='inspect')console.log(JSON.stringify(inspectExistingDarkUpdateArchive(target,resolve(archive)),null,2));
  else await publish(target,resolve(archive));
 }catch(e){console.error(e.message);process.exitCode=1;}
}