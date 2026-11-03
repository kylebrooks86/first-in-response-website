import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewedPublicAccessOverrides} from '../public-access-contract.mjs';
import {STRIPE_TEST_PROPOSED_OVERRIDE,STRIPE_TEST_REQUIRED_EVENTS} from './webhook-path-contract.mjs';
import {
  GATE9_TEST_ORIGIN,GATE9_TEST_CALLBACK,LEGACY_SITES_CALLBACK,
  reviewWebhookAccessDelta,reviewStripeTestEndpointMetadata,
} from './gate9-provider-webhook-contract.mjs';

const workerId='synthetic-access-worker-id-NOT-PROVIDER-EVIDENCE';
const before=()=>({type:'worker',worker_id:workerId,overrides:reviewedPublicAccessOverrides()});
const after=()=>({...before(),overrides:[...before().overrides,{...STRIPE_TEST_PROPOSED_OVERRIDE}]});
const original=()=>({
  id:'we_legacySynthetic123',url:LEGACY_SITES_CALLBACK,livemode:false,status:'enabled',
  enabled_events:['checkout.session.completed','checkout.session.async_payment_failed','checkout.session.async_payment_succeeded'],
});
const fresh=()=>({
  id:'we_newSynthetic123',url:GATE9_TEST_CALLBACK,livemode:false,status:'enabled',
  enabled_events:[...STRIPE_TEST_REQUIRED_EVENTS],
});
const scope=()=>({expectedWorkerId:workerId,before:before(),after:after()});
const endpoint=()=>({legacyBefore:original(),legacyAfter:original(),newTestEndpoint:fresh()});
const blocked=(call)=>assert.throws(call,/FIRE GATE9 PROVIDER ISOLATION BLOCKED/);

test('correct TEST callback and provider metadata are required, but always remain unapproved',()=>{
  assert.equal(GATE9_TEST_ORIGIN,'https://fire-stripe-test-20261101.kyle-bfc.workers.dev');
  assert.equal(GATE9_TEST_CALLBACK,GATE9_TEST_ORIGIN+'/api/payments/webhook');
  const a=reviewWebhookAccessDelta(scope());
  const b=reviewStripeTestEndpointMetadata(endpoint());
  assert.equal(a.addedPublicPath,'/api/payments/webhook');
  assert.equal(a.existingExceptionsPreserved,reviewedPublicAccessOverrides().length);
  assert.equal(b.events,5);
  assert.equal(b.originalLegacyEndpointPreserved,true);
  for(const result of [a,b])for(const k of Object.keys(result).filter(k=>/Verified|Applied|Created|Configured|Enabled|Authorized|Accepted/.test(k)))
    assert.equal(result[k],false,'No hosted evidence or approval can be inferred: '+k);
});

test('Access changes fail closed on wrong Worker, missing/duplicated paths, broad or private bypass',()=>{
  for(const mutate of [
    x=>x.after.worker_id='another-worker',
    x=>x.before.worker_id='another-worker',
    x=>x.after.type='public',
    x=>x.after.overrides[0].path_pattern='/*',
    x=>x.before.overrides[0].path_pattern='/api/*',
    x=>x.after.overrides.pop(),
    x=>x.after.overrides.push({...STRIPE_TEST_PROPOSED_OVERRIDE}),
    x=>x.after.overrides.push({behavior:'public',path_pattern:'/api/payments/refund'}),
    x=>x.after.overrides.push({behavior:'public',path_pattern:'/api/payments/webhook/*'}),
    x=>x.after.overrides.push(null),
    x=>x.after.overrides[0].behavior='bypass',
    x=>x.after.overrides.splice(0,1),
    x=>x.after.overrides.push({behavior:'public',path_pattern:'/api/backup'}),
  ]){
    const x=scope();mutate(x);blocked(()=>reviewWebhookAccessDelta(x));
  }
  blocked(()=>reviewWebhookAccessDelta({...scope(),expectedWorkerId:'undocumented:worker'}));
});

test('Stripe endpoint must be independent, TEST-only, exact callback and exactly five events',()=>{
  for(const mutate of [
    x=>x.newTestEndpoint.id=x.legacyBefore.id,
    x=>x.newTestEndpoint.url=x.legacyBefore.url,
    x=>x.newTestEndpoint.url='https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev/api/payments/webhook',
    x=>x.newTestEndpoint.url='https://fire-app-independent-staging.kyle-bfc.workers.dev/api/payments/webhook',
    x=>x.newTestEndpoint.url='https://fire-stripe-test-20261101.kyle-bfc.workers.dev/api/payments/*',
    x=>x.newTestEndpoint.enabled_events.pop(),
    x=>x.newTestEndpoint.enabled_events.push('*'),
    x=>x.newTestEndpoint.enabled_events[0]='charge.refunded',
    x=>x.newTestEndpoint.enabled_events[0]=x.newTestEndpoint.enabled_events[1],
    x=>x.newTestEndpoint.livemode=true,
    x=>x.newTestEndpoint.status='disabled',
    x=>x.legacyAfter.url='https://new-host.invalid',
    x=>x.legacyAfter.enabled_events.push('refund.updated'),
    x=>x.newTestEndpoint=null,
  ]){
    const x=endpoint();mutate(x);blocked(()=>reviewStripeTestEndpointMetadata(x));
  }
});

test('matching existing webhook handler retains raw HMAC signature and TEST mode safeguards',()=>{
  const route=readFileSync(new URL('../../shared/app/api/payments/webhook/route.ts',import.meta.url),'utf8');
  const materializer=readFileSync(new URL('../materialize-stripe-test.py',import.meta.url),'utf8');
  assert.match(route,/verifyStripeSignature\(rawBody, signature, runtime\.STRIPE_WEBHOOK_SECRET\)/);
  assert.match(route,/Math\.abs\(nowSeconds-timestampNumber\) > 300/);
  assert.match(route,/event\.livemode!==!sandboxTarget/);
  assert.match(materializer,/FIRE_STRIPE_MODE !== "test"/);
  // This is ONLY an offline safety contract and must never authorize provider writes.
  const code=readFileSync(new URL('./gate9-provider-webhook-contract.mjs',import.meta.url),'utf8');
  for(const unsafe of ['api.stripe.com/v1/webhook_endpoints','wrangler deploy','secret put','process.env.STRIPE_SECRET_KEY'])
    assert.ok(!code.includes(unsafe),'No cloud-write/secret access: '+unsafe);
});
