# FIRE — NEW LIVE post-lock recovery, owner decision boundary (Nov 14, 2026)

## Accepted current hosted state — do not recheck or repeat

The owner ran the NEW `owner_new_live_initialized_journal_readonly.mjs --capture` against already authenticated Cloudflare on Acer. Actual validated result `FIRE_NEW_LIVE_INITIALIZED_JOURNAL_EMPTY_READ_ONLY_MATCH_NO_RETRY` (see exact owner-provided screenshot). Pinned physical NEW LIVE D1 is `fire-fullapp-new-live-db`, UUID `0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662`. Physical `d1_migrations` has 0 rows; `sqlite_sequence` has 0 high-water records; zero FIRE schema objects; exact journal DDL and automatic UNIQUE index match; original 26-attempt lock exists, original completion receipt absent. Cloudflare readbacks were not atomic, the prior command's ACK remains unknown, and the original attempt must NEVER be repeated.

**Preserved accepted evidence:** DR 26/26, dark DR Worker first-create `fire-fullapp-dr` version `b7c42773-5a93-4c6c-91d2-83cdb8e857d9`, verified hosted DR D1 UUID `5e55c5b7-cd67-4c8f-a52e-40f71b5d3145`, original local Acer locks/snapshots, prior iPhone QA and login attempts. No repeat login, screenshots or DR migrations.

## New NEW LIVE source candidate — no Cloudflare action authorized or taken

On the current MAIN-based DRAFT PR270, actual source code `business-app-parity/owner_new_live_postlock_recovery_once_separately_approved.mjs` was implemented, NOT executed. Source-only changed-code checkpoint `bd20b3b3c70c0cae113ddf04bea939d7406c71cd`. Focused offline test `test_owner_new_live_postlock_recovery_once.mjs` exercises old lock preservation, separate explicit consent/interactive terminal requirement, pinned 26-SQL local integrity, wrong D1 refusal, unexpected prior recovery lock/receipt, atomic exclusive new lock and no-retry, lost ACK custody, source-only default.

The guarded *future* action, only if owner gives NEW exact permission after reviewing this scope:
1. Require the separate NEW CLI approval sentinel PLUS exact new owner-typed target UUID phrase from the real owner interactive terminal (neither generic "continue" nor the old approval counts).
2. Confirm original old lock is a bounded regular file and remains identical; original receipt absent; refuse if a previous distinct recovery attempt lock or receipt exists. Check original exact source-reviewed 26 SQL files on the known saved Acer working folder, pinned config and Wrangler 4.92.0.
3. Target-only D1 physical UUID and exact journal schema/unique index/zero migration rows/zero `sqlite_sequence` high-water/zero FIRE schema objects. Re-read these as a NEW immediately pre-write freshness gate; previous accepted readback is preserved, NOT requested again merely to gather evidence.
4. Create and fsync a **NEW distinct local exclusive recovery attempt lock BEFORE any remote mutation**. NEVER delete, rename or overwrite the original lock. No automatic retry even after transport failure, cancellation, partial write or missing receipt.
5. Issue exactly ONE Cloudflare Wrangler `d1 migrations apply fire-fullapp-new-live-db --remote` using ONLY reviewed independent NEW LIVE D1 config and 26 source Git blob identities. No DR/QA/STAGING migration.
6. If the call reports success, run **existing** comprehensive source-pinned read-only physical verification for 26 ordered migration IDs/names, refund/Stripe idempotency and invoice indexes, immutable Customer#/Job#/deposit agreement triggers, all zero app data, empty numbering sequences, expected first future Job #0001. If any part fails: STOP, original and new locks remain. No second attempt.
7. Only after every provider readback passes, write a **DISTINCT new recovery receipt** exclusively to a new filename. This proves the *new* command only, NEVER retroactively declares success of the unknown original attempt. Neither Worker deployment, Access/owner login, Stripe/payment, R2, billing, DNS or Git merge/cutover is involved or authorized.

### Explicit owner consent still required
The present conversation does **not** authorize any NEW migration. Do NOT run the recovery script with its `--execute` flag, or hand off executable instructions, until the owner separately explicitly approves **one new 26-migration remote attempt ONLY on `fire-fullapp-new-live-db`, UUID `0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662`**, under the above locks, source review and physical checks. The old original attempt lock remains immutable. After a fresh approval, reconfirm final source and focused CI SHA, then provide a single pinned Acer command. No Work-browser/cloud sign-in loops needed.

### Acceptance boundary
G1/G2/G3/G8 accepted 4/10; G4/G5/G6/G7/G9/G10 open. NEW LIVE NO-GO until physical postwrite proof PLUS separate later hosted parity/auth/recovery/payment/rollback gate acceptance. Job #0001 has NOT been created. Source code is not deployed or provider-verified functionality. No new mutation has occurred.
