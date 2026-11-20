/** FIRE NEW LIVE 26 SQL portable source packet tests. All local, no D1/Cloudflare/Stripe calls. */
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,readFileSync,readdirSync,existsSync,writeFileSync,
 rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {prepareNewLivePortableSchemaPacket,verifyNewLivePortableSchemaPacket}
 from './prepare_new_live_portable_schema_packet.mjs';

const temp=mkdtempSync(join(tmpdir(),'fire-new-live-source-only-'));
let checks=0;
function pass(pred,label){assert.ok(pred,label);checks++;}
function blocked(fn,label){assert.throws(fn,/BLOCKED/,label);checks++;}
function change(id,callback){
 const dir=join(temp,id);
 cpSync(join(temp,'original'),dir,{recursive:true});
 callback(dir);
 blocked(()=>verifyNewLivePortableSchemaPacket(dir),'altered portable source must block: '+id);
}
try{
 const root=join(temp,'original');
 const result=prepareNewLivePortableSchemaPacket(root);
 pass(result.status==='EXACT_26_REVIEWED_NEW_LIVE_SQL_SOURCE_CUSTODY_VERIFIED'&&
   result.sqlFiles===26&&result.sourceReviewed===true,
   'complete 26 original Git-pinned NEW LIVE SQL source packet materialized');
 pass(result.database_id==='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662'&&
   result.remoteWriteApproved===false&&result.cloudflareContacted===false&&
   result.schemaMigrated===false&&result.firstJob0001Verified===false,
   'correct physical NEW LIVE identity, no fabricated provider or job readiness');
 pass(verifyNewLivePortableSchemaPacket(root).sqlFiles===26,
   'independent read-back of actually saved source packet');
 const source=join(root,'new-live-schema-source'),migrations=join(source,'migrations');
 pass(readdirSync(migrations).filter(x=>x.endsWith('.sql')).length===26,
   'all real canonical SQL files copied, not simply a checklist');
 const config=JSON.parse(readFileSync(join(source,'wrangler.json')));
 pass(config.d1_databases.length===1&&
   config.d1_databases[0].binding==='DB'&&
   config.d1_databases[0].database_name==='fire-fullapp-new-live-db'&&
   config.d1_databases[0].database_id==='0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662'&&
   config.r2_buckets===undefined&&config.assets===undefined&&
   config.routes===undefined,
   'only one independent target D1, no R2, services, Workers or remote routes');
 const operatorNotice=readFileSync(join(root,'OWNER_READ_ME_FIRST.txt'),'utf8');
 pass(operatorNotice.includes('November 14, 2026')&&
   operatorNotice.includes('already completed 26/26')&&
   operatorNotice.includes('NEVER reapply')&&
   operatorNotice.includes('The old installer is CONSUMED.')&&
   !operatorNotice.includes('empty schema verification are mandatory before any remote one-shot migration'),
   'new portable source packet cannot instruct owner to repeat accepted NEW LIVE 26/26 migration');
 const receipt=JSON.parse(readFileSync(join(root,'portable-schema-source-receipt.json')));
 pass(receipt.sqlFiles.length===26&&receipt.remoteMigrationAuthorized===false&&
   receipt.workerDeployed===false&&receipt.gatesClosedByThisSourcePacket===0,
   'cryptographic receipt does not forge approved release/migration');
 blocked(()=>prepareNewLivePortableSchemaPacket(root),'never overwrite prior portable source ZIP');
 for(const v of ['','   '])blocked(()=>prepareNewLivePortableSchemaPacket(v),
   'blank paths cannot accidentally produce local output');
 change('tampered-SQL',p=>{
  const name=readdirSync(join(p,'new-live-schema-source','migrations')).find(x=>x.endsWith('.sql'));
  const f=join(p,'new-live-schema-source','migrations',name);
  writeFileSync(f,readFileSync(f,'utf8')+'\n-- unreviewed edit\n');
 });
 change('DR-UUID-reused',p=>{
  const f=join(p,'new-live-schema-source','wrangler.json');
  const j=JSON.parse(readFileSync(f));j.d1_databases[0].database_id='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145';
  writeFileSync(f,JSON.stringify(j));
 });
 change('unapproved-r2',p=>{
  const f=join(p,'new-live-schema-source','wrangler.json');
  const j=JSON.parse(readFileSync(f));j.r2_buckets=[{binding:'BUCKET',bucket_name:'paid'}];
  writeFileSync(f,JSON.stringify(j));
 });
 change('spoofed-approval',p=>{
  const f=join(p,'portable-schema-source-receipt.json');
  const j=JSON.parse(readFileSync(f));j.remoteMigrationAuthorized=true;
  writeFileSync(f,JSON.stringify(j));
 });
 change('fake-job-0001',p=>{
  const f=join(p,'portable-schema-source-receipt.json');
  const j=JSON.parse(readFileSync(f));j.physicalFirstJob0001Verified=true;
  writeFileSync(f,JSON.stringify(j));
 });
 change('deleted-source-SQL',p=>{
  const dir=join(p,'new-live-schema-source','migrations');
  rmSync(join(dir,readdirSync(dir).find(x=>x.endsWith('.sql'))));
 });
 change('extra-source-file',p=>writeFileSync(join(p,'fake-provider-record.json'),'bad'));
 change('changed-owner-notice',p=>{
  writeFileSync(join(p,'OWNER_READ_ME_FIRST.txt'),'JUST RUN MIGRATION');
 });
 change('symlink-packet-file',p=>{
  const f=join(p,'OWNER_READ_ME_FIRST.txt');rmSync(f);
  symlinkSync(join(root,'OWNER_READ_ME_FIRST.txt'),f);
 });
 change('rewritten-original-manifest',p=>{
  const f=join(p,'new-live-schema-source','source-hashes.json');
  const j=JSON.parse(readFileSync(f));j.migrations[0].sha256='0'.repeat(64);
  writeFileSync(f,JSON.stringify(j));
 });
 pass(existsSync(root)&&existsSync(join(root,'OWNER_READ_ME_FIRST.txt')),
   'source artifact retained in disjoint new directory only');
 console.log('PASS '+checks+'/'+checks+
   ' NEW LIVE 26-SQL physical D1 packet, exact original Git hashes,'+
   ' malformed/forged-release/DR/R2/changed SQL negatives; no provider operations.');
}finally{rmSync(temp,{recursive:true,force:true});}
