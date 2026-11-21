import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTestAppIdentity,PROPOSED_TEST_MAPPING} from './test-app-identity-contract.mjs';
test('verified owner-only TEST resources map locally and remain explicitly nondeployable',()=>{
 const result=validateTestAppIdentity(PROPOSED_TEST_MAPPING);
 assert.equal(result.status,'SOURCE_MAPPING_OK_NOT_DEPLOYED');
 assert.equal(result.appDeployed,false);
 assert.equal(result.hostBindingsVerified,false);
 assert.equal(result.photosEnabled,false);
 assert.equal(result.stripeEnabled,false);
});
test('reject missing/changed owner auth, wrong D1, Stripe, photos, routes, and extra paid bindings',()=>{
 const mutate=[
  x=>x.worker='fire-fullapp-qa-20261016',
  x=>x.origin='https://other.example.com',
  x=>x.d1.uuid='8ccfb1f8-1657-4074-b1b2-47de78f95003',
  x=>x.d1.name='fire-app-staging-db',
  x=>x.d1.migrationsApplied=0,
  x=>x.vars.FIRE_ACCESS_REQUIRED='',
  x=>x.vars.FIRE_ENV='cloudflare-production',
  x=>x.vars.FIRE_STRIPE_MODE='test',
  x=>x.vars.SITE_ORIGIN='https://other.example.com',
  x=>x.secretNames=[],
  x=>x.secretNames.push('STRIPE_SECRET_KEY'),
  x=>x.previewUrlsEnabled=true,
  x=>x.existingAccessOwnerOnlyVerified=false,
  x=>x.fullAppDeploymentApproved=true,
  x=>x.payments='stripe-enabled',
  x=>x.photos='r2-enabled',
  x=>x.r2_buckets=[{binding:'BUCKET',bucket_name:'qa-photos'}],
  x=>x.kv_namespaces=[{binding:'BUCKET'}],
  x=>x.routes=['fire.example.com/*'],
  x=>x.customDomains=['example.com'],
 ];
 for(const edit of mutate){
  const x=structuredClone(PROPOSED_TEST_MAPPING);edit(x);
  assert.throws(()=>validateTestAppIdentity(x),/FIRE TEST APP DEPLOY BLOCKED/);
 }
});
