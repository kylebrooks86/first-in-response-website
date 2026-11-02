import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareStripeTestManifest} from './prepare-stripe-test-manifest.mjs';
const PLACEHOLDER='00000000-0000-4000-8000-000000000000';
function local(){
 return {
   name:'site-creator-vinext-starter',
   topLevelName:'site-creator-vinext-starter',
   main:'./index.js',
   compatibility_date:'2026-05-15',
   compatibility_flags:['nodejs_compat'],
   assets:{directory:'../client',binding:'ASSETS'},
   d1_databases:[{binding:'DB',database_name:'fire-app-local',database_id:PLACEHOLDER}],
   r2_buckets:[{binding:'BUCKET',bucket_name:'fire-app-local'}],
   vars:{
    FIRE_SERVICE_LOCATIONS_CANDIDATE:'',
    FIRE_CUSTOMER_PROPERTIES_CANDIDATE:'',
    FIRE_PROPERTY_WORKFLOW_CANDIDATE:'',
    FIRE_PROPERTY_RECOVERY_CANDIDATE:'',
    FIRE_PROPERTY_ESTIMATES_CANDIDATE:'',
    FIRE_LOCAL_CUSTOMERS_CANDIDATE:''
   }
 };
}
test('compiles exact isolated test manifest locally with no billable storage and no payment keys',()=>{
 const generated=local();
 const result=prepareStripeTestManifest(generated);
 assert.equal(generated.d1_databases[0].database_id,PLACEHOLDER,'input is not mutated');
 assert.equal(result.name,'fire-stripe-test-20261101');
 assert.equal(result.topLevelName,'fire-stripe-test-20261101');
 assert.equal(result.d1_databases[0].database_id,'dba421ba-fc66-4cf8-9c31-51616f8249ba');
 assert.equal(result.workers_dev,true);
 assert.equal(result.preview_urls,false);
 assert.deepEqual(result.routes,[]);
 assert.equal(Object.hasOwn(result,'r2_buckets'),false);
 assert.equal(Object.hasOwn(result,'kv_namespaces'),false);
 assert.equal(result.vars.FIRE_STRIPE_MODE,'disabled');
 assert.equal(result.vars.FIRE_ENV,'cloudflare-staging');
 assert.equal(result.vars.SITE_ORIGIN,'https://fire-stripe-test-20261101.kyle-bfc.workers.dev');
 assert.equal(result.vars.FIRE_ACCESS_REQUIRED,'enabled');
 assert.deepEqual(Object.keys(result.vars).sort(),['FIRE_ACCESS_REQUIRED','FIRE_ENV','FIRE_STRIPE_MODE','SITE_ORIGIN']);
 assert.deepEqual(result.assets,generated.assets);
 assert.doesNotMatch(JSON.stringify(result),/FIRE_ACCESS_AUD|FIRE_ACCESS_OWNER_EMAIL|FIRE_ACCESS_TEAM_DOMAIN|sk_test_|rk_test_|whsec_/);
});
test('incorrect inherited identity, flags, routes, paid resources and keys fail closed',()=>{
 const changes=[
  x=>x.d1_databases[0].database_id='8ccfb1f8-1657-4074-b1b2-47de78f95003',
  x=>x.d1_databases[0].database_id='dba421ba-fc66-4cf8-9c31-51616f8249ba',
  x=>x.d1_databases[0].database_name='fire-app-staging-db',
  x=>x.d1_databases.push({binding:'EXTRA',database_id:PLACEHOLDER,database_name:'extra'}),
  x=>x.r2_buckets[0].bucket_name='qa-photos',
  x=>x.r2_buckets[0].binding='UNEXPECTED',
  x=>x.r2_buckets=[],
  x=>x.kv_namespaces=[{binding:'PHOTOS',id:'other'}],
  x=>x.vars.FIRE_QA_SYNTHETIC_ONLY='enabled',
  x=>x.vars.FIRE_LOCAL_CUSTOMERS_CANDIDATE='synthetic-only',
  x=>x.vars.FIRE_ACCESS_OWNER_EMAIL='owner@private.com',
  x=>x.routes=[{pattern:'fire.example.com',custom_domain:true}],
  x=>x.env={production:{}},
  x=>x.main='../QA/worker.js',
  x=>x.main='/absolute/worker.js',
  x=>x.triggers={crons:['* * * * *']},
  x=>x.vars.STRIPE_SECRET_KEY='sk_live_dummy'
 ];
 for(const mutate of changes){
  const cfg=local();mutate(cfg);
  assert.throws(()=>prepareStripeTestManifest(cfg),/FIRE TEST BUILD BLOCKED/);
 }
});
