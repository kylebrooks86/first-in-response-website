/** SOURCE REVIEW ONLY; NEVER installs or changes Cloudflare Access / Stripe.
 * Stripe is a machine webhook: it cannot complete an owner's interactive login.
 * Only the exact signed TEST callback may bypass owner-only Cloudflare Access.
 */
export const STRIPE_TEST_WEBHOOK_PATH = '/api/payments/webhook';
export const STRIPE_TEST_REQUIRED_EVENTS = Object.freeze([
  'checkout.session.completed',
  'checkout.session.async_payment_failed',
  'checkout.session.async_payment_succeeded',
  'refund.created',
  'refund.updated',
  'refund.failed',
]);
export const STRIPE_TEST_PROPOSED_OVERRIDE = Object.freeze({
  behavior: 'public',
  path_pattern: STRIPE_TEST_WEBHOOK_PATH,
});
const PRIVATE_SAMPLES = [
  '/', '/api/payments', '/api/payments/refund',
  '/api/payments/checkout', '/api/payments/checkout/reconcile',
  '/api/customers', '/api/invoices', '/settings', '/api/backup',
  '/api/payments/webhook/admin', '/api/payments/webhook/other',
];
export function reviewTestWebhookOverride(policy) {
  if (!policy || Object.keys(policy).sort().join(',') !== 'behavior,path_pattern' ||
      policy.behavior !== 'public' || policy.path_pattern !== STRIPE_TEST_WEBHOOK_PATH)
    throw Error('FIRE TEST WEBHOOK BLOCKED: require exact POST callback path');
  for (const other of PRIVATE_SAMPLES) {
    if (other === policy.path_pattern) throw Error('FIRE TEST WEBHOOK BLOCKED: private path');
  }
  return Object.freeze({
    proposal:'EXACT_SIGNED_WEBHOOK_PATH_SOURCE_REVIEW',
    path:STRIPE_TEST_WEBHOOK_PATH,
    cloudflareOverrideInstalled:false,
    stripeTestWebhookCreated:false,
    signatureNegativeCasesProvenOnHost:false,
    sixEventReconciliationProven:false,
    liveMode:false,
    ownerApproved:false,
  });
}
