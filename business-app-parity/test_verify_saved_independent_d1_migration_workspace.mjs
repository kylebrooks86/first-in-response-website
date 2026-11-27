/** Targeted disposable saved-folder corruption checks; no provider clients. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,unlinkSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareIndependentD1MigrationWorkspace} from './prepare_independent_d1_migration_workspace.mjs';
import {verifySavedIndependentD1MigrationWorkspace} from './verify_saved_independent_d1_migration_workspace.mjs';
const root=mkdtempSync(join(tmpdir(),'fire-actual-saved-release-'));
let checks=0;
const pass=(condition,msg)=>{assert.ok(condition,msg);checks++;};
const rejects=fn=>{assert.throws(fn,/BLOCKED|reviewed SQL source/);checks++;};
try{
 const targets=[
  ['independent-dr','fire-fullapp-dr-db','5e55c5b7-cd67-4c8f-a52e-40f71b5d3145'],
  ['independent-live','fire-fullapp-new-live-db','0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662']
 ];
 for(const [target,name,id] of targets){
  const dir=join(root,target);
  prepareIndependentD1MigrationWorkspace(target,dir);
  const result=verifySavedIndependentD1MigrationWorkspace(target,dir);
  pass(result.target===target&&result.database_name===name&&result.database_id===id&&
   result.reviewedSqlFiles===26&&result.savedWorkspaceVerified===true&&
   result.cloudflareContacted===false&&result.remoteMigrationAuthorized===false&&
   result.gate5Accepted===false,'real saved folder must report only local integrity');
  const configPath=join(dir,'wrangler.json'),configRaw=readFileSync(configPath);
  const receiptPath=join(dir,'source-hashes.json'),receiptRaw=readFileSync(receiptPath);
  rejects(()=>verifySavedIndependentD1MigrationWorkspace(target,join(root,'nonexistent')));
  rejects(()=>verifySavedIndependentD1MigrationWorkspace(
   target==='independent-dr'?'independent-live':'independent-dr',dir));
  const config=JSON.parse(configRaw.toString('utf8'));
  config.d1_databases[0].database_id='11111111-1111-4111-8111-111111111111';
  writeFileSync(configPath,JSON.stringify(config));
  rejects(()=>verifySavedIndependentD1MigrationWorkspace(target,dir));
  writeFileSync(configPath,configRaw);
  const extra=JSON.parse(configRaw.toString('utf8'));
  extra.r2_buckets=[{binding:'BUCKET',bucket_name:'not-authorized'}];
  writeFileSync(configPath,JSON.stringify(extra));
  rejects(()=>verifySavedIndependentD1MigrationWorkspace(target,dir));
  writeFileSync(configPath,configRaw);
  const wrong=JSON.parse(receiptRaw.toString('utf8'));
  wrong.remoteMigrationAuthorized=true;
  writeFileSync(receiptPath,JSON.stringify(wrong));
  rejects(()=>verifySavedIndependentD1MigrationWorkspace(target,dir));
  writeFileSync(receiptPath,receiptRaw);
  for(const idx of [18,19,22,25]){
   const receipt=JSON.parse(receiptRaw.toString('utf8'));
   const file=join(dir,'migrations',receipt.migrations[idx].filename);
   const original=readFileSync(file);
   const changed=Buffer.concat([original,Buffer.from('-- benign-looking unreviewed edit\\n')]);
   writeFileSync(file,changed);
   // A forged SHA256 receipt of the modified disk file is NOT approval.
   receipt.migrations[idx].sha256=createHash('sha256').update(changed).digest('hex');
   writeFileSync(receiptPath,JSON.stringify(receipt));
   rejects(()=>verifySavedIndependentD1MigrationWorkspace(target,dir));
   writeFileSync(file,original);
   writeFileSync(receiptPath,receiptRaw);
  }
  const orphan=join(dir,'migrations','0026_unreviewed.sql');
  writeFileSync(orphan,'SELECT 1;');
  rejects(()=>verifySavedIndependentD1MigrationWorkspace(target,dir));
  unlinkSync(orphan);
  const real=join(dir,'migrations','0000_wise_namora.sql');
  const bytes=readFileSync(real);unlinkSync(real);symlinkSync(receiptPath,real);
  rejects(()=>verifySavedIndependentD1MigrationWorkspace(target,dir));
  unlinkSync(real);writeFileSync(real,bytes);
  pass(verifySavedIndependentD1MigrationWorkspace(target,dir).reviewedSqlFiles===26,
   'saved workspace must fully recover after fixture edits');
 }
 console.log('PASS '+checks+'/'+checks+
  ' independent DR/LIVE SAVED 26-migration integrity, altered receipt, tampered SQL/refund/Stripe/numbers, swapped target and unsafe binding refusals; zero provider actions.');
}finally{rmSync(root,{recursive:true,force:true});}
