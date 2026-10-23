/** Test the ACTUAL independent Wrangler config adapter in a disposable sandbox.
 * No Wrangler invocation, network access, remote database or production config.
 */
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync,existsSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const source=resolve(fileURLToPath(new URL('./configure-independent-wrangler.mjs',import.meta.url)));
const uuid='12345678-1234-4234-8234-123456789abc';
let checks=0;
function check(value,label){assert.ok(value,label);checks++;console.log('PASS: '+label);}
function exercise(overrides={}, inherited={}, existing=false){
 const temp=mkdtempSync(join(tmpdir(),'fire-d1-only-wrangler-'));
 try{
  mkdirSync(join(temp,'scripts'),{recursive:true});
  mkdirSync(join(temp,'dist','server'),{recursive:true});
  const script=join(temp,'scripts','configure-independent-wrangler.mjs');
  const out=join(temp,'dist','server','wrangler.independent.json');
  copyFileSync(source,script);
  copyFileSync(new URL('./independent-config-values.mjs',import.meta.url),join(temp,'scripts','independent-config-values.mjs'));
  writeFileSync(join(temp,'dist','server','wrangler.json'),JSON.stringify({
    name:'placeholder-worker',topLevelName:'placeholder-worker',
    d1_databases:[{binding:'DB',database_name:'unreviewed',database_id:'00000000-0000-4000-8000-000000000000'}],
    main:'index.js',assets:{directory:'../client'},compatibility_flags:['nodejs_compat'],
    queues:{consumers:[],producers:[]},durable_objects:{bindings:[]},triggers:{crons:[]},
    r2_buckets:[{binding:'BUCKET',bucket_name:'unreviewed'}],...inherited
  }));
  const original=readFileSync(join(temp,'dist','server','wrangler.json'),'utf8');
  if(existing)writeFileSync(out,'original-owner-config');
  const env={...process.env,FIRE_WORKER_NAME:'fire-app-ci-synthetic-do-not-deploy',
    FIRE_D1_DATABASE_NAME:'fire-app-ci-synthetic-db',FIRE_D1_DATABASE_ID:uuid,
    FIRE_R2_BUCKET_NAME:'',...overrides};
  const run=spawnSync(process.execPath,[script],{cwd:temp,env,encoding:'utf8',timeout:10000});
  assert.equal(readFileSync(join(temp,'dist','server','wrangler.json'),'utf8'),original,'compiled source is unchanged');
  if(existing)assert.equal(readFileSync(out,'utf8'),'original-owner-config','existing destination is unchanged');
  else if(run.status!==0)assert.equal(existsSync(out),false,'invalid config must leave no output');
  const config=run.status===0?JSON.parse(readFileSync(out,'utf8')):null;
  return {status:run.status,config,mode:config?statSync(out).mode&0o777:null,source:run.stdout+run.stderr};
 }finally{rmSync(temp,{recursive:true,force:true});}
}
const without=exercise();
check(without.status===0,'Independent Worker config builds successfully without R2 subscription');
check(without.config.r2_buckets.length===0,'No Cloudflare R2 binding is emitted for offline-only customer photos');
check(without.config.d1_databases.length===1&&without.config.d1_databases[0].binding==='DB'&&without.config.d1_databases[0].database_id===uuid,
 'D1-only mode preserves exactly the reviewed synthetic DB binding');
check(without.config.name==='fire-app-ci-synthetic-do-not-deploy','D1-only mode does not change worker identity');
check(without.config.workers_dev===true&&without.config.preview_urls===false,'Only workers.dev publication is prepared; preview URLs disabled');
check(JSON.stringify(without.config.secrets)==='{"required":["FIRE_ADMIN_PASSWORD_HASH","FIRE_SESSION_SECRET"]}','Prepared Worker requires both owner authentication secrets without storing their values');
check(without.config.main==='index.js'&&without.config.assets.directory==='../client','Relative compiled main/assets remain beside original manifest');
if(process.platform!=='win32')check(without.mode===0o600,'Generated configuration is private to its filesystem owner');
const withR2=exercise({FIRE_R2_BUCKET_NAME:'fire-ci-synthetic-photos'});
check(withR2.status===0&&withR2.config.r2_buckets.length===1,'Optional explicitly supplied R2 binding remains supported');
check(withR2.config.r2_buckets[0].binding==='BUCKET'&&withR2.config.r2_buckets[0].bucket_name==='fire-ci-synthetic-photos','R2 binding uses the exact explicitly supplied synthetic bucket');
check(exercise({FIRE_R2_BUCKET_NAME:'invalid/Bucket'}).status!==0,'Malformed bucket names fail closed');
check(exercise({FIRE_D1_DATABASE_ID:'00000000-0000-4000-8000-000000000000'}).status!==0,'Placeholder D1 database UUID cannot be accepted');
check(exercise({FIRE_D1_DATABASE_ID:''}).status!==0,'Missing D1 database identity cannot be accepted');
check(exercise({FIRE_D1_DATABASE_NAME:''}).status!==0,'Missing database name cannot be accepted');
for(const id of ['-'.repeat(36),'a'.repeat(32),'12345678-1234-1234-1234-123456789ab-','00000000-0000-0000-0000-000000000000'])
 check(exercise({FIRE_D1_DATABASE_ID:id}).status!==0,'Reject malformed or nil database UUID: '+id);
for(const name of ['FIRE_WORKER_NAME','FIRE_D1_DATABASE_NAME']){
 for(const value of ['fire-production','Invalid/Name','x'])check(exercise({[name]:value}).status!==0,'Reject unsafe '+name+' value: '+value);
}
check(exercise({FIRE_R2_BUCKET_NAME:'fire-production-photos'}).status!==0,'Reject production R2 resource names consistently with preflight');
for(const inherited of [
 {routes:['firstinresponseexteriors.com/*']},{route:'example.invalid/*'},
 {zone_id:'unreviewed'},{account_id:'unreviewed'},{env:{production:{}}},
 {services:[{binding:'OTHER',service:'other-worker'}]},
 {kv_namespaces:[{binding:'OTHER',id:'unreviewed'}]},
 {queues:{producers:[{binding:'OTHER',queue:'unreviewed'}]}},
 {durable_objects:{bindings:[{name:'OTHER',class_name:'Other'}]}},
 {vars:{STRIPE_SECRET_KEY:'synthetic-not-a-key'}},
])check(exercise({},inherited).status!==0,'Reject inherited routing/binding/secret: '+Object.keys(inherited)[0]);
check(exercise({}, {}, true).status!==0,'Never overwrite an already prepared owner configuration');

// Exercise the actual preflight too: generator and preflight must agree on
// optional storage and malformed identity inputs, without invoking Wrangler.
const preflight=fileURLToPath(new URL('./preflight-independent.mjs',import.meta.url));
for(const [overrides,expected] of [[{},0],[{FIRE_R2_BUCKET_NAME:'fire-ci-photos'},0],
 [{FIRE_R2_BUCKET_NAME:'Bad/Bucket'},1],[{FIRE_D1_DATABASE_ID:'-'.repeat(36)},1],
 [{FIRE_WORKER_NAME:'fire-production'},1],[{FIRE_D1_DATABASE_NAME:''},1]]){
 const env={...process.env,FIRE_WORKER_NAME:'fire-ci-synthetic',FIRE_D1_DATABASE_NAME:'fire-ci-db',FIRE_D1_DATABASE_ID:uuid,FIRE_R2_BUCKET_NAME:'',...overrides};
 const run=spawnSync(process.execPath,[preflight],{env,encoding:'utf8',timeout:10000});
 check(run.status===expected,'Actual preflight agrees with config validation: '+JSON.stringify(overrides));
}
console.log('PASS '+checks+' independent D1-only Wrangler adapter checks (zero remote actions).');
