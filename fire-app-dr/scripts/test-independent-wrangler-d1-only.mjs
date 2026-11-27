/** Test the ACTUAL independent Wrangler config adapter in a disposable sandbox.
 * No Wrangler invocation, network access, remote database or production config.
 */
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const source=resolve(fileURLToPath(new URL('./configure-independent-wrangler.mjs',import.meta.url)));
const uuid='12345678-1234-4234-8234-123456789abc';
let checks=0;
function check(value,label){assert.ok(value,label);checks++;console.log('PASS: '+label);}
function exercise(overrides={}){
 const temp=mkdtempSync(join(tmpdir(),'fire-d1-only-wrangler-'));
 try{
  mkdirSync(join(temp,'scripts'),{recursive:true});
  mkdirSync(join(temp,'dist','server'),{recursive:true});
  const script=join(temp,'scripts','configure-independent-wrangler.mjs');
  const out=join(temp,'dist','server','wrangler.independent.json');
  copyFileSync(source,script);
  writeFileSync(join(temp,'dist','server','wrangler.json'),JSON.stringify({
    name:'placeholder-worker',topLevelName:'placeholder-worker',
    d1_databases:[{binding:'DB',database_name:'unreviewed',database_id:'00000000-0000-4000-8000-000000000000'}],
    r2_buckets:[{binding:'BUCKET',bucket_name:'unreviewed'}]
  }));
  const env={...process.env,FIRE_WORKER_NAME:'fire-app-ci-synthetic-do-not-deploy',
    FIRE_D1_DATABASE_NAME:'fire-app-ci-synthetic-db',FIRE_D1_DATABASE_ID:uuid,
    FIRE_R2_BUCKET_NAME:'',...overrides};
  const run=spawnSync(process.execPath,[script],{cwd:temp,env,encoding:'utf8',timeout:10000});
  const config=run.status===0?JSON.parse(readFileSync(out,'utf8')):null;
  return {status:run.status,config,source:run.stdout+run.stderr};
 }finally{rmSync(temp,{recursive:true,force:true});}
}
const without=exercise();
check(without.status===0,'Independent Worker config builds successfully without R2 subscription');
check(without.config.r2_buckets.length===0,'No Cloudflare R2 binding is emitted for offline-only customer photos');
check(without.config.d1_databases.length===1&&without.config.d1_databases[0].binding==='DB'&&without.config.d1_databases[0].database_id===uuid,
 'D1-only mode preserves exactly the reviewed synthetic DB binding');
check(without.config.name==='fire-app-ci-synthetic-do-not-deploy','D1-only mode does not change worker identity');
const withR2=exercise({FIRE_R2_BUCKET_NAME:'fire-ci-synthetic-photos'});
check(withR2.status===0&&withR2.config.r2_buckets.length===1,'Optional explicitly supplied R2 binding remains supported');
check(withR2.config.r2_buckets[0].binding==='BUCKET'&&withR2.config.r2_buckets[0].bucket_name==='fire-ci-synthetic-photos','R2 binding uses the exact explicitly supplied synthetic bucket');
check(exercise({FIRE_R2_BUCKET_NAME:'invalid/Bucket'}).status!==0,'Malformed bucket names fail closed');
check(exercise({FIRE_D1_DATABASE_ID:'00000000-0000-4000-8000-000000000000'}).status!==0,'Placeholder D1 database UUID cannot be accepted');
check(exercise({FIRE_D1_DATABASE_ID:''}).status!==0,'Missing D1 database identity cannot be accepted');
check(exercise({FIRE_D1_DATABASE_NAME:''}).status!==0,'Missing database name cannot be accepted');
console.log('PASS '+checks+' independent D1-only Wrangler adapter checks (zero remote actions).');
