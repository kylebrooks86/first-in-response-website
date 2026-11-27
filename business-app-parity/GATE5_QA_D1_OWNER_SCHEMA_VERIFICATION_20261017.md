# Isolated QA D1 schema verification — owner screenshots, 2026-10-17

Scope: **new QA database only** `fire-fullapp-qa-db-20261016` (UUID `8ccfb1f8-1657-4074-b1b2-47de78f95003`). Evidence: sequential owner-provided Acer Windows PowerShell photos. No independent server-side execution by this assistant.

## Observed read-only post-migration results

- Cloudflare CLI reported QA migrations applied; screenshot of the final migration list shows green checks through `0022_stripe_provider_uniqueness.sql`.
- Initial `npx` call was blocked by PowerShell execution policy. `npx.cmd` succeeded. A subsequent `migrations list` without a Wrangler config failed; owner instead used direct read-only D1 queries against the **named QA database**.
- `sqlite_master` table-name query returned application tables including `customers`, `customer_photos`, `estimates`, `invoices`, `payments`, `payment_refunds`, and `d1_migrations`.
- Migration 0022 journal count: **1**.
- Index `idx_payments_stripe_provider_unique` on `payments`: **1**.
- Duplicate payment provider ID groups under checked `cs_*` / `refund:*` patterns: **0**.
- Screenshot outputs explicitly say `Executing on remote database fire-fullapp-qa-db-20261016` with the new QA UUID.

## Acceptance limits

This confirms **owner-observed QA-only remote schema and journal evidence**, not an independent database snapshot or complete end-to-end app test. It does not establish that all tables/indexes/foreign keys or all 23 journal rows were individually checked, nor that a Worker is published, authenticated, or installed. No additional remote migrations should be run without a fresh reason and guarded review.

Next: review the QA-only Worker runtime, private credential provisioning procedure and first-deployment safety preflight. Do not publish or upload credentials by default. Existing LIVE, refund staging, Doomsday, R2, Stripe and iOS vaults remain outside this test scope.

Official release readiness remains **3/10 (30%)**.
