# Nov 19, 2026 — authenticated STAGING Worker production secret-name and D1-binding evidence; NEW SOURCE/HOSTED MISMATCH

**Physical target:** Cloudflare Workers & Pages `fire-app-independent-staging` (breadcrumb truncated in image but established by owner navigation) → **Production** → **Settings**. Two new owner-authenticated original portrait screenshots `IMG_4495.png` and `IMG_4496.png`, captured November 19, ~8:58 PM CST, show the production runtime variables/secrets and production bindings for this same Worker.

**Private originals not published:** exact original uploaded bytes verified on this conversation container:
- `IMG_4495.png` (Production Runtime variables and secrets): SHA-256 `a46bc671ef5bfa25d062ba34df01469b89c1cef09a38c7c062063216bf19be11`.
- `IMG_4496.png` (Production D1 binding): SHA-256 `a8089bb31292a60b350888469d8bdfd12d8040b5bf9ab72ce974b9eec26a31d5`.

## Actual authenticated provider UI readback

The **Runtime variables and secrets → Production** table visibly includes two rows, both Type **Secret** and Value **Value encrypted**:
1. `FIRE_SESSION_SECRET`
2. `STRIPE_SECRET_KEY`

No plaintext variable rows are visible in the captured Production list; do not infer the entire serving compiled Worker's runtime config/version byte equality from the dashboard alone. Neither secret value is exposed or known. The presence of a secret name **does not prove its value, TEST/LIVE Stripe key mode, whether code reads it, an active Stripe integration, actual payment delivery or successful authentication**.

The **Bindings → Production** table visibly has one D1 database binding: name **`DB`**, value **`fire-app-staging-db`**. This directly corroborates the previously separately accepted account-authenticated Worker-to-physical-D1 mapping and the real STAGING console query evidence (existing D1 UUID `afb2c05a-d794-4a9a-b580-924ce01c26ad`). The visible Bindings section shows **no R2 bucket** or other binding, supporting absence of an *advertised dashboard R2 binding*, not paid feature enrollment or all possible source code/storage paths.

## NEW Gate 4 source/hosted discrepancy requiring resolution (NO changes authorized)

The reviewed **unmerged current candidate source** `business-app-parity/check_independent_staging_runtime_config.mjs` explicitly requires **`FIRE_ADMIN_PASSWORD_HASH` plus `FIRE_SESSION_SECRET`** in `cfg.secrets.required`, and refuses additional/unapproved Stripe configuration. Its source manifest expects `FIRE_ENV=staging`, a bounded `SITE_ORIGIN`, exact STAGING D1 UUID and no R2. The **new authenticated hosted dashboard screenshot instead shows two secret rows: `FIRE_SESSION_SECRET` and `STRIPE_SECRET_KEY`, and no visible `FIRE_ADMIN_PASSWORD_HASH`**. The UI does not show the expected plain variable rows either.

**Evidence supports a configuration divergence between source requirements and displayed hosted STAGING settings**, but is NOT enough to conclude a security incident, an actual LIVE Stripe key, a deployed source hash, a disabled login, an exposed public route, or usage of the Stripe secret. Older STAGING Worker version may not be the unmerged new QA-master candidate. Do not try to patch or rotate secrets, toggle Access, remove payments, enable/deploy Worker, or touch D1 without a separately exact-scoped owner-approved release plan. First compare actual immutable serving version/manifest and approved target design against this physical screenshot; preserve old accepted v138/100% and binding evidence unless a genuinely changed version requires new readback.

**Formal G4-03 already accepted** (D1 binding strengthened, not newly closed). **G4-04 remains OPEN** (origin, secret names/scopes, Stripe TEST/LIVE isolation, actual photo mode/zero R2, across all targets); **G4-07 remains OPEN** (new STAGING QA-master release not deployed). This is actionable physical provider evidence and an actual new discrepancy, not another release checkoff. Official **50/95 accepted, 45 OPEN, 4/10 accepted gates G1/G2/G3/G8**, NEW LIVE dark and first Job #0001 unissued. Source remains DRAFT/unmerged/undeployed.

**No provider configuration mutation, D1 SQL, Worker publication, Stripe/payment activity, R2 activation/subscription, Access route, Git merge or LIVE release was performed. Original screenshots remain private. Do not ask the owner for the same two settings screenshots again.**
