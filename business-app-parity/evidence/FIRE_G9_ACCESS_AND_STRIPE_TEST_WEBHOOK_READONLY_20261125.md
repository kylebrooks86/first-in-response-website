# Gate 9 — TEST webhook provider evidence (2026-11-25)

**Physical provider-read result, Stripe sandbox acct_1ULRIG7ND12rd1wI, livemode false.** Using the existing connected read-only Stripe API, list webhook endpoints returned exactly two and `has_more:false`:

- **Dedicated FIRE TEST endpoint ENABLED** at `https://fire-stripe-test-20261101.kyle-bfc.workers.dev/api/payments/webhook`; six and only six configured events: `checkout.session.completed`, `checkout.session.async_payment_failed`, `checkout.session.async_payment_succeeded`, `refund.created`, `refund.updated`, `refund.failed`; `livemode:false`.
- **Legacy Sites TEST endpoint DISABLED** at `https://fire-app.kylebrooks8605.chatgpt.site/api/payments/webhook`; `livemode:false`. It was not modified.

**Cloudflare Access:** owner Acer's already accepted read-only result [Issue #19 #7167548786](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-7167548786) is `READ_ONLY: EXACT_EIGHT` / `TEST ACCESS INVENTORY COMPLETE - NO CHANGES`. Reviewed active PR282 source `owner_gate9_access_readonly_preflight.ps1`: the successful branch verifies pinned TEST Access app/Worker ID, exactly one reusable Allow policy with an email selector, seven exact former public overrides plus exact `/api/payments/webhook`, zero duplicates/additions and GET-only operation. This is more than a raw count, but not a real signed POST, all alternate ingress, or owner/nonowner host denial.

**Newly completed supplemental G9-05 prerequisite:** exact provider TEST webhook exists/enabled; six intended events and unchanged disabled legacy endpoint established, with existing scoped Access readback. **No original numbered checklist item newly closed:** G9-04 was already accepted; G9-05 still needs test-key/secret scope, target-bound D1 readiness, separately authorized inactive activation and genuine signed Stripe TEST payments/refunds/ledger evidence. Current local candidate remains Stripe disabled/activation blocked.

No provider writes, upload, Access mutation, Stripe payment, R2 subscription, Git merge or deploy. Preparation-only owner consent remains in effect. Original tally **52/95**, whole gates **4/10** G1/G2/G3/G8; NEW LIVE DARK/NO-GO, first job #0001 unused.
