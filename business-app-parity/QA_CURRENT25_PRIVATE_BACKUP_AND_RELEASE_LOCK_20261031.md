# FIRE Business App — existing QA 25-migration recovery handoff (Oct 31, 2026)

**Target is isolated full-app QA only, not LIVE, not the public website,
not protected staging or independent Doomsday.**

## Verified so far

- On the Acer, owner-observed authenticated QA read-only checks PASSED:
  sole 100% serving QA Worker, expected physical D1 binding, the 25 saved
  migration names, eight required tables, payment provider index and two
  immutable agreement triggers. See QA_ACER_READONLY_ACCEPTANCE_20261031.md.
- App branch: Draft PR #72 (unmerged, not deployed), containing the Customer
  # / Job # candidate, Text/Email handoff repairs from stacked PRs and safety CI.
- New SOURCE-ONLY offline verifier:
  verify_qa_current25_d1_export.py (with synthetic unit tests).
  Accepts only an owner-held SQL file and an expected SHA-256; restores into
  in-memory SQLite; checks exact 25 ordered journal, canonical source-pinned
  application schema, critical payment/signed-agreement triggers, integrity,
  foreign keys, four reviewed payment-ledger anomalies and an independent
  in-memory recovery copy preserving all table rows and values. No private
  rows or SQL are printed. Rejects the old 23-migration backup.
- New separate SOURCE-ONLY optional export helper:
  owner_windows_qa_backup_current25.ps1. By default it does absolutely
  nothing (no file, no Cloudflare command, no export). The separately opted-in
  -Export path requires checked 25-schema support, exact QA config/UUID,
  original owner Windows account, a preexisting private unlinked folder,
  two typed confirmations, and a fresh read-only QA Worker/D1/schema review
  before and after a QA-only SQL export. Only after a successful local
  current-25 integrity/recovery check does it save a sanitized receipt.
- Existing older owner_windows_qa_backup.ps1 remains **retired for the
  current deployed QA schema**: it expects a stale Worker version and
  23-to-25 migration rehearsal. Never run the old -Export to compensate
  for a changed version, and never modify old evidence to manufacture a PASS.

## October 31 owner backup inventory and device-encryption observation

Owner-provided Windows screenshots show **Device encryption: On** under
Settings → Privacy & security. This is a device-level setting, not
independent evidence of off-device recovery, private archive access
control or verified BitLocker key custody.

The owner searched the local `FIRE-Private-Backups` folder:
`CURRENT25_SQL_COUNT=0`, `CURRENT25_RECEIPT_COUNT=0`.
The observed older local files include a Doomsday PRE0022 SQL dated
October 15 and QA PRE0023 SQL/restore-review pairs dated October 19
and October 23, 2026. **Preserve all older originals.** This is a
directory observation only; other owner-held backup destinations may exist.

The backup plan has TWO separate checkpoints:
1. **Pre-upgrade database safety point:** an owner-approved, current-25
   isolated QA SQL export and verified offline recovery. Captures existing
   records before any later candidate publication; **does not** claim it
   contains PR #72 application changes.
2. **Final accepted release point:** after the remaining app edits and
   owner device/hosted QA tests, retain exact final Git commit, exact
   published Worker version, compatible full SQL+number-mapping backup,
   durable photo/vault recovery, configuration/migration history, and a
   tested safe restoration procedure. Avoid rewinding new customer/jobs
   by blindly restoring the earlier pre-upgrade database with final code.

No current-25 export, off-device custody audit, final approved app
checkpoint, numbered-schema migration or production release is attested
by these screenshots. Never merge database rollback and app-code rollback
into one automatic destructive action.

## Owner-observed Oct 31 current-25 SQL export and offline restore — PASS

The owner expressly approved **QA-only** database export and supplied a
photo of the actual Acer PowerShell result. The reviewed backup helper
`owner_windows_qa_backup_current25.ps1 -Export` was updated to run its
identity/schema checks in independent PowerShell sessions and then:
- **PASS**: pre-export current 100%-served QA Worker, exact QA D1 UUID,
  protected staging separation, all 25 migration names, required eight
  tables, unique payment provider index and both signed-agreement triggers;
- Wrangler reported **successful download** of an isolated QA D1 SQL export
  to the local `FIRE-Private-Backups` directory at
  `FIRE-QA-CURRENT25-20261031-111316.sql` (49,069 bytes);
- **PASS**: post-export exact QA Worker/DB/schema inspection with no resource drift;
- **PASS**: offline disposable SQLite restore and verification of the
  exported current-25 SQL, including exact migration history/schema and
  financial/foreign-key integrity checks; a SHA-256 digest and private
  adjacent `.restore-review.json` receipt were produced;
- Terminal reported `REMOTE_D1_ROW_WRITES=NONE; DEPLOYED=NO;
  QA_RELEASE_APPROVED=NO; PRODUCTION_GATES=3/10`.

This is **owner-observed evidence from a screenshot, not an independently
retrieved private backup**. Do not copy the SQL, signed Cloudflare export
URL, user credentials or local private backup bytes into GitHub/chat.
Do not repeat an export solely to recreate this verified local backup.
The existing older PRE0023 and Doomsday PRE0022 backups remain preserved.

**Completed:** current pre-upgrade QA SQL archive + local SQLite recovery
checkpoint. **Still separate:** proof of durable off-device encrypted
custody, private receipt/SHA durability, photo/vault recovery, latest
app source/Worker artifact sealing, untouched LIVE/staging/Doomsday gate
evidence, hosted QA candidate acceptance and actual iPhone tests.
**Do not enable permanent numbering or publish PR #72 on the strength of
this data backup alone.** No integrated production gate may be auto-closed;
formal readiness remains 3/10 pending its own exact release checklist.

## Important boundaries / remaining release work

1. **Nothing on the Acer needs another command yet.** First verify whether an
   already owner-retained, current-25, privately encrypted QA SQL export and
   independent recovery receipt already exist. Avoid duplicate sensitive
   exports or unnecessary QA query interruptions.
2. If a current private backup does not exist, separately authorize the
   **specific** isolated QA Worker/physical D1 SQL export. Export may briefly
   disrupt hosted QA requests. Do not start without an approved safe window,
   private encrypted destination and original owner Wrangler profile. A test
   fixture passing CI is not permission to export.
3. When independently approved, obtain the latest PR #72 source on the Acer,
   preserve existing local files and backups, then run the NEW helper in its
   default dry-run mode before any opt-in. The helper's default output must
   say EXPORT_ATTEMPTED=NO, REMOTE_WRITES=NONE and QA_RELEASE_APPROVED=NO.
   No public/cloud backup storage and no plaintext uploads are allowed.
4. Even an exact checksum, successful 25-migration local SQL restoration
   and fresh provider QA binding evidence **do not** authenticate original
   Git SHA of hosted Worker source, historic record completeness, photo vault/
   on-device ZIP recovery, durable off-device custody, an independently
   proven remote rollback, QA Text/Email acceptance, owner session isolation,
   or real iPhone Home Screen tests.
5. Permanent Customer # and Job # feature flags and migrations must stay
   OFF until the upgraded lossless identity backup/restore and old-record
   backfill are independently verified. The old v1 JSON record backup remains
   hard-locked whenever these permanent number tables exist.
6. Only a later, reviewed exact-commit, exact-Worker, QA-DB-only update with
   separately scoped owner permission may publish the candidate. No
   automatic deployment, migration, Stripe action, real customer message,
   cloud photo operation or production cutover follows from this document.

**QA-only identity/schema prereqs owner-observed PASS; the private current-25
export/recovery gate has SOURCE-ONLY tests but no owner export completed in
this batch. Production formal readiness remains 3 of 10 gates.**
