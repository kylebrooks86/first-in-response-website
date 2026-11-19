/**
 * Real accepted PR266 ZIP -> physically bound DR Worker-only SOURCE review.
 * No Cloudflare provider writes, no migration, no login, no Stripe or R2.
 * Usage: node test_dr_bound_noassets_worker.mjs EXTRACTED_AUTHENTIC_PR266_ZIP
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,existsSync,mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,readdirSync}
 from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {prepareDRPhysicalBoundWorker,reviewDRWorkerSource}
 from './prepare_dr_bound_noassets_worker.mjs';

const root=process.argv[2];
if(!root)throw Error('expected real previously accepted no-assets source folder');
const original=resolve(root);
const isolated=mkdtempSync(join(tmpdir(),'fire-dr-actual-physical-prehost-'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
let tests=0;
const ok=(result,message)=>{assert.ok(result,message);tests++;};
const blocked=(call,message)=>{assert.throws(call,/FIRE physical DR prehost BLOCKED:/,message);tests++;};
function clone(label){
 const destination=join(isolated,label);
 cpSync(original,destination,{recursive:true});
 return destination;
}
function alter(label,action){
 const src=clone(label);
 action(src);
 blocked(()=>reviewDRWorkerSource(src),label);
}
try{
 const input=reviewDRWorkerSource(original);
 ok(input.receipt.assetFileCount===41&&input.receipt.sourceCompiledFiles===242,
  'exact previously compiled original DR source shape preserved');
 const dst=join(isolated,'new-physical-dr-prehost');
 const result=prepareDRPhysicalBoundWorker(original,dst);
 ok(result.status==='FIRE_EXISTING_DR_PHYSICAL_D1_PREHOST_PACKAGE_CREATED__NOT_DEPLOYED'&&
    result.deployed===false&&result.providerContacted===false,
    'real physical D1-bound config created with no provider operation');
 const originalConfig=JSON.parse(readFileSync(join(original,'server','wrangler.json'),'utf8'));
 const cfg=JSON.parse(readFileSync(join(dst,'server','wrangler.json'),'utf8'));
 ok(originalConfig.d1_databases[0].database_id==='00000000-0000-4000-8000-000000000000'&&
    cfg.d1_databases[0].database_id==='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145'&&
    cfg.d1_databases[0].database_name==='fire-fullapp-dr-db',
    'only existing physically installed DR D1 is bound in output');
 ok(cfg.main==='fire-noassets-entry.mjs'&&cfg.assets===undefined&&cfg.r2_buckets.length===0,
    'no separate asset upload, R2, subscription or legacy_env');
 ok(cfg.vars.FIRE_DR_AUTH_ENABLED==='blocked'&&
    cfg.vars.FIRE_PHOTO_STORAGE_MODE==='owner-device-zip'&&
    cfg.vars.FIRE_ENV==='isolated-dr',
    'auth remains disabled and zero paid storage');
 const proof=JSON.parse(readFileSync(join(dst,'dr-physical-prehost-source-receipt.json'),'utf8'));
 ok(proof.cloudflareFirstWorkerCreationAuthorized===false&&
    proof.cloudflareWorkerExistsIndependentlyVerified===false&&
    proof.physicalD1BindingInConfigPrepared===true&&
    proof.physicalD1BindingDeployed===false&&proof.ownerLoginEnabled===false&&
    proof.originalDR26MigrationsPreviouslyOwnerAccepted===true&&
    proof.gate4Accepted===false&&proof.gate7Accepted===false,
    'no imaginary provider acceptance, authorizations or release-gate closure');
 ok(proof.oldNoAssetsSourceReceiptSha256===hash(join(original,'alternative-receipt.json'))&&
    proof.newConfigSha256===hash(join(dst,'server','wrangler.json')),
    'new source provenance binds to unchanged old receipt and new bound config');
 let compared=0;
 function walk(dir){
  for(const item of readdirSync(dir,{withFileTypes:true})){
   const src=join(dir,item.name);
   if(item.isDirectory())walk(src);
   else{
    const rel=relative(join(original,'server'),src);
    if(rel==='wrangler.json')continue;
    assert.equal(hash(src),hash(join(dst,'server',rel)),
      'SSR/client Data module changed '+rel);
    compared++;
   }
  }
 }
 walk(join(original,'server'));
 ok(compared>150,'all original immutable SSR and 41 binary modules remain unchanged');
 blocked(()=>prepareDRPhysicalBoundWorker(original,dst),'no prehost package overwrite');
 alter('wrong-live-d1',src=>{
  const p=join(src,'server','wrangler.json'),c=JSON.parse(readFileSync(p));
  c.d1_databases[0].database_id='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662';
  writeFileSync(p,JSON.stringify(c));
 });
 alter('auth-enabled',src=>{
  const p=join(src,'server','wrangler.json'),c=JSON.parse(readFileSync(p));
  c.vars.FIRE_DR_AUTH_ENABLED='owner-approved';writeFileSync(p,JSON.stringify(c));
 });
 alter('r2-unapproved',src=>{
  const p=join(src,'server','wrangler.json'),c=JSON.parse(readFileSync(p));
  c.r2_buckets=[{binding:'PHOTOS',bucket_name:'unapproved'}];writeFileSync(p,JSON.stringify(c));
 });
 alter('wrong-provenance',src=>{
  const p=join(src,'alternative-receipt.json'),c=JSON.parse(readFileSync(p));
  c.reviewedSourceSha='b'.repeat(40);writeFileSync(p,JSON.stringify(c));
 });
 alter('forged-provider',src=>{
  const p=join(src,'alternative-receipt.json'),c=JSON.parse(readFileSync(p));
  c.workerDeployed=true;writeFileSync(p,JSON.stringify(c));
 });
 alter('changed-client-data',src=>{
  const r=JSON.parse(readFileSync(join(src,'alternative-receipt.json')));
  writeFileSync(join(src,'server',r.clientAssets[0].module),'MALICIOUS BYTES');
 });
 alter('new-route',src=>{
  const p=join(src,'server','wrangler.json'),c=JSON.parse(readFileSync(p));
  c.routes=[{pattern:'example.com/*',zone_name:'example.com'}];writeFileSync(p,JSON.stringify(c));
 });
 console.log('PASS '+tests+'/'+tests+
  ' real saved original DR Worker-only release -> physically accepted existing D1 config,'+
  ' exact source modules, no-assets/no-R2/blocked owner auth and fail-closed source mutations.'+
  ' ZERO Cloudflare provider calls, new migrations, payments or deployment.');
}finally{rmSync(isolated,{recursive:true,force:true});}
