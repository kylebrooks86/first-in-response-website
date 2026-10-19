# Existing QA release packet — preparation only, no hosted write authorization

Reviewed source baseline: `758e183e3c32b7040cacca65b0d478e6a0929552`; GitHub Actions run `39333820407` passed **8/8 jobs**. The next candidate includes the shared estimate/invoice save guards described below; its exact commit and CI must be attached before approval.

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
| Migration-aware release mechanism | Implement and test a separately reviewed path for this exact 23-to-25 transition; existing code-only reviewer/publisher must continue refusing 25 migrations |
| Final candidate identity | Seal exact commit, passing CI run, materialized QA source verification, build/runtime manifest checks and artifact hash |
| Explicit migration approval | NOT GIVEN; exact two SQL hashes, recovery receipt and limitations required |
| Explicit code update approval | NOT GIVEN; exact same candidate and QA target required |
| Hosted and physical acceptance | Pending authorized deployment; verify four priority screens on iPhone |

The existing code-only updater is **not usable for this transition**, even after local rehearsal. Do not change its 23-file condition, use the first-publish initializer, or invoke deploy directly to evade it. A migration-aware path is a remaining implementation blocker, not an owner evidence task.

Future approved execution must follow this order:

1. Seal a clean exact candidate from the development branch, its CI/build checks, canonical migration hashes and isolated runtime configuration. Preserve the first-release 23-migration archive and both historical Worker versions unchanged. No secrets upload or Stripe changes.
2. Agree a quiet QA window with no test edits. Bind the existing verified backup and receipts to the approval. If QA data changed since that backup, assess the recovery gap and obtain an approved fresh recovery checkpoint; do not silently reuse a stale recovery point.
3. Immediately before any write, authenticate the intended account; recheck sole active 58a467fa version, deployed `DB` binding, isolated QA/staging identities, exact original 23 schema/journal and pending list consisting only of 0023 then 0024. Refuse a different head, unexpected migration, expired evidence or changed binding/version.
4. Only after explicit migration approval and a tested guarded executor, apply those two pinned migrations to QA UUID `8ccfb1f8-1657-4074-b1b2-47de78f95003`, in order. No database reset, import, seed or production command. A partial failure stops: inspect actual journal/schema read-only and do not blindly rerun or drop tables.
5. Before publishing, perform authenticated read-only checks for exact 25 journal entries, expected columns/indexes/triggers, clean integrity/foreign keys and unchanged original row/financial snapshots. Do not retain or print customer rows in public evidence. A mismatch blocks deployment; code rollback does not restore data.
6. Only with separate exact QA code approval, publish the sealed candidate to the same Worker, preserving existing D1, QA login secrets and synthetic records. Recheck identity immediately before publication; keep 58a467fa as the expected code rollback. Record the new serving version and verify sole 100% traffic, bindings, owner login and record persistence afterwards.
7. Test synthetic Customer View, View Invoice, Job Report and Job Costs on the owner's iPhone: navigation, narrow layouts/light and dark, balances, draft/completed saves, expense/profit totals, double taps and recoverable online errors. Record observed results separately from automated tests. Failure stops release advancement. Remote rollback/restore requires its own explicit authorization.

## Specific approval text for review — NOT YET READY TO EXECUTE

Complete every bracketed evidence field first; placeholders are not authorization. Approval of database migration and code deployment must be explicit and separately identifiable:

> I approve ONLY the two QA migrations 0023 (`b117d357a44c2ef3801e15eccd3a67bd82f701984b7658acf5d575fccb362a99`) then 0024 (`95a1ed3148cd0eee936ad2f8e69323c8a0f8243df226a00973adc04fbab0808e`) from candidate [full commit], CI [passed run], using reviewed executor [identity], on fire-fullapp-qa-db-20261016 / 8ccfb1f8-1657-4074-b1b2-47de78f95003. I reviewed backup [original SHA-256, timestamp, successful receipt hash], secure retention [confirmation], Cloudflare provenance [capture hash/time and binding attestation], and the no-test-edits window [time]. I understand that code rollback does not undo schema, immutable audit/signature data must be preserved, and remote database recovery could lose later writes and requires separate approval.

> Separately, I approve updating ONLY fire-fullapp-qa-20261016 from sole active version 58a467fa-9dbc-45a3-971e-b5a4e478f54d to that same exact candidate [full commit / sealed artifact SHA-256], only after successful post-migration checks. Preserve its database and existing authentication. Retain 58a467fa as code rollback. No production changes are authorized.

## App work and scope

Shared estimate/job details now use synchronous request locks for date/status saves, invoice creation and overpayment reconciliation. Repeated same-frame taps cannot issue duplicate requests, conflicting saves are blocked during closeout verification, and the detail window stays open while a request is pending. Visible accessible saving feedback and disabled date input make the wait clear; failures release the lock so the owner can retry or close. Financial calculations, payment APIs and agreement data are unchanged. This does not add an offline mutation queue or solve uncertain server outcomes after a disconnected request.

These improvements are implemented in shared source for isolated LIVE, staging, Doomsday and QA candidates; no deployed parity is claimed. Actual component regression tests cover pending-save dismissal, duplicate taps, visible feedback, failed-save recovery and retry as well as existing report verification cases. Attach the new candidate's CI evidence before approval.

Production release acceptance remains **3/10 gates (30%)**. Updated four priority screens deployed in this batch: **0/4**; physically accepted on iPhone in this batch: **0/4**; hosted migration and code approval: **not given**. Next bounded batch: implement and test the migration-aware guarded review/execution path using synthetic fixtures, then seal the final candidate and complete the private retention/provenance evidence fields. No hosted operation is authorized by this packet.
