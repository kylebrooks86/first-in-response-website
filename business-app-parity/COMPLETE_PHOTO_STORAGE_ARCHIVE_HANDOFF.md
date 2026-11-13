# Complete customer-photo namespace archive — candidate implementation

Base checkpoint: 3427404f2224f0e7886e099d23c03ca3c4a53b45. No production resource, database, binding, customer record or deployment changed. Owner screenshot evidence of the missing Doomsday R2 binding remains in PHOTO_STORAGE_RECONCILIATION_EVIDENCE.json.

## Functional change

Business now offers an additional **Complete photo storage backup** download, alongside the preserved legacy Photo archive and records backup. Owner-only GET `/api/backup/photos/storage` exports every observed object in the `customers/` namespace, including retained unreferenced files from uncertain upload/delete outcomes. Those bytes keep their original object key and are explicitly tagged unreferenced with `photoId:null`; no ownership or historical photo record is invented. Shared and independent source use the same libraries while preserving their auth adapters.

New format `fire-app-photo-storage-archive`, version 2, contains photo metadata, customer IDs, object inventory, exact object sizes/versions/ETags, SHA-256 checksums, associations, and indexed ZIP entries. Indexed entries avoid embedding storage keys as extraction paths. The namespace scope is explicit; unrelated R2 objects and full customer/property/financial records are not included. The separate records backup is still required, including immutable property/address history.

Export compares complete bounded metadata and inventory observations before and after byte reads, checks object versions during reads, verifies exact sizes and referenced content types, and writes the final manifest/ZIP central directory only after coverage checks. Missing referenced bytes, conflicts, concurrent changes or interrupted reads reject/abort export. It never deletes source bytes, creates metadata, retries uploads or restores data. A download aborted after HTTP headers is an incomplete ZIP, not a successful backup; the validator rejects truncated archives. No cross-service atomic snapshot is claimed.

Bounds: 5,000 customers/photo rows/namespace objects, 20 MiB per object, 250 MiB total object bytes and 5 MiB manifest. Objects are processed individually, retaining at most one bounded object for hashing/output. These additive endpoint limits do not reduce the legacy archive's existing limits. Oversized or unsafe namespace keys fail closed and require a separately reviewed export approach; nothing is silently skipped.

## Validation and execution limits

Read-only LOCAL validation:

```sh
python3 scripts/validate-photo-storage-archive.py /path/to/archive.zip
```

The validator reads ZIP entries without extracting onto the filesystem or contacting a provider. It rejects unsafe/duplicate paths, symlinks/encryption, partial or unlisted entries, ownership conflicts, duplicate IDs/object keys, invalid counts, size/hash failures, missing identity fields, and invented orphan associations. It validates version-1 referenced-only archives conservatively and reports their missing cryptographic/full-namespace evidence without inventing it. Legacy supported restore behavior is unchanged.

`declaredNamespaceCoverageValidated` is an INTERNAL archive consistency result. `sourceNamespaceCoverageIndependentlyVerified:false` and `restoreExecutionAuthorized:false` remain explicit. Checksums cannot authenticate a forged manifest or independently prove that an omitted object never existed in the source. Candidate exports obtain source inventory observations; hosted resource identity and complete trusted recovery acceptance remain separate.

The actual existing restore CLI explicitly blocks this new complete format BEFORE any target inspection/upload/write, for both local and remote modes. No native atomic complete-photo restore executor is introduced. The existing property-record CLI restoration block remains unchanged. Native tests transport archive bytes only into fresh isolated synthetic buckets; they do not authorize provider restoration, occupied-destination overwrites or metadata creation for orphan files.

## Verification

Actual current routes/libraries were tested with disposable native D1/R2 in all three candidates. Tests cover referenced plus orphan byte/checksum preservation, transport into a fresh native bucket, missing bytes, object replacement, post-inventory record changes, interrupted exports and 15 corrupted archive variants. The framework/browser suite verifies real local auth adapters, the new Business link, archive export/validation after uncertain upload/delete responses, and no unauthorized access or source deletion. Existing restore CLI compatibility and financial regressions pass, along with all three TypeScript/build checks and shared parity. Test-only inspector routes were removed before builds. See COMPLETE_PHOTO_STORAGE_ARCHIVE_EVIDENCE.json.

Multiple-property implementation stays 5/5 scoped milestones (100%). Official release readiness remains 3/10 (30%); no new gate accepted. Gate 7 still requires hosted R2 capability/isolation, full database-plus-photo recovery and acceptance. Gate 10 still requires reviewed destination safety, complete coordinated source/resource/schema/backup seals and rollback acceptance. Gate 4/5 provider identity/definition/journal evidence, hosted auth, physical new-candidate device acceptance and authorized Stripe sandbox integration remain outstanding.

Next bounded batch: add native recovery planning/destination-conflict checks for the new format, tying referenced photo identities to a matching validated records backup and preserving orphan bytes without creating records. Keep execution blocked until occupied-destination and interrupted-save safety are independently proven. No hosted storage creation or binding change is authorized.
