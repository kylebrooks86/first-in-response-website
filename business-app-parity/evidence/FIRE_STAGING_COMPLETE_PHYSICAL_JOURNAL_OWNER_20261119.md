# Nov 19, 2026 — authenticated STAGING D1 complete 22-row physical migration journal read (owner original screenshots)

**Target:** Existing Cloudflare STAGING D1 `fire-app-staging-db`, already-established physical UUID `afb2c05a-d794-4a9a-b580-924ce01c26ad`; *not* QA, DR, NEW LIVE or legacy Sites LIVE.

**New physical evidence:** Two owner-submitted authenticated Cloudflare D1 **Console** browser photographs from this conversation show the **entire ordered response** to the read-only `d1_migrations` SQL journal query: first photograph rows 1–14; second photograph rows 10–22 with overlap 10–14. The same database title and Cloudflare database URL prefix are visible in both. All row IDs 1 through 22 appear in order with no gap in the displayed result. Response time shown: 490 ms, query time 0.62 ms (second photograph). No SQL mutation, migration, publication, Access change or customer data is involved.

**Original photographs remain PRIVATE in the owner conversation; not placed in this repository.** Exact SHA-256 of the uploaded original file bytes, for future evidence matching:
- `IMG_0386206A-2512-44C9-9F62-60818EFA24C3.jpeg` (rows 1–14): `5c219b5720a52baf7527f11748535cc04f35c5ea0f65ca124e5cc2fa4d90d7ad`.
- `IMG_2245B79B-FEB9-43C0-8065-23AF232544CB.jpeg` (rows 10–22): `5d3cc993993b3eeb843ac06472d9fc953cc28f69a9a3f823c13296df67582267`.

## Complete original response names — visibly transcribed, read-only

| Physical d1_migrations.id | name (exact) |
| --- | --- |
| 1 | `0000_wise_namora.sql` |
| 2 | `0001_elite_cammi.sql` |
| 3 | `0002_tearful_ink.sql` |
| 4 | `0003_absent_dracula.sql` |
| 5 | `0004_volatile_fenris.sql` |
| 6 | `0005_unknown_king_cobra.sql` |
| 7 | `0006_open_solo.sql` |
| 8 | `0007_open_bloodaxe.sql` |
| 9 | `0008_typical_tomorrow_man.sql` |
| 10 | `0009_spicy_micromax.sql` |
| 11 | `0010_discount_mode.sql` |
| 12 | `0011_editable_invoices.sql` |
| 13 | `0012_invoice_revisions.sql` |
| 14 | `0013_checkout_sessions.sql` |
| 15 | `0014_notification_resolution.sql` |
| 16 | `0015_single_open_checkout.sql` |
| 17 | `0016_notification_resolution_note.sql` |
| 18 | `0017_one_invoice_per_estimate.sql` |
| 19 | `0018_payment_refunds.sql` |
| 20 | `0019_refund_ledger_unique.sql` |
| 21 | `0020_notification_lifecycle_unique.sql` |
| 22 | `0021_manual_processing_fees.sql` |

**Actual source comparison performed 2026-11-19:** These 22 ordered names match **exactly**, including `0004_volatile_fenris.sql`, the first 22 individual `.sql` migration filenames returned by the GitHub directory listing on the current unmerged work branch: `business-app-parity/adapters/doomsday/drizzle/`. This is the Doomsday-family lineage, **not** `adapters/staging/drizzle`. The source has **three further files not present in the physically captured STAGING journal**: `0022_stripe_provider_uniqueness.sql`, `0023_deposit_policy_events.sql`, `0024_deposit_agreement_snapshots.sql`. Those have **not** been applied by this investigation.

## Evidence reconciliation and checklist boundary

The [Oct 29 original owner Wrangler evidence](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6513700760) had already shown **22 physical rows** and only their last three names; [Nov 18 evidence crosswalk](FIRE_ACER_POWERSHELL_EVIDENCE_CROSSWALK_20261118.md) accurately marked the *full name list* as missing. **That specific STAGING full-journal-name evidence gap is now closed** with these two owner photographs. Do **NOT** request another STAGING migration journal or reapply the same 22 migrations. Also preserve previously accepted QA 25-migration preflight and DR/NEW LIVE 26/26 proofs; do not repeat those.

**Formal G5-01 is still OPEN** because it is compound: it requires schema **and** ordered actually bound journals for QA/STAGING/DR/NEW LIVE, and cross-target schema/functional readiness remains incomplete. This STAGING journal is **22/22 verified as source-aligned physical history**, **NOT STAGING 25/25 or parity**. Three forward migrations and their schema changes are not shown in hosted STAGING. Do not migrate, change provider configuration, merge or deploy without exact owner approval and target-specific backup/rollback checks. Official master remains **50/95 checked, 45 open; 4/10 formal gates accepted (G1/G2/G3/G8)**.
