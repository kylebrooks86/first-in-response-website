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

## Owner-verified Cloudflare QA D1 creation — October 16

**Observed in an Acer Wrangler CLI screenshot:**
`wrangler.cmd d1 create fire-fullapp-qa-db-20261016` returned
`Successfully created DB 'fire-fullapp-qa-db-20261016' in region WNAM`
with **new UUID `8ccfb1f8-1657-4074-b1b2-47de78f95003`**.

The existing independently listed database `fire-app-staging-db`
remains UUID `afb2c05a-d794-4a9a-b580-924ce01c26ad`.
The identities are distinct; **the new D1 was created and is not a LIVE/staging rename**. Schema state not independently checked; do not assume migrations were applied. Only the QA D1 creation is authorized and observed; no Worker, R2, Stripe resource, GitHub deployment, data migration or paid service activation has occurred.

The exact QA adapter now overrides the otherwise placeholder local Vite/Cloudflare config: it pins Worker `fire-fullapp-qa-20261016`, uses the **sole** `DB` binding to the **new** UUID, has **no R2 bucket**, no Stripe keys and no LIVE/domain routes. `SITE_ORIGIN` remains EMPTY unless an exact owner-subdomain QA URL is independently confirmed at build time; this deliberately fails authentication closed. CI builds and checks the resolved Worker manifest with `check_qa_runtime_config.mjs`. That CI must pass before review package is considered updated; this is not deployment consent.

**Next owner action:**
```powershell
wrangler.cmd d1 info fire-fullapp-qa-db-20261016 --json
```

This is an official Cloudflare **read-only** info command, not a schema mutation. Confirm it identifies the new D1 and shows empty/new status. After observing that, obtain precise existing `workers.dev` account subdomain (without sharing secrets) and validate the QA-only runtime configuration, before applying any synthetic-only schema to the isolated new DB. No full app release gate passes from D1 provisioning alone.


## Owner-read-only D1 verification (October 17 UTC)

After successful creation, owner ran `wrangler.cmd d1 info fire-fullapp-qa-db-20261016 --json` in already authenticated PowerShell and photographed output. This is **real Cloudflare read-only evidence**, not a simulated result:
- Returned UUID `8ccfb1f8-1657-4074-b1b2-47de78f95003` with exact new QA name.
- Region WNAM; **num_tables: 0**, `database_size: 12288`, `read_queries_24h: 0`, `write_queries_24h: 0`, `rows_read_24h: 0`, `rows_written_24h: 0`.
- Read replication disabled. These statistics support a new empty D1 at observation time, not a verified persistent hosted schema.
- No migration, schema, Worker app, R2 bucket or auth secret configured by this read-only check.
- Distinct from preexisting `fire-app-staging-db` UUID `afb2c05a-d794-4a9a-b580-924ce01c26ad`. **Never execute any migration on staging or the old independent Doomsday D1**.

The pinned QA Worker build config and its built-manifest guard passed all seven CI jobs at commit `654cd34b468b698c10183fa29b35f95e73096214`:
https://github.com/kylebrooks86/first-in-response-website/actions/runs/38997288618
That CI validates only the built artifact; **it does not apply migrations or prove any deployed origin**.

**Next owner-facing task** is discover the owner's exact Cloudflare `workers.dev` account subdomain from the Cloudflare Workers & Pages dashboard (no keys, no passwords), then generate and validate the exact QA URL. Until then `SITE_ORIGIN` stays unset and QA authentication remains fail-closed. Separately prepare and rehearse all 23 migrations with an exact new-DB guard before any authorized remote schema initialization; do not ask owner to run generic `wrangler d1 migrations apply` against an unverified configuration. Official gates remain 3/10.


## Verified Cloudflare Workers subdomain and exact planned QA URL — October 17

Owner provided Cloudflare Workers & Pages dashboard screenshot displaying existing
`fire-app-independent-staging.kyle-bfc.workers.dev`, confirming this account's
public Worker subdomain is `kyle-bfc.workers.dev`. The separate candidate's
**planned but NOT DEPLOYED** origin is:

`https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev`

The QA Vite Worker config now pins that exact canonical HTTPS address at build
time; the QA authentication origin guard and built Worker manifest verifier now
require this precise value, rejecting attacker-owned or unrelated Cloudflare
subdomains. A separate test confirms wrong-account origins fail closed.

**State:** The owner-verified new QA D1 remains the only approved D1 binding;
there is still **no QA Worker deployed**, no password hash/session secret
provisioned, no R2 signup, no billed resource activation, no remote migration,
and no change to existing Workers, DNS, LIVE staging, Stripe, iPhone/iPad vaults
or completed Acer offline recovery evidence. QA app sign-in must not be enabled
or deployed until the owner-only credentials and first-run D1 schema are
independently prepared and approved. New full-app build CI must pass before
the newly origin-pinned artifact is used.

**Next prerequisite before a QA publish:** Verify exact QA Worker name is not
already occupied in the account, prepare an owner-held QA passphrase and
server-side session secret without exposing them in ChatGPT or GitHub, and
rehearse the isolated-new-D1 schema setup with a pinned UUID and no
staging/Doomsday remote side effects. No deploy or migrations from documentation
alone. Official gates remain **3/10 (30%)**.


## Cloudflare QA Worker noncollision and private credentials — owner report

Owner searched existing Cloudflare Workers & Pages applications for exact
`fire-fullapp-qa-20261016` and reported **"no project found."** This is
owner-observed UI evidence of no visible existing project under that name,
not an API-level Worker script namespace uniqueness proof. No new Worker
was created, deployed or purchased.

The independent QA credential preparation helper is now
`owner_windows_prepare_qa_credentials.ps1`, with security regression
`test_owner_windows_prepare_qa_credentials.py`. **Dry-run by default**;
`-Prepare` is optional and deliberately local Windows-only. It prompts
privately for a NEW owner-chosen passphrase of 24–128 characters (never
reuses the LIVE/DR PIN), calculates its SHA-256 verifier, and uses CSPRNG
to generate an independent 48-byte session secret. Only an owner-Windows
DPAPI-encrypted SecureString and corresponding QA metadata are written
under `%LOCALAPPDATA%\\FIRE-QA-Private\\qa-owner-secrets.xml`, with
nonoverwrite protection. No credential is uploaded, displayed to
ChatGPT, or deployed by this preparation helper. Full Windows execution
has not been owner-observed or authenticated yet.

**Next strictly non-destructive owner step:** Confirm whether the GitHub
checkout exists on Acer:
`Test-Path "$HOME\\first-in-response-website"`.
Use this to choose either a safe `git pull --ff-only` in an existing
checkout or a separately reviewed download/install workflow. Never
ask for the passphrase, session secret, private XML, or its hash in chat.

Hosted D1 remains empty and unmigrated as last observed. First remote
schema initialization, QA secret provisioning, full Worker publish and
iPhone/iPad acceptance are all independently pending. Official gates
remain 3/10 (30%).
