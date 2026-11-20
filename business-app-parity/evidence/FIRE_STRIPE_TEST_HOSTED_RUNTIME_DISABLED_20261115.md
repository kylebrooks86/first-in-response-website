# FIRE Gate 9 — real owner Cloudflare TEST Worker production runtime remains disabled (Nov 15, 2026)

**Source/custody:** Two owner-provided authenticated Cloudflare Workers & Pages dashboard screenshots of the existing `fire-stripe-test-20261101` Worker > **Settings > Runtime variables and secrets > Production**. Original screenshots remain in the conversation, not in GitHub. Uploaded image metadata, computed from exact bytes:
- `IMG_4351.png` 353,955 bytes SHA-256 `a328af2dee5b5409ec2eb9224325cbdd2c3786445ec1fc033290def70fe13ca0`;
- `IMG_4352.png` 331,183 bytes SHA-256 `3c40b0fb77812c68d9a1a861a4e8cbc6027361349e96179a9c29f27a77d7ab90`.

**New provider-hosted runtime observation:** In the TEST Worker's currently displayed **Production** settings:
- nonsecret `FIRE_STRIPE_MODE` **`disabled`**, NOT `test`;
- nonsecret `FIRE_ENV` **`cloudflare-staging`**;
- nonsecret `FIRE_ACCESS_REQUIRED` **`enabled`**;
- `SITE_ORIGIN` variable present, with an HTTPS URL beginning `https://fire-stripe-test-20261101.kyle-bfc.w...`; full exact URL **visually truncated**, so do not infer exact trailing host or path;
- `STRIPE_WEBHOOK_SECRET` configured as **Secret — Value encrypted** (name/existence only, do not claim value correctness or Stripe signing-secret pairing);
- `FIRE_ACCESS_AUD`, `FIRE_ACCESS_OWNER_E...`, `FIRE_ACCESS_TEAM_DO...` listed as **encrypted secrets** (only name fragments shown, no values/validity asserted).
- The second screenshot begins a **Bindings** section but does **not display a D1 binding value/UUID**. Preserve the earlier, separately accepted physically verified independent TEST D1 UUID `dba421ba-fc66-4cf8-9c31-51616f8249ba` as historical; do not claim it was reverified by these settings screenshots.

**Source check:** DRAFT PR270 `business-app-parity/shared/app/api/payments/webhook/route.ts` accepts Stripe events only with correct HMAC signature and live/test mode controls; for sandbox `FIRE_ENV=cloudflare-staging` it explicitly returns HTTP **503 on an HMAC-valid signed TEST webhook until `FIRE_STRIPE_MODE=test`**. This is a purposefully fail-closed existing gate, not a reason to turn it on immediately. **Hosted Worker code byte equivalence** to PR270 is not established by the runtime screen; avoid claiming a specific hosted HTTP outcome as a certainty. The code's signature and origin validations remain source-only absent exact hosted proof.

**Separate already accepted evidence:** owner Stripe Sandbox dedicated endpoint is **Active** but destination **Event deliveries: No event deliveries found** (see `FIRE_STRIPE_TEST_DELIVERIES_EMPTY_20261115.md`). Owner read-only Acer anonymous GET to webhook is 405, while `/api/customers` 302 Location leads to Cloudflare Access login; these are NOT a signed POST proof or saved effective Access path override enumeration. Owner previously revoked temporary potentially exposed read-only API token; do not request or repeat its use. DR and NEW LIVE remain DARK.

**Decision:** No Stripe signed TEST delivery/reconciliation should be started at present. First decide on safe, specific authorization to inspect immutable active TEST Worker version/source runtime and confirm exact-path webhook exception without touching the private customer API, then separately authorize tightly bounded TEST-only activation, bona fide signed Stripe sandbox event and isolated D1 refund/checkout exact-cent audit. A payment/refund, Cloudflare variable change, Access bypass, webhook POST, worker deployment, SQL migration, or merge is **NOT** authorized by this screenshot.

**Formal release:** G1/G2/G3/G8 accepted (4/10); G4/G5/G6/G7/G9/G10 OPEN, NEW LIVE DARK NO-GO. No paid Cloudflare/R2. This file is source documentation only; no provider mutation.
