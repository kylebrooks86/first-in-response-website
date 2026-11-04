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
- 22 canonical migrations, `0000` through `0021`

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

Do not manually substitute a plain Wrangler deploy command. The governed wrapper requires the current `origin/fire-calculator-exact-live-clone` commit, re-runs predeploy provenance, validates the independent Worker/D1/no-R2 target, applies remote migrations only to `fire-app-staging-db` with the independent config, re-runs provenance after migrations, and only then deploys the independent Worker with that same config.

The preparation script verifies the current staging branch and sealed archive, restores persistent governance/evidence overlays, verifies v138 identity and the governed script inventory, applies the PIN/mobile/Templates/LIVE-evidence overlays, restores persistent independent evidence and deliberate comparison decisions, synchronizes parity summaries, verifies overlay idempotency plus owner/customer/service/restore/refund/evidence/parity guards, builds, validates the D1-only/no-R2 deployment config, stages the exact 22 migrations, fingerprints post-build artifacts and evidence state, self-tests predeploy provenance, then runs typecheck and reports the result honestly.

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

Optional tipping is intentionally available only on the final balance card payment: No tip is selected by default, with 5% / 10% / 15% / Custom choices. Percentage presets are calculated from the full invoice total, while the Stripe card charge is only the remaining balance plus the selected tip. Deposits do not offer or accept tips. Stripe receives the tip as a separate line item, FIRE records Tip / Tip Refund separately, and those entries must never change invoice paid/balance, paid-in-full, overpayment, or refund-review math. The Payments summary shows net tip revenue separately so tip income remains visible without being treated as invoice payment. Customer-profile **Paid** totals exclude Tip / Tip Refund rows, and customer payment history labels **Tip** and **Tip refund** explicitly. Both Stripe and manual tips are capped at the lesser of the full invoice total or $500. Both the Stripe webhook and the customer success-page fallback verify replayed invoice-payment and tip ledger rows before accepting a duplicate completion, so either arrival order reconciles to the same split. Until LIVE receives the same flow, tipping remains a `PENDING_LIVE_SYNC` forward-sync blocker.

For a Stripe charge that includes an optional tip, initiate any refund from FIRE's Payment History so FIRE can preserve the invoice-payment versus Tip split. Do not use a single combined Stripe Dashboard refund as the normal tipping-refund workflow; Stripe exposes that as one refund amount while FIRE deliberately maintains separate invoice and Tip ledger rows.

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

Owner-approved user-facing differences are additionally governed by `FORWARD_SYNC_APPROVED.json`. Any entry that remains `PENDING_LIVE_SYNC` must be preserved in DR rather than removed to imitate an older LIVE state, and blocks `FULL_IDENTICAL` until that specific LIVE upgrade is confirmed by same-device rendered and functional review.

Do not mark a formal state identical from source inspection alone. Independent evidence and comparison decisions persist outside the extracted `fire-app-dr` tree so sealed-v138 rebuilds cannot silently erase them.

Show the current capture queue first:

```sh
python3 scripts/report-fire-dr-evidence-capture-queue.py
```

Before taking screenshots, while logged into the DR app, open the authenticated capture-identity endpoint and record its `captureId`:

```text
https://fire-app-independent-staging.kyle-bfc.workers.dev/api/dr-capture-identity
```

The endpoint returns only non-secret staging identity fields (exact source commit, v138 release, deterministic capture ID, and forward-sync registry fingerprint), is owner-authenticated, and is marked no-store. The capture ID must come from the same deployed DR build shown in the screenshots.

Register one real DR screenshot only after the governed DR build that produced it exists:

```sh
python3 scripts/register-fire-dr-independent-evidence.py --entry-id <formal-id> --file <screenshot> --capture-id <capture-id> --notes "Exact DR state captured to match registered LIVE evidence."
```

The registrar requires the deployed capture ID to match the exact source-build provenance, records the screenshot hash/bytes/dimensions/profile, persists that provenance snapshot, rejects stale-build or profile-mismatched captures by default, invalidates any prior comparison if evidence is explicitly replaced, synchronizes parity summaries, and never auto-promotes `comparison_status`.

After visually and functionally reviewing the exact registered LIVE/DR pair, record an identical result only with both review confirmations:

```sh
python3 scripts/record-fire-dr-parity-comparison.py --entry-id <formal-id> --result identical --notes "Exact registered LIVE and DR pair reviewed." --visual-review-complete --functional-review-complete
```

Record a mismatch instead when the pair differs:

```sh
python3 scripts/record-fire-dr-parity-comparison.py --entry-id <formal-id> --result mismatch --notes "Describe the exact rendered or functional difference."
```

Every comparison decision is tied to the exact LIVE and DR SHA-256 values. Replacing either DR evidence file invalidates the old comparison and requires fresh review. `VERIFIED_IDENTICAL` is never inferred merely because both screenshots exist.


Forward-sync product differences use a separate deliberate recorder. After the LIVE customer-profile upgrade is actually deployed and the matching LIVE/DR state has been reviewed on the same device/profile, mark one registry entry synchronized with:

```sh
python3 scripts/record-fire-dr-forward-sync.py --entry-id <forward-sync-id> --result synced --notes "Describe the verified LIVE upgrade." --same-device-render-reviewed --functional-review-complete --live-screenshot-sha256 <sha256> --dr-screenshot-sha256 <sha256>
```

This updates `FORWARD_SYNC_APPROVED.json` and the strict parity matrix together, records the exact LIVE/DR screenshot SHA-256 pair plus an append-only sync history, synchronizes release summaries, runs forward-sync/ledger/release-readiness verification, and rolls all touched files back if any verification fails. It never marks a state synchronized from source inspection alone.

If a previously synchronized LIVE behavior later regresses, reopen only that entry with:

```sh
python3 scripts/record-fire-dr-forward-sync.py --entry-id <forward-sync-id> --result reopen --notes "Describe the LIVE regression or reason for reopening."
```

Reopening restores that state to `PENDING_LIVE_SYNC` / `FORWARD SYNC APPROVED` without disturbing other forward-sync states.

Known current formal evidence summary remains:

- 11/32 LIVE evidence captured
- 0/32 independent evidence captured
- 0 verified identical comparisons
- 0 mismatches
- Owner-approved forward-sync blockers: see current `PENDING_LIVE_SYNC` entries in `FORWARD_SYNC_APPROVED.json`

The evidence-coverage guard intentionally requires all current 11 LIVE-captured formal states to be mapped. When a new LIVE capture is registered, preparation stops until the coverage map is deliberately updated.

## 10. Current release verdict

The independent Worker is a real isolated staging deployment, but the release remains:

```text
STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED
NOT_YET_FULLY_VERIFIED
```

Do not promote it to FULL_IDENTICAL until the formal rendered-evidence gate is complete, every owner-approved `PENDING_LIVE_SYNC` entry has been brought into LIVE and verified, and any remaining difference is explicitly approved as infrastructure-only.

## Rollback

Because the staging Worker and D1 are isolated and no production domain is attached, rollback is simply stopping use of the staging URL or redeploying the last known-good staging commit. Do not alter LIVE as part of DR rollback.
