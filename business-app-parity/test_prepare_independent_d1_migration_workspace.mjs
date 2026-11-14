/** Local-only test: build exact 26 target-bound SQL files without Cloudflare. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareIndependentD1MigrationWorkspace} from './prepare_independent_d1_migration_workspace.mjs';
import {EXPECTED_NEW_LIVE_D1_MIGRATIONS} from './shared/lib/new-live-migration-journal.mjs';
import {requirePinnedDRProviderIdentity,requirePhysicallyEmptyDRSchema,readOnlyWranglerRows,readOnlyPreparedSql} from './owner_approved_dr_d1_migration.mjs';
import {assertReviewedIndependentD1SqlBlobs,gitSqlBlobSha1,REVIEWED_INDEPENDENT_D1_SQL_BLOBS}
 from './reviewed_independent_d1_sql_blobs.mjs';

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
  const actual=names.map(name=>({name,bytes:readFileSync(join(out,'migrations',name))}));
  check(assertReviewedIndependentD1SqlBlobs(actual)===true,
   'both targets must contain all 26 fixed reviewed SQL identities');
  for(let i=0;i<names.length;i++){
   const data=actual[i].bytes;
   check(hex(data)===audit.migrations[i].sha256&&
    audit.migrations[i].filename===names[i]&&
    audit.migrations[i].reviewedGitBlobSha1===REVIEWED_INDEPENDENT_D1_SQL_BLOBS[i].gitBlobSha1&&
    gitSqlBlobSha1(data)===REVIEWED_INDEPENDENT_D1_SQL_BLOBS[i].gitBlobSha1,
    'independent fixed blob pin and SHA-256 receipt mismatch: '+names[i]);
  }
  for(const idx of [18,19,22,25]){
   const tampered=actual.map(file=>({...file}));
   tampered[idx]={name:actual[idx].name,bytes:Buffer.concat([actual[idx].bytes,Buffer.from('-- tampered\\n')])};
   assert.throws(()=>assertReviewedIndependentD1SqlBlobs(tampered),/BLOCKED/);
   checks++;
  }
  const renamed=actual.map(file=>({...file}));
  renamed[25].name='0025_forged_permanent_numbers.sql';
  assert.throws(()=>assertReviewedIndependentD1SqlBlobs(renamed),/BLOCKED/);
  checks++;
  assert.throws(()=>assertReviewedIndependentD1SqlBlobs(actual.slice(1)),/BLOCKED/);
  checks++;
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
 // The owner-approved remote runner has no cloud access in this fixture:
 // test the ACTUAL write-boundary predicates, not another mock executor.
 const realDR=[
  {name:'fire-fullapp-dr-db',uuid:'5e55c5b7-cd67-4c8f-a52e-40f71b5d3145'},
  {name:'fire-fullapp-new-live-db',uuid:'0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662'}
 ];
 check(requirePinnedDRProviderIdentity(realDR).readOnlyIdentityVerified,
  'remote runner permits only the exact owner-created physical DR with distinct LIVE');
 for(const altered of [
  realDR.slice(1),
  [{...realDR[0],uuid:realDR[1].uuid},realDR[1]],
  [{...realDR[0],name:'fire-fullapp-qa-20261016'},realDR[1]],
  [realDR[0],{...realDR[1],uuid:realDR[0].uuid}],
  [...realDR,realDR[0]]
 ]){assert.throws(()=>requirePinnedDRProviderIdentity(altered),/STOP/);checks++;}
 check(requirePhysicallyEmptyDRSchema([]).noApplicationTables===true,
  'physically empty D1 is eligible for initial installation');
 check(requirePhysicallyEmptyDRSchema([{type:'table',name:'_cf_KV',
   sql:'CREATE TABLE "_cf_KV" ("key" TEXT PRIMARY KEY,"value" BLOB) WITHOUT ROWID'}])
   .noApplicationTables===true,'known provider metadata only may exist');
 for(const contaminated of [
  [{type:'table',name:'customers',sql:'CREATE TABLE customers(id TEXT)'}],
  [{type:'table',name:'d1_migrations',sql:'CREATE TABLE d1_migrations(id INTEGER)'}],
  [{type:'table',name:'sqlite_sequence',sql:'CREATE TABLE sqlite_sequence(name,seq)'}],
  [{type:'view',name:'unsafe',sql:'CREATE VIEW unsafe AS SELECT 1'}],
  [{type:'index',name:'ix_extra',sql:'CREATE INDEX ix_extra ON customers(id)'}],
  [{type:'table',name:'_cf_KV',sql:'CREATE TABLE _cf_KV (secret TEXT)'}],
  [{type:'table',name:'_cf_OTHER',sql:'CREATE TABLE _cf_OTHER (value TEXT)'}]
 ]){assert.throws(()=>requirePhysicallyEmptyDRSchema(contaminated),/STOP/);checks++;}
 check(readOnlyWranglerRows([{success:true,results:[]}]).length===0,
  'preflight accepts one confirmed Wrangler JSON empty result');
 for(const invalid of [[],{results:[]},[{success:false,results:[]}],
   [{success:true,results:[]},{success:true,results:[]}]]){
  assert.throws(()=>readOnlyWranglerRows(invalid),/STOP/);checks++;
 }
 check(readOnlyPreparedSql("SELECT id FROM customers WHERE id=? AND name=?",["id-1","O'Neil"])
   ==="SELECT id FROM customers WHERE id='id-1' AND name='O''Neil'",
   'post-install remote D1 queries safely bind read-only values');
 for(const sql of ["DELETE FROM customers","DROP TABLE customers",
   "SELECT 1; DROP TABLE customers","WITH x AS (DELETE FROM customers) SELECT 1",
   "SELECT 1 -- uncomment"]) {
  assert.throws(()=>readOnlyPreparedSql(sql),/STOP/);checks++;
 }
 console.log('PASS '+checks+'/'+checks+
  ' reviewed local migration workspaces plus OWNER DR one-shot physical identity/empty-schema/read-only boundary negatives. No remote operation.');

}finally{rmSync(temp,{recursive:true,force:true});}
