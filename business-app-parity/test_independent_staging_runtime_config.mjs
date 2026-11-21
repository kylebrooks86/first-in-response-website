/** Exact STAGING built runtime identity; no provider calls or owner credentials. */
import assert from 'node:assert/strict';
import {verify} from './check_independent_staging_runtime_config.mjs';

const baseline={
  name:'fire-app-independent-staging',
  workers_dev:true,
  preview_urls:false,
  d1_databases:[{binding:'DB',database_name:'fire-app-staging-db',
    database_id:'afb2c05a-d794-4a9a-b580-924ce01c26ad'}],
  secrets:{required:['FIRE_ADMIN_PASSWORD_HASH','FIRE_SESSION_SECRET']},
  vars:{FIRE_ENV:'staging',
    SITE_ORIGIN:'https://fire-app-independent-staging.kyle-bfc.workers.dev'}
};
const copy=()=>structuredClone(baseline);
const numbering=c=>{c.vars.FIRE_JOB_NUMBERS_CANDIDATE='owner-approved-schema-v1';};
const quick=c=>{
  Object.assign(c.vars,{
    FIRE_QUICK_AUTH_MODE:'passkey-or-pin-v1',
    FIRE_ACCESS_TEAM_DOMAIN:'fire-example.cloudflareaccess.com',
    FIRE_ACCESS_AUDIENCE:'0123456789abcdef0123456789abcdef',
    FIRE_ACCESS_OWNER_EMAIL:'owner@example.test'
  });
  c.secrets.required.push('FIRE_PIN_HASH','FIRE_PIN_PEPPER');
};
const accepted=(transform,label)=>{
  const target=copy();transform(target);
  const result=verify(target);
  assert.equal(result.candidateBuildIdentityVerified,true,label);
  assert.equal(result.sourceJobNumberModeRequested,
    Object.hasOwn(target.vars,'FIRE_JOB_NUMBERS_CANDIDATE'),label);
  assert.equal(result.sourceQuickAuthModeRequested,
    Object.hasOwn(target.vars,'FIRE_QUICK_AUTH_MODE'),label);
  assert.equal(result.jobNumbersPhysicalD1ProofVerified,false,
    'source-only numbering can never attest a physical D1');
  assert.equal(result.quickAuthAccessAndOwnerApproved,false,
    'source-only quick authentication can never approve Access');
  assert.equal(result.actualHostedSourceMatched,false,
    'build config does not prove hosted deployment');
};
let checks=0;
for(const [label,transform] of [
  ['default protected source',()=>{}],
  ['reviewed numbering opt-in only',numbering],
  ['reviewed quick auth opt-in only',quick],
  ['reviewed numbering AND quick auth',c=>{numbering(c);quick(c);}]
]){accepted(transform,label);checks++;}
const rejected=(label,mutate)=>{
  const c=copy();mutate(c);
  assert.throws(()=>verify(c),undefined,label);
  checks++;
};
for(const [label,mutate] of [
  ['wrong Worker',c=>{c.name='fire-fullapp-qa-20261016'}],
  ['preview URLs reopened',c=>{c.preview_urls=true}],
  ['missing preview lock',c=>{delete c.preview_urls}],
  ['invalid preview lock',c=>{c.preview_urls='false'}],
  ['wrong D1',c=>{c.d1_databases[0].database_id='8ccfb1f8-1657-4074-b1b2-47de78f95003'}],
  ['extra D1',c=>{c.d1_databases.push(c.d1_databases[0])}],
  ['missing signing secret',c=>{c.secrets.required.pop()}],
  ['plaintext signing secret',c=>{c.vars.FIRE_SESSION_SECRET='DO-NOT-USE'}],
  ['wrong origin',c=>{c.vars.SITE_ORIGIN='https://example.com'}],
  ['production route',c=>{c.routes=[{pattern:'example.com/*'}]}],
  ['extra R2 bucket',c=>{c.r2_buckets=[{binding:'BUCKET',bucket_name:'fire-live-photos'}]}],
  ['unexpected Stripe key',c=>{c.vars.STRIPE_SECRET_KEY='DO-NOT-USE'}],
  ['unknown backend binding',c=>{c.services=[{binding:'LIVE'}]}],
  ['unknown analytics binding',c=>{c.analytics_engine_datasets=[{binding:'LOGS'}]}],
  ['unexpected browser binding',c=>{c.browser={binding:'BROWSER'}}],
  ['wrong environment',c=>{c.vars.FIRE_ENV='production'}],
  ['numbering value injection',c=>{c.vars.FIRE_JOB_NUMBERS_CANDIDATE='true'}],
  ['numbering blank injection',c=>{c.vars.FIRE_JOB_NUMBERS_CANDIDATE=''}],
  ['numbering nonstring injection',c=>{c.vars.FIRE_JOB_NUMBERS_CANDIDATE=true}],
  ['quick auth wrong value',c=>{quick(c);c.vars.FIRE_QUICK_AUTH_MODE='true'}],
  ['quick auth without PIN hash',c=>{quick(c);c.secrets.required.pop()}],
  ['quick auth with swapped PIN secret names',c=>{quick(c);c.secrets.required.reverse()}],
  ['PIN secrets without Access approval mode',c=>{c.secrets.required.push('FIRE_PIN_HASH','FIRE_PIN_PEPPER')}],
  ['partial Access variable without mode',c=>{c.vars.FIRE_ACCESS_AUDIENCE='0123456789abcdef'}],
  ['quick auth no team',c=>{quick(c);delete c.vars.FIRE_ACCESS_TEAM_DOMAIN}],
  ['quick auth adversarial team',c=>{quick(c);c.vars.FIRE_ACCESS_TEAM_DOMAIN='evil.cloudflareaccess.com.attacker.test'}],
  ['quick auth wrong audience length',c=>{quick(c);c.vars.FIRE_ACCESS_AUDIENCE='short'}],
  ['quick auth invalid owner',c=>{quick(c);c.vars.FIRE_ACCESS_OWNER_EMAIL='not an email'}],
  ['quick auth fake password var',c=>{quick(c);c.vars.FIRE_PIN_HASH='plaintext-secret'}],
  ['extra auth field',c=>{c.secrets.bad='secret'}],
  ['both features with injected payment',c=>{numbering(c);quick(c);c.vars.PAYMENT_MODE='live'}],
  ['both features with undeclared email',c=>{numbering(c);quick(c);c.vars.FIRE_ACCESS_OWNER_EMAIL=''}]
])rejected(label,mutate);
console.log('PASS '+checks+'/'+checks+' independent STAGING build modes: default, guarded optional numbering/quick auth and fail-closed negatives (no hosted operations)');
