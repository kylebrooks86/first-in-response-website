# FIRE full-app QA candidate built — owner handoff (October 16, 2026)

**Official release readiness stays 3/10 (30%).** A fourth synthetic-only QA app has been compiled but **not published**. QA is separate from the existing LIVE, Doomsday and refund-staging source/build targets. The user's successfully completed Acer/Edge encrypted synthetic recovery, original iPhone Revision 3 vault, iPad Revision 1 vault, backups and installed apps remain unchanged.

## Exact passing application build

Branch: `work/fire-business-app-parity-2026-10-08`

Source/build commit: `fa81373119fc794a40a75cb39d12117aff210ab8`.

**7/7 independent GitHub Actions jobs passed**:
https://github.com/kylebrooks86/first-in-response-website/actions/runs/38995412983

The new QA-only job passed exact source verification, frozen dependency installation, TypeScript, all 23 target-specific disposable migrations, complete D1 preflight, independent QA authentication negative controls, mock Stripe checkout/refund/webhook safety tests, the full vinext application build, SHA256 read-back of every sealed archive member and upload of `fire-full-app-review-qa-fa81373119fc794a40a75cb39d12117aff210ab8`. That archive is **source/build review evidence, not a working install URL**. GitHub retains it for seven days. The three original candidate builds also passed, with no deployment.

## Safety implementation

- `materialize.py qa` assembles the unchanged shared Business App plus the reviewed independent Doomsday **source** overlay and then a separate QA adapter, without selecting the old Doomsday deployed Worker or D1 resource. The exact assembled file bytes and migration count are verified by `verify_materialized_candidate.py qa`. This inheritance is source-only; it does **not** grant permission to bind Doomsday infrastructure.
- The QA adapter has a fixed `qa` owner/vault identity; visible synthetic-only banner and application name; a **separate** 12-hour `fire_qa_session` cookie; `FIRE_QA_SESSION_SECRET` (>=32 characters) and `FIRE_QA_PASSWORD_HASH` (SHA256 of an owner-held random 24–128-character QA-only passphrase). No old 4-digit PIN, signing secret, stored customer data or ChatGPT gateway trust is copied.
- QA owner authentication fails closed unless `FIRE_QA_SYNTHETIC_ONLY=enabled`, `FIRE_ENV=synthetic-qa`, and `SITE_ORIGIN` is the exact HTTPS `fire-fullapp-qa-20261016.<owner-subdomain>.workers.dev` origin without an extra port. Runtime sign-in protection uses the same source-based D1 attempt limiter but must connect **only to a newly created isolated QA D1**. Neither test passphrase nor secret has been created or entered in GitHub.
- All QA Stripe checkout, refund, webhook, owner checkout reconciliation and connection-probe routes now immediately respond HTTP 503 before network or D1 access. A synthetic QA account cannot accidentally move money or modify the existing sandbox webhook even if a Stripe key appears in the QA environment. Existing three application targets retain their normal guarded payment behavior.
- QA build is not yet a confirmed offline PWA in real iOS Safari, not a hosted preview, not R2/photo recovery proof and not Gate 8, 9 or 6 acceptance. An independent QA login is built and unit-tested but not yet exercised on a hosted iPhone/iPad.

## Current Cloudflare state — owner verified; not changed by this batch

- Workers Free active; no payment method on account; **four** existing applications.
- Wrangler signed in on Acer and `wrangler d1 list --json` succeeded. Exactly **one** D1, `fire-app-staging-db`, exists. It is NOT the QA destination. The owner reported **1,927 of 3,000** remaining build minutes at the start of this task; no current remaining-minute count claimed.
- R2 is on its signup screen. **Do not activate R2, add billing, create photo buckets, purchase anything or assume R2 is available.**
- **Zero** new Cloudflare QA resources and **zero** remote schema migrations, production modifications, payment actions or deployments were performed.

## Next owner-assisted release step

1. On the already authenticated Acer, verify the same Cloudflare account and no QA-name collision, then create only a newly named **separate** D1 database `fire-fullapp-qa-db-20261016`, provided Workers Free/no-charge rules still hold and the account permits it. Record its **new UUID privately**, never use/rebind the existing `fire-app-staging-db`.
2. Prepare a **new**, exact Worker configuration for `fire-fullapp-qa-20261016` binding only that new UUID. R2 binding, Stripe keys and LIVE routes must be omitted. All old deployment scripts are barred. Validate resulting build config and owner passphrase setup without publishing before first remote deploy.
3. After owner sees the verified QA resource identity and approved configuration, publish a single isolated owner-authenticated QA version; test sign-in, fail-closed missing-config cases, data isolation, app screens, the actual iPhone/iPad install and offline behavior. Never replace existing Home Screen apps or clear vaults.

At this point the user has conditionally approved a new isolated $0 QA environment, but the assistant has **not** authenticated to the owner's Cloudflare account and cannot claim the resource exists. Confirm new account resource identities first; a review ZIP alone is not a runtime or a release gate.
