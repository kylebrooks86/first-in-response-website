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

The current DR deployment must remain isolated from production/LIVE hosting, production DNS, production D1/R2 resources, and real customer data unless the owner explicitly authorizes a recovery import.

## 1. Required source baseline

The current preparation path requires:

- archive: `FIRE_App_Restore_Failure_Audit_Completeness_v138_2026-10-01.zip`
- expected SHA-256: `2f17f220ba08abd893a89bfc8e4fe7df870e692557723a475e859a44ff8382ca`
- package version: `1.0.0-rc.138`
- FIRE release: `v138`
- 21 canonical migrations, `0000` through `0020`

If the archive hash or release identity does not match, preparation must stop.

## 2. Current Cloudflare build and deploy configuration

Build command:

```sh
git fetch origin fire-calculator-exact-live-clone && git checkout fire-calculator-exact-live-clone && bash scripts/prepare-fire-v138-dr-no-r2.sh
```

Governed deploy command:

```sh
bash scripts/deploy-fire-dr-staging.sh
```

Do not manually substitute a plain Wrangler deploy command. The governed wrapper requires the current `origin/fire-calculator-exact-live-clone` commit, re-runs predeploy provenance, validates the independent Worker/D1/no-R2 target, applies remote migrations only to `fire-app-staging-db` with `dist/server/wrangler.independent.json`, re-runs provenance after migrations, and only then deploys the independent Worker with that same config.

The preparation script:

1. verifies the checked-out staging branch equals current `origin/fire-calculator-exact-live-clone`;
2. verifies the sealed archive hash;
3. extracts a fresh `fire-app-dr` source tree;
4. restores persistent DR governance/audit overlays;
5. verifies v138 package/release identity;
6. verifies the governed DR script inventory and isolated deployment runbook;
7. applies the DR-only 4-digit PIN overlay;
8. applies the user-confirmed mobile-shell/header parity overlay;
9. applies the Templates mobile parity overlay;
10. applies stored-LIVE evidence corrections;
11. verifies overlay idempotency;
12. runs LIVE parity, owner-workflow, 30-service catalog, LIVE-evidence coverage, customer-workflow, restore/lifecycle/refund, and formal parity-ledger guards;
13. installs dependencies and builds;
14. writes and validates a separate D1-only Wrangler config with no R2 binding;
15. requires the exact canonical migration sequence `0000` through `0020` and stages all 21 migrations;
16. verifies post-build deployment artifacts byte-for-byte;
17. writes build provenance with the checked-out source commit, provider trigger commit, governed scripts/documents, parity evidence, deployment target, and migration fingerprints;
18. self-tests the predeploy provenance gate;
19. runs typecheck and reports its result honestly.

The preparation script runs the LIVE-evidence coverage/accountability guard so newly registered LIVE evidence cannot silently bypass DR parity coverage.

The sealed-v138 TypeScript errors are currently known and treated as `FAIL_NONBLOCKING` only after the production build succeeds. Do not report typecheck as passing unless it actually passes.

## 3. Authentication

The current DR deployment does **not** use the old long-password setup described by earlier staging documents. The preparation overlay changes the owner login to a 4-digit PIN flow and creates a signed owner session. The PIN itself must not be stored in plain text in documentation or source.

Verify after deployment that an incorrect PIN is rejected, the correct PIN opens the owner app, the session persists as expected, the Home Screen-installed app remains usable, and authentication does not alter the post-login LIVE-style experience.

## 4. D1-only staging and migrations

The current independent Wrangler config must contain exactly the isolated D1 binding and no R2 binding. The governed deploy wrapper is the only documented deployment path.

Before any remote mutation, the wrapper verifies the generated config still targets:

```text
fire-app-staging-db
afb2c05a-d794-4a9a-b580-924ce01c26ad
```

Do not point the staging Worker at any production database.

## 5. Photo capability exception

The current DR deployment has no R2 bucket because the owner chose the free D1-only staging path. Photos UI can still be compared visually with LIVE, but actual photo upload/archive/download is **not** functionally equivalent to LIVE. `/api/customer-photos` must fail closed with `Photo storage is unavailable.` when storage is missing. JSON records backup may include photo metadata, but photo files are not recoverable from this D1-only deployment. Do not mark photo-file recovery `VERIFIED_IDENTICAL` until storage is intentionally provisioned and tested.

This is an explicit capability exception, not a hidden defect or fake-success path.

## 6. Stripe

Stripe configuration is not required to prove basic owner UI parity. If Stripe is tested in staging, use the intended non-production configuration and verify server-side amount calculation, session tracking, webhook signature handling, idempotency, refund behavior, and stale-session expiration. Do not enable live charging merely to prove rendered parity.

## 7. Backup and restore

The records backup/restore path remains important in D1-only DR staging. The in-app JSON restore is merge-only: missing records may be added; existing records are preserved; records are not silently overwritten or deleted; checkout-session safety is preserved; invoice revision history is preserved; refund integrity is validated; lifecycle notification duplicates from older backups are normalized; and post-write verification failures return structured restore-audit guidance.

Photo-file restore remains unavailable without storage and must not be represented as working.

## 8. Current acceptance checks

Use disposable staging data only while parity is incomplete.

Verify PIN login, Dashboard/navigation, crisp/inset top Back/Home/Theme/Menu controls, bottom navigation, Templates mobile selection/edit flow, the LIVE-captured 30-service catalog/order, signer-name retention, estimate/discount behavior, scheduling without a hard deposit gate, completion-report requirement, Completed → Create invoice → Invoice created / Send invoice transition, final-invoice billing, refund/overpayment payment locks, JSON backup/merge-only restore, clear photo-storage failure, and absence of production resource bindings.

Scrolling/smoothness is intentionally frozen as accepted by the owner and is not an active parity-tuning target.

## 9. Rendered parity evidence

Formal parity remains governed by `PARITY_EVIDENCE_MANIFEST.json`, `STRICT_PARITY_MATRIX.md`, `LIVE_MASTER_PARITY_CHECKLIST.md`, and `STRICT_RENDERED_PARITY_QUEUE.md`. The working queue contains 95 rendered states; the formal evidence manifest contains 32 release-gating parity entries.

Do not mark a formal state identical from source inspection alone. For every formal comparison, capture the same state in LIVE and DR; use the same content/state, device class, orientation, viewport, and theme where practical; register both evidence files with hashes and provenance; compare the exact registered pair; and mark `VERIFIED_IDENTICAL` only when the comparison is actually complete.

Known current formal evidence summary remains:

- 11/32 LIVE evidence captured
- 0/32 independent evidence captured
- 0 verified identical comparisons
- 0 mismatches

The evidence-coverage guard intentionally requires all current 11 LIVE-captured formal states to be mapped. When a new LIVE capture is registered, preparation stops until the coverage map is deliberately updated.

## 10. Current release verdict

The independent Worker is a real isolated staging deployment, but the release remains:

```text
STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED
NOT_YET_FULLY_VERIFIED
```

Do not promote it to FULL_IDENTICAL until the formal rendered-evidence gate is complete or a difference is explicitly approved as infrastructure-only.

## Rollback

Because the staging Worker and D1 are isolated and no production domain is attached, rollback is simply stopping use of the staging URL or redeploying the last known-good staging commit. Do not alter LIVE as part of DR rollback.
