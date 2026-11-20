# Property schema upgrade and rollback preflight

Base checkpoint: 25c9bdef8d062d58a8df89bef4d8b198cd8f3a74. This batch completes the previously preserved review-package generator and integrates the independent WAL correction's safety requirements into the shared release tooling. It does not install a migration or change an application route.

## Review package

`python3 business-app-parity/build_property_upgrade.py` produces additive review SQL under `release/property-upgrade`, outside all active migration directories and journals. LIVE/staging pin 21 existing migrations and propose names 0021/0022; Doomsday pins 23 and proposes 0023/0024. Source SQL matches the existing reviewed candidate definitions. Every historical and proposed SQL file has a SHA-256 checksum. Existing migration histories, journals and historical records remain untouched; no backfill invents a historical address or property link. Manifest flags refuse execution and production approval.

## Read-only preflight

From the repository root:

```sh
node business-app-parity/shared/scripts/property-upgrade-preflight.mjs LOCAL_SQLITE_FILE CANDIDATE_ROOT business-app-parity/release/property-upgrade/manifest.json live
node business-app-parity/shared/scripts/test-property-upgrade-preflight.mjs "$PWD"
```

Choose each target explicitly. Use only an identified disposable LOCAL SQLite mirror; this utility has no provider or remote connection. It opens an existing file read-only, enables query-only protection, and reads schema/journal/aggregate counts in a single read transaction. Connection foreign-key enforcement is enabled. It does not use immutable mode: committed WAL schema must remain visible. A missing file is never created. Tests verify that database/WAL byte hashes are unchanged by inspection.

Full table/index/trigger/view definitions must match the pinned baseline or complete upgrade. SQL whitespace inside literals is never normalized away. Absent, partial and complete schemas are distinguished; unknown objects, altered definitions, weakened same-name triggers, changed SQL checksums, incomplete/duplicate journals, FK violations, unreadable financial queries and financial/property anomalies block the report. Financial preflight queries come from the adjacent shared source, not an arbitrary caller-supplied file.

An exact baseline reports eligibility for a separately approved upgrade review. An exact complete candidate reports local property-schema readiness. Neither result establishes resource identity, hosted acceptance, backups, deploy approval or production readiness. The generic reader adapter requires its caller to provide one consistent read snapshot; the local file adapter enforces this. Missing metadata fails closed rather than guessing a migration state.

## Rollback decision

A legacy-app rollback is incompatible once any property/snapshot/link record exists. The tool never authorizes schema removal, including on an empty database. Data-bearing rollback must retain additive tables and all history, use a reviewed compatible app/feature-off path, and verify complete database plus photo recovery before coordinated approval. No inverse DROP script or migration executor is included. The existing CLI backup restoration restriction remains unchanged.

## Evidence and limitations

See PROPERTY_UPGRADE_PREFLIGHT_EVIDENCE.json. Native tests use disposable local Miniflare/workerd D1 bindings, no credentials or remote resources. They validate each target's full baseline, native atomic rollback of DDL plus journal inserts after a deliberately failing statement, complete upgraded schema, retained-record rollback refusal and immutable-trigger enforcement. Native batch safety is not proof of provider migration-CLI or backup-restoration safety.

The independent WAL handoff was read from FIRE_Property_Schema_Preflight_WAL_Corrected.zip; its eight isolated Python checks also passed. Its name-only inspection is deliberately superseded here by full-definition checks. Its old usage paragraph still mentions immutable mode, but the corrected code and WAL correction explicitly prohibit that; this implementation follows the corrected code.

Gate 4 remains missing immutable physical LIVE/refund-staging DB mappings and deployed artifact/source linkage. Supported Sites table-name metadata is insufficient for Gate 5, including the observed LIVE missing payment_refunds table. No unavailable provider endpoint was retried. Hosted authentication, R2 capability/isolation/recovery, new-candidate physical iPhone/iPad acceptance, authorized Stripe sandbox testing and final rollback/source/resource seals remain outstanding. Existing installed apps' smooth scrolling is accepted and not reinvestigated.

Multiple-property implementation remains 5/5 scoped milestones (100%). Official readiness remains 3/10 release gates (30%). No production deployment, database/migration/customer-data change, Stripe/credential action, existing backup/device-app change or spending occurred.

Next bounded batch: implement a read-only photo metadata/object reconciliation report and test interrupted storage outcomes and complete photo recovery with disposable native D1/R2 fixtures. Never automatically delete retained orphan bytes.
