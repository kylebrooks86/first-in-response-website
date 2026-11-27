import assert from 'node:assert/strict';
import {testActivationGuard,reviewActivationCandidate} from './review_gate9_test_activation_candidate.mjs';
const origin='https://fire-stripe-test-20261101.kyle-bfc.workers.dev';
const request={url:origin+'/api/payments/webhook'};
const env={FIRE_GATE9_PRIVATE_ACTIVATION:'owner-approved',FIRE_ENV:'cloudflare-staging',
 FIRE_STRIPE_MODE:'test',FIRE_ACCESS_REQUIRED:'enabled',SITE_ORIGIN:origin,
 FIRE_STRIPE_EXPECTED_ACCOUNT_ID:'acct_1ULRIG7ND12rd1wI',
 STRIPE_RESTRICTED_KEY:'rk_test_'+'synthetic',STRIPE_WEBHOOK_SECRET:'whsec_'+'synthetic',
 FIRE_ACCESS_AUD:'fake',FIRE_ACCESS_OWNER_EMAIL:'fake',FIRE_ACCESS_TEAM_DOMAIN:'fake',DB:{}};
assert.equal(testActivationGuard(env,request),true);
const negatives=[
 {FIRE_GATE9_PRIVATE_ACTIVATION:'blocked'},{FIRE_ENV:''},{FIRE_ENV:'live'},
 {FIRE_STRIPE_MODE:'disabled'},{FIRE_ACCESS_REQUIRED:'disabled'},
 {FIRE_STRIPE_EXPECTED_ACCOUNT_ID:'wrong'},{SITE_ORIGIN:'https://wrong.invalid'},
 {STRIPE_RESTRICTED_KEY:'rk_live_synthetic'},{STRIPE_RESTRICTED_KEY:'sk_test_synthetic'},
 {STRIPE_SECRET_KEY:'sk_test_synthetic'},{STRIPE_WEBHOOK_SECRET:''},
 {FIRE_ACCESS_AUD:''},{FIRE_ACCESS_OWNER_EMAIL:''},{FIRE_ACCESS_TEAM_DOMAIN:''},
 {DB:undefined},{BUCKET:{}},{ASSETS:{}}
];
for(const change of negatives)assert.equal(testActivationGuard({...env,...change},request),false);
assert.equal(testActivationGuard(env,{url:'https://wrong.invalid/api/payments/webhook'}),false);
assert.equal(testActivationGuard(env,{url:'invalid'}),false);
assert.equal(testActivationGuard(null,request),false);
assert.throws(()=>reviewActivationCandidate('not-a-package','bad-pin'),/GATE9_ACTIVATION_REVIEW_STOP/);
console.log('PASS 22 synthetic activation guard and missing pin checks; zero provider calls');
