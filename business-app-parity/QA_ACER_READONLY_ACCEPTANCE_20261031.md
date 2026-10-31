# FIRE Business App — Acer QA exact-runtime verification, October 31, 2026

**Only the existing isolated QA Worker `fire-fullapp-qa-20261016`.**
This is a READ-ONLY metadata acceptance step, NOT a code publication or
authorization to change D1, LIVE, protected staging, Doomsday, Stripe or data.

## October 31 Acer owner-observed verification — PASSED (QA-only)

The owner supplied a photo of their actual Windows PowerShell output after
running the corrected, pinned read-only source script against the existing
isolated Cloudflare QA Worker. This is **owner-observed runtime evidence**, not
an uploaded provider-signed attestation, source/build artifact seal or a
production release. The screenshot showed:

- PASS: Exactly one current QA Worker version serves 100% of traffic.
- PASS: QA and protected staging D1 account identities match pinned values.
- PASS: 25 migration names, 8 required table names, Stripe provider unique
  index and 2 immutable signed-agreement triggers match expected QA schema.
- PASS: Active QA Worker physical D1 binding matches the pinned QA database,
  with no R2 bucket bound to this version.
- `REMOTE_WRITES=NONE; DEPLOYED=NO; CUSTOMER_ROWS_READ=NONE; RELEASE_APPROVED=NO`.

The first attempt stopped during the initial Wrangler D1 list because of a
PowerShell invocation issue; the corrected, checked-in script succeeded.
The owner independently confirmed Wrangler D1 list returned both database
names. There is no need to rerun that exact inspection on an unchanged
Worker just to repeat evidence.

**QA-only identity/schema prereqs: observed PASS.** **Formal integrated
production gates 4–10: still NOT ACCEPTED** (3/10 overall) because separate
LIVE/staging/Doomsday evidence, exact served artifact-source identity,
backup custody/recovery, owner auth and physical iPhone acceptance remain
outstanding. Do not infer PR #72 deployed, source fingerprint verified,
Stripe integration passed, photos migrated or backups restored. No hosted
migration/deployment is authorized by this report.

## Latest owner-confirmed QA baseline (must be freshly reverified)

- Active QA Worker version: `99fa8c27-df83-48d3-b953-9a84eb295334`.
- QA Worker D1 binding variable: `DB`.
- Exact QA database: `fire-fullapp-qa-db-20261016`, physical UUID
  `8ccfb1f8-1657-4074-b1b2-47de78f95003`.
- Protected staging DB is distinct. The accepted QA migration journal has
  25 ordered entries through `0024_deposit_agreement_snapshots.sql`.
- Hosted QA is **NOT** running new PR #72 code and has not enabled permanent
  Customer # / Job # numbering or a new backup migration.
- This evidence is a historical checkpoint only until a real read succeeds.

## On the owner's original Acer Windows profile

1. Open the existing repository checkout or a fresh unmodified ZIP of
   [PR #72](https://github.com/kylebrooks86/first-in-response-website/pull/72).
   Do not overwrite any local edits, encrypted vaults or private backups.
   Obtain the current version of
   `business-app-parity/owner_windows_qa_current_readonly.ps1` with the
   pinned `99fa8c27` version. Run only from the repository root.
2. In **PowerShell** (the existing Windows account authenticated with
   Wrangler), run exactly:
   ```powershell
   .\business-app-parity\owner_windows_qa_current_readonly.ps1
   ```
   The script accepts no destructive flags; it reads `wrangler d1 list`,
   the 100% routed QA Worker version, the detailed Worker-to-D1 binding and
   one pinned aggregate-only SELECT on the **QA** database. It rechecks
   identities and binding after the SELECT. It never opens customer rows or
   collects login tokens.
3. Share only its bounded `PASS`, `STOP` and `LIMIT` output in chat.
   NEVER paste raw Cloudflare account JSON, credentials, personal records,
   SQL exports, private backups, customer/payment rows or a recovery phrase.

## Interpreting results correctly

- All PASS lines: current **QA resource identity, physical DB binding, 25
  migrations, required schema objects** were observed through this owner's
  current Wrangler authentication. This can close those **QA-only evidence
  prerequisites** for the next guarded candidate, NOT production Gate 4.
- Any STOP, version drift or incomplete provider response: do nothing to
  the Worker or D1; report the bounded STOP reason for review. No guessed
  replacement version, no deploy, no migration, no automatic repair.
- The script does not prove exact Git SHA built into hosted QA, R2/photo
  backups, real owner cookie/session isolation, fresh remote Stripe
  integration, iPhone cold-launch acceptance, LIVE/staging/Doomsday physical
  isolation or that all production release gates are complete.

## Next separate approval boundaries

After a fully green current QA inspection, obtain a latest source/build
fingerprint, review the preserved synthetic QA D1/backup state and candidate
compatibility, then ask for separate **exact-commit/exact-Worker QA-only code
publication** approval. No migration or numbering feature enablement occurs
until their separate lossless-backup and historical backfill preflights pass.
When approved and published to QA, test Text / Email prepared-message
handoffs, customer edit persistence, the $25 custom quote, repeat job IDs,
and physical iPhone UI with synthetic data. Do not repeat previously accepted
hosted photo backup tests just to restate the result.

Formal FIRE production acceptance remains **3 of 10 gates** pending verified
LIVE, staging, Doomsday, hosted QA, provider resource and exact-target evidence.
