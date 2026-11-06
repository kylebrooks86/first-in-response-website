// FIRE TEST-ONLY. Deliberately no FIRE App logic, DB queries, Stripe, or customer data.
// Fail closed even if a Cloudflare Access policy has not yet been installed.
export default {
  async fetch() {
    return new Response('FIRE Stripe test Worker disabled pending Access verification.', {
      status: 403,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      }
    });
  }
};
