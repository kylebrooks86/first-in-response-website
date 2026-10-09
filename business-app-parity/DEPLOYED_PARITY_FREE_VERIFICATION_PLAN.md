# FIRE Business App — zero-cost deployed parity verification

Status: NOT VERIFIED; read-only procedure for LIVE, Doomsday, and staging.
This is a verification plan, not permission to deploy or mutate billing records.

## Current grounded checkpoint
- Isolated LIVE/DR/staging *candidates* have 119/119 common source file hashes matched per PROGRESS_STATUS.json; this is NOT deployed equivalence.
- Formal deployed/mobile comparisons: 0/32. Production readiness: 3/10 gates.
- LIVE refund staging: https://fire-live-refund-staging.kylebrooks8605.chatgpt.site (recorded published v3; candidate not verified published).
- Independent Doomsday staging: https://fire-app-independent-staging.kyle-bfc.workers.dev (read-only public GET not reliably accessible in the available free checking environment).
- Prior read-only staging checks show 19 table names and 163 column names, but DO NOT verify types/indexes/journals, resource isolation, sandbox credentials, or remote migration safety.
- One earlier completed DR sandbox Stripe checkout USD 484 (principal 440 + tip 44) and succeeded refund USD 100 has been independently confirmed, but does not establish LIVE staging Stripe connection or event replay safety.

## Current native metadata and table blocker — 2026-10-09

Read-only native metadata confirms saved LIVE version 61/source `896b5e4125cb89da729993d1f37127e3b930c79d` and refund staging version 3/source `f7ed28a5d13ada738f5663e4f55a45c5d794c21e`; their recorded latest publish attempts succeeded. This does not seal runtime build/routing identity. Current development reliability changes are saved at `857630e20c7cc79203b76971d32ae569976588f7` and were not published.

LIVE's complete DB table-name projection contains **18/19 candidate-required tables**, missing **`payment_refunds`**. Staging matches **19/19 table names**. The new `check-deployed-table-inventory.py` exits 1 for LIVE and 0 for staging; both reports keep complete schema/resource isolation/journal/production readiness false. Exact native IDs and metadata are in `DEPLOYED_IDENTITY_TABLE_EVIDENCE.json`. No customer/financial rows were read.

Treat the missing LIVE refund table as a confirmed candidate-promotion blocker; do not infer that current legacy LIVE behavior is broken or run a migration. Independent Doomsday identity remains blocked, and no exposed tool supports its Cloudflare deployment/schema metadata. Prior blocked endpoints and completed staging column reads were not repeated. Readiness stays 3/10 (30%).

## Free, safe capture procedure
Use an existing free ChatGPT Work browser or self-hosted browser session already available; never require TinyFish paid credits, subscriptions, external test vendors, or real Stripe charges. If the browser cannot visit an authenticated page, mark BLOCKED_ACCESS rather than invent screenshots.

For **each deployed target** record exact URL, visible environment banner, build/version identity when available, and whether test account is synthetic. Never transfer LIVE production customer/payment data into staging/DR.

Use matching synthetic customer and invoice scenarios at identical browser viewport sizes (iPhone portrait first, then desktop), with light and dark themes. For each comparable state collect screenshot, short interaction result, timestamp and target build identifier.

Priority sequences:
1. Owner dashboard: header, bottom nav, drawer, Back/Home, alerts, search/scroll and dark/light appearance.
2. Customer profile: same layout; Call/Text/Email, Maps/Stride/Earth/Zillow/property preview; edit fields; payment history amounts and Copy, any Refund affordance.
3. Estimate/invoice: multi-service lines, discounts, revisions, contract agreement and signed states, share/public mobile routes.
4. Public invoice and standalone payment page: default No tip; 5%, 10%, 15%, custom, full-invoice percentage base, tip ceiling; Cash App and Venmo hrefs. Observe only; DO NOT submit checkout.
5. Payments/refunds: payment/tip separately represented; processing fees, balance due, payment history; refund pending/completed/exception states using preexisting synthetic data or mocked fixtures only; no live/refund writes.
6. Backup/restore/photos/schedule/settings: compare actions and error states without altering production records.

## Acceptance and classification
For each of the 32 strict parity evidence states from dr-parity-overlays/STRICT_PARITY_MATRIX.md assign PASS, DIFFERENT, UNVERIFIED, or BLOCKED_ACCESS and cite both target screenshots or deterministic tests.
Mark PASS only after same-state rendering and function are both examined. For DIFFERENT record exact reproduction steps and a joint fix task in all candidate repositories. A candidate-only improvement is not a deployed PASS. Avoid declaring all versions identical until every target is verified and the production release gates pass.

## Deployment blockers to resolve before staging promotion
- Verify target deployment identity and isolate real D1/resource IDs.
- Verify live schemas including types, indexes and migration journals, not just table/column names.
- Verify signed Stripe sandbox webhook routing points only to the intended staging endpoint, and mode is non-live; do not print secrets.
- Prove idempotent webhook/replay and refund safeguards in isolated synthetic tests.
- Verify auth and photo storage and prepare rollback/backup plan.
- Get owner explicit approval with concrete commit hashes and deploy destinations before modifying production.

## Next bounded work batch
Obtain comparable, authenticated **read-only iPhone-viewport** owner dashboard screenshots for both deployed staging versions. If either is inaccessible, record that as a blocker and advance a static source-level UI comparison without declaring deployed parity. Do not waste time retrying blocked endpoints or use paid tools.
