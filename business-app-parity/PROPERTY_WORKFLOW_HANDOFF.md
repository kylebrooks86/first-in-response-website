# Complete property-to-estimate workflow — isolated candidates only

Base: `a7eedc3dc93e65eee96b94ce89d1cd3abcbe25ae`.

## Implemented behavior

The existing profile property selector now connects to New Estimate under a separate development-only `FIRE_PROPERTY_WORKFLOW_CANDIDATE=synthetic-tests-only` switch, requiring the already verified snapshot/property/association/recovery switches. Normal builds and ordinary property candidates remain disabled. No production activation or migration occurred.

New Estimate independently reloads and validates properties. A sole active property selects automatically; multiple properties need a deliberate choice. Selection preserves whether it was automatic or explicit. The server and existing native insertion guard reject a changed sole-active count, wrong owner, archived property or stale revision. The selected property can be beyond the first 50 rows: the API returns a separate customer-owned selected-property lookup without changing its bounded keyset page. The dialog can safely add a new property using the existing authenticated route and uncertain-save protection. Closing the dialog refreshes profile properties.

Saved receipts and optimistic estimate rows now use the server-confirmed address/property identity, never the typed/default address. A quiet profile reload retains the successful receipt. Historical snapshots, invoice/payment/document associations and audit histories are unchanged. The native UI test also checks the captured public estimate address after default-address edits and property archival; earlier committed native association evidence remains the invoice/payment/history proof.

Conflicts return to property review while retaining services/pricing. Lost, malformed or 5xx save responses block another save and offer a read-only stored-estimate review. A synchronous lock prevents duplicate in-flight handler calls. Closing an uncertain draft requires a specific warning that the estimate may already exist. No automatic mutation retry occurs. This in-session protection is not durable offline draft recovery or global request idempotency; those remain separately governed offline/release work.

## Evidence and limits

`PROPERTY_WORKFLOW_EVIDENCE.json` records final native workerd/D1 browser runs for all three adapters with workflow enabled and capability off, financial regressions, TypeScript, builds and shared source parity. The lost-response fixture forwards the real POST to disposable D1, then returns synthetic 503, verifying exactly one stored estimate and a blocked additional save. Real hosted authentication, deployed parity, production data, physical iPhone/iPad acceptance and provider actions are not inferred.

All five scoped property milestones are verified in isolated candidate implementation/native tests (100%). This is not app release completion: official readiness remains three of ten gates (30%). Candidate activation needs target schema compatibility, identity isolation, auth/storage/device/sandbox/rollback evidence and exact owner-approved rollout.

## Next bounded task

Prepare an exact target-specific property/snapshot migration and rollback package from the final shared schema and each target's existing journal. Reconcile available remote schema/journal evidence read-only. Gate 4's immutable physical LIVE/refund-staging database mappings and complete artifact linkage remain unavailable; follow the existing provider evidence request without repeating unavailable endpoint attempts. Do not apply schema, deploy or change any installed app or backup.
