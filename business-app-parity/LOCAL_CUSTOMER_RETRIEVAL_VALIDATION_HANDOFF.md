# Local customer retrieval and backup validation checkpoint

Started from verified GitHub commit 6a7b4cb861e61085b0e94c97dd35677f398cbf78; remote branch had no newer changes. Shared inactive foundation only: no deployed app or real-record activation.

Added `getCustomer(id)` and `listCustomers()`. Reads validate stored records, preserve account/target isolation, return detached data, and settle only after native transaction completion. Aborted reads reject rather than reporting missing records. Existing revision-checked atomic writes and duplicate-operation behavior remain intact.

Added pure `validateLocalCustomerExport(value, expectedNamespace)`. Exact v1 fields, namespace, IDs, safe revisions, canonical timestamps, duplicates, operation payload references and complete per-customer revision history are checked. Unknown fields and malformed or oversized collections are rejected (10,000 customers / 100,000 operations). V1 retains all local operation history; a future pruning/acknowledgment format requires separate review. Validation never writes. This is not a full business backup or a restore API.

Validation: 56/56 native Chromium IndexedDB checks per target, 168/168 total; includes 31 invalid-backup cases per target, repeated preflight, existing-record preservation, offline reads, malformed stored rows and injected native read interruptions. All three target TypeScript checks and builds pass; shared-source parity 120/120. The additional stale Doomsday candidate manifest check initially rejected copied source; fresh materialization, build and provenance verification passed. Evidence and hashes are in LOCAL_CUSTOMER_RETRIEVAL_VALIDATION_EVIDENCE.json.

Limitations: no atomic restoration/import, local access protection, app UI integration, offline installed-app launch, Safari/iPhone testing, physical quota exhaustion, storage eviction or crash/power-loss guarantee. Browser fault injection uses real IndexedDB but is not an actual interrupted import. Existing navigation reset is preserved; iPhone whole-screen shaking is unresolved. No deployment, migration, remote DB mutation, Stripe call or paid operation.

Next bounded batch: implement customer-only atomic synthetic restore with a preflight-validated namespace and an explicit conflict policy that preserves existing records, then test invalid/interrupted/repeated imports and concurrent revision conflicts in native IndexedDB. Do not activate real business storage until access and recovery safeguards are ready.

Official production release readiness remains 3/10 (30%); no release gate passed this batch.
