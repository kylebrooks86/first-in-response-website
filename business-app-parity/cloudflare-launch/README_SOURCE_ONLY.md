# FIRE independent Cloudflare launch — SOURCE ONLY / NOT DEPLOYABLE

Owner-approved scope (November 1, 2026): **prepare GitHub source, staging/production configuration templates, and secure authentication groundwork only**. No new Cloudflare Workers, D1/R2, Access apps, routes, domains, secrets, Stripe webhooks, migrations, exports, deploys or charges are authorized.

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

## Critical open launch decisions — must be verified, not assumed

1. Obtain actual owned **Cloudflare account**, two distinct fresh D1 UUIDs, new separately named Workers, and owner-controlled HTTPS custom domains. **Cloudflare Access must protect all paths and assets on each hostname**. Check authenticated binding and domain routing *before* any deploy. The source-level verifier is defense-in-depth, not a substitute for Access configuration.
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
