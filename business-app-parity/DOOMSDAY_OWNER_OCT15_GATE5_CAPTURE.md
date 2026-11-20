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
| Pending 0022 index | **Owner's read-only D1 Studio SQL returned `index_0022_rows=0`** | Confirms absence of the *named* index at the time queried; exact other index/constraint definitions not yet captured |
| R2 | Production Bindings screenshot displays D1 only; R2 navigation shows **Get started with R2** | No R2 binding currently shown. An account-level start screen is not a definitive provider inventory or authorization for paid storage |
| Build failure | Legacy v138 preparation/build **completed**, TypeScript reported `FAIL_NONBLOCKING`; auto deploy attempted `npx wrangler preview` and failed for missing `previews` block | Later settings screenshot displayed `bash scripts/deploy-fire-dr-staging.sh`. The screenshots do not establish why the executed command differed from current settings. **Do not retry, save, or switch commands.** |

The older v138 build intentionally checked out commit
`a1cdb94be76b0ded16b213b84616e741651e140d`, **not** the current
development branch. Passing the old build is not deployed candidate parity.
The governed deploy wrapper could apply remote migrations and deploy a Worker;
it remains **out of scope** without separate owner approval.

## October 15 owner-confirmed Gate 5 diagnostic: 0 / 0 / 0

The owner independently opened **D1 → fire-app-staging-db → Studio → Query**
and provided a screenshot showing one result row for the exact reviewed,
read-only `DOOMSDAY_0022_OWNER_CONSOLE_READ_ONLY.sql` statement:

| Column | Observed count | Narrow interpretation |
|---|---:|---|
| `migration_0022_rows` | **0** | Named migration not recorded in `d1_migrations` |
| `index_0022_rows` | **0** | Named partial unique index not present in `sqlite_master` |
| `duplicate_provider_groups` | **0** | No currently duplicated `payments.provider_id` groups matching `cs_*` or `refund:*` |

**Observation source:** owner-supplied Cloudflare D1 Studio screenshot,
October 15, 2026. This is **point-in-time screenshot evidence**, not a
provider-signed/exported SQL result or a permanently locked database. The
SQL is one SELECT, does not export payment identifiers, and its GLOB
predicates match the WHERE predicate of the reviewed candidate's
`0022_stripe_provider_uniqueness.sql` index.

**Acceptance:** This narrow duplicate-reference/index/journal preflight
is clear **as of the screenshot**. No proof of writer quiescence, full
metadata integrity, physical backup/restore or authorized execution.
If another payment/refund is written after the screenshot, preflight
results may change. Do not assume the index can be created safely until
rechecked immediately before an owner-authorized maintenance window.

## October 15 owner-confirmed financial and foreign-key preflight: 0 / 0 / 0 / 0

The owner next ran the reviewed **single SELECT**
`DOOMSDAY_LEDGER_OWNER_AGGREGATE_READ_ONLY.sql` in the same Cloudflare
**D1 → fire-app-staging-db → Studio → Query** and supplied four screenshots
showing the horizontally scrollable **one-row / four-column** result.
Across the four screenshots, all four blue result values are visible as 0:

| Aggregate-only field | Observed count | Interpretation limited to query predicate |
|---|---:|---|
| `invalid_refund_links` | **0** | No detected invalid original-payment/estimate/amount associations |
| `succeeded_refund_ledger_mismatches` | **0** | No detected succeeded-refund negative-ledger mismatch |
| `over_reserved_payment_groups` | **0** | No detected group whose pending plus succeeded refunds exceed the referenced original payment |
| `foreign_key_violations` | **0** | `pragma_foreign_key_check` returned zero violations |

**Evidence:** October 15, 2026 owner-supplied D1 Studio result
screenshots. The observations are consistent with the exact safe SQL
in the repo; the screenshot set did not disclose any row-level customer,
payment, refund, or provider identifiers. Screenshots are retained in
the conversation, not copied into this Git repository.

**Acceptance:** All **seven** owner-observed aggregate checks (three
migration/index/provider-reference counts plus four ledger/FK counts)
were zero *at capture time*. This is a **narrow Gate 5 subcheck**, not
the entire Gate 5 acceptance, hosted cutover approval, proof of application
data being present, or proof that concurrent writers are stopped.

**Remaining blockers:** Confirm complete application schema, exact
columns/index SQL and constraints, migration-manifest checksums, active
deployed source/runtime identity, provider-verifiable D1 isolation
across LIVE/refund-staging/Doomsday, backup export and disposable restore
proof, a controlled writer-quiescence plan and recheck immediately before
any approved migration. Gate 4, Gate 5, Gate 7, Gate 8, Gate 9 and Gate 10
remain pending under existing release policy. Neither `0022` nor any
remote migration is authorized by either set of owner observations.

## October 15 owner-confirmed D1 Time Travel recovery option

The owner opened **D1 → fire-app-staging-db → Time Travel** and supplied
a screenshot showing the following available controls:

- The page advertises restore to a **specific date/time or bookmark ID**.
- The visible recovery window is **7 days**, with the displayed range
  **October 7, 2026 23:30 through October 14, 2026 23:30**. Those are
  dashboard-displayed values; timezone and exact capture instant were not
  independently validated. The window moves with time.
- The date/time has **not been selected**, and the red Restore database
  button is not currently active.
- Cloudflare's page expressly warns that restoring an older version
  **overwrites the current database**.

**What this proves:** A seven-day D1 Time Travel restore interface is
available to the owner for this database. It does **not** establish that a
specific restore point exists/was bookmarked, that restoration has been
tested, or that the backup is independently retained outside the rolling
window. It does not capture or back up R2 photo objects.

**Release decision:** This is meaningful Gate 10 recovery capability
evidence but **NOT a completed backup-and-restore gate**. Before an
owner-authorized database migration or redeploy, separately require:
immutable target UUID and active Worker binding confirmation, a complete
owner-controlled pre-change D1 export or equivalent independently
restorable snapshot (with a verified secure retention location), integrity
hash/size and schema+journal capture, disposable restore and invariant
rehearsal, selected recovery strategy with migration-version compatibility,
writer-quiescence/recheck procedures, and explicit narrowly-scoped owner
approval. Do not select a restore point, invoke Time Travel, change the
binding, or execute a migration based only on this screenshot.

**Screenshot source:** owner-provided Cloudflare D1 Time Travel page,
October 15, 2026. Image remains in the chat, not Git or any public artifact.

## Strict execution boundary

No remote migration, table modification, Stripe payment, R2 activation, build
retry, deployment or change to real customer data was requested or performed
to create this checkpoint. Source work stays on
`work/fire-business-app-parity-2026-10-08`; evidence collection does not
raise official readiness until the release gates independently satisfy their
acceptance rules.
