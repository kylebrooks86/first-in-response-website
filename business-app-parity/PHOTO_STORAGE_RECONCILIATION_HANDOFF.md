# Read-only photo reconciliation and isolated byte recovery

Base checkpoint: 73e943fd833cf1461802f296694d8e7959ae5970. Shared app source and independent Doomsday source are updated; deployments and provider resources are unchanged.

## Implemented

Owner-authenticated GET `/api/backup/photos/integrity` returns a read-only comparison of customer/photo metadata and the `customers/` R2 namespace. It checks valid customer relationships, IDs, safe keys, duplicate identities/object references, recorded sizes/content types and listed/head object versions. It scans every inventory page twice and compares metadata before/after; interrupted, incomplete, repeated-cursor or oversized scans fail closed. Bounded limits are 5,000 customers, metadata rows and objects. Queries read at most 5,001 rows to detect overflow. This diagnostic limit does not reduce the existing archive export limit.

Unreferenced objects are listed as retained evidence, never deleted or automatically restored. No mutation/retry endpoint or cleanup plan is generated. Missing storage returns 503 while preserving records. Any unexpected read failure returns 503 `inspectionUncertain`, not a clean inspection. Owner and non-owner checks use each candidate's actual local auth adapter in browser/runtime tests.

The report explicitly states `recoveryReady:false`, `snapshotAtomic:false`, `photoBytesVerified:false`, `cleanupAuthorized:false` and `writesAttempted:0`. Equal observations cannot prove a transaction spanning D1/R2, account-wide storage completeness, ownership of orphan bytes, or byte-level backup/recovery. The namespace scope is customer photo objects only. Object versions are compared as well as ETags, because identical bytes can be re-uploaded with changed metadata.

Both existing archive exporters keep supported format/version 1 and add truthful scope flags: referenced photos only, orphan storage files excluded, non-atomic export and separate records backup required. Existing backups are untouched. The current archive cannot preserve all retained orphan objects. Complete storage archival/reconciliation remains unfinished and Gate 7 stays blocked. No destructive cleanup is safe merely because metadata has no matching row.

## Native verification

`node scripts/test-photo-storage-integrity.mjs` runs from each materialized candidate with its installed TypeScript and an explicitly supplied installed Miniflare path when necessary. It loads actual current route/library source, uses disposable native local D1/R2, validates read-only reconciliation and the real existing ZIP exporter, extracts a referenced synthetic image, and transports it into a fresh isolated native bucket with byte-for-byte verification. This is referenced-byte export/transport evidence, not acceptance of the production restore CLI or full database/photo disaster recovery. No new restoration executor is introduced.

The framework/browser photo suite also calls the new route after actual native failed insert and lost HTTP acknowledgements, verifies the retained orphan count and remaining referenced record, proves no objects were deleted by inspection, and rejects unauthenticated access. Test-only storage inspection endpoints are removed before final candidate builds; no fixture route appears in the build route inventory.

Compatibility tests use synthetic ZIPs and a fake local Wrangler; distinguish those from native byte tests. Financial regressions and all three TypeScript/build checks pass. See PHOTO_STORAGE_RECONCILIATION_EVIDENCE.json.

## New owner screenshot — Gate 7

The screenshot attached as IMG_1889(1).png was visually reviewed in the conversation. It shows Workers & Pages, a title truncated as `fire-app-independent-sta...`, Production selected, and the Bindings table containing D1 `DB` → `fire-app-staging-db`, followed by the Observability section. No R2 binding is visible. The owner identifies the Worker as independent Doomsday. This corroborates the existing missing photo-storage binding blocker; it does not prove immutable physical D1 identity or source/artifact linkage. Only a secret variable label and encrypted-value placeholder are visible; no secret value was read or saved.

No R2 bucket was created, no binding or deployment was changed, and no hosted record was accessed or modified. Do not repeat the screenshot request. Supported production photo recovery requires separately reviewed storage capability/isolation and acceptance; an absent binding cannot be resolved by more local tests. LIVE/refund-staging immutable resource mapping remains the existing provider-support request, not something this screenshot establishes.

## Progress and next task

Official release readiness stays 3/10 (30%); multiple-property implementation remains 5/5 scoped milestones (100%). Gates 4–10 remain unaccepted. Native/photo tooling progress does not advance hosted gate acceptance.

Next bounded batch: design and implement a bounded complete photo archive format that preserves both referenced files and retained unreferenced bytes, with SHA-256 coverage and conservative validation of missing/conflicting data. Preserve supported older archive formats. Keep mutation/recovery execution blocked until native isolated destination-safety tests and an exact coordinated release/backup packet are verified. No hosted storage change is authorized.
