# FIRE Business App parity audit — 2026-10-08

**Status: isolated candidate checkpoint; production release blocked.** Business Command Center is excluded, as are marketing sites and calculators. No deployment, production database write, environment-variable change, paid service activation, or real payment occurred in this audit.

## Deployment evidence

| Target | Observed version/source | Evidence and limits |
|---|---|---|
| LIVE | Sites v61, commit 896b5e4125cb89da729993d1f37127e3b930c79d; runtime reports 105 | Native deployment inventory and exact source checkout obtained. Authenticated Owner Account, customer tools/edit fields, Payments, Templates, Insights, Business, invoices and Schedule inspected read-only. Full workflow/mobile parity remains open. |
| Refund staging | Sites v3, commit f7ed28a5d13ada738f5663e4f55a45c5d794c21e; runtime reports refund-staging-ebc670f | Public synthetic invoice opened in cloud browser. Tip selection updates the total; direct Cash App and Venmo links present. Owner page requires sign-in. Runtime version label is stale relative to published UI. |
| Independent Doomsday | GitHub reference e516af3ce93368450cd3d02906d117116d090f3e | Reconstructed sealed v138 archive plus governed overlays. This is reference source, not proof of the deployed commit. Secure four-digit PIN sign-in completed. Owner Account and existing customer profile inspected; approved command-center links and Edit customer present. The identity endpoint navigation was blocked by the browser client, so deployed commit remains unverified. |

Only these active Business App deployments were identified in the available inventory. Historical rollback copies must remain immutable, rather than be rewritten to resemble current releases. Additional deployments, if discovered, must be registered and audited before claiming coverage of all versions.

## Difference report

The complete file-level baseline comparison is in FIRE_SOURCE_DIFFERENCES.json: 47 differing or target-only files across application code, components, assets, libraries, and schema source. The raw GitHub app folder is not the complete Doomsday app: its preparation overlays are essential.

| Area | Difference found | Candidate action / remaining verification |
|---|---|---|
| Owner account | Environment wording and implementations differ | Shared component accepts LIVE/DOOMSDAY/STAGING. Existing auth adapters retained separately; no password/PIN management buttons added. |
| Customer command center | Different component implementations; approved contacts/property tools present in prior LIVE candidate | Shared implementation preserved: Call/Text/Email/Maps/Stride/Earth/Zillow/property preview. Encoded-link tests pass. LIVE and DR owner-browser links observed; fields inspected without saving. |
| Customer editing | Different implementations and validation paths | Existing LIVE candidate editing preserved; PATCH tests verify identity/history preservation and invalid-input rejection. No duplicate customer creation. |
| Final-payment tips | Prior deployed staging had narrow five-button row; Doomsday overlay supplies reference layout | Shared reviewed invoice candidate uses two mobile columns and full-width Custom, preset dollar amounts, optional default, and desktop five-column rule. Mobile screenshot equivalence remains unverified. |
| Manual payment options | Plain-text versus styled cards; Venmo URL differs | Shared green Cash App/blue Venmo cards and direct business-profile links; canonical Venmo /u/ URL. Actual href-expression tests pass. |
| Payment history | Long raw processor references versus shortened reference/Copy | Short reference and Copy action now in customer/payment history. Fee and tip detail remains separate. Clipboard on iPhone still needs review. |
| Refunds | Older Doomsday retry/failure handling versus stronger LIVE candidate | Robust shared per-payment helper/API/webhook logic carried into candidates; pending reservations, idempotency, limits, tip separation, atomic recovery tested. |
| Manual processing fees | Different migration numbering and history presentation | Shared gross/fee/net workflow and reports preserved; no forced Cash App estimate; invoice receives principal credit. Tests pass. |
| Backup/restore | Doomsday includes richer relationship/refund validation and restore audit | Ported merge-only validation/audit to shared route and fixed TypeScript errors. Fee/refund/legacy-backup round trips pass. New orphan-estimate/payment and immutable payment/customer conflict tests reject before writes. General relationship validation now runs before restore writes. |
| Weather, photos, analytics | LIVE has dashboard/schedule weather, before/after composer, analytics additions absent from prepared DR reference | Shared LIVE implementation included in all candidates. Weather refresh, image persistence, and analytics need authenticated deployed review. |
| Notification lifecycle | DR reference has uniqueness migration/normalization; LIVE lacks same deployed constraint | Restore normalization included. Conditional lifecycle INSERT SQL passes stale/repeated-view/acceptance replay tests. No historical dedup migration is replayed. |
| Estimate validity/mobile history | DR overlays include distinct validation/navigation guards | Estimate snapshot/amount validation and pending-refund/overage guards now shared and tested. Mobile history still requires on-device verification. |
| Migrations | LIVE and DR use different numbering for refunds/fees | DR candidate preserves DR history; LIVE retains LIVE history. Never replay, renumber, or replace applied production migrations. Compare actual schema and applied journal before release. |
| Storage | LIVE uses managed DB/object storage; independent deployment reference has D1 without configured R2 | Photo and photo-backup parity cannot be declared until an existing free compatible binding is verified. No service activated. |
| Authentication | Managed owner-only ChatGPT sign-in versus independent PIN/signed-cookie controls | Explicit security adapter boundary. The reconstructed DR adapter needs verification against actual deployed PIN preparation; candidate is not ready for independent deployment. |
| Release identity | Native/source/runtime labels differ | Capture exact deployed commits and generate consistent candidate release identity before approval. |

## Workflow coverage

| Screens/workflows | Current evidence | Required remaining evidence |
|---|---|---|
| Dashboard, mobile header, light/dark, navigation | Shared source; owner navigation/theme tests | Authenticated views and actual iPhone layout |
| Customers, profile, contacts, edit, lead source, notes, property/photos | Customer PATCH and contact link tests; shared source | Field use, save/reopen, photo persistence, light/dark iPhone |
| Estimates, services, discounts, scheduling, acceptance/signature/change requests | Shared source; financial revision/session invalidation regression tests | End-to-end synthetic owner-to-customer flow, historical document preservation review |
| Contracts and public estimates | Shared source; public owner floating controls absent | Deployed signature and document layout audit |
| Invoices, revisions, public invoice | Shared source; real staging synthetic public page inspected | Screenshot match at iPhone sizes, revision after payment, public navigation |
| Deposits, final balance, fees, tips, overpayment, refunds, reconciliation | Isolated actual-module SQLite/mocked Stripe suites pass | Sandbox end-to-end API/webhook deployment on each target |
| Schedule, weather, reports, before/after | Shared source/builds | Weather freshness, recurrence/date handling, uploads/downloads |
| Payments, accounting/analytics | Gross/net/tip/refund tests pass | Report filters/totals and mobile overflow with representative synthetic data |
| Templates, follow-ups, notifications, tasks | Shared source; owner/Templates separation tests | Sending must remain test-only; lifecycle concurrency/notification behavior |
| Owner account, preferences, security, PWA | LIVE owner test and TypeScript/build checks | DR auth parity and iPhone install/theme/navigation review |
| Record/photo backup and restore | Fee/refund/legacy round trips pass | Malformed relationships, duplicate/conflict cases, photo archive verification |

## Tests actually completed

- LIVE candidate: processing-fee suite, final-tipping/customer PATCH suite, per-payment refund suite, tip UI/contact/payment link suite, Owner Account/navigation suite, TypeScript, production compilation, git whitespace check.
- DR candidate: the same four shared financial/customer/tip suites, TypeScript, production compilation. LIVE authentication assertions are not a substitute for DR authentication tests.
- Staging candidate: four shared financial/customer/tip suites, TypeScript after adapter synchronization, production compilation.
- Refund suite covers partial refunds, repeat API requests, duplicate signed webhooks, altered amounts/providers, pending/success reconciliation, Stripe 500 and lost-response retries reusing idempotency, atomic rollback/recovery, concurrent limits, tip separation, manual refund fee preservation, external refunds, and backup/restore.
- Fee suite covers $75/$2.10 Cash App; $100/$2 Venmo; no fee; partial; final tip plus fee; deposit; overpayment rejection; refunds; invoice revision; backup/restore; legacy backups; invalid fees.
- Shared-source parity gate: 113 files identical across all three candidates. Nine explicitly listed auth/environment/staging/release adapters are excluded and require separate verification. Hosting and migration histories also require independent compatibility review. This gate does not mean the deployments match or all reference behavior has been audited.
- All payment tests use in-memory SQLite and mocked Stripe. No real payments or customer/financial records changed. Builds are compilations, not deployed end-to-end tests.

## Saved candidates

- parity-live-candidate, branch parity-all-2026-10-08
- parity-dr-candidate, branch parity-dr-candidate-2026-10-08
- parity-staging-candidate, branch parity-staging-candidate-2026-10-08

The existing published staging site is unchanged. These new candidates have no new staging URL because they have not been deployed. Reports, policy, inventory, and the shared-source gate are committed alongside code.

## Release plan — no approval requested yet

1. LIVE cloud-browser authentication succeeded. Verify deployed Doomsday identity without altering authentication. Complete the open source-guard, notification, restore-validation, schema-journal, and storage checks above.
2. Lock all target candidate commit hashes and artifact hashes. Verify no staging fixtures/banner/sandbox restrictions leak into LIVE or DR. Verify DR keeps its exact deployed PIN/signed-cookie security adapter.
3. Obtain rollback artifacts and compatible database/object-store backups independently for each target using existing free resources. Keep secrets outside artifacts and preserve Stripe configurations. Never import one target’s database into another.
4. Run only necessary additive target-specific migrations against isolated test copies; do not rerun historical DR dedup migrations. Test upgrade, restore, and rollback compatibility.
5. Deploy approved test candidates to isolated staging with own synthetic DB and sandbox Stripe, then test signed webhook delivery, retries/refunds, tipping, customer edits, invoice revisions, photos, weather, and mobile light/dark layouts.
6. Present the complete differences disposition, exact candidates/migration plan, screenshots, tests, and rollback plan for production approval. Only then publish to named production targets. Verify public and authenticated release hashes and complete smoke tests without financial transactions.

Until these steps are complete, do not mark any candidate production-ready or claim a complete all-screen deployed parity audit.

## Authenticated browser checkpoint

Doomsday secure PIN sign-in succeeded. The deployed Owner Account page opens independently of Templates and shows DOOMSDAY environment/security information. The deployed customer profile shows Call, Text, Email, Google Maps, Stride, Google Earth, Zillow, property preview, and Edit customer. Dashboard has no weather card. Templates display the existing full message list. Contracts and customer list render existing records. Estimates, follow-ups, schedule, invoices, and payments were navigated but several snapshots caught loading states; those are not recorded as successful end-to-end tests. No fields were saved and no payment/refund action was executed.

LIVE authentication subsequently succeeded through the owner handoff. Current signed-in screens were inspected without saving fields or processing payments. The earlier credential error is resolved.

## Coordinated implementation batch — current checkpoint

GitHub reference was fetched again: e516af3 unchanged. Native Sites inventory still reports LIVE v61 and refund staging v3. LIVE already includes Owner Account, all eight customer tools, and Edit customer with all five requested fields. Deployed DR Payments shows separate tip revenue and per-payment Refund actions, which deployed LIVE lacks. LIVE has dashboard/schedule weather and Insights absent from DR. Candidate source retains both sets of useful features.

New changes synchronized to all three isolated candidates:

- Additive partial unique index for Stripe Checkout principal, tip suffixes, and refund ledger providers. LIVE/staging migration 0020; DR migration 0022. Collision preflight is read-only; a collision blocks index creation, preserving rows. No deployed database has been migrated.
- Checkout reconciliation rejects multiple historical provider rows and verifies exactly one matching row. Existing atomic principal/tip recovery and concurrent replay tests remain passing. Uniqueness failures remain retryable errors; they are not reported as successful payments.
- Refund confirmation validates original paid-payment/job linkage, existing negative-row job/type/amount/status, provider refund association and exactly one final negative ledger row. Missing succeeded acknowledgement repairs without another Stripe refund. Corrupt or duplicate ledger fails closed. Old pending/failed events cannot downgrade a succeeded refund.
- Estimate collection blocks malformed snapshots/amounts and unresolved refunds/overpayments. Invoice collection now also blocks pending refunds. First-view and acceptance notification inserts are atomic conditional statements, avoiding repeated alerts without deleting history.
- Restore relationships and duplicate Stripe providers validate before writes. Refund backup validation now also checks negative-ledger job ownership.

Tests: six shared suites × three target migration histories = 18/18 suite executions passed; three TypeScript checks and three production compilations passed; LIVE Owner Account/navigation suite additionally passed. These are actual application modules with in-memory SQLite and mocked Stripe, not full Cloudflare/Stripe integration tests. Additional refund replay cases test missing-ledger recovery, wrong job/type/amount/status, historical duplicates, original-payment linkage, and out-of-order events.

Staging DB read-only overview lists 19 user tables, including payment_refunds. The complete payment-table read returns one synthetic Stripe payment with all fee/gross/tip columns and no repeated provider ID. Native tools do not expose its index definitions or migration journal; those remain unverified. Independent Cloudflare credentials are unavailable in this runtime, so remote D1 schema/journal and governed Worker provenance are not verified.

Formal baseline evidence remains LIVE 11/32, independent 0/32, identical 0/32. One new desktop DR Payments screenshot is collected separately with deployed source identity pending. It shows tip revenue/refund actions and the raw reference overflow. It is not an iPhone equivalence test and does not close the strict baseline gates.

An incomplete address in existing LIVE and DR data caused Google's property preview to resolve outside Tulsa. No stored address was changed. Full service addresses are required for accurate property lookup; do not guess/overwrite historical customer data.

No paid resources activated. No production deployment, customer edit, real payment, refund, environment-secret change, or remote migration performed.
