/** Real Wrangler LOCAL D1 migration -> export -> Python restore test.
 * No remote Cloudflare accounts, database or Stripe credentials are accessed.
 * Working directory, D1 name/id, and all data are generated in temp folders.
 * This test exercises the actual D1 SQL format, unlike SQLite iterdump mocks.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdtempSync,mkdirSync,readdirSync,writeFileSync,copyFileSync,readFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';

const source=resolve('.');
const parity=resolve('..');
const wrangler=join(source,'node_modules/wrangler/bin/wrangler.js');
assert.ok(existsSync(wrangler),'Pinned local Wrangler package required; do not install on the fly.');
const names=readdirSync(join(parity,'adapters/doomsday/drizzle')).filter(n=>/^\d{4}_.+\.sql$/.test(n)).sort();
assert.equal(names.length,23,'Expected 23 Doomsday candidate migration files.');
assert.equal(names.at(-1),'0022_stripe_provider_uniqueness.sql');
const root=mkdtempSync(join(tmpdir(),'fire-wrangler-d1-export-'));
const name='fire-synthetic-local-d1-export-no-remote';
const config=join(root,'wrangler.jsonc'), restoredConfig=join(root,'restore.wrangler.jsonc');
let checks=0;
const env={
  ...process.env,
  CI:'1',CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_SEND_METRICS:'false',
  WRANGLER_WRITE_LOGS:'false',CLOUDFLARE_API_TOKEN:'',CLOUDFLARE_ACCOUNT_ID:'',
};
function invoke(args){
  assert.ok(args.includes('--local'),'Every D1 call must explicitly target local storage.');
  assert.ok(args.includes('--config') && [config,restoredConfig].some(p=>args.includes(p)));
  assert.ok(args[0]===wrangler && args[1]==='d1' && ['migrations','execute','export'].includes(args[2]),
    'Disallow other Wrangler commands.');
  assert.ok(!args.includes('--remote'),'Remote D1 commands forbidden.');
  const result=spawnSync(process.execPath,args,{cwd:root,env,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
  if(result.error || result.status!==0){
    // No actual data leaves this synthetic temp dir; still redact CLI command
    // output to avoid future leakage should the fixture ever change.
    throw new Error('Synthetic local D1 stage '+args.slice(1,4).join(' ')+' failed ('+
      (result.error?.name || String(result.status))+') '+[result.stderr,result.stdout].join('\n').replaceAll(root,'[synthetic-temporary-directory]').slice(-1600));
  }
  return result.stdout;
}
try{
  mkdirSync(join(root,'migrations'));
  for(const n of names.slice(0,-1))copyFileSync(join(parity,'adapters/doomsday/drizzle',n),join(root,'migrations',n));
  writeFileSync(join(root,'noop.js'),'export default {fetch(){return new Response("synthetic");}}');
  writeFileSync(config,JSON.stringify({
    name,
    main:'./noop.js',
    compatibility_date:'2026-10-14',
    d1_databases:[{
      binding:'DB',database_name:name,
      database_id:'12345678-1234-4234-8234-123456789abc',
      migrations_dir:'migrations'
    }]
  },null,2));
  invoke([wrangler,'d1','migrations','apply','DB','--local','--config',config]);
  checks++;
  const seed=join(root,'seed.sql');
  writeFileSync(seed,[
    "INSERT INTO customers(id,name,created_at) VALUES ('synthetic-local-customer','Synthetic-only Wrangler customer','2026-10-15');",
    "INSERT INTO estimates(id,customer_id,status,subtotal_cents,total_cents,deposit_cents,created_at)",
    "VALUES ('synthetic-local-estimate','synthetic-local-customer','completed',10000,10000,5000,'2026-10-15');",
    "INSERT INTO payments(id,estimate_id,type,amount_cents,status,provider_id,created_at)",
    "VALUES ('synthetic-local-payment','synthetic-local-estimate','Cash',10000,'paid','manual-synthetic-only','2026-10-15');"
  ].join('\n'));
  invoke([wrangler,'d1','execute','DB','--local','--config',config,'--file',seed,'--yes']);
  checks++;
  const output=join(root,'full-private-synthetic.sql');
  invoke([wrangler,'d1','export','DB','--local','--config',config,'--output',output]);
  assert.ok(existsSync(output),'Local Wrangler export missing');
  checks++;
  const verifier=join(parity,'verify_doomsday_d1_export.py');
  const v=spawnSync('python3',[verifier,output],{cwd:root,env,encoding:'utf8',timeout:40000,maxBuffer:1024*1024});
  if(v.error||v.status!==0)throw new Error('Actual local Wrangler SQL export failed offline restore validation.');
  const receipt=JSON.parse(v.stdout);
  assert.equal(receipt.offlineRestorationValidated,true);
  assert.equal(receipt.expectedBaselineMigrationCount,22);
  assert.equal(receipt.remoteDataModified,false);
  assert.equal(receipt.migrationAuthorized,false);
  assert.equal(receipt.releaseGateAccepted,false);
  assert.deepEqual(Object.values(receipt.checks),Array(Object.keys(receipt.checks).length).fill(true));
  checks+=7;
  // Import this actual Wrangler dump into a DIFFERENT, empty local D1
  // instance, then re-export. Never restore over the original database.
  const restoreName='fire-synthetic-restore-empty-no-remote';
  writeFileSync(restoredConfig,JSON.stringify({
    name:restoreName,main:'./noop.js',compatibility_date:'2026-10-14',
    d1_databases:[{binding:'DB',database_name:restoreName,
      database_id:'42345678-1234-4234-8234-123456789abc',
      migrations_dir:'migrations'}]
  },null,2));
  invoke([wrangler,'d1','execute','DB','--local','--config',restoredConfig,'--file',output,'--yes']);
  checks++;
  const restoredDump=join(root,'restored-from-real-d1.sql');
  invoke([wrangler,'d1','export','DB','--local','--config',restoredConfig,'--output',restoredDump]);
  const second=spawnSync('python3',[verifier,restoredDump],
    {cwd:root,env,encoding:'utf8',timeout:40000,maxBuffer:1024*1024});
  assert.equal(second.status,0,'Independent restored local D1 re-export must validate');
  assert.equal(JSON.parse(second.stdout).offlineRestorationValidated,true);
  assert.ok(readFileSync(output,'utf8').includes('Synthetic-only Wrangler customer'),
    'Initial export must contain full synthetic data, not schema only.');
  assert.ok(readFileSync(restoredDump,'utf8').includes('Synthetic-only Wrangler customer'),
    'Restored D1 must preserve synthetic customer data, not only table definitions.');
  checks+=3;
  const schemaOnly=join(root,'schema-only.sql');
  invoke([wrangler,'d1','export','DB','--local','--config',config,'--no-data','--output',schemaOnly]);
  const noData=spawnSync('python3',[verifier,schemaOnly],{cwd:root,env,encoding:'utf8',timeout:40000,maxBuffer:1024*1024});
  assert.notEqual(noData.status,0,'Schema-only export must never be accepted as verified complete data');
  checks++;
  console.log('PASS: '+checks+' real Wrangler LOCAL D1 SQL migration/export/disposable restore assertions; no remote/Stripe access or real customer records.');
}finally{rmSync(root,{recursive:true,force:true});}
