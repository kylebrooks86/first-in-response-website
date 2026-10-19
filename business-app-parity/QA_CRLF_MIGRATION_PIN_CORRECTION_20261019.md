# QA private backup: Windows CRLF migration-source pin correction

## Evidence and cause

The owner reports a matching ORIGINAL private export SHA-256, a stop at PINNED_SOURCE / PINNED_SOURCE_OR_INPUT_REFUSED, zero restore statements, and Git migration inventory showing i/lf w/crlf on the Acer. The private SQL export was not uploaded, read by the agent, changed or re-exported.

A local reproduction using copies of all 25 pinned migrations with CRLF checkout bytes reproduced the old source hash rejection before SQL execution. Git's pinned blobs contain LF bytes; Windows checkout conversion changes raw byte lengths and therefore Git blob IDs calculated directly from those working files. This explains the reported source-phase failure; it is not proof of private backup corruption or a completed private restore.

## Secure correction

- Read migration files as bytes and retain the original raw bytes separately.
- Convert only paired CRLF to LF IN MEMORY, reject any remaining bare CR, and require the resulting exact Git blob ID to match each existing fixed historical/additive pin.
- No trimming, whitespace folding, BOM stripping, decoding/re-encoding, comment removal, SQL rewriting, filename exemptions or pin changes.
- Retain the exact required migration filename sets and contiguous numbering; reject missing/new SQL, malformed names, uppercase SQL suffix bypasses, linked SQL files/directories and oversized files.
- Return a verified canonical memory snapshot for expected schema creation and local migration rehearsal. Do not reopen unverified SQL files for execution after validation.
- Report canonical LF SHA-256 and raw working-tree SHA-256 separately. originalMigrationsByteIdentical is false when raw archives/checkouts differ, even if originalMigrationsLfEquivalent is true. Existing canonical approval hashes remain stable across Windows/Linux.
- Private backup SHA-256 remains an EXACT RAW-BYTE check. Migration normalization is never applied to the SQL export. All schema, journal, SQLite integrity, foreign-key, financial and original-row preservation checks remain required.

No migration file, Git migration history, active-version pin, hosted journal, database, export or publisher authorization was changed. Code-only QA publication remains blocked by the existing 23-to-25 migration difference.

## Verification

Nine new LF/CRLF regression methods cover all 25 files, mixed line endings, LF archive versus CRLF candidate, canonical/raw hash reporting, source file preservation, original baseline metadata, full local additive rehearsal, private export fixture restoration, genuine SQL/source tampering before any restore statement, and rejection of a changed private export against its original raw SHA-256. Negative variants include added whitespace/comments, BOM, bare CR, NUL, UTF-16, altered final newline, destructive SQL, missing/extra/malformed/uppercase migration names, and directory-shaped SQL.

Existing schema-delta, private-export, additive-rehearsal, hosted metadata capture, offline metadata review and release readiness security suites pass locally. Linux CI includes the new suite; a separate Windows runner executes the CRLF suite, additive rehearsal and capture guards using synthetic data only. CI results must be reviewed for the final checkpoint; no Windows pass is inferred from local simulation alone.

## Exact offline-only recheck on Acer

First safely refresh the existing development checkout. The following validation block itself performs no network requests, migrations, exports, file writes or remote access. Run it FROM THE REPOSITORY ROOT and enter the preserved export path and the ORIGINAL SHA-256 printed by the successful export:

```powershell
$qaBackupPath = (Read-Host 'Full path to the preserved QA SQL export').Trim().Trim('"')
$qaBackupHash = (Read-Host 'Original SHA-256 printed when exported').Trim().ToLowerInvariant()
python .\business-app-parity\verify_qa_d1_export.py "$qaBackupPath" --expected-sha256 "$qaBackupHash"
```

Do not run -Export again or overwrite the original SQL or receipt. Share only the verifier's diagnostic/check JSON. A successful source check should show pinnedMigrationSourceVerified=true and proceed to actual restore/integrity review. A later failure must be diagnosed from its fixed stage/code/checks; never bypass it because the CRLF issue is corrected.

## Release state and next bounded task

Source correction is implemented and locally tested. Actual private backup restoration, hosted full-schema/journal review, controlled QA migration authorization, code-deployment authorization and physical iPhone acceptance remain outstanding. Accepted release gates remain **3/10 (30%)**. No QA or production deployment occurred.

Next: review Windows/Linux CI and the owner's offline private-backup receipt, then resolve only confirmed remaining failures and complete the exact QA release approval packet. Existing Job Report/Job Costs, closeout and customer/invoice improvements are preserved. No background app development or hosted action is implied by this handoff.
