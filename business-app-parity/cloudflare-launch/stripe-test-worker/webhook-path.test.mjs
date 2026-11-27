import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  STRIPE_TEST_WEBHOOK_PATH, STRIPE_TEST_REQUIRED_EVENTS,
  STRIPE_TEST_PROPOSED_OVERRIDE, reviewTestWebhookOverride,
} from './webhook-path-contract.mjs';
const route=readFileSync(new URL('../../shared/app/api/payments/webhook/route.ts',import.meta.url),'utf8');
const ownerRefund=readFileSync(new URL('../../shared/app/api/payments/refund/route.ts',import.meta.url),'utf8');
test('TEST webhook exact path and six supported Stripe event types',()=>{
  assert.equal(STRIPE_TEST_WEBHOOK_PATH,'/api/payments/webhook');
  assert.deepEqual(STRIPE_TEST_REQUIRED_EVENTS,[
    'checkout.session.completed','checkout.session.async_payment_failed',
    'checkout.session.async_payment_succeeded','refund.created','refund.updated','refund.failed',
  ]);
  const result=reviewTestWebhookOverride(STRIPE_TEST_PROPOSED_OVERRIDE);
  assert.equal(result.ownerApproved,false);
  assert.equal(result.cloudflareOverrideInstalled,false);
  assert.equal(result.stripeTestWebhookCreated,false);
  assert.equal(result.sixEventReconciliationProven,false);
  for(const mutation of [
    {behavior:'bypass',path_pattern:STRIPE_TEST_WEBHOOK_PATH},
    {behavior:'public',path_pattern:'/*'},
    {behavior:'public',path_pattern:'/api/*'},
    {behavior:'public',path_pattern:'/api/payments/*'},
    {behavior:'public',path_pattern:'/api/payments/refund'},
    {behavior:'public',path_pattern:'/api/payments/webhook/*'},
    {behavior:'public',path_pattern:'/api/payments/checkout'},
    {behavior:'public',path_pattern:STRIPE_TEST_WEBHOOK_PATH,extra:'bad'},
  ])assert.throws(()=>reviewTestWebhookOverride(mutation),/FIRE TEST WEBHOOK BLOCKED/);
});
test('real handler verifies HMAC signature, timestamp, test/live envelope and session mode',()=>{
  for(const pattern of [
    /STRIPE_WEBHOOK_SECRET/,/stripe-signature/,/verifyStripeSignature\(/,
    /crypto\.subtle\.importKey/,/HMAC/,/SHA-256/,
    /Math\.abs\(nowSeconds-timestampNumber\) > 300/,
    /event\.livemode!==!sandboxTarget/,
    /object\.livemode!==event\.livemode/,
    /reconcileStripeCheckout\(/,/recordStripeCheckoutFailure\(/,
    /recordRefundUpdate\(/,
  ])assert.match(route,pattern);
  for(const event of STRIPE_TEST_REQUIRED_EVENTS)assert.ok(route.includes(event),event);
  assert.match(ownerRefund,/idempotency-key/);
  assert.match(ownerRefund,/fire-refund-\$\{requestId\}/);
  assert.doesNotMatch(route,/getChatGPTUser\(/);
});
