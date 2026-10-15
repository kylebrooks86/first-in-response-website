# FIRE independent Doomsday — October 15 owner-hosted evidence checkpoint

**Official release readiness: 3/10 (30%). Gate 4, Gate 5 and Gate 7 remain OPEN.**
This is an owner-supplied Cloudflare dashboard screenshot/log reconciliation,
not an authenticated Cloudflare API query, migration authorization or deployment.

## Owner's Cloudflare observations (captured Oct 15, 2026)

| Question | Owner screenshot / log observation | Limitation |
|---|---|---|
| Independent Worker | `fire-app-independent-staging`, **Production** → **Settings** → **Bindings** | Does not independently authenticate active deployed source/artifact |
| Current DB binding | One visible D1 binding `DB` → `fire-app-staging-db` | Name/binding agrees with historically recorded database UUID; full UUID not displayed in the latest binding screenshot |
| Historical full D1 UUID | `afb2c05a-d794-4a9a-b580-924ce01c26ad`; latest D1 list shows matching visible prefix | No comparison to physical LIVE/refund-staging databases; Gate 4 not passed |
| Application tables | D1 Studio lists the 19 expected application table names including `payment_refunds` | SQL definitions, column types, partial index predicates and foreign keys still need read-only capture |
| Migration journal | `d1_migrations` reports **22 rows**, first `0000_wise_namora.sql`, final `0021_manual_processing_fees.sql` dated Oct 7 | Owner screenshots cover journal range and last row; not a captured machine-readable exact definition/manifest |
| Pending candidate migration | Coordinated Doomsday candidate expects **`0022_stripe_provider_uniqueness.sql`**, absent from the observed journal | Do not assume its proposed index is absent without independently reading metadata |
| Application indexes | Index `idx_payments_stripe_provider_unique` not yet captured in the latest screenshots | Requires safe owner read-only query before preparing reviewed migration approval |
| R2 | Production Bindings screenshot displays D1 only; R2 navigation shows **Get started with R2** | No R2 binding currently shown. An account-level start screen is not a definitive provider inventory or authorization for paid storage |
| Build failure | Legacy v138 preparation/build **completed**, TypeScript reported `FAIL_NONBLOCKING`; auto deploy attempted `npx wrangler preview` and failed for missing `previews` block | Later settings screenshot displayed `bash scripts/deploy-fire-dr-staging.sh`. The screenshots do not establish why the executed command differed from current settings. **Do not retry, save, or switch commands.** |

The older v138 build intentionally checked out commit
`a1cdb94be76b0ded16b213b84616e741651e140d`, **not** the current
development branch. Passing the old build is not deployed candidate parity.
The governed deploy wrapper could apply remote migrations and deploy a Worker;
it remains **out of scope** without separate owner approval.

## Next narrowly scoped screenshot: one read-only SQL result

Cloudflare **D1 → fire-app-staging-db → Studio → Query**. Paste and run only
the single `SELECT` in `DOOMSDAY_0022_OWNER_CONSOLE_READ_ONLY.sql`.
It returns **one aggregate row** with these columns:

- `migration_0022_rows`: 0 expected based on captured migration journal
- `index_0022_rows`: currently **unknown** (do not infer from journal)
- `duplicate_provider_groups`: currently **unknown** in this screenshot set

Take one screenshot displaying the entire query result and database breadcrumb.
A result of `0,0,0` would mean **preflight remains reviewable**, *not* that
it is safe or authorized to apply 0022. A failed query, nonzero duplicate
count, mismatched journal/index status, or unrecognized database is **STOP**.
Never screenshot provider IDs, customer/payment rows, tokens or secrets.

Even if that query passes, Gate 5 still requires complete read-only application
schema/index/column/foreign-key metadata, reconciliation with the candidate's
migration manifest, additional refund integrity checks, immutable deployed
artifact identity and provider-authenticated mapping. Gate 4 also requires
physical isolation of all three targets. Gate 7 remains blocked by no hosted
R2 binding/recovery acceptance. Mobile/iPad, sandbox Stripe and hosted rollback
are independently pending.

## Strict execution boundary

No remote migration, table modification, Stripe payment, R2 activation, build
retry, deployment or change to real customer data was requested or performed
to create this checkpoint. Source work stays on
`work/fire-business-app-parity-2026-10-08`; evidence collection does not
raise official readiness until the release gates independently satisfy their
acceptance rules.
