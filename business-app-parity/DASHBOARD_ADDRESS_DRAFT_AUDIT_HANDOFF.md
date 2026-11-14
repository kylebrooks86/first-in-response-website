# Dashboard address, draft and communication audit integration

Base checkpoint: `78cbba2b43da4dbe0d16a9a806b555d1b91124e8`.

Scope: shared development source only. No deployments, migrations, customer-data modifications, Stripe actions, paid services or device-vault changes.

## Functionality

- Both customer-profile navigation paths retain the selected estimate's service address and provenance. Null is normalized to undefined solely for the existing detail type; no mutable customer-address substitution occurs. Captured blank addresses stay blank. Legacy provenance remains unverified, not reconstructed.
- The composer retains manually edited text through late template and share-link responses and close/reopen while mounted. Explicit template replacement requires confirmation. Choosing “Not sent — keep editing” preserves the exact prepared text. Stale responses from closed effect instances cannot change template/link state. This is in-memory draft protection, not reload-safe encrypted draft persistence.
- Confirmation remains an append-only backend event. The customer history groups only the exact `prepared-id:owner-confirmed` identity when customer, estimate, channel, template and body all agree. Both timestamps are displayed and both audit events remain in the database and backups. Orphans, legacy interactions and mismatches stay separate. Identical text is never used as a deduplication identity. Repeated callbacks replace only the same ID in the local display list.

## Reference review

Reviewed `FIRE_Dashboard_Three_Fix_Atomic_Integration.zip`. Its ID-only proposal would not group the backend's new confirmation record; that portion was replaced with exact audit-event pairing. Its scripted/model checks were not treated as browser proof.

## Verification scope

Final results are recorded in `DASHBOARD_ADDRESS_DRAFT_AUDIT_EVIDENCE.json`. Earlier concurrent build/browser runs failed on existing fixture item visibility and request timeout; the next run exposed an incorrect fixed-count assertion because another test creates an additional communication. The assertion now checks actual fixture audit counts and unchanged audit records. Failed runs are not counted as passes.

## Remaining blockers

- Multiple-property management is not implemented by this batch. Next: customer-owned active properties and explicit multi-property selection, preserving immutable estimate snapshots, transaction ownership and additive backup coverage behind a development-only gate. No production schema changes are approved.
- CLI service-address snapshot restore remains blocked pending native atomic verification; the verified owner API workflow is unchanged.
- Gate 4 still lacks immutable LIVE/refund-staging physical database identities and complete deployed artifact/runtime isolation evidence. Other pending release gates remain open.
- Owner confirms existing installed iPhone/iPad Home Screen apps scroll smoothly. Shaking is not an active defect for those apps. New candidate installed-device/deployed parity remains pending; no speculative CSS changes.

Official readiness: **30% (3/10 gates)**. Source/tests/builds do not prove deployed acceptance.
