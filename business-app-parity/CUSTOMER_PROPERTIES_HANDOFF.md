# Actual shared customer property management — development only

Base: `45b14984d4549b3f5440c7ece9ff6809b302d856` on `work/fire-business-app-parity-2026-10-08`.

## Integrated functionality

- Real owner-authenticated `/api/customer-properties` route and compact Properties section inside the existing customer profile. No new main navigation.
- Separate customer-owned property identities with address and optional building/unit/area designation. No fixed application limit per customer; 55 retained properties verified. Reads use bounded 50-record keyset pages, with full-customer active counts and a sole-active-record query.
- Automatically selects the sole active property in this section; multiple active properties require explicit choice. **Selection is not yet consumed by estimate creation.**
- Deliberate, revision-checked archival retains the original property record. Concurrent archive attempts permit exactly one transition; a stale/wrong-owner attempt conflicts. No deletion, automatic merge or address editing.
- Property identity/address/label/owner are immutable at the database layer. Existing default customer addresses and historical estimate snapshots remain unchanged.
- An uncertain save retains address/label inputs, blocks another write, and offers a deliberate read-only stored-list review. No automatic mutation retry.

## Gating and incomplete paths

`FIRE_CUSTOMER_PROPERTIES_CANDIDATE=synthetic-only` requires the snapshot capability and is emitted only for development. Normal builds disable it. The reviewed SQL is outside all migration journals and was applied only to disposable local fixtures.

Property-associated estimate creation is **not implemented or enabled**. Customers with retained properties are blocked from creating estimates in the gated candidate until associations and recovery are verified. Customers with no properties retain the original workflow. Normal capability-off builds and databases without the new table were tested.

Property-aware backup/recovery is **not implemented or enabled**. Candidate export/import is blocked while the property capability is on, so a partial export cannot silently omit property records. API import, CLI restore and file validation reject property-bearing packages, even when the capability is off. The original formats remain supported outside this incomplete property feature. These are fail-closed guards, **not successful property backup/recovery proof**.

## Verification

See `CUSTOMER_PROPERTIES_EVIDENCE.json`: final feature-on/off native browser runs, schema contracts, backup file rejection checks, financial regressions, three builds/TypeScript checks and 144 shared-file parity. An initial parallel LIVE browser process ended before completing verification; it is not counted as a pass. Final runs were separate from builds and complete for all targets. Initial D1 result-typing errors were corrected before the final build.

## Next bounded task

Add immutable estimate/property links with exact customer ownership, authoritative server selection and atomic snapshot capture; then integrate property-aware backup/restore before enabling creation. Correct invoice/customer-history associations must follow the estimate identity and historical snapshot, never the mutable customer default. Do not deploy or apply production migrations.

Address editing/reactivation, linking pre-existing estimates, in-dialog property creation, and portable property recovery remain incomplete. No auto-backfill, merge or reassignment is authorized. The schema presently supports archival only.

Official release readiness stays **30% (3/10 gates)**. Gate 4's physical LIVE/refund-staging resource identities and full deployed artifact/runtime isolation evidence remain unavailable. No release gate is advanced by this batch. Owner confirmed that existing installed iPhone and iPad Home Screen apps scroll smoothly. Shaking is not an active defect for those apps; new candidate installed-device validation remains pending. No speculative CSS changes.

No production deployments, migrations, financial actions, paid services, device recovery, customer-data modifications, or changes to existing Home Screen apps, calculator or backups.
