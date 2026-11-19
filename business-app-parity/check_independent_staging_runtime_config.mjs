/** Read-only source identity gate for the existing independent STAGING Worker.
 * Supports only the explicit OPTIONAL build flags already guarded by the
 * independently reviewed staging vite.config.ts. Does NOT attest any owner
 * approval, actual hosted Access/numbering, provider config or deployment.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const NAME='fire-app-independent-staging';
const DB='fire-app-staging-db';
const UUID='afb2c05a-d794-4a9a-b580-924ce01c26ad';
const ORIGIN='https://fire-app-independent-staging.kyle-bfc.workers.dev';
const KEYS=['FIRE_ADMIN_PASSWORD_HASH','FIRE_SESSION_SECRET'];
const QUICK_KEYS=[...KEYS,'FIRE_PIN_HASH','FIRE_PIN_PEPPER'];
const EXACT_NUMBERING='owner-approved-schema-v1';
const EXACT_QUICK_AUTH='passkey-or-pin-v1';
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
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
  assert.ok(cfg.vars && typeof cfg.vars==='object' && !Array.isArray(cfg.vars),
    'Staging vars must be a concrete object');
  const vars=cfg.vars;
  assert.equal(vars.FIRE_ENV,'staging','Wrong environment or tenant');
  assert.equal(vars.SITE_ORIGIN,ORIGIN,'Unexpected staging origin');
  const numbering=own(vars,'FIRE_JOB_NUMBERS_CANDIDATE');
  const quick=own(vars,'FIRE_QUICK_AUTH_MODE');
  if(numbering){
    assert.equal(vars.FIRE_JOB_NUMBERS_CANDIDATE,EXACT_NUMBERING,
      'Permanent Job # source opt-in is not recognized');
  }
  if(quick) {
    assert.equal(vars.FIRE_QUICK_AUTH_MODE,EXACT_QUICK_AUTH,
      'PIN/passkey source opt-in is not recognized');
    assert.ok(typeof vars.FIRE_ACCESS_TEAM_DOMAIN==='string' &&
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(vars.FIRE_ACCESS_TEAM_DOMAIN),
      'PIN/passkey requires a bounded staging Access team domain');
    assert.ok(typeof vars.FIRE_ACCESS_AUDIENCE==='string' &&
      vars.FIRE_ACCESS_AUDIENCE.length>=12 && vars.FIRE_ACCESS_AUDIENCE.length<=256,
      'PIN/passkey requires a bounded Access application audience');
    assert.ok(typeof vars.FIRE_ACCESS_OWNER_EMAIL==='string' &&
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(vars.FIRE_ACCESS_OWNER_EMAIL),
      'PIN/passkey requires a bounded owner identity');
  }
  // Only reviewed feature flags may expand these compiled vars. Reject
  // stray payment, credential, storage, customer, origin and tenancy vars.
  const allowed=['FIRE_ENV','SITE_ORIGIN',
    ...(numbering?['FIRE_JOB_NUMBERS_CANDIDATE']:[]),
    ...(quick?['FIRE_QUICK_AUTH_MODE','FIRE_ACCESS_TEAM_DOMAIN',
       'FIRE_ACCESS_AUDIENCE','FIRE_ACCESS_OWNER_EMAIL']:[])];
  assert.deepEqual(Object.keys(vars).sort(),allowed.sort(),
    'Unexpected plaintext variable or unreviewed feature flag');
  assert.deepEqual(cfg.secrets?.required,quick?QUICK_KEYS:KEYS,
    'Exact private authentication secret names required for selected mode');
  assert.ok(!cfg.secrets || Object.keys(cfg.secrets).every(k=>k==='required'),
    'Unknown authentication secrets configuration');
  for(const field of ['r2_buckets','kv_namespaces','queues','services',
                       'durable_objects','hyperdrive','ai','dispatch_namespaces',
                       'unsafe','analytics_engine_datasets','send_email',
                       'pipelines','browser','workflows']) {
    assert.ok(empty(cfg[field]),'Unreviewed hosted binding: '+field);
  }
  assert.ok(empty(cfg.routes) && empty(cfg.route) &&
    !cfg.zone_id && !cfg.account_id && empty(cfg.triggers),
    'No production/custom routes or account overrides');
  assert.ok(empty(cfg.tail_consumers) && empty(cfg.migrations),
    'No secondary Worker consumers or migrations');
  return {
    candidateBuildIdentityVerified:true,worker:NAME,db:DB,
    dbBindingVerified:true,requiredAuthSecretNamesVerified:true,
    sourceJobNumberModeRequested:numbering,
    sourceQuickAuthModeRequested:quick,
    jobNumbersPhysicalD1ProofVerified:false,
    quickAuthAccessAndOwnerApproved:false,
    hostedBindingsRechecked:false,actualHostedSourceMatched:false,
    remoteMigrationApproved:false,previewUploadAuthorized:false,
    productionReady:false
  };
}
if (process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  assert.equal(process.argv.length,3,'Usage: node check_independent_staging_runtime_config.mjs COMPILED_WRANGLER_JSON');
  const result=verify(JSON.parse(readFileSync(process.argv[2],'utf8')));
  console.log(JSON.stringify(result));
}
