# Atomic property/estimate associations — synthetic tests only

Base checkpoint: `bf43bc2e91f5ba4040efedc2595994141e79cea0`.

## Actual shared implementation

The existing estimate creation API now selects an active customer-owned property authoritatively when both the property capability and `FIRE_PROPERTY_ESTIMATES_CANDIDATE=synthetic-tests-only` are set in development. This second switch is off in normal builds and ordinary property-management candidates. Property customers' estimate buttons remain disabled until backup/recovery and complete UI integration are verified.

- One active property is selected by the server without another required selection step. Multiple active properties require an explicit property ID and revision. Wrong owner, stale revision, inactive property and no active retained property are rejected.
- The server captures the property address plus building/unit/area label, rather than trusting the mutable customer default or submitted address. Estimate, address snapshot, immutable property link and line items use one actual D1 batch.
- Database guards verify customer ownership, property activity/revision, exact snapshot address/time and the sole-active count at insertion. Historical links reject update/delete. Archiving a property does not change prior estimates or documents.
- Estimate, invoice and customer-history API responses expose the correct property association. Public estimate/invoice/payment documents retain the captured service location. Repeat estimates receive separate identities.

## Verification limits

Native workerd/D1 tests exercise the actual shared routes under synthetic authentication. Transaction-injected archival and addition of another property simulate state changes after selection; both failures roll back estimate/snapshot creation and the injected property mutation. This does not claim an independently concurrent external database writer test.

Final results are in `PROPERTY_ASSOCIATION_EVIDENCE.json`. No new candidate was published. No production schema, payment, customer record, installed app, device vault or backup was changed. Existing installed iPhone/iPad apps are owner-confirmed smooth; new candidate installed-device acceptance remains pending. No CSS changed.

## Next priority

Property-aware backup/recovery must preserve both property rows and immutable links, validate identity/ownership/coverage and reject occupied/conflicting destinations atomically before user-facing creation is enabled. The existing fail-closed property backup/import guards remain active. Complete the new-estimate property selector and in-dialog property creation only after that recovery workflow is verified; adopt authoritative returned addresses in the UI save receipt.

The five property milestones have three candidate-source/native milestones verified (records, profile selection, atomic associations); portable recovery and full user-facing workflow remain pending. This scoped 3/5 progress is not release readiness. Official release readiness remains 30% (3/10 gates).

Gate 4 review is in `GATE4_PROVIDER_EVIDENCE_REQUEST.md`. New runtime reads succeeded for LIVE/staging; physical D1 mappings and complete artifact seals are still missing. No request was sent to support.
