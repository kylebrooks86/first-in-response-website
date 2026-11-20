# Property backup validation checkpoint

Base: `76eb81068a0bee6ceb9efb435fbdd895a0baa536`.

The shared property backup contract validates exact property/link fields, canonical timestamps, IDs, customer/estimate ownership, current supported lifecycle revisions, immutable address/time agreement and declared coverage. It accepts retained archived properties and historical sole selections without re-evaluating the current property count. Genuine legacy packages remain valid without inventing links. It provides the manifest builder for the next export/restore implementation; this does not enable property export or recovery.

API and both file workflows now reject property metadata declarations even when both property tables have been stripped. Existing table guards remain intact. Native workerd/D1 route tests verify these rejection paths under synthetic auth with property capability off. CLI apply remains blocked, and property-enabled candidates still block backup/export and ordinary property estimate creation.

## Verified checks

See `PROPERTY_BACKUP_VALIDATION_EVIDENCE.json`: 28 property contracts, 8 file guards, 13 existing location contracts, 7 SQLite property schema checks, 21 native framework/browser checks across three candidates, 207 financial regressions, three TypeScript checks, three complete builds and 146 matching shared source files. Initial dependency/browser setup failures were resolved before final passing checks. Native property restoration, hosted authentication and physical devices were not tested by this batch.

## Next bounded implementation

The existing `estimate_property_ownership` INSERT trigger enforces current activity/revision and sole-active counts. Directly inserting historical links for an already archived property will fail. Implement a reviewed synthetic-only atomic restore path that validates captured history independently of present activity while preserving the normal estimate-creation guards. Do not bypass or drop those guards broadly. Verify on native D1: archived property plus historical link, full rollback on injected failure, occupied destination and in-transaction occupancy races, incomplete coverage, wrong ownership and legacy recovery. Keep CLI apply and user-facing creation disabled until the safety evidence exists. Photo recovery remains separately governed.

Three of five property milestones remain complete (60%). No release gates advanced: 3/10, 30%. Gate 4 still needs immutable physical LIVE/refund-staging resource mappings; do not retry unavailable provider endpoints. No deployments, production database changes, financial actions, device changes or paid services occurred. Existing smooth installed iPhone/iPad apps remain untouched.
