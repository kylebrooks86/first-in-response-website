# Read-only QC handoff — 2026-10-08

Work is the sole implementation writer. Base GitHub commit e516af3 rechecked unchanged. Review the isolated branch `work/fire-business-app-parity-2026-10-08`, folder `business-app-parity`. Do not modify branches/resources. Candidates are NOT deployed/merged.

New synchronized code: Stripe principal/tip/refund provider unique index with non-destructive collision preflight; exact ledger count and original job/payment refund verification; pending-refund/invalid-billing collection guards; conditional first-view/acceptance notification insertion; pre-write restore relationship/provider validation. Restores reject invalid relationships and immutable conflicts without writes. Missing succeeded refund acknowledgement can repair exactly once without issuing another refund.

18/18 shared suite executions (six suites × LIVE/DR/staging migration histories), 3/3 TypeScript checks, 3/3 production builds, plus LIVE Owner Account/navigation suite passed. All Stripe calls are mocked and databases disposable SQLite. This is not deployed Cloudflare/Stripe integration proof. Shared-source hash gate: 113/113; nine explicit authentication/environment adapters require separate verification. Local candidate commits are recorded in CANDIDATE_COMMITS.json.

Actual deployed: LIVE already has customer tools, all five edit fields and Owner Account. DR Payments has tip metric/refund actions; LIVE lacks them. LIVE has weather/Insights; DR lacks them. Staging has one synthetic payment, no refund rows, and correct fee/gross/tip columns; schema indexes/journal are not exposed by the connector. No database/deployment/secrets/login/pricing/customer record changes occurred.

Open blockers: exact deployed DR identity/PIN adapter, remote index/journal and historical collision preflight, full sandbox Stripe webhook/refund roundtrip, independent free photo storage, iPhone light/dark evidence, rollback backups and release manifest seals. Current Work runtime has no Cloudflare API credential; no paid resource was activated.

Formal saved baseline remains 11/32 LIVE captures, 0/32 independent captures, 0/32 verified comparisons. New read-only DR Payments desktop screenshot is separate current evidence with identity pending; it does not close iPhone/strict equality gates. Never equate passing local tests with production readiness.

QC priorities: adversarial duplicate provider data before index; corrupted negative ledger job/type/amount/count; stale pending/failed events after succeeded; incomplete/malformed backups; verify migration tool tracking (Wrangler SQL inventory versus incomplete Drizzle journal) before suggesting replay. Do not recommend removing richer DR features to reduce differences.
