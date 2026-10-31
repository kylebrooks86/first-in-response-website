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
