/** Read-only identity gate for an independent staging-only FIRE Worker build.
 * Does not upload, deploy, mutate D1, or claim hosted version equivalence.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const NAME='fire-app-independent-staging';
const DB='fire-app-staging-db';
const UUID='afb2c05a-d794-4a9a-b580-924ce01c26ad';
const ORIGIN='https://fire-app-independent-staging.kyle-bfc.workers.dev';
const KEYS=['FIRE_ADMIN_PASSWORD_HASH','FIRE_SESSION_SECRET'];

const empty=value => value===undefined || value===null || value==='' ||
  (Array.isArray(value) && value.length===0) ||
  (value && typeof value==='object' && !Array.isArray(value) && Object.values(value).every(empty));

export function verify(cfg) {
  assert.ok(cfg && typeof cfg==='object' && !Array.isArray(cfg), 'Missing Worker manifest');
  assert.equal(cfg.name,NAME,'Wrong Worker target');
  assert.equal(cfg.workers_dev,true,'Worker must retain its own workers.dev domain');
  assert.ok(!cfg.env,'No named Cloudflare environment override allowed');
  assert.deepEqual(cfg.d1_databases,[{binding:'DB',database_name:DB,database_id:UUID}],
    'Must bind only exact owner staging D1');
  assert.deepEqual(cfg.secrets?.required,KEYS,'Both owner authentication secrets required');
  assert.deepEqual(cfg.vars,{FIRE_ENV:'staging',SITE_ORIGIN:ORIGIN},
    'Unexpected runtime vars or staging origin');
  assert.ok(!Object.keys(cfg.vars).some(name=>/(password|secret|token|stripe|key)/i.test(name)),
    'Credentials or payment keys are forbidden in plaintext vars');
  for (const field of ['r2_buckets','kv_namespaces','queues','services',
                       'durable_objects','hyperdrive','ai','dispatch_namespaces','unsafe']) {
    assert.ok(empty(cfg[field]),'Unreviewed hosted binding: '+field);
  }
  assert.ok(empty(cfg.routes) && empty(cfg.route) && !cfg.zone_id && !cfg.account_id && empty(cfg.triggers),
    'No production/custom routes or account overrides');
  assert.ok(!cfg.tail_consumers && !cfg.migrations,'No secondary Worker consumers or migrations');
  return {candidateBuildIdentityVerified:true,worker:NAME,db:DB,
    dbBindingVerified:true,requiredAuthSecretNamesVerified:true,
    hostedBindingsRechecked:false,actualHostedSourceMatched:false,
    remoteMigrationApproved:false,previewUploadAuthorized:false,
    productionReady:false};
}
if (process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  assert.equal(process.argv.length,3,'Usage: node check_independent_staging_runtime_config.mjs COMPILED_WRANGLER_JSON');
  const result=verify(JSON.parse(readFileSync(process.argv[2],'utf8')));
  console.log(JSON.stringify(result));
}
