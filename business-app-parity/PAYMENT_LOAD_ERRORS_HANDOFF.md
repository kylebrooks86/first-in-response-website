# Payments request failures and retry — October 9, 2026

Parent checkpoint 0da9627eac38c2c1414161ec0f930b09f02c0894 was clean and matched remote head before editing. FIRE Business App only.

Payments previously ignored non-OK responses and defaulted missing collections to empty. A request failure could produce zero totals / All caught up; rejected requests also lacked an error handler. Shared PaymentsView now checks both statuses, requires both arrays, prepares both replacement collections before setting either, catches failures and displays an accessible error with Try again. Metrics, fee report and payment/refund controls are hidden during loading/error. Prior records remain in state after failure; a successful retry restores current data and genuinely empty results remain valid. Payment calculations, collection/refund handlers, APIs, schemas and adapters unchanged.

825/825 new checks (275 per target) execute actual component hooks, load effect and retry event handler with mocked reads. Cover job/payment HTTP rejection, generic server error, network rejection, bad JSON, missing/malformed collections and non-Error rejection with empty and previously populated state; verify hidden misleading zero/empty summaries, retained old records and recovery. Successful numeric conversion also checked. Prior component fails the negative control.

12/12 selected runs pass: new error suite, payment received-status (294 checks), payment mobile structure (33), public tip layout (48). TypeScript and builds 3/3 each. Actual materialized shared application source 119/119 matches; new script separately identical across targets. Snapshot commits/paths/hashes are in PAYMENT_LOAD_ERRORS_EVIDENCE.json. No new dependencies or hosted requests by these tests.

Overall verified readiness: 30% (3/10 release gates). Deployed/mobile comparisons 0/32; complete remote schemas/journals 0/3. Candidate evidence is not browser/mobile/processor integration proof. No deployment, remote database/Stripe write, paid service or production change.

PAYMENT_LOAD_CANDIDATE_MANIFEST.json seals current working-source hashes and review inputs; prior manifests remain historical and will reject newer source when verified. Publication remains blocked.

Next bounded task: review invoice-list error handling and recovery, which still defaults failed reads to empty results. Use the same honest loaded/error behavior without changing invoices or payment calculations; then verify related candidate flows. Continue overnight work from latest remote head, preserving newer work. Other chat remains independent read-only QC; do not duplicate edits. Deployment identity, complete schema/journal compatibility, sandbox isolation, auth/storage adapters and actual mobile evidence remain release blockers.
