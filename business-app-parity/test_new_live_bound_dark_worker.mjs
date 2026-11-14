/** NEW LIVE no-R2 physical D1 DARK source-only focused regression on real PR267 ZIP. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,mkdtempSync,readFileSync,readdirSync,writeFileSync,rmSync,symlinkSync}
 from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {prepareNewLiveBoundDarkWorker,reviewOriginalNewLive,SOURCE_SHA,
 SOURCE_ARTIFACT,ZIP_SHA} from './prepare_new_live_bound_dark_worker.mjs';
if(!process.argv[2])throw Error('verified real PR267 extracted ZIP required');
const root=resolve(process.argv[2]);
const tmp=mkdtempSync(join(tmpdir(),'fire-new-live-dark-prehost-'));
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
let n=0;
const ok=(v,why)=>{assert.ok(v,why);n++;};
const blocked=(fn,why)=>{assert.throws(fn,/FIRE NEW LIVE prehost BLOCKED:/,why);n++;};
const clone=name=>{const p=join(tmp,name);cpSync(root,p,{recursive:true});return p;};
function changed(name,mutate){const p=clone(name);mutate(p);blocked(()=>reviewOriginalNewLive(p),name);}
const cfg=p=>join(p,'server','wrangler.json');
function changeConfig(p,edit){
 const file=cfg(p),x=JSON.parse(readFileSync(file));
 edit(x);writeFileSync(file,JSON.stringify(x,null,2)+'\n');
}
try{
 const old=reviewOriginalNewLive(root);
 ok(old.paths.length===242&&old.receipt.assetFileCount===41,
   'actual saved original complete 242 Worker files and 41 original Data assets');
 ok(SOURCE_SHA==='3ee92374dca6322955fdd5f920a95e0864a9654f'&&
    SOURCE_ARTIFACT===14101058770&&
    ZIP_SHA==='7c701cc6401e3eba06f684db2dd5a770b4c137401224ef8aeb812d18faabaec3',
    'exact prior accepted Worker-only NEW LIVE provenance');
 const output=join(tmp,'new-bound-dark');
 const result=prepareNewLiveBoundDarkWorker(root,output);
 ok(result.deployed===false&&result.providerContacted===false&&
   result.job0001PhysicallyVerified===false,'no provider write or fake clean Job #0001');
 const a=JSON.parse(readFileSync(cfg(root))),b=JSON.parse(readFileSync(cfg(output)));
 ok(b.name==='fire-fullapp-new-live'&&b.main==='fire-noassets-entry.mjs'&&
   b.d1_databases[0].binding==='DB'&&
   b.d1_databases[0].database_name==='fire-fullapp-new-live-db'&&
   b.d1_databases[0].database_id==='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662',
   'only already owner-created physical LIVE D1 bound to source');
 ok(b.workers_dev===false&&b.preview_urls===false&&
   b.route===undefined&&b.routes===undefined&&
   (!b.triggers||Object.values(b.triggers).every(x=>x==null||
    (Array.isArray(x)&&x.length===0))),'first create has no normal public URL/preview/cron');
 ok(b.assets===undefined&&b.r2_buckets.length===0&&
   b.vars.FIRE_PHOTO_STORAGE_MODE==='owner-device-zip'&&
   b.vars.FIRE_NEW_LIVE_AUTH_ENABLED==='blocked'&&
   b.vars.FIRE_NEW_LIVE_CLEAN_START===undefined,
   'no assets-session, R2, auth or Job # activation');
 const expected=structuredClone(a);
 expected.d1_databases=[{binding:'DB',database_name:'fire-fullapp-new-live-db',
   database_id:'0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662'}];
 expected.vars.FIRE_PHOTO_STORAGE_MODE='owner-device-zip';
 expected.workers_dev=false;expected.preview_urls=false;
 ok(JSON.stringify(expected)===JSON.stringify(b),
   'only exact D1/photo/preview/public-route config differences');
 for(const p of old.paths){
  if(p==='server/wrangler.json')continue;
  assert.equal(sha(join(root,p)),sha(join(output,p)),'changed original app bytes: '+p);
 }
 ok(true,'every other original compiled SSR and binary file byte identical');
 const receipt=JSON.parse(readFileSync(join(output,'new-live-physical-dark-prehost-receipt.json')));
 ok(receipt.originalUnchangedFileCount===241&&receipt.originalUnchangedClientAssets===41&&
    receipt.originalConfigSha256===sha(cfg(root))&&
    receipt.resultingConfigSha256===sha(cfg(output)),
   'original and output manifest SHA integrity protected');
 ok(receipt.firstJob0001CleanStartPhysicallyVerified===false&&
    receipt.newLive26MigrationsPhysicallyVerified===false&&
    receipt.firstCloudflareWorkerCreationAuthorized===false&&
    receipt.workerDeployed===false&&receipt.remoteD1OperationPerformed===false,
   'never infer hosted D1, first live job or deployment approvals');
 blocked(()=>prepareNewLiveBoundDarkWorker(root,output),'must refuse overwriting existing output');
 changed('dr-db-substitution',p=>changeConfig(p,c=>{c.d1_databases[0].database_id='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';}));
 changed('premature-live-db',p=>changeConfig(p,c=>{c.d1_databases[0].database_id='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662';}));
 changed('owner-auth-on',p=>changeConfig(p,c=>{c.vars.FIRE_NEW_LIVE_AUTH_ENABLED='enabled';}));
 changed('paid-r2',p=>changeConfig(p,c=>{c.r2_buckets=[{binding:'X',bucket_name:'paid'}];}));
 changed('public-route',p=>changeConfig(p,c=>{c.routes=[{pattern:'example.com/*'}];}));
 changed('preview-on',p=>changeConfig(p,c=>{c.preview_urls=true;}));
 changed('forged-provider',p=>{
  const f=join(p,'alternative-receipt.json'),x=JSON.parse(readFileSync(f));
  x.newLiveSchemaPhysicallyVerified=true;writeFileSync(f,JSON.stringify(x));
 });
 changed('tampered-client-binary',p=>{
  const dir=join(p,'server','fire-inline-assets');
  const bin=readdirSync(dir).find(x=>x.endsWith('.bin'));
  assert.ok(bin);writeFileSync(join(dir,bin),'BAD');
 });
 changed('extra-source',p=>writeFileSync(join(p,'server','EXTRA.txt'),'unreviewed'));
 const link=clone('symlink');
 symlinkSync(cfg(root),join(link,'server','unexpected-link'));
 blocked(()=>reviewOriginalNewLive(link),'no symlinks in original release');
 console.log('PASS '+n+'/'+n+' real-source focused NEW LIVE physical D1 DARK preview-off review; no provider/DB/auth/paid service changes.');
}finally{rmSync(tmp,{recursive:true,force:true});}
