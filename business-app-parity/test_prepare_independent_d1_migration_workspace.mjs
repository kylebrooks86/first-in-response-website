/** Local-only test: build exact 26 target-bound SQL files without Cloudflare. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareIndependentD1MigrationWorkspace} from './prepare_independent_d1_migration_workspace.mjs';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS} from './shared/lib/new-live-migration-journal.mjs';

const temp=mkdtempSync(join(tmpdir(),'fire-independent-d1-migrations-'));
const hex=data=>createHash('sha256').update(data).digest('hex');
let checks=0;
const check=(test,message)=>{assert.ok(test,message);checks++;};
try{
 const cases=[
  ['independent-dr','fire-fullapp-dr-db','5e55c5b7-cd67-4c8f-a52e-40f71b5d3145'],
  ['independent-live','fire-fullapp-new-live-db','0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662']
 ];
 const outputs=[];
 for(const [target,name,id] of cases){
  const out=join(temp,target);
  const result=prepareIndependentD1MigrationWorkspace(target,out);
  check(result.localWorkspacePrepared===true&&!result.remoteOperationAttempted&&
    !result.remoteMigrationAuthorized&&!result.providerSchemaVerified,
    'workspace must not claim any hosted action');
  const config=JSON.parse(readFileSync(join(out,'wrangler.json'),'utf8'));
  check(Object.keys(config).join(',')==='d1_databases'&&
    config.d1_databases.length===1&&
    JSON.stringify(config.d1_databases[0])===JSON.stringify({
     binding:'DB',database_name:name,database_id:id,
     migrations_dir:'migrations',migrations_table:'d1_migrations'
    }),'config must pin exact target DB and a real Wrangler migration folder');
  const audit=JSON.parse(readFileSync(join(out,'source-hashes.json'),'utf8'));
  check(audit.target===target&&audit.database_id===id&&audit.migrationCount===26&&
    audit.remoteMigrationAuthorized===false&&audit.gate5Accepted===false,
    'audit must not claim production readiness');
  const names=readdirSync(join(out,'migrations')).sort();
  check(JSON.stringify(names)===JSON.stringify(EXPECTED_NEW_LIVE_D1_MIGRATIONS),
    'exact 26 ordered source migration filenames are required');
  for(let i=0;i<names.length;i++){
   const data=readFileSync(join(out,'migrations',names[i]));
   check(hex(data)===audit.migrations[i].sha256&&
    audit.migrations[i].filename===names[i],
    'source hash and filename mismatch: '+names[i]);
  }
  check(readFileSync(join(out,'READ_ME_FIRST.txt'),'utf8').includes('NEW')&&
    !('r2_buckets' in config),'must warn before provider writes, no R2 binding');
  outputs.push(out);
 }
 for(const name of EXPECTED_NEW_LIVE_D1_MIGRATIONS){
  check(hex(readFileSync(join(outputs[0],'migrations',name)))===
    hex(readFileSync(join(outputs[1],'migrations',name))),
    'DR and NEW LIVE SQL must be byte-identical: '+name);
 }
 for(const invalid of ['qa','staging','doomsday','live','independent-staging','']){
  const out=join(temp,'reject-'+(invalid||'empty'));
  assert.throws(()=>prepareIndependentD1MigrationWorkspace(invalid,out),/BLOCKED/);
  check(!existsSync(out),'rejected target must never create files');
 }
 assert.throws(()=>prepareIndependentD1MigrationWorkspace('independent-dr',outputs[0]),/exists/);
 checks++;
 check(existsSync(join(outputs[0],'migrations','0025_independent_permanent_numbers.sql')),
  'permanent #0001 numbering migration must be included');
 console.log('PASS '+checks+'/'+checks+
  ' independent DR/LIVE D1 migration workspace safety and exact 26-file hashes; local files only, zero remote/provider calls.');
}finally{rmSync(temp,{recursive:true,force:true});}
