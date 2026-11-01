# FIRE independent Cloudflare launch — SOURCE ONLY / NOT DEPLOYABLE

Owner approvals are scoped and additive:

- Original launch scope: source-only templates and authentication groundwork; **no existing LIVE, QA, staging, DR, Stripe or DNS changes**.
- Later November 1 approval: create **new, empty, isolated test-only** Cloudflare D1 and Worker identities; confirmed D1 `fire-stripe-test-db-20261101` UUID `dba421ba-fc66-4cf8-9c31-51616f8249ba` was created and confirmed to contain **0 application tables** by the owner via authenticated Wrangler.
- Latest explicit owner approval: protect a new dedicated test Worker with **owner-only Cloudflare Access**, then deploy a **minimal deny-all stub Worker** with `DB` bound only to that verified new empty D1. This approval does **not** authorize deploying the FIRE Business App, enabling any public/preview route before Access protection, adding Stripe keys/webhooks, migrations, tests/charges/refunds, DNS updates, production cutover, or modifying any existing Worker/D1.
- The `stripe-test-worker/` folder is the isolated, fail-closed first-deployment stub. It returns 403 for all paths, never accesses D1, has `workers_dev=false`, `preview_urls=false`, `routes=[]`, and contains no secrets or Stripe code. **Deploying it while no public route exists is permitted under the latest approval; do not enable `workers.dev` until owner-only Access is verified.** Access must be restricted to the exact owner identity rather than all email addresses in an organizational domain.
- This new test Worker is **not** production/staging FIRE App and does **not** satisfy Gate 9 by itself. Its deployment identity and exact D1 binding must be verified after publication, with separate subsequent authorizations for schema initialization, payment tests, and Stripe endpoints.



## Why this route

The current isolated QA Worker successfully published the approved app at `711c57df022244165e208defda2421c231b9e2c1`. Legacy ChatGPT Sites LIVE and refund staging remain separate, older hosted apps whose **physical D1 IDs are not exposed**. A human support escalation is pending. The existing Sites LIVE table list is missing `payment_refunds`. Do not replay any migration, delete/overwrite a Sites project, infer an empty database, or silently transfer an old session.

Cloudflare [D1 named environments](https://developers.cloudflare.com/d1/configuration/environments/) allow distinct `database_id` values. Workers [named environments](https://developers.cloudflare.com/workers/wrangler/environments/) create distinct Workers; bindings, secrets and variables are **not inherited**. The blueprint is intentionally unusable until authenticated identities and Access policies exist.

## What this branch actually adds

- `cloudflare-launch/access-jwt.mjs`: cryptographically verifies Cloudflare Access **RS256 signature** using the exact configured team certificate endpoint; checks issuer, per-app AUD, expiry, not-before, issue time, and owner email. Rejects missing, malformed, expired, wrong-audience and unsigned tokens. No weaker PIN or email-header fallback.
- `cloudflare-launch/app-auth.ts`: proposed Cloudflare-only replacement for managed Sites sign-in. Requires a verified Access JWT on every request and refuses synthetic QA flags. Future materialization replaces the `app/chatgpt-auth.ts` adapter, not the protected existing Sites/QA source.
- `cloudflare-launch/materialize-cloudflare.py`: creates a separate **local, source-only** staging or production candidate from the same shared features and LIVE adapter; staging is visibly labeled. It refuses an existing or in-repository destination. The inherited Vite config still binds a LOCAL PLACEHOLDER DB, not a valid production D1. **Do not deploy its built output.**
- `cloudflare-launch/wrangler.NONDEPLOYABLE.example.json`: two environment templates with invalid D1 IDs, invalid origins, no routes, no Stripe, no actual secrets, and no R2.
- `cloudflare-launch/validate-launch-config.mjs`: offline identity/isolation preflight; rejects known QA/DR UUIDs, shared D1 UUIDs, old Sites origins, unsafe routes, weak auth, unapproved Stripe mode, and unexpected bindings. A pass only means a **proposed mapping** is syntactically consistent; does NOT attest provider resources or authorize deployment.
- Synthetic key-signature and resource-mapping tests; no secret data used.

## Launch blocker — customer links must remain usable without owner login

The existing owner Message Composer generates `/estimate/{shareToken}` and `/invoice/{shareToken}` on the same `SITE_ORIGIN`. Customer pages also link to `/pay/{id}`; signature and change request buttons POST to three specific `/api/public/estimates/{token}/...` endpoints. Card Checkout calls only `POST /api/payments/checkout`, which validates the share token. **Protecting the entire hostname behind owner-only Access would break those links for customers.** This is a prelaunch P1 blocker, not a request for a new feature or a separate customer app.

- `public-access-contract.mjs` is a source-only proposed set of **11 precise Cloudflare Access public-path overrides**, including the customer-facing routes and essential portal assets. `public-access.test.mjs` checks actual existing UI/API source paths and proves known private routes stay outside the *proposed* offline exceptions. Broad Access bypass patterns fail tests.
- The public policy **does not** authenticate an owner. All owner/private routes still require signed owner identity at both Cloudflare Access and their app authorization boundary. Public links rely on opaque bearer tokens and their server-side workflow guards; do not use an owner session to validate them.
- **No public-path overrides have been installed, accepted or verified in Cloudflare.** Actual Access wildcard semantics, static asset requests, public POST reachability, same-origin link generation, independent staging/production isolation, token misuse/invalid links, payment return URLs, and non-owner denial must be checked on the authenticated staging target *before* deployment acceptance. Failing or unknown tests mean STOP.
- The Stripe TEST webhook endpoint is **not** one of these public customer exceptions. Its signed delivery policy remains a separate Gate 9 decision and must not be enabled through a broad `/api/*` bypass.
- Do not apply these exceptions to the old Sites LIVE, QA Worker, or Doomsday. No owner data, Access policy, route, DNS or D1 was changed by this source review.

## Stripe TEST hosted milestone — protected Worker, isolated D1, and deployment blockers

Owner-backed provider evidence (November 1, 2026): dedicated `fire-stripe-test-20261101` deny-all HTTP 403 Worker with `DB` mapped to new `fire-stripe-test-db-20261101` (UUID `dba421ba-fc66-4cf8-9c31-51616f8249ba`); new D1 shows **zero app tables**. Zero Trust Free is configured. The Worker has **All traffic** Cloudflare Access, sole allow policy for the verified business owner email, production `workers.dev` URL enabled and preview disabled. An anonymous InPrivate request was redirected to Cloudflare Access, and an owner-authenticated request reached the intentionally disabled stub. No app code, migrations, or Stripe integration has been published on the new Worker.

**Source fixes before replacing this stub:**

1. `materialize-stripe-test.py` builds a fresh **source-only / nondeployable** FIRE staging-mode candidate. It substitutes validated Cloudflare Access JWT login and rewrites inherited old Sites personal-email authorization checks **only in the generated Stripe TEST copy** to the exact verified Access policy email. Shared, Sites LIVE, Doomsday, QA and current staging files are never changed.
2. The generated test app is marked `LOCAL_CUSTOMER_DEPLOYMENT='staging'`, so the existing payment/refund server code rejects Stripe LIVE keys and LIVE event/session IDs. Its Vite config **still uses the fake D1 UUID**; no artifact may be uploaded without a new manifest and explicit owner approval.
3. `stripe-test-worker/rehearse-new-db-migrations.py` runs all 25 canonical migrations in a fresh, offline in-memory SQLite DB. It must pass integrity, refund/deposit table, index and zero-record checks. This is **not a remote D1 journal or rollback receipt**.
4. **Remote TEST initialization remains unapproved**. Before a one-time 0000–0024 schema apply, fail closed unless the exact remote D1 is `fire-stripe-test-db-20261101` with UUID `dba421ba-fc66-4cf8-9c31-51616f8249ba`, has zero non-provider tables, and existing QA/staging/Doosday/LIVE identities are never referenced. Take a test-state recovery checkpoint and verify the remote journal after. A schema operation here must never run against `fire-app-staging-db` or its previously protected Doomsday UUID.
5. **Webhook delivery remains blocked:** all-traffic owner Access will reject automated Stripe POSTs by design. Do not turn off Worker Access. A future owner-reviewed, exact-path `/api/payments/webhook` public Access exception (no broad `/api/*` or payment admin bypass) may be used *only after* the installed app independently validates raw-body Stripe HMAC-SHA256 signatures, timestamp, test-mode envelope/object and idempotent D1 ledger. Confirm actual Cloudflare matching and unauthenticated negative cases before connecting Stripe TEST. Refunds/checkouts are not authorized yet.
6. Stripe sandbox has a separate old Sites webhook; **never alter, replay or delete it** as part of these TEST preparations. Require a distinct new Stripe TEST endpoint and secret, and exact-cent checkout/partial-refund/idempotency/failed-retry checks under a later explicit authorization.

**This is a Gate 9 staging-path milestone, not Gate 9 acceptance.** User's final LIVE app remains entirely separate.

## Critical open launch decisions — must be verified, not assumed

1. Obtain actual owned **Cloudflare account**, two distinct fresh D1 UUIDs, new separately named Workers, and owner-controlled HTTPS custom domains. **Cloudflare Access must protect all owner screens and owner/private APIs**, while explicit token-bearing customer estimate/invoice/payment URLs, their required public API operations, and static assets must be reachable without owner login under a narrowly scoped, verified public-path policy. Do not bypass Access on `/`, `/api/*`, or all of `/api/public/*`. See the customer-access review contract below. Check authenticated binding and domain routing *before* any deploy. The source-level verifier is defense-in-depth, not a substitute for Access configuration.
2. Set up two distinct Access **applications and AUD tags**, owner-only identity policy, appropriate session duration, revocation and device testing. Use an identity provider supporting passkeys/Face ID if eligible. The adapter does **not** implement native biometrics or a guaranteed 30-day session. Those depend on Access/IdP policies and verified physical iPhone behavior.
3. When considering a new empty production D1, determine whether **any** real customers, estimates, invoices, payments, photos or messages need safe migration from old Sites LIVE; don't rely on a previous “no LIVE jobs” assertion. Do not cut over before record disposition, backup and recovery are independently accepted.
4. Review all 23+ production migration files and their dependencies against a fresh provider-attested target. Use a separately approved first initialization with exact SHA, journal and restore receipt—**not** the old Sites migration/replay script. Review permanent numbering/backfill gates separately.
5. Staging: confirm distinct synthetic-only auth/session, fresh D1 schema and private backup, then request **separate explicit approval** to create its own Stripe TEST webhook for five Checkout/refund events. The existing legacy Sites TEST webhook remains unchanged. Stage test refunds, cents reconciliation and idempotency before considering production Stripe.
6. Photos: current QA accepted local-on-device behavior. Staging/production photo preservation, backups and restore are a separate acceptance requirement. The launch template intentionally binds no R2 bucket; do not claim cloud photo support.
7. Build/hosted full app: the current `vite.config.ts` has a **deliberately fake local D1 ID**. An owner-reviewed packaging step must generate an entirely separate provider-verified production/staging manifest, then run a fresh fail-closed manifest review. Do not rename this template `wrangler.json` and deploy it.
8. Preserve the Sites LIVE, Sites refund-staging, QA and Doomsday targets. A new production hostname/cutover, migrations, secrets, Access policy creation, Stripe changes, real customers and DNS all require **distinct owner approval** after the relevant preflight.

## Closeout criteria

Do not elevate the overall release 3/10 gate count from this **source-only** work. The user wants launch-first prioritization, so do not repeat accepted QA synthetic/customer save and database backup checks. Only test previously unverified **new hosting/auth/payment** integration and ensure the final production lifecycle (customer → estimate → approval/deposit → invoice → schedule → payment/history) works before canceling QuoteIQ.

### Source-only, isolated development examples

```sh
node --test business-app-parity/cloudflare-launch/launch-source.test.mjs
python3 business-app-parity/cloudflare-launch/materialize-cloudflare.py staging /tmp/FIRE-CLOUD-STAGING-NEW
python3 business-app-parity/cloudflare-launch/materialize-cloudflare.py production /tmp/FIRE-CLOUD-PROD-NEW
```

The example paths must not already exist. These produce only local files, never create hosted resources.
