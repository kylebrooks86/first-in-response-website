# FIRE App — Independent Cloudflare DR Staging Runbook

This is the independent disaster-recovery staging copy of the FIRE App v138 release candidate. The active deployment model is intentionally **free-tier, D1-only, no R2** and uses a separate Cloudflare Worker and separate D1 database.

Current staging resources:

- Worker: `fire-app-independent-staging`
- D1 database: `fire-app-staging-db`
- D1 database ID: `afb2c05a-d794-4a9a-b580-924ce01c26ad`
- Temporary host: `https://fire-app-independent-staging.kyle-bfc.workers.dev`
- Owner authentication: DR-only 4-digit PIN overlay with signed session cookie
- Photo-file storage: not provisioned in the current DR deployment

The sealed v138 package remains unchanged. DR-only compatibility/auth/parity changes are applied after extraction by the staging preparation script.

## Safety boundary

Do not attach the production website domain, reuse production databases/storage, import real customer records, or modify LIVE while strict DR parity is still being closed.

The current DR deployment must remain isolated from:

- production/LIVE hosting
- production DNS
- production D1/R2 resources
- real customer data unless the owner explicitly authorizes a recovery import

## 1. Required source baseline

The current preparation path requires:

- archive: `FIRE_App_Restore_Failure_Audit_Completeness_v138_2026-10-01.zip`
- expected SHA-256: `2f17f220ba08abd893a89bfc8e4fe7df870e692557723a475e859a44ff8382ca`
- package version: `1.0.0-rc.138`
- FIRE release: `v138`
- 21 canonical migrations, `0000` through `0020`

If the archive hash or release identity does not match, preparation must stop.

## 2. Current Cloudflare build configuration

Build command:

```sh
git fetch origin fire-calculator-exact-live-clone && git checkout fire-calculator-exact-live-clone && bash scripts/prepare-fire-v138-dr-no-r2.sh
```

Deploy command:

```sh
cd fire-app-dr && pnpm exec wrangler d1 migrations apply fire-app-staging-db --remote --config dist/server/wrangler.independent.json && pnpm exec wrangler deploy --config dist/server/wrangler.independent.json
```

The preparation script:

1. verifies the sealed archive hash;
2. extracts a fresh `fire-app-dr` source tree;
3. verifies v138 package/release identity;
4. applies the DR-only 4-digit PIN overlay;
5. applies the mobile-shell parity overlay;
6. applies the Templates mobile parity overlay;
7. runs the LIVE parity source guard;
8. runs the owner-workflow parity guard;
9. runs the customer-workflow parity guard;
10. runs the formal parity-ledger consistency guard;
11. installs dependencies and builds;
12. writes a separate D1-only Wrangler config;
13. removes any R2 binding from that independent config;
14. stages all 21 migrations;
15. runs typecheck and reports its result honestly.

The sealed-v138 TypeScript errors are currently known and treated as `FAIL_NONBLOCKING` only after the production build succeeds. Do not report typecheck as passing unless it actually passes.

## 3. Authentication

The current DR deployment does **not** use the old long-password setup described by earlier staging documents.

The preparation overlay changes the owner login to a 4-digit PIN flow and creates a signed owner session. The PIN itself must not be stored in plain text in documentation or source.

Verify after deployment:

- incorrect PIN is rejected;
- correct PIN opens the owner app;
- the session persists as expected;
- the owner can return to the Home Screen-installed app without reconfiguration;
- authentication changes do not alter the post-login LIVE-style app experience.

## 4. D1-only staging and migrations

The current independent Wrangler config must contain exactly the isolated D1 binding and no R2 binding.

Before deploy, verify the generated config targets:

```text
fire-app-staging-db
afb2c05a-d794-4a9a-b580-924ce01c26ad
```

Then apply the 21 migrations with the deploy command above.

Do not point the staging Worker at any production database.

## 5. Photo capability exception

The current DR deployment has no R2 bucket because the owner chose the free D1-only staging path.

Therefore:

- Photos UI can still be compared visually with LIVE.
- Actual photo upload/archive/download is **not** functionally equivalent to LIVE.
- `/api/customer-photos` must fail closed with `Photo storage is unavailable.` when storage is missing.
- JSON records backup may include photo metadata, but photo files are not recoverable from this D1-only deployment.
- Do not mark photo-file recovery `VERIFIED_IDENTICAL` until a storage capability is intentionally provisioned and tested.

This is an explicit capability exception, not a hidden defect or fake-success path.

## 6. Stripe

Stripe configuration is not required to prove basic owner UI parity.

If Stripe is tested in staging, use the intended non-production configuration and verify server-side amount calculation, session tracking, webhook signature handling, idempotency, refund behavior, and stale-session expiration.

Do not enable live charging merely to prove rendered parity.

## 7. Backup and restore

The records backup/restore path remains important in D1-only DR staging.

The in-app JSON restore is merge-only:

- missing records may be added;
- existing records are preserved;
- records are not silently overwritten or deleted;
- checkout-session safety is preserved;
- invoice revision history is preserved;
- refund integrity is validated;
- lifecycle notification duplicates from older backups are normalized;
- post-write verification failures return structured restore-audit guidance.

Photo-file restore remains unavailable without storage and must not be represented as working.

## 8. Current acceptance checks

Use disposable staging data only while parity is incomplete.

Verify:

- PIN login works;
- Dashboard and navigation render correctly;
- top Back / Home / Theme / Menu controls work;
- bottom navigation works;
- Templates mobile selection/edit flow works;
- estimate creation and discounts work;
- approved/signed estimates can be scheduled without a hard deposit gate;
- job completion still requires the completion report;
- final invoice becomes the canonical completed-job billing amount;
- payments/refunds fail closed during unresolved refund/overpayment states;
- JSON backup and merge-only restore work against disposable D1 data;
- photo actions fail clearly while no storage binding exists;
- no production resources are attached.

Scrolling/smoothness is intentionally frozen as accepted by the owner and is not an active parity-tuning target.

## 9. Rendered parity evidence

Formal parity remains governed by:

- `PARITY_EVIDENCE_MANIFEST.json`
- `STRICT_PARITY_MATRIX.md`
- `LIVE_MASTER_PARITY_CHECKLIST.md`
- `STRICT_RENDERED_PARITY_QUEUE.md`

The working queue contains 95 rendered states; the formal evidence manifest contains 32 release-gating parity entries.

Do not mark a formal state identical from source inspection alone.

For every formal comparison:

1. capture the same state in LIVE and DR;
2. use the same content/state, device class, orientation, viewport, and theme where practical;
3. register both evidence files with hashes and provenance;
4. compare the exact registered pair;
5. mark `VERIFIED_IDENTICAL` only when the comparison is actually complete.

Known current formal evidence summary remains:

- 11/32 LIVE evidence captured
- 0/32 independent evidence captured
- 0 verified identical comparisons
- 0 mismatches

## 10. Current release verdict

The independent Worker is a real isolated staging deployment, but the release remains:

```text
STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED
NOT_YET_FULLY_VERIFIED
```

Do not promote it to FULL_IDENTICAL until the formal rendered-evidence gate is complete or a difference is explicitly approved as infrastructure-only.

## Rollback

Because the staging Worker and D1 are isolated and no production domain is attached, rollback is simply stopping use of the staging URL or redeploying the last known-good staging commit. Do not alter LIVE as part of DR rollback.
