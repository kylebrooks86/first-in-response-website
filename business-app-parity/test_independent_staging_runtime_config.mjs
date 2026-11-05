import assert from 'node:assert/strict';
import {verify} from './check_independent_staging_runtime_config.mjs';

const baseline={
  name:'fire-app-independent-staging',
  workers_dev:true,
  d1_databases:[{binding:'DB',database_name:'fire-app-staging-db',
    database_id:'afb2c05a-d794-4a9a-b580-924ce01c26ad'}],
  secrets:{required:['FIRE_ADMIN_PASSWORD_HASH','FIRE_SESSION_SECRET']},
  vars:{FIRE_ENV:'staging',
    SITE_ORIGIN:'https://fire-app-independent-staging.kyle-bfc.workers.dev'}
};
const copy=()=>structuredClone(baseline);
let checks=0;
assert.equal(verify(copy()).candidateBuildIdentityVerified,true);checks++;
const negative = [
  ['wrong Worker',c=>{c.name='fire-fullapp-qa-20261016'}],
  ['wrong D1',c=>{c.d1_databases[0].database_id='8ccfb1f8-1657-4074-b1b2-47de78f95003'}],
  ['missing signing secret',c=>{c.secrets.required.pop()}],
  ['plain secret in vars',c=>{c.vars.FIRE_SESSION_SECRET='DO-NOT-USE'}],
  ['wrong origin',c=>{c.vars.SITE_ORIGIN='https://example.com'}],
  ['routing override',c=>{c.routes=[{pattern:'example.com/*'}]}],
  ['extra R2 bucket',c=>{c.r2_buckets=[{binding:'BUCKET',bucket_name:'fire-live-photos'}]}],
  ['unexpected Stripe key',c=>{c.vars.STRIPE_SECRET_KEY='DO-NOT-USE'}],
  ['unknown backend binding',c=>{c.services=[{binding:'LIVE'}]}],
  ['wrong environment',c=>{c.vars.FIRE_ENV='production'}]
];
for(const [label,change] of negative){
  const broken=copy();change(broken);
  assert.throws(()=>verify(broken),undefined,label);checks++;
}
console.log('PASS: '+checks+' isolated staging build identity and negative controls');
