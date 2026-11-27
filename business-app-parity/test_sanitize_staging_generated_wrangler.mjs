/** Synthetic, no-provider tests for obsolete Wrangler legacy_env removal. */
import assert from 'node:assert/strict';
import {stripObsoleteLegacyEnv} from './sanitize_staging_generated_wrangler.mjs';
const baseline={
  name:'fire-app-independent-staging',workers_dev:true,preview_urls:false,
  compatibility_date:'2026-10-16',main:'index.js',
  d1_databases:[{binding:'DB',database_name:'fire-app-staging-db',database_id:'afb2c05a-d794-4a9a-b580-924ce01c26ad'}],
  secrets:{required:['FIRE_ADMIN_PASSWORD_HASH','FIRE_SESSION_SECRET']},
  vars:{FIRE_ENV:'staging',FIRE_STRIPE_MODE:'disabled',
    SITE_ORIGIN:'https://fire-app-independent-staging.kyle-bfc.workers.dev'}
};
let checks=0;
for(const flag of [true,false]){
 const candidate={...structuredClone(baseline),legacy_env:flag};
 const {clean,changed}=stripObsoleteLegacyEnv(candidate);
 assert.equal(changed,true);
 assert.equal(Object.hasOwn(clean,'legacy_env'),false);
 assert.equal(candidate.legacy_env,flag,'Original input unchanged');
 assert.deepEqual(clean,baseline,'Every other Worker, D1, Stripe and security binding retained');
 checks++;
}
const prior=stripObsoleteLegacyEnv(structuredClone(baseline));
assert.equal(prior.changed,false);assert.deepEqual(prior.clean,baseline);checks++;
for(const [label,mutate] of [
 ['unexpected legacy value',c=>c.legacy_env='false'],
 ['wrong Worker',c=>c.name='fire-app-independent-live'],
 ['wrong D1',c=>c.d1_databases[0].database_id='wrong'],
 ['Stripe enabled',c=>c.vars.FIRE_STRIPE_MODE='test'],
 ['preview enabled',c=>c.preview_urls=true],
 ['R2 binding',c=>c.r2_buckets=[{binding:'BUCKET',bucket_name:'new-photos'}]]
]){
 const candidate=structuredClone(baseline);mutate(candidate);
 assert.throws(()=>stripObsoleteLegacyEnv(candidate),undefined,label);checks++;
}
console.log('PASS '+checks+'/'+checks+' STAGING legacy_env compatibility and fail-closed identity checks; NO CLOUD WRITES');
