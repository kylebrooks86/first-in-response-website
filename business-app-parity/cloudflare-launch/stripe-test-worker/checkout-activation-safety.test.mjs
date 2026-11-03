// Source-only regression guard for eventual Stripe TEST activation.
// No network, Cloudflare calls, credentials, checkout, refund, or deployment.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const route = readFileSync(new URL('../../shared/app/api/payments/checkout/route.ts',import.meta.url),'utf8');
const materializer = readFileSync(new URL('../materialize-stripe-test.py',import.meta.url),'utf8');
const manifest = readFileSync(new URL('./prepare-stripe-test-manifest.mjs',import.meta.url),'utf8');
const webhook = readFileSync(new URL('../../shared/app/api/payments/webhook/route.ts',import.meta.url),'utf8');

test('Stripe TEST checkout has the signed-only rules from current deployed QA source',()=>{
  assert.match(route,/e\.signed_at AS signedAt/);
  assert.match(route,/acceptedAt:string\|null; signedAt:string\|null/);
  assert.match(route,/!row\.acceptedAt\s*\|\|\s*!row\.signedAt/);
  assert.match(route,/\["approved","scheduled","completed"\]\.includes\(row\.status\)/);
  assert.match(route,/status IN \('approved','scheduled','completed'\) AND accepted_at IS NOT NULL AND signed_at IS NOT NULL/);
  assert.doesNotMatch(route,/!row\.acceptedAt\s*&&\s*!\[/);
});

test('checkout reservations and provider acknowledgment must retain exact cents and source identity',()=>{
  for(const expected of [
    'metadata[expected_charge_cents]', 'metadata[expected_amount_cents]',
    'metadata[tip_amount_cents]', 'remote.amount_total===session.amountCents',
    'remote.client_reference_id===estimateId',
    'remote.payment_status==="unpaid"', 'remote.livemode===!sandbox',
  ])assert.ok(route.includes(expected), 'Missing exact session check: '+expected);
  assert.match(route,/WHERE id=\? AND estimate_id=\? AND type=\? AND amount_cents=\? AND status='open'/);
});

test('TEST app is still Stripe-disabled regardless of source checkout improvement',()=>{
  assert.match(materializer,/\bFIRE_STRIPE_MODE\?:string/);
  assert.match(materializer,/FIRE_STRIPE_MODE !== "test"/);
  assert.match(materializer,/Stripe TEST mode kill-switch injection changed/);
  assert.match(manifest,/result\.vars\.FIRE_STRIPE_MODE==='disabled'/);
  assert.match(manifest,/!Object\.hasOwn\(result,'r2_buckets'\)/);
  assert.match(webhook,/verifyStripeSignature\(/);
});

test('this candidate cannot by itself authorize payments or release',()=>{
  // Neither prepared source nor local regression code unlocks Stripe testing.
  assert.doesNotMatch(materializer,/wrangler\.cmd\s+deploy|secret\s+put|stripe\.com\/v1\/refunds/);
  assert.doesNotMatch(manifest,/wrangler\.cmd\s+deploy|secret\s+put/);
  assert.equal(true,true);
});

test('Gate 9 disabled TEST webhook checks HMAC before returning retryable 503, with NO ledger delivery',()=>{
  // The generated Stripe TEST candidate alone changes; shared/LIVE handler is untouched.
  assert.doesNotMatch(materializer,/"app\/api\/payments\/webhook\/route\.ts": "export async function POST/);
  for(const relative of [
    'app/api/payments/checkout/route.ts',
    'app/api/payments/refund/route.ts',
    'app/api/payments/checkout/reconcile/route.ts',
    'app/api/payments/connection/route.ts',
  ]) assert.ok(materializer.includes('"' + relative + '":'), 'Missing early disabled guard on '+relative);
  for(const needed of [
    'webhook_anchor = "  let event:StripeEvent;"',
    'required_signature = "verifyStripeSignature(rawBody, signature, runtime.STRIPE_WEBHOOK_SECRET)"',
    'webhook_source.index(required_signature) > webhook_source.index(webhook_anchor)',
    '"FIRE_STRIPE_MODE" in webhook_source',
    'webhook_guard + webhook_anchor',
    'Stripe TEST is intentionally disabled.',
    'status:503',
    'cache-control',
  ]) assert.ok(materializer.includes(needed), 'Missing disabled webhook fail-closed invariant: '+needed);
  assert.ok(webhook.indexOf('if (!await verifyStripeSignature(') < webhook.indexOf('  let event:StripeEvent;'),
    'Webhook signature validation must run before any event handling');
  assert.ok(webhook.indexOf('  let event:StripeEvent;') < webhook.indexOf('recordRefundUpdate('),
    'TEST injection anchor must come before refund reconciliation');
  assert.ok(webhook.indexOf('  let event:StripeEvent;') < webhook.indexOf('reconcileStripeCheckout('),
    'TEST injection anchor must come before checkout reconciliation');
});
