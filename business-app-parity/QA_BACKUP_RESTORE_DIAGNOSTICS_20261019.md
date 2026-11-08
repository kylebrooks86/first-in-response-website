# Preserved QA backup: offline-only diagnostic recheck

Owner reports successful isolated QA export and hash, followed by PRIVATE_QA_RESTORE_STOP. That proves export creation, not verified restorability. The actual private export has not been read by this agent, and its specific cause remains unknown. Do not re-export merely to obtain diagnostics. Preserve both the original SQL and the original export SHA-256.

## Findings and changes

The old verifier discarded individual baseline results when it raised an exception, then printed a generic stop. The updated verifier retains completed checks, failed-check names, a fixed diagnostic code, a fixed stage, the SQLite runtime version and SQLite error name. It emits no paths, SQL, table/column names, exception text, records, values or provider/payment identifiers. SQL trace callback counts statements only; it never stores or prints statement text. Omitted checks mean not reached, never passed. All failure exits retain migration/publication=false.

The local SQLite engine now builds both pinned expected schemas before restoring the private SQL. This distinguishes local engine/source incompatibility from an export restore problem. Existing schema, journal, financial, foreign-key and row-preservation requirements remain unchanged. No speculative schema exceptions were introduced.

Source reference: https://developers.cloudflare.com/d1/best-practices/import-export-data/

The pinned Wrangler 4.92.0 / Miniflare 4.20260515.0 exporter source emits SQL with PRAGMA defer_foreign_keys=TRUE, application schema/data, sqlite_sequence handling, and index/trigger/view definitions. A new --qa mode in the existing integration test exercises 23 actual LOCAL D1 migrations, synthetic records, export, offline verification, import into a DIFFERENT disposable local D1 and re-export. All D1 calls require --local, temporary identities/configuration and stripped cloud credentials. This establishes local format compatibility, not equivalence to this owner's unseen remote file or remote recovery proof. The historical 22-migration integration test is preserved.

## Exact offline recheck

After safely updating the existing development checkout, run this block FROM THE REPOSITORY ROOT. These commands never contact Cloudflare or modify the SQL. Enter the original printed export SHA-256, not a newly calculated replacement hash.

```powershell
$qaBackupPath = (Read-Host 'Full path to the preserved QA SQL export').Trim().Trim('"')
$qaBackupHash = (Read-Host 'Original SHA-256 printed when exported').Trim().ToLowerInvariant()
python .\business-app-parity\verify_qa_d1_export.py "$qaBackupPath" --expected-sha256 "$qaBackupHash"
```

Keep the SQL private. Share only the diagnostic JSON produced by this verifier (not the SQL or the original file contents). Do not rerun owner_windows_qa_backup.ps1 -Export for this diagnostic step, and do not overwrite the existing .restore-review.json receipt.

| Diagnostic | Meaning and next action |
| --- | --- |
| EXPORT_HASH_MISMATCH | Original bytes do not match the supplied original hash; stop and investigate custody/path/hash. |
| INPUT_NOT_REGULAR_SQL / INPUT_SIZE_REFUSED / EXPECTED_HASH_FORMAT_INVALID | Input selection or format was refused before restore. |
| EXPORT_ENCODING_INVALID | File could not be decoded as expected UTF-8 SQL; do not rewrite the original file. |
| SQLITE_AUTHORIZER_REFUSED | SQL requested an unreviewed PRAGMA, disk attachment or extension operation; blockedOperation names only the category. No blanket allowance. |
| SQLITE_STAGE_FAILED at EXPECTED_BASELINE_SCHEMA or EXPECTED_CANDIDATE_SCHEMA | Local SQLite could not build pinned source; investigate runtime support before blaming the backup. |
| SQLITE_STAGE_FAILED at SQL_RESTORE | SQL import failed; engine code and statement counter distinguish this from later review. No statement content is exposed. |
| BASELINE_CHECKS_FAILED | Read checks=false and failedChecks: schema, original 23 journal, integrity, relationships, executable journal triggers or financial ledger. |
| LOCAL_REHEARSAL_CHECKS_FAILED | Restored original baseline passed, but a disposable 23-to-25 rehearsal or preservation check failed. |
| LOCAL_FILE_IO_FAILED / SQLITE_RUNTIME_CAPABILITY_MISSING / PINNED_SOURCE_OR_INPUT_REFUSED | Local file/runtime/source issue; no hosted action is authorized. |

A successful recheck still does not approve migration/publication, prove full live export completeness or prove remote rollback. Continue full hosted schema/journal review, private backup retention and exact owner approval requirements. Release acceptance remains 3/10 (30%). No hosted migration or QA publication occurred.

## Independent app improvement

Job Report no longer treats HTTP success alone as a saved report. It now verifies the returned report's job/customer identity, record ID, draft/completed status, submitted notes/airflow and every checklist value before showing success or advancing completion. Missing, malformed or wrong-record replies leave the success state false with a visible recovery message. Synthetic tests cover matching draft/completed saves and rejected confirmations. Shared source is inherited by the isolated candidates; deployment and iPhone acceptance remain pending.
