# Existing QA release packet — preparation only, no hosted write authorization

Reviewed starting checkpoint: `33099fe5a504fe4d9bd58369d034bbaeb440e6ed`; GitHub Actions run `39435107597` passed **8/8 jobs**. The migration-aware workflow, final write-window checks and invoice recovery fixes are in this packet's development commit: use its full `git rev-parse HEAD`, exact passed eight-job CI run and sealed local build digest in the generated approval plan. Never approve the starting checkpoint as though it included this new workflow.

**PREPARATION ONLY — no hosted migration or deployment authorization.** Updated October 19 from the owner's authenticated Acer results. Recovery and hosted schema checks below are completed owner observations, not independently reproduced agent access to the private export or Cloudflare account. Do not repeat the export, restore, or schema capture merely to update this packet.

## Reconciled target

| Item | Exact value |
| --- | --- |
| Worker | `fire-fullapp-qa-20261016` |
| Expected currently serving version | `58a467fa-9dbc-45a3-971e-b5a4e478f54d` |
| Expected traffic | Exactly one version, 100% |
| D1 | `fire-fullapp-qa-db-20261016` |
| D1 UUID | `8ccfb1f8-1657-4074-b1b2-47de78f95003` |
| Owner-reported applied migrations | 23, ending `0022_stripe_provider_uniqueness.sql` |
| Older historical rollback | `5e44f843-94f0-4ea4-b80f-a889bd0830ef` |

The owner's authenticated Acer observation on October 19 supersedes the earlier active-version assumption. See QA_OWNER_IDENTITY_RECONCILIATION_20261019.json. This is owner-supplied evidence, not a fresh agent Cloudflare session. The runtime checks must still re-read exact identities before and after capture/export. Old version evidence remains historical and unchanged. All three current capturer/reviewer/publisher version expectations now pin the full 58a467fa UUID; the old rollback UUID must fail as active.

**The rollback target for the NEXT code deployment would normally be the independently rechecked CURRENT version 58a467fa, not automatically the older 5e44f843.** Retain both historical versions. Never execute rollback during this preparation.

## Completed recovery and schema evidence

| Check | Owner-observed result |
| --- | --- |
| Preserved original private SQL SHA-256 | MATCHED original checksum |
| Offline restoration of the actual SQL export | PASSED |
| Original 23 migration journal and full schema | PASSED |
| Local application of exactly 0023 and 0024 | PASSED |
| Financial integrity and foreign keys | PASSED |
| Preservation of all original rows | PASSED |
| Hosted QA metadata capture | COMPLETED; matches original 23 schema |
| Offline release-readiness review | Capture recognized; correctly STOP pending evidence/approval |

The preserved original SQL remains the recovery source. The LF/CRLF source correction canonicalizes only verified migration source bytes; it never changes backup bytes or relaxes their original SHA-256. No hosted writes were reported.

### Retention requirements still to confirm

The completed restore proves recoverability in disposable local SQLite. It does not prove storage retention. Confirm that the **existing** original SQL, original checksum, export timestamp, successful restore-review receipt, schema capture and its review receipt are retained together outside the repository on encrypted, access-controlled storage, with a second independently recoverable secure copy. Confirm both copies' SQL hashes against the already recorded original SHA-256, without overwriting or re-exporting the original. Neither a second folder on the same disk nor a GitHub artifact is an independent private recovery copy.

Only sanitized hash/check results and timestamps are needed for review. Never upload SQL, record contents, tokens, credentials or authenticated browser profiles. This packet has not received the literal original hash, receipt identity/timestamp, retention confirmation or second-copy hash result; do not invent them or label them independently verified. If receipt filenames contain personal paths, redact those paths.

### Cloudflare provenance requirements still to confirm

Local schema JSON can be reviewed for consistency but cannot authenticate its origin. The capturer intentionally records `providerSourceAttested=false`; a local PASS does not override that flag. Retain private authenticated Cloudflare evidence tying the capture to the intended account, exact Worker and `DB` binding to the exact QA UUID, plus sole active version `58a467fa-9dbc-45a3-971e-b5a4e478f54d` at 100%. D1 inventory alone does not prove the deployed Worker's binding. Record evidence time, capture SHA-256, and owner attestation that the existing capture came from that authenticated account/database. Keep account identifiers private where possible; never provide tokens.

Reuse the completed capture and receipts. The reviewer's 24-hour freshness requirement still applies at execution: recheck live identity and schema only if expired or changed, rather than repeating successful recovery work. Any different version, split traffic, database binding, pending migration list or schema drift is a STOP for investigation, not permission to repin expectations.

## Exact proposed SQL and effects

| Pending migration | SHA-256 |
| --- | --- |
| `0023_deposit_policy_events.sql` | `b117d357a44c2ef3801e15eccd3a67bd82f701984b7658acf5d575fccb362a99` |
| `0024_deposit_agreement_snapshots.sql` | `95a1ed3148cd0eee936ad2f8e69323c8a0f8243df226a00973adc04fbab0808e` |

All 23 previous SQL blobs must match their pinned Git contents under the verified LF/CRLF equivalence rule; no SQL edits or other normalization is accepted. Apply 0023 before 0024 only after a distinct exact owner authorization. If the pending journal contains anything else, stop. The ordered procedure below remains a review specification; it is not an executable authorization.

0023 adds append-only policy events, one index and two immutability triggers. 0024 adds signed agreement snapshots referencing those events, one index and two immutability triggers. Together: two tables, two indexes, four triggers; no rewrite of existing tables or rows, no charges/refunds and no retroactive signature changes. Their constraints reject invalid financial amounts and signed-document metadata. Future audit records reference estimates: once used, those references and immutable rows can restrict deletion. They are not disposable cleanup data.

## Recovery and rollback limits

A code rollback restores Worker code only; it does not undo schema or migration-journal changes. Do not DROP the new audit/signed tables or delete signed rows after they are used. A full database restore could lose any writes since the backup; reconcile those writes and obtain separate explicit authorization before remote recovery. A clean in-memory restore/rehearsal does not establish tested remote rollback, live row-count completeness or hosting identity by itself.

During a future approved migration/update window, avoid QA test edits, retain the verified pre-change export/hash/current Worker version, recheck target and journal, apply only the two approved migrations, and verify exact schema/journal and unchanged pre-existing financial data before publishing. Any failure stops publication. Keep a post-change private backup if testing subsequently creates new agreements. Production and other databases remain outside this packet.

## Exact remaining blockers and controlled procedure

| Remaining blocker | Required resolution |
| --- | --- |
| Private retention and receipt identity | Confirm existing original hash/timestamp, successful check-only receipt and two secure copies as above |
| Capture provenance and deployed binding | Authenticated owner attestation/evidence tied to account, Worker, DB UUID, capture hash/time and active version |
| Migration-aware release mechanism | Implemented as `qa_guarded_update.py`; local adversarial and native workerd tests below. Authenticated read-only preflight and final candidate CI/build/evidence must pass before any approval |
| Final candidate identity | Seal exact commit, passing CI run, materialized QA source verification, build/runtime manifest checks and artifact hash |
| Explicit migration approval | NOT GIVEN; exact two SQL hashes, recovery receipt and limitations required |
| Explicit code update approval | NOT GIVEN; exact same candidate and QA target required |
| Hosted and physical acceptance | Pending authorized deployment; verify four priority screens on iPhone |

The existing code-only updater is **not usable for this transition**, even after local rehearsal. Do not change its 23-file condition, use the first-publish initializer, or invoke deploy directly to evade it. The separate migration-aware path now exists; it grants no authority and does not modify either old script. An authenticated preflight failure remains a blocker, never a reason to change protected identities.

Future approved execution must follow this order:

1. Seal a clean exact candidate from the development branch, its CI/build checks, canonical migration hashes and isolated runtime configuration. Preserve the first-release 23-migration archive and both historical Worker versions unchanged. No secrets upload or Stripe changes.
2. Agree a quiet QA window with no test edits. Bind the existing verified backup and receipts to the approval. If QA data changed since that backup, assess the recovery gap and obtain an approved fresh recovery checkpoint; do not silently reuse a stale recovery point.
3. Immediately before any write, authenticate the intended account; recheck sole active 58a467fa version, deployed `DB` binding, isolated QA/staging identities, exact original 23 schema/journal and pending list consisting only of 0023 then 0024. Refuse a different head, unexpected migration, expired evidence or changed binding/version.
4. Only after explicit migration approval and a tested guarded executor, apply those two pinned migrations to QA UUID `8ccfb1f8-1657-4074-b1b2-47de78f95003`, in order. No database reset, import, seed or production command. A partial failure stops: inspect actual journal/schema read-only and do not blindly rerun or drop tables.
5. Before publishing, perform authenticated read-only checks for exact 25 journal entries, expected columns/indexes/triggers, clean integrity/foreign keys and unchanged original row/financial snapshots. Do not retain or print customer rows in public evidence. A mismatch blocks deployment; code rollback does not restore data.
6. Only with separate exact QA code approval, publish the sealed candidate to the same Worker, preserving existing D1, QA login secrets and synthetic records. Recheck identity immediately before publication; keep 58a467fa as the expected code rollback. Record the new serving version and verify sole 100% traffic, bindings, owner login and record persistence afterwards.
7. Test synthetic Customer View, View Invoice, Job Report and Job Costs on the owner's iPhone: navigation, narrow layouts/light and dark, balances, draft/completed saves, expense/profit totals, double taps and recoverable online errors. Record observed results separately from automated tests. Failure stops release advancement. Remote rollback/restore requires its own explicit authorization.

## Implemented guarded workflow and final evidence fields

`qa_guarded_update.py` has four distinct modes. No flags is an offline dry run. Evidence inputs without an action produce an offline exact plan, its canonical SHA-256 and the full migration approval string. `--preflight` performs authenticated reads only. `--migrate` and `--publish` require **different exact approval strings** bound to the same commit, build digest, original backup, account, evidence, quiet window, SQL hashes and rollback version. Migration never calls publication.

The workflow:

- Uses the candidate's tested Wrangler **4.92.0**, invoked directly through Node (avoids Windows `.cmd` SQL quoting); reuses the owner's authenticated profile. It does not install anything or switch accounts automatically.
- Creates only an isolated temporary configuration with the reviewed account, QA Worker and exact QA DB UUID. It reads the actual serving version's `resources.bindings`, requires the exact `DB` UUID and both QA login secret names, and refuses foreign services, buckets and privileged public variables. No token/secret value is read or uploaded.
- Independently reads the exact GitHub CI run and all eight job results before hosted actions; refuses wrong commit, branch, workflow, failed/skipped jobs or unavailable evidence. Requires a clean source checkout equal to fetched origin and the unchanged QA source/runtime verifier results. It hashes every compiled `dist` file and rechecks all release inputs before writes. It checks the approved quiet-window deadline again immediately before each migration file and after the publication dry run; slow reads/dry runs cannot authorize a write outside that window.
- Never calls `d1 migrations list` or `apply` (even Wrangler's list initializes the journal). It verifies the existing journal using SELECT, then executes one pinned migration file at a time with the reviewed journal append. No journal reset, initialization, SQL normalization of backups, arbitrary SQL input or target override is available.
- Rechecks exact 23/24/25 schema, indexes, full trigger definitions, journal ordering, clean foreign keys and ledger anomaly counts, D1 `quick_check`, and empty new audit tables. Full offline backup `integrity_check` remains required by the existing receipt. D1 does not authorize the full SQLite integrity query; quick_check is the documented hosted physical consistency check, not a claim of equivalent full index verification. Reference: https://developers.cloudflare.com/d1/sql-api/sql-statements/#pragma-quick_check
- Reads original synthetic QA application values and full original journal rows **only into process memory** for per-table SHA-256 comparison; supports BLOBs, checks row counts for truncation, and saves only hashes. This is broader than the existing metadata-only capture. No row contents, SQL exceptions or raw CLI output are printed or written to the receipt. Metrics/CLI log files are disabled.
- Reserves a new private receipt outside the repository before hosted activity. A failure leaves a STOP receipt; it does not retry, resume a partial migration, publish, reset or roll back. A 24-entry partial journal requires separate review. Do not retry a timed-out write based on its exit status alone.
- Publication requires the migration receipt's canonical SHA-256 in its separate approval. It independently rechecks hosted schema 25 and unchanged original rows, performs a no-upload dry run, rehashes the bundle, preserves existing authentication and D1, and verifies a new sole-100% serving version and its binding after deploy. Owner login and physical iPhone acceptance remain separate outstanding checks. A failed post-deploy check does not automatically roll back code or data.

### Owner evidence preparation — no repeated SQL export or restore

Copy `QA_GUARDED_UPDATE_EVIDENCE.example.json` to a **private folder outside the repository**. Fill its fields from the already completed receipts and authenticated owner observation. The template intentionally fails until completed. Do not commit the private copy. Its four boolean confirmations must reflect actual retention/provenance/no-write facts; a local JSON file is owner attestation, not independent proof of encryption or Cloudflare origin.

Remaining private facts: original SQL hash and export time, successful restore receipt's raw file hash (UTF-8 or PowerShell UTF-16 BOM JSON accepted without modifying it), existing schema capture hash, confirmed encrypted/access-controlled retention and independent matching second copy, exact authenticated Cloudflare account ID and origin attestation, no QA writes since that recovery point, agreed quiet-window end and this exact candidate's passed CI run ID. The workflow freshly rechecks the actual Worker-to-DB binding; do not repeat the existing capture unless genuinely expired (>24h) or changed.

The original SQL is **not an input** to this workflow. Preserve it unchanged. Existing receipts are consumed without rerunning the successful restoration/rehearsal. Do not paste/upload the SQL, tokens or private evidence file into chat/GitHub.

Build the isolated candidate using the existing `owner_windows_build_qa_candidate.ps1` only after this exact commit passes CI. Then, from the repository root, the following is **offline only** (replace the three private filenames with their existing exact paths):

```powershell
$qaCandidateCommit = (git rev-parse HEAD).Trim()
$qaCandidateDirectory = Join-Path $env:LOCALAPPDATA ('FIRE-QA-Builds\qa-' + $qaCandidateCommit)
python .\business-app-parity\qa_guarded_update.py `
  --evidence 'C:\PRIVATE\qa-update-evidence.json' `
  --restore-receipt 'C:\PRIVATE\EXISTING-PASSED.restore-review.json' `
  --capture-file 'C:\PRIVATE\EXISTING-QA-SCHEMA-ONLY.json' `
  --candidate $qaCandidateDirectory
```

This prints the exact plan and `migrationApprovalText`; it does not contact Cloudflare or authorize writes. Review and retain its plan hash privately. The optional `--preflight --output <new-private-receipt>` performs the newly implemented read-only checks, including in-memory synthetic row hashing; it does not repeat the export/restore. No `--migrate` or `--publish` command is authorized or requested now.

## Specific approval packet — blocked pending private evidence and live preflight

The exact migration approval is the generated **`migrationApprovalText`**, beginning `MIGRATE QA fire-fullapp-qa-20261016 8ccfb1f8-1657-4074-b1b2-47de78f95003 ... PLAN ... FROM 58a467fa-9dbc-45a3-971e-b5a4e478f54d`. Review its full commit and plan hash, two SQL hashes above, successful CI run, build digest, backup/retention/provenance evidence and rollback limits before providing it. Generic "continue", passing tests or owner observations are not migration approval.

After an explicitly approved migration, adding the resulting private migration receipt to the same **offline** plan command with `--migration-receipt <existing-private-file>` produces `publicationApprovalText`. It begins `PUBLISH QA ...` and additionally pins the **canonical JSON receipt SHA-256** (not the raw file hash). The workflow does not infer publication approval from migration approval. Changes to the source, build, evidence, receipt, account, window or version invalidate the old exact approval. Expired windows or partial/uncertain writes require a new reviewed recovery decision; never bypass the hold.

For approval review, the owner must acknowledge: only isolated QA is in scope; code rollback to 58a467fa does not undo schema; append-only audit/signature records must survive; a remote database restore can lose writes and needs separate authorization; LIVE, Doomsday and protected staging are excluded. **Neither migration nor publication approval has been given.** This packet deliberately does not invent missing hashes or attestations.

## Verification and app work

The workflow regression suite uses real pinned SQLite schemas with a fake provider: correct 23->25, protected targets, prior/split versions, wrong binding/resources, absent/changed approvals, CI failures, missing/altered SQL, schema/journal/ledger drift, missing immutable triggers, journal trigger injection, row mutation despite identical counts, truncated reads, partial failure/no retry, changed receipts, publication dry-run/build changes, UTF-16 receipts, and redacted provider errors. Native Wrangler/workerd tests exercise the exact SQL-file-plus-journal format, retain synthetic customer/job/payment values, and verify 25 journal entries, four triggers, empty new tables and quick_check. No hosted integration is claimed.

Estimate and final-invoice editors prevent same-frame duplicate submissions, keep unsaved edits open while saving and freeze fields until the response. The invoice editor now clears old fields before reload, hides editing after failed/malformed or wrong-record reads, shows an explicit retry action, and requires the invoice/job/customer identity to match. Old or closed requests cannot replace a new invoice. Successful saves require a matching invoice ID and a valid returned total; missing or mismatched confirmations do not report success. Both editors preserve valid fractional quantities below one instead of rounding them up when opened. Final-invoice editing now uses the existing bounded scroll area with a fixed header/save footer, keeping services, payment terms and errors reachable on narrow/short iPhone layouts instead of inheriting hidden overflow without a scroll body. Error paths recover for retry or safe close. Actual extracted React-component tests cover successful saves and HTTP/network/malformed JSON failures, with exact original cents and fractional quantities preserved. The actual React/Radix browser fixture also exercises failed invoice loads, retry, narrow light/dark layouts and a held pending save with close/Escape attempts. All records are synthetic; hosted and iPhone acceptance remain separate. The prior job-details guards remain intact. Shared source applies to every isolated target; deployment parity is not claimed.

Customer profile updates and note saves now have synchronous submission locks, visible failure feedback and response-identity checks. An unconfirmed note keeps its customer-specific draft; a late response cannot erase another customer's draft or repopulate notes after owner authentication denial. Refresh saved notes is read-only; uncertain saves are not automatically retried. Draft protection is in the current mounted owner session, not a persistent offline note queue. Edit Customer freezes pending fields and cannot be dismissed mid-save. The unchanged API still controls duplicate contacts, property history and authorization.

Schedule, estimate and follow-up callbacks no longer reopen a closed detail or replace another selected job. Schedule cards and same-day routing now use America/Chicago, matching existing job details/weather, including the Central midnight boundary; stored timestamps are untouched. The schedule editor labels its existing device-local input explicitly. New source tests cover customer write failures and cross-customer responses; the browser fixture uses actual CustomersView/EditCustomer, Radix and compiled shared CSS on narrow light/dark screens. Final candidate CI must pass before approval.

Estimate history now hides previous-query cards and totals while a new search/status read is pending or failed, and offers a direct retry of the current query. Failed older-page reads retain already loaded records and open edits, with a separate older-page retry. Invalid page identities, duplicate IDs, stalled cursors and unreadable amounts fail before publishing a page. No pricing, payment or database change is included. Synthetic handler and real React browser tests cover recovery in both Pipeline and List.

Insights now requires complete readable customer/job/invoice/payment collections before publishing metrics. Malformed or incomplete reads cannot masquerade as zero activity; a visible error offers a read-only retry. Normalization is atomic, safe integer and aggregate bounds are checked, and late or unmounted reads are ignored. Existing collected, revised invoice value and unpaid principal calculations remain unchanged, including signed refunds and tips. Synthetic handler and real narrow-screen light/dark browser tests verify recovery; no hosted or physical iPhone acceptance is claimed.

Business records are now easier to locate on a phone: task search with All/Open/Completed filters, expense search across the entire loaded history and twelve-record expansion instead of an inaccessible twelve-row cutoff, explicit filtered counts/empty states, and focus-aware jumps between tasks and expenses. Long descriptions wrap while amounts stay readable; controls have 44px touch targets and theme-aware count text. Completed tasks retain readable contrast instead of whole-row fading, and task/expense detail text is at least 12px with tested 4.5:1 contrast in both themes. These controls do not send writes, recalculate financial totals, reset drafts or alter request-ID/status recovery. The actual React/Radix browser fixture covers 320px, 390px and short landscape light/dark screens, long text, every older expense, draft preservation, rapid task taps and interrupted-status read-only recovery. Synthetic UI screenshots are archived with CI; they do not prove physical iPhone acceptance.

Production release acceptance remains **3/10 gates (30%)**. Four priority screens deployed in this batch: **0/4**; physically accepted on iPhone: **0/4**; hosted migration/publication approvals: **not given**. Next bounded batch: review the completed private evidence fields and authenticated read-only preflight, seal this exact candidate's approval plan, and continue core app fixes until explicit hosted authorization. No hosted operation is authorized by this packet.
