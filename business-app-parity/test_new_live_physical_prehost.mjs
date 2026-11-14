/** Targeted ONLY: original real archived NEW LIVE 242-file Worker -> separate physical D1 config. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,mkdtempSync,readFileSync,writeFileSync,rmSync,readdirSync,symlinkSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {
 prepareNewLivePhysicalPrehost,reviewOriginalNewLiveWorker,
 ORIGINAL_SOURCE_SHA,ORIGINAL_ZIP_SHA256,ORIGINAL_EXTRACTED_FILES_SHA256,
 ORIGINAL_ARTIFACT_ID
} from './prepare_new_live_physical_prehost.mjs';

if(!process.argv[2])throw Error('expected exact original GitHub ZIP extracted after independent SHA256 validation');
const input=resolve(process.argv[2]);
const tmp=mkdtempSync(join(tmpdir(),'fire-new-live-target-bound-offline-'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
let passed=0;
function okay(value,why){assert.ok(value,why);passed++;}
function refuses(fn,why){assert.throws(fn,/FIRE NEW LIVE prehost BLOCKED:/,why);passed++;}
function modified(label,alter){const src=join(tmp,label);cpSync(input,src,{recursive:true});alter(src);refuses(()=>reviewOriginalNewLiveWorker(src),label);}
function cfgEdit(root,modify){const p=join(root,'server','wrangler.json'),cfg=JSON.parse(readFileSync(p,'utf8'));modify(cfg);writeFileSync(p,JSON.stringify(cfg));}
try{
 const original=reviewOriginalNewLiveWorker(input);
 okay(original.files.length===242&&original.receipt.assetFileCount===41,'exact archived source 242 files and 41 original public assets');
 okay(ORIGINAL_SOURCE_SHA==='3ee92374dca6322955fdd5f920a95e0864a9654f'&&
    ORIGINAL_ARTIFACT_ID===14101058770&&
    ORIGINAL_ZIP_SHA256==='7c701cc6401e3eba06f684db2dd5a770b4c137401224ef8aeb812d18faabaec3'&&
    ORIGINAL_EXTRACTED_FILES_SHA256==='ebce69a7eabb00a30c128ca02bdfe99cba377afed916e58bd1b3175c5047453a',
    'original exact SHA and artifact pins correct');
 const output=join(tmp,'new-existing-live-db-disabled-routes');
 const result=prepareNewLivePhysicalPrehost(input,output);
 okay(result.providerContacted===false&&result.deployed===false&&result.ownerApprovalRequired===true,
    'new local configuration only, never creates a Worker');
 const old=JSON.parse(readFileSync(join(input,'server','wrangler.json')));
 const now=JSON.parse(readFileSync(join(output,'server','wrangler.json')));
 okay(old.d1_databases[0].database_id==='00000000-0000-4000-8000-000000000000'&&
    now.d1_databases[0].database_id==='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662'&&
    now.d1_databases[0].database_name==='fire-fullapp-new-live-db'&&
    now.d1_databases[0].binding==='DB',
    'only previously provisioned independent LIVE D1, never DR/QA/STAGING DB');
 okay(now.workers_dev===false&&now.preview_urls===false&&
    now.routes===undefined&&now.route===undefined,
    'no normal public or preview Worker URL and no route');
 okay(now.assets===undefined&&now.r2_buckets.length===0&&now.kv_namespaces.length===0&&
    now.services.length===0,'no assets-upload-session, R2 or paid/external service');
 okay(now.vars.FIRE_NEW_LIVE_AUTH_ENABLED==='blocked'&&
    now.vars.FIRE_PHOTO_STORAGE_MODE==='owner-device-zip'&&
    now.vars.FIRE_ENV==='new-live-prelaunch','owner auth blocked and approved no-R2 photo mode');
 const stripped=structuredClone(now);delete stripped.preview_urls;
 stripped.workers_dev=true;delete stripped.vars.FIRE_PHOTO_STORAGE_MODE;
 stripped.d1_databases=old.d1_databases;
 okay(JSON.stringify(stripped)===JSON.stringify(old),
    'only D1 UUID, explicit no-R2 photo flag and the two public routes changed');
 const receipt=JSON.parse(readFileSync(join(output,'new-live-physical-prehost-source-receipt.json')));
 okay(receipt.originalUnpacked242FilesSha256===ORIGINAL_EXTRACTED_FILES_SHA256&&
    receipt.originalNoAssetsReceiptSha256===hash(join(input,'alternative-receipt.json'))&&
    receipt.newWranglerConfigSha256===hash(join(output,'server','wrangler.json')),
    'hash bound original accepted archive and exact new configuration');
 okay(receipt.physicalNewLive26MigrationsAppliedOrVerified===false&&
    receipt.remoteNewLiveSchemaCurrentlyVerified===false&&
    receipt.firstRealJob0001PhysicallyVerified===false&&
    receipt.firstWorkerCreationAuthorized===false&&receipt.workerUploaded===false&&
    receipt.liveStripeEnabled===false&&receipt.liveActivationAuthorized===false,
    'new schema/job/payment/release status is explicitly BLOCKED');
 let count=0;
 function walk(dir){for(const ent of readdirSync(dir,{withFileTypes:true})){
   const p=join(dir,ent.name);
   if(ent.isDirectory()){walk(p);continue;}
   const relativePath=relative(join(output,'server'),p);
   if(relativePath==='wrangler.json')continue;
   assert.equal(hash(p),hash(join(input,'server',relativePath)),'changed original compiled byte '+relativePath);
   count++;
 }}
 walk(join(output,'server'));
 okay(count===240,'all 240 original runtime and Data module files unchanged');
 refuses(()=>prepareNewLivePhysicalPrehost(input,output),'cannot overwrite original output');
 modified('tamper-live-uuid',p=>cfgEdit(p,c=>c.d1_databases[0].database_id='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662'));
 modified('tamper-dr-binding',p=>cfgEdit(p,c=>c.d1_databases[0].database_id='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145'));
 modified('enable-owner-login',p=>cfgEdit(p,c=>c.vars.FIRE_NEW_LIVE_AUTH_ENABLED='enabled'));
 modified('forge-hosted-acceptance',p=>{const q=join(p,'alternative-receipt.json'),v=JSON.parse(readFileSync(q));v.newLiveSchemaPhysicallyVerified=true;writeFileSync(q,JSON.stringify(v))});
 modified('add-r2',p=>cfgEdit(p,c=>c.r2_buckets.push({binding:'BUCKET',bucket_name:'some-new-bucket'})));
 modified('add-custom-route',p=>cfgEdit(p,c=>c.routes=[{pattern:'example.org/*'}]));
 modified('spoof-worker',p=>cfgEdit(p,c=>c.name='fire-fullapp-dr'));
 modified('change-origin',p=>cfgEdit(p,c=>c.vars.SITE_ORIGIN='https://example.org'));
 modified('change-binary',p=>{const z=JSON.parse(readFileSync(join(p,'alternative-receipt.json')));writeFileSync(join(p,'server',z.clientAssets[0].module),'FORGED ASSET')});
 modified('change-ssr',p=>writeFileSync(join(p,'server','index.js'),'FORGED SSR'));
 modified('change-original-receipt',p=>{const q=join(p,'alternative-receipt.json'),v=JSON.parse(readFileSync(q));v.firstJob0001CleanStartVerified=true;writeFileSync(q,JSON.stringify(v))});
 modified('linked-asset',p=>symlinkSync(join(input,'server','index.js'),join(p,'server','BAD_LINK.js')));
 console.log('PASS '+passed+'/'+passed+' actual original NEW LIVE no-assets ZIP -> physical D1-bound dark PREHOST source only. NO remote 26 migrations, Job #0001 claim, cloud calls, payments or subscriptions.');
}finally{rmSync(tmp,{recursive:true,force:true});}
