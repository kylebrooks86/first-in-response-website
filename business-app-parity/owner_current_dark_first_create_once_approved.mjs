/**
 * FIRE QA-master DR / NEW LIVE — source-pinned owner first-create tool.
 *
 * INSPECT (OFFLINE, default, no network / writes):
 *   node owner_current_dark_first_create_once_approved.mjs inspect dr|new-live EXACT_SAVED_ZIP
 *
 * CREATE (NEVER run without separate exact owner authorization):
 *   node owner_current_dark_first_create_once_approved.mjs create dr|new-live EXACT_SAVED_ZIP
 *
 * Only one brand-new DARK Worker, no public URLs/login/Stripe/R2/D1 writes.
 * All failures after the durable attempt lock require READ-ONLY follow-up.
 */
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,mkdirSync,writeFileSync,openSync,writeSync,fsyncSync,closeSync,readdirSync,rmSync} from 'node:fs';
import {join,resolve,dirname,sep} from 'node:path';
import {homedir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {inflateRawSync} from 'node:zlib';
import {createInterface} from 'node:readline/promises';
import {pathToFileURL} from 'node:url';
import {verifyOwnerAccountReadback,verifyPhysicalD1InfoReadback,
 verifyNewWorkerAbsentReadback,verifyCreatedWorkerListReadback}
 from './owner_current_first_create_provider_evidence.mjs';
const blocked=why=>{throw Error('FIRE ONE-SHOT DARK FIRST-CREATE STOP: '+why)};
const sha=b=>createHash('sha256').update(b).digest('hex');
const SOURCE='e27b39df06c1ed4ff63cd437e39fd3e314142eec';
const ACCOUNT='bfc00939cfb2f8dfd8581a7a7f5f1307';
const TARGETS={
 dr:{worker:'fire-fullapp-dr',env:'isolated-dr',db:'fire-fullapp-dr-db',
  uuid:'5e55c5b7-cd67-4c8f-a52e-40f71b5d3145',var:'FIRE_DR_AUTH_ENABLED',
  zipBytes:3100484,zipSha:'f0f307bca99d44c796e3d966c2de424c47173deb70168da73c3c87a63ad21ef4'},
 'new-live':{worker:'fire-fullapp-new-live',env:'new-live-prelaunch',db:'fire-fullapp-new-live-db',
  uuid:'0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662',var:'FIRE_NEW_LIVE_AUTH_ENABLED',
  zipBytes:3102669,zipSha:'06cd1886806fd8cad4d0ed26fbac3005b6eeb4ac3012efa84bf5e0c4b1d23fac'}
};
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let n=0;n<8;n++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=b=>{let c=-1;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^-1)>>>0};
const hex=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function unpackVerifiedZip(file,spec){
 const bytes=readFileSync(file);
 if(bytes.length!==spec.zipBytes||sha(bytes)!==spec.zipSha)blocked('saved ZIP is not exact reviewed private Drive file (SHA256 and byte length)');
 let end=-1;
 for(let k=bytes.length-22;k>=Math.max(0,bytes.length-65557);k--){
  if(bytes.readUInt32LE(k)===0x06054b50&&k+22+bytes.readUInt16LE(k+20)===bytes.length){end=k;break}
 }
 if(end<0||bytes.readUInt16LE(end+4)!==0||bytes.readUInt16LE(end+6)!==0||
    bytes.readUInt16LE(end+8)!==bytes.readUInt16LE(end+10))blocked('multipart or invalid ZIP directory');
 const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12);
 let p=bytes.readUInt32LE(end+16),total=0;
 if(count<200||count>450||p+size!==end)blocked('incomplete, oversized or ZIP64 archive');
 const seen=new Map();
 for(let i=0;i<count;i++){
  if(p+46>bytes.length||bytes.readUInt32LE(p)!==0x02014b50)blocked('invalid ZIP central entry');
  const flags=bytes.readUInt16LE(p+8),method=bytes.readUInt16LE(p+10),
   crc=bytes.readUInt32LE(p+16),compressed=bytes.readUInt32LE(p+20),
   expanded=bytes.readUInt32LE(p+24),nameLength=bytes.readUInt16LE(p+28),
   extra=bytes.readUInt16LE(p+30),comment=bytes.readUInt16LE(p+32),
   external=bytes.readUInt32LE(p+38),local=bytes.readUInt32LE(p+42),
   next=p+46+nameLength+extra+comment;
  if(next>bytes.length||nameLength<5)blocked('bad ZIP entry length');
  const name=bytes.subarray(p+46,p+46+nameLength).toString('utf8');
  if(!/^(?:first-create-source-only-receipt\.json|server\/[A-Za-z0-9._~/-]+)$/.test(name)||
     name.includes('//')||name.split('/').some(s=>s==='.'||s==='..')||seen.has(name)||
     ![0,8].includes(method)||(flags&1)!==0||
     (external>>>16 & 0xf000)!==0x8000||expanded>10_000_000||compressed>4_000_000)
   blocked('unsupported, linked, duplicate or unsafe ZIP entry: '+name);
  if(local+30>p||bytes.readUInt32LE(local)!==0x04034b50)blocked('bad local ZIP header');
  const localNameLength=bytes.readUInt16LE(local+26),localExtra=bytes.readUInt16LE(local+28);
  if(bytes.subarray(local+30,local+30+localNameLength).toString('utf8')!==name)
   blocked('local ZIP file name differs');
  const start=local+30+localNameLength+localExtra;
  if(start+compressed>p||start+compressed>bytes.length)blocked('invalid ZIP local data span');
  const data=method===0?bytes.subarray(start,start+compressed):
   inflateRawSync(bytes.subarray(start,start+compressed),{maxOutputLength:10_000_000});
  if(data.length!==expanded||crc32(data)!==crc)blocked('ZIP data CRC or length differs: '+name);
  total+=expanded;if(total>28_000_000)blocked('ZIP expanded data limit exceeded');
  seen.set(name,Buffer.from(data));p=next;
 }
 if(p!==end||seen.size!==count)blocked('ZIP central directory mismatch');
 return seen;
}
function checkPackage(target,filename){
 const spec=TARGETS[target];if(!spec)blocked('target must be dr or new-live');
 if(!existsSync(filename))blocked('exact private Drive ZIP does not exist locally');
 const files=unpackVerifiedZip(filename,spec);
 const get=path=>{const bytes=files.get(path);if(!bytes)blocked('missing expected saved file: '+path);return bytes};
 let receipt,cfg;
 try{receipt=JSON.parse(get('first-create-source-only-receipt.json'));cfg=JSON.parse(get('server/wrangler.json'));}
 catch{blocked('malformed saved receipt or Worker config')}
 const inv=receipt.overlayServerFiles;
 if(receipt.kind!=='FIRE_EXACT_CURRENT_DARK_FIRST_CREATE_CONFIG_OVERLAY_V1'||
  receipt.target!==target||receipt.worker!==spec.worker||receipt.reviewedSourceSha!==SOURCE||
  receipt.futureSecretDeclarationOnlyRemoved!==true||receipt.originalCompiledModulesUnchanged!==true||
  receipt.allRequestsDeniedBeforeActivation!==true||receipt.publicRoutesDisabled!==true||
  receipt.paidStorageDisabled!==true||!hex(receipt.sourceDarkReceiptSha256)||
  !hex(receipt.originalWranglerConfigSha256)||!hex(receipt.originalServerFilesSha256)||
  !hex(receipt.firstCreateWranglerConfigSha256)||!hex(receipt.overlayServerFilesSha256)||
  !Array.isArray(inv)||inv.length!==files.size-1)
   blocked('first-create receipt does not match reviewed QA-master release');
 for(const flag of ['ownerAuthenticationEnabled','firstCreateAuthorized','providerContacted',
  'workerCreatedByOverlay','workerDeployedByOverlay','physicalD1Queried',
  'migrationPerformedByOverlay','stripeModified','hostedParityAccepted',
  'gate4Accepted','gate5Accepted','gate6Accepted','gate7Accepted','gate9Accepted','gate10Accepted']){
  if(receipt[flag]!==false)blocked('release receipt includes unsupported provider or gate claim: '+flag);
 }
 const paths=[...files.keys()].filter(x=>x!=='first-create-source-only-receipt.json').sort();
 if(!same(paths,inv.map(x=>'server/'+x.path).sort()))blocked('ZIP member list differs from trusted source inventory');
 const catalog=[];
 for(const record of inv){
  const name='server/'+record.path,data=get(name);
  if(!Number.isSafeInteger(record.bytes)||record.bytes<1||data.length!==record.bytes||
     !hex(record.sha256)||sha(data)!==record.sha256)
   blocked('compiled SSR/asset inventory mismatch: '+name);
  catalog.push(record);
 }
 if(!same(catalog,inv)||sha(Buffer.from(JSON.stringify(catalog)))!==receipt.overlayServerFilesSha256||
    sha(get('server/wrangler.json'))!==receipt.firstCreateWranglerConfigSha256)
   blocked('compiled full-source/first-create config seal mismatch');
 if(cfg.name!==spec.worker||cfg.main!=='fire-noassets-entry.mjs'||
  cfg.no_bundle!==true||cfg.workers_dev!==false||cfg.preview_urls!==false||
  cfg.find_additional_modules!==true||cfg.preserve_file_names!==true||
  cfg.secrets!==undefined||cfg.assets!==undefined||cfg.account_id!==undefined||
  cfg.routes!==undefined||cfg.route!==undefined||cfg.zone_id!==undefined||
  !same(cfg.d1_databases,[{binding:'DB',database_name:spec.db,database_id:spec.uuid}])||
  !same(cfg.r2_buckets,[])||!same(cfg.rules,[{type:'ESModule',globs:['**/*.js','**/*.mjs']}])||
  !same(Object.keys(cfg.vars).sort(),['FIRE_ENV','FIRE_PHOTO_STORAGE_MODE','SITE_ORIGIN',spec.var].sort())||
  cfg.vars.FIRE_ENV!==spec.env||cfg.vars[spec.var]!=='blocked'||
  cfg.vars.FIRE_PHOTO_STORAGE_MODE!=='owner-device-zip'||
  cfg.vars.SITE_ORIGIN!=='https://'+spec.worker+'.kyle-bfc.workers.dev')
   blocked('Worker not DARK, target-bound, independent, no-R2 or auth-disabled');
 const inert=v=>v===undefined||v===null||(typeof v==='object'&&Object.values(v).every(inert));
 for(const k of ['kv_namespaces','services','durable_objects','triggers','queues','workflows',
  'dispatch_namespaces','analytics_engine_datasets','hyperdrive','send_email',
  'tail_consumers','unsafe','vectorize','secrets_store_secrets','migrations']){
  if(!inert(cfg[k]))blocked('unapproved nonempty Worker resource: '+k)
 }
 const runtime=get('server/fire-inline-assets/runtime.mjs').toString('utf8');
 if(!runtime.includes('env.FIRE_DR_AUTH_ENABLED')||
    !runtime.includes('env.FIRE_NEW_LIVE_AUTH_ENABLED')||
    !runtime.includes('status:404')||!runtime.includes('if(!approvedDR&&!approvedLive)'))
  blocked('current-source private first-request guard not present');
 const entry=get('server/fire-noassets-entry.mjs').toString('utf8');
 if(!entry.includes('wrapInertDRWorker(server,manifest,"'+spec.env+'");'))
  blocked('private entry target mismatch');
 if(paths.filter(x=>/server\/fire-inline-assets\/asset-\d{3}-[a-f0-9]{16}\.bin$/.test(x)).length!==41)
  blocked('compiled QA-master 41 client Data modules incomplete');
 return {spec,files,receipt,bytes:spec.zipBytes,target,sourceSha:SOURCE};
}
function run(args,account){
 // Invoke the installed npm CLI through the exact Node binary, NOT cmd.exe.
 // Windows shell:true around the owner's home path could interpret & or %;
 // absence of npm is a hard stop, never a reason to weaken quoting or retry.
 const npmCli=[
  join(dirname(process.execPath),'node_modules','npm','bin','npx-cli.js'),
  join(dirname(process.execPath),'..','lib','node_modules','npm','bin','npx-cli.js')
 ].find(existsSync);
 if(!npmCli)blocked('Node npm/npx CLI not available at reviewed location; no provider action');
 const result=spawnSync(process.execPath,[npmCli,'--no-install','wrangler@4.162.0',...args],{
  encoding:'utf8',timeout:90_000,maxBuffer:2_000_000,windowsHide:true,
  env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account,WRANGLER_SEND_METRICS:'false'},
  shell:false});
 if(result.error)blocked('Wrangler invocation failed; no repeat after attempt lock: '+result.error.message);
 return {code:result.status,stdout:String(result.stdout||''),stderr:String(result.stderr||'')};
}
function ensureNoEarlierLocks(target){
 const root=join(homedir(),'Documents');
 if(!existsSync(root))return;
 for(const dir of readdirSync(root,{withFileTypes:true})){
  if(!dir.isDirectory()||!/^FIRE-.*(?:FIRST-?CREATE|FIRSTCREATE)/i.test(dir.name))continue;
  const key=target==='dr'?'DR':'NEW-LIVE';
  if(!dir.name.toUpperCase().includes(key))continue;
  for(const mark of ['REMOTE-FIRST-CREATE-ATTEMPT-LOCK.json','FIRST-CREATE-CLI-SUCCESS-READBACK.json']){
   if(existsSync(join(root,dir.name,mark)))blocked('previous Worker first-create attempt/receipt exists in '+dir.name+' — never repeat');
  }
 }
}
async function createDark(target,archive){
 if(process.platform!=='win32'||!process.stdin.isTTY||!process.stdout.isTTY||
    process.env.CI||process.env.GITHUB_ACTIONS||process.env.TF_BUILD)
  blocked('first creation requires interactive owner Acer Windows, never CI/browser/automation');
 const verified=checkPackage(target,archive),spec=verified.spec;
 if(process.env.CLOUDFLARE_ACCOUNT_ID&&process.env.CLOUDFLARE_ACCOUNT_ID!==ACCOUNT)
  blocked('existing Cloudflare account override differs from the previously accepted owner account');
 ensureNoEarlierLocks(target);
 // Do not leave a locked-out workspace after a harmless missing-session or D1 preflight failure.
 // The pinned Wrangler must already be locally installed; never fetch npm code automatically.
 const v=run(['--version'],ACCOUNT);
 if(v.code!==0||v.stdout.trim()!=='4.162.0')blocked('pinned Wrangler version unavailable; no Worker write');
 const who=run(['whoami','--json'],ACCOUNT);
 verifyOwnerAccountReadback(who,ACCOUNT);
 const db=run(['d1','info',spec.db,'--json'],ACCOUNT);
 verifyPhysicalD1InfoReadback(db,spec.db,spec.uuid);
 const home=join(homedir(),'Documents');
 const workspace=join(home,'FIRE-FIRSTCREATE-'+target.toUpperCase()+'-'+SOURCE.slice(0,8));
 if(existsSync(workspace))blocked('workspace already exists; do NOT restart or override earlier first-create investigation');
 mkdirSync(workspace,{recursive:false,mode:0o700});
 try{
 const dir=join(workspace,'first-create-worker');
 for(const [path,bytes] of verified.files){
  if(path==='first-create-source-only-receipt.json')continue;
  const dst=join(dir,...path.split('/'));
  mkdirSync(dirname(dst),{recursive:true,mode:0o700});
  writeFileSync(dst,bytes,{flag:'wx',mode:0o600});
 }
 writeFileSync(join(workspace,'first-create-source-only-receipt.json'),
  verified.files.get('first-create-source-only-receipt.json'),{flag:'wx',mode:0o600});
 const cfg=join(dir,'server','wrangler.json');
 const local=run(['deploy','--dry-run','--no-bundle','--config',cfg,
  '--outdir',join(workspace,'dry-run')],ACCOUNT);
 if(local.code!==0)blocked('local Wrangler compilation failed; no Worker write');
 const rl=createInterface({input:process.stdin,output:process.stdout});
 const required='CREATE FIRE DARK '+target.toUpperCase()+' '+spec.uuid;
 let answer;try{answer=await rl.question('Type exactly '+required+' to authorize ONE provider first-creation: ')}
 finally{rl.close()}
 if(answer!==required)blocked('owner declined; no Worker creation');
 // Check Worker nonexistence immediately before sealing the one-shot provider attempt.
 const prior=run(['versions','list','--name',spec.worker,'--json'],ACCOUNT);
 verifyNewWorkerAbsentReadback(prior);
 const lock=join(workspace,'REMOTE-FIRST-CREATE-ATTEMPT-LOCK.json');
 const fd=openSync(lock,'wx',0o600);
 try{
  const payload={sourceSha:SOURCE,zipSha256:spec.zipSha,worker:spec.worker,db:spec.uuid,
   authorizedAction:'FIRST CREATE BRAND-NEW DARK WORKER ONLY',attemptedUtc:new Date().toISOString(),
   providerOutcome:'UNCONFIRMED_IF_INTERRUPTED_DO_NOT_RETRY'};
  writeSync(fd,Buffer.from(JSON.stringify(payload,null,2)+'\n'));fsyncSync(fd);
 }finally{closeSync(fd)}
 const created=run(['deploy','--no-bundle','--config',cfg],ACCOUNT);
 if(created.code!==0)blocked('provider first-create outcome UNKNOWN; durable lock retained. READ ONLY follow-up; never rerun');
 const post=run(['versions','list','--name',spec.worker,'--json'],ACCOUNT);
 const hostedVersionEvidence=verifyCreatedWorkerListReadback(post);
 writeFileSync(join(workspace,'FIRST-CREATE-CLI-SUCCESS-READBACK.json'),JSON.stringify({
  sourceSha:SOURCE,worker:spec.worker,db:spec.uuid,zipSha256:spec.zipSha,
  darkWorkerDeployCliSucceeded:true,versionsListCliSucceeded:true,
  hostedVersionCount:hostedVersionEvidence.versionCount,
  hostedAuthVerified:false,hostedPhysicalBindingReadbackVerified:false,
  gate4Accepted:false,gate10Accepted:false,completedUtc:new Date().toISOString()
 },null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('FIRE one-shot DARK first-create CLI succeeded; source routes/login blocked; preserve attempt lock and receipt. NO release gate accepted.');
 }catch(error){
  // Only delete THIS new, script-owned staging directory before a provider attempt lock exists.
  // Once the attempt lock exists, NEVER delete or retry: a remote write may have occurred.
  if(!existsSync(join(workspace,'REMOTE-FIRST-CREATE-ATTEMPT-LOCK.json'))){
   rmSync(workspace,{recursive:true,force:true});
  }
  throw error;
 }
}
export {checkPackage};
const invoked=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(invoked){
 const [mode,target,archive,...rest]=process.argv.slice(2);
 try{
  if(rest.length||!['inspect','create'].includes(mode)||!TARGETS[target]||!archive)
   blocked('usage: node SCRIPT inspect|create dr|new-live EXACT_REVIEWED_ZIP');
  if(mode==='inspect'){
   const r=checkPackage(target,resolve(archive));
   console.log(JSON.stringify({result:'CURRENT_QA_MASTER_FIRST_CREATE_ZIP_OFFLINE_VERIFIED',
    target:r.target,reviewedSourceSha:r.sourceSha,zipBytes:r.bytes,
    zipSha256:r.spec.zipSha,filesVerified:r.files.size,firstCreateAuthorized:false,
    providerContacted:false,workerCreated:false,readyForProduction:false},null,2));
  }else await createDark(target,resolve(archive));
 }catch(e){console.error(e.message);process.exitCode=1}
}
