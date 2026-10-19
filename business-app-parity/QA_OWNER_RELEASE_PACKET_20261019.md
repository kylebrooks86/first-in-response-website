# Existing QA release packet — preparation only, no hosted write authorization

Implementation checkpoint: `ccaf457bde23c968c291c2b4c7207ef86749acc0` (includes app changes from `69b7dc9ed2cbfb99e087dee49ac3f4bd84fd8570`).
This packet is **BLOCKED PENDING ACTUAL PRIVATE BACKUP AND FULL SCHEMA EVIDENCE**. It is not a request to approve a migration now.

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

## Owner action needed: private recovery and full metadata

After this checkpoint's CI passes, safely refresh the existing development checkout on the Acer. From the repository root:

```powershell
git pull --ff-only
powershell -NoProfile -File .\business-app-parity\owner_windows_qa_backup.ps1
powershell -NoProfile -File .\business-app-parity\owner_windows_qa_backup.ps1 -Export
python .\business-app-parity\capture_existing_qa_schema_read_only.py --capture
```

First backup command is a no-network, no-write dry run. The export command requires typing `EXPORT 8ccfb1f8-1657-4074-b1b2-47de78f95003`. Schema capture separately asks for `CAPTURE` with the same UUID. Export may temporarily pause queries on this isolated QA database; choose a quiet testing window. These operations do not migrate, publish, change secrets, or touch production.

The helper verifies both QA and protected staging D1 identities and checks the exact QA Worker version at 100% before and after export. Export is pinned by a temporary D1-only configuration. It refuses repository output paths, linked directories, existing export/config/receipt filenames and empty files. It retains the SQL and a hash/check-only restore receipt in the owner's private backup folder; it does not upload them.

Local restore checker:
- Restores the trusted SQL into disposable in-memory SQLite with disk attachment/extension access blocked.
- Requires exact original 23 migration names, application schema, clean foreign keys, integrity and financial ledger checks.
- Allows only the already reviewed Cloudflare internal _cf_KV schema, preserving its blob values; refuses unexpected schema and executable journal triggers.
- Applies only the two pinned additive source files LOCALLY, compares every original application row and original journal row, and verifies the resulting schema and local 25-entry journal.
- Keeps an unchanged disposable baseline rollback copy and verifies that the private SQL input is unchanged.
- Prints checks and file hash, never customer/payment rows or SQL exception text.

These are now synthetic-tested capabilities, **not proof that the owner's actual QA export has already passed**. Keep the real SQL on encrypted private storage with a second secure copy. Do not paste/upload SQL, credentials, tokens or login files into chat or GitHub. Return only the check-only receipt, SHA-256, export timestamp and whether the independent secure copy was retained.

Run the existing offline metadata reviewer on the newly captured JSON. Journal count alone does not establish full column/index/trigger compatibility. Any schema drift, source mismatch, financial anomaly or changed serving version is a STOP, not an invitation to reset/reinitialize data.

## Exact proposed SQL and effects

| Pending migration | SHA-256 |
| --- | --- |
| `0023_deposit_policy_events.sql` | `b117d357a44c2ef3801e15eccd3a67bd82f701984b7658acf5d575fccb362a99` |
| `0024_deposit_agreement_snapshots.sql` | `95a1ed3148cd0eee936ad2f8e69323c8a0f8243df226a00973adc04fbab0808e` |

All 23 previous SQL blobs must remain byte-identical. Apply 0023 before 0024 only after a distinct exact owner authorization. If the pending journal contains anything else, stop. No hosted migration command is supplied by this packet.

0023 adds append-only policy events, one index and two immutability triggers. 0024 adds signed agreement snapshots referencing those events, one index and two immutability triggers. Together: two tables, two indexes, four triggers; no rewrite of existing tables or rows, no charges/refunds and no retroactive signature changes. Their constraints reject invalid financial amounts and signed-document metadata. Future audit records reference estimates: once used, those references and immutable rows can restrict deletion. They are not disposable cleanup data.

## Recovery and rollback limits

A code rollback restores Worker code only; it does not undo schema or migration-journal changes. Do not DROP the new audit/signed tables or delete signed rows after they are used. A full database restore could lose any writes since the backup; reconcile those writes and obtain separate explicit authorization before remote recovery. A clean in-memory restore/rehearsal does not establish tested remote rollback, live row-count completeness or hosting identity by itself.

During a future approved migration/update window, avoid QA test edits, retain the verified pre-change export/hash/current Worker version, recheck target and journal, apply only the two approved migrations, and verify exact schema/journal and unchanged pre-existing financial data before publishing. Any failure stops publication. Keep a post-change private backup if testing subsequently creates new agreements. Production and other databases remain outside this packet.

## Approval fields that must be completed before asking the owner

| Field | State |
| --- | --- |
| Owner-reported exact Worker/D1 and 23 journal | Received; runtime recheck still required |
| Complete hosted schema/column/index/trigger/journal capture | Pending owner metadata capture |
| Actual private export SHA-256 and timestamp | Pending |
| Actual export local restore + additive rehearsal receipt | Pending |
| Independent encrypted backup retention | Pending |
| Exact release candidate commit and passing CI/build identity | Attach final verified run and sealed QA artifact |
| Exact hosted migration mechanism and fresh pending-list review | Pending separate reviewed migration path; code-only updater still rejects 25 SQL files |
| Current Worker retained as rollback, with limits acknowledged | Recheck before approval |
| Explicit approval of exact migration | NOT GIVEN |
| Explicit approval of exact QA code deployment | NOT GIVEN |
| Physical iPhone acceptance of updated four screens | Pending deployment |

Do not use the initial publisher, bypass the 23/25 code-only hold, reinitialize D1, or infer approval from tests. Once the pending evidence is reviewed, ask for one concrete approval covering the exact candidate, target, two SQL hashes, backup receipt and rollback limitations, with migration and code update explicitly identified.

## App work and scope

Job closeout now catches report HTTP/network/JSON failures with a visible recoverable error, prevents same-frame duplicate completion requests, bypasses cached report reads, and requires the completed report to match the selected estimate and customer before issuing a status update. Actual extracted component tests cover valid completion plus failed verification and wrong-record responses (88 assertions). Shared source is inherited by LIVE, staging, Doomsday and QA candidates; no deployed parity is claimed.

Production release acceptance remains **3/10 gates (30%)**. Four updated priority screens deployed in this batch: **0/4**; physically accepted on iPhone in this batch: **0/4**. No real record edits, payments, hosted migrations or deployments were performed. Next bounded batch: review the actual private recovery/metadata receipts, resolve any drift, and complete the exact release approval packet. If owner access is unavailable, preserve this checkpoint and continue a bounded online app fix.
