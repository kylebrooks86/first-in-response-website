// No Cloudflare credentials, network or hosted mutations. Verify the exact
// one-field local compatibility transform and strict rejection paths.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {finalizeLegacyEnv,finalizeReviewFile} from './finalize-stripe-test-legacy-env.mjs';
const base={
  name:'fire-stripe-test-20261101',topLevelName:'fire-stripe-test-20261101',
  main:'./index.js',legacy_env:true,workers_dev:true,preview_urls:false,
  routes:[],d1_databases:[{binding:'DB',database_name:'fire-stripe-test-db-20261101',
    database_id:'dba421ba-fc66-4cf8-9c31-51616f8249ba'}],
  vars:{FIRE_STRIPE_MODE:'disabled',FIRE_ACCESS_REQUIRED:'enabled',
    FIRE_ENV:'cloudflare-staging',SITE_ORIGIN:'https://fire-stripe-test-20261101.kyle-bfc.workers.dev'},
  observability:{enabled:true,logs:{enabled:true,invocation_logs:true},redact_query_string:false},
  compatibility_flags:['nodejs_compat','global_fetch_strictly_public'],
  assets:{directory:'./assets'},upload_source_maps:false
};
const deep=x=>structuredClone(x);
test('exactly legacy_env:true removed; all other binding, traffic, asset, flags and vars unchanged',()=>{
 const original=deep(base);
 const result=finalizeLegacyEnv(original);
 assert.equal(Object.hasOwn(result,'legacy_env'),false);
 assert.deepEqual(result,Object.fromEntries(Object.entries(original).filter(([key])=>key!=='legacy_env')));
 assert.equal(original.legacy_env,true);
});
for(const [name,mutate] of [
 ['legacy_env false',x=>{x.legacy_env=false}],
 ['legacy_env missing',x=>{delete x.legacy_env}],
 ['legacy_env string',x=>{x.legacy_env='true'}],
 ['nested env',x=>{x.env={staging:{}}}],
 ['account override',x=>{x.account_id='other-account'}],
 ['zone override',x=>{x.zone_id='other-zone'}],
 ['wrong Worker name',x=>{x.name='fire-app-live'}],
 ['wrong topLevelName',x=>{x.topLevelName='other'}],
 ['workers.dev turned off',x=>{x.workers_dev=false}],
 ['preview enabled',x=>{x.preview_urls=true}],
 ['public route',x=>{x.routes=['*']}],
 ['D1 wrong target',x=>{x.d1_databases[0].database_id='11111111-2222-4333-8444-555555555555'}],
 ['extra D1',x=>{x.d1_databases.push({...x.d1_databases[0]})}],
 ['R2 binding',x=>{x.r2_buckets=[{binding:'BUCKET',bucket_name:'live'}]}],
 ['KV binding',x=>{x.kv_namespaces=[{binding:'KV',id:'0'}]}],
 ['DO binding',x=>{x.durable_objects={bindings:[{name:'X'}]}}],
 ['Stripe enabled',x=>{x.vars.FIRE_STRIPE_MODE='test'}],
 ['Access disabled',x=>{x.vars.FIRE_ACCESS_REQUIRED='disabled'}],
 ['observability disabled',x=>{x.observability.enabled=false}],
 ['invocation logs disabled',x=>{x.observability.logs.invocation_logs=false}],
 ['redaction changed',x=>{x.observability.redact_query_string=true}]
]){
 test('reject unsafe or ambiguous '+name,()=>{
  const x=deep(base);mutate(x);assert.throws(()=>finalizeLegacyEnv(x),/STOP/);
 });
}
test('local exact file mutation once, no other JSON changes or external writes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'fire-stripe-legacy-'));
 try{
  const server=join(dir,'dist','server');mkdirSync(server,{recursive:true});
  const review=join(server,'wrangler.FIRE_TEST_REVIEW_ONLY.json');
  const prior=JSON.stringify(base);writeFileSync(review,prior);
  finalizeReviewFile(review);
  assert.deepEqual(JSON.parse(readFileSync(review,'utf8')),finalizeLegacyEnv(base));
  assert.throws(()=>finalizeReviewFile(review),/STOP/, 'second modification must refuse');
  assert.deepEqual(JSON.parse(readFileSync(review,'utf8')),finalizeLegacyEnv(base));
  assert.throws(()=>finalizeReviewFile(join(dir,'other.json')),/STOP/,'wrong destination refused');
 }finally{rmSync(dir,{force:true,recursive:true})}
});
