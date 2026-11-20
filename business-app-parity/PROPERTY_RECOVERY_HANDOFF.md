# Native atomic property recovery — development candidates only

Base: `61e214e6bc37d0cb8c682e327e29b5170bd7a32c`.

## Actual implementation

The shared backup API supports complete property-aware export and recovery only under `FIRE_PROPERTY_RECOVERY_CANDIDATE=synthetic-tests-only`, in addition to the existing development property/snapshot switches. Ordinary candidates and production builds retain their fail-closed guards. Customer-facing property estimate creation and CLI property apply remain blocked.

Export reads all supported record tables, photo metadata, retained property rows, immutable links and service-address snapshots in one native batch. It validates relationships/refunds/photo metadata and creates explicit property/snapshot coverage manifests. Recovery requires all declared record tables and exact compatible record columns; it refuses unknown or incomplete content, unsafe photo metadata, owner/address/link mismatches, missing schema, missing or incompatible native emptiness guard, and occupied destinations. Both legacy formats still pass through existing supported normalization and recovery without inventing historical property records. Legacy recovery is refused against retained properties.

The reviewed synthetic schema adds a transient recovery guard. Its INSERT trigger checks every supported record table inside the same D1 transaction. During that transaction, historical link insertion can validate captured ownership, address and time independently of current property activity or today's active-property count. Normal active/revision/sole-count guards remain in force outside this permit. The permit is deleted before commit. A normal estimate cannot select an archived property after restoration.

All inserts and permit cleanup use one actual D1 batch. No INSERT OR IGNORE or merging is used. Open checkout sessions are explicitly expired and pending refunds explicitly failed; no Stripe/network financial action occurs. Every other supported record field, including audit/message/revision history and photo metadata, is retained. Photo bytes remain a separate archive requirement. The transient permit is not a backup business record.

A thrown batch call can be a transport-uncertain outcome: the response reports `writesCommitted: null`, requests destination inspection before retry, and performs no automatic retry. It does not falsely promise that a lost response means no commit. Native late-abort and in-transaction write injections prove rollback in disposable D1; they are not an independently concurrent external-writer or lost-network-response test.

## Verification

Final evidence: `PROPERTY_RECOVERY_EVIDENCE.json`. Three actual framework/auth-adapter/browser runs on native local workerd/D1 cover archived history, all retained records, rejected corrupt coverage, missing guard, late rollback, injected occupancy race, competing restore requests, occupied repeats, provider state deactivation, historical APIs and legacy recovery. Additional shared property contracts, file/CLI guards, schema contracts, financial regressions, TypeScript, builds and source parity are recorded there. No hosted authentication or real-device acceptance is inferred from fixtures.

## Progress and next task

The property backup/recovery milestone is verified in isolated candidates: four of five property milestones (80%). The complete customer-facing estimate workflow is the remaining milestone. Connect selected properties to New Estimate, preserve automatic sole selection and explicit multiple selection, use the returned authoritative address, and handle stale/archive/owner mismatch/interrupted saves. Keep user-facing creation disabled until those integration tests pass. Review and test in-dialog property creation only if safely bounded.

Production release readiness remains three of ten gates (30%). Gate 4 still lacks immutable physical LIVE/refund-staging database identity and complete deployed artifact linkage. Do not retry unavailable provider endpoints. Existing installed iPhone/iPad apps remain owner-confirmed smooth and untouched. No production deployment, migration, customer/payment write, provider action, device/backup change or paid resource occurred. SQL remains outside migration journals and was applied only to disposable synthetic fixtures.
