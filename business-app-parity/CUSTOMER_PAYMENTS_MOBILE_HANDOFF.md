# Customer-profile payment layout batch — October 9, 2026

Resumed 8d3ad662d9bf3625bdfd2354020de5225f5afb74 on work/fire-business-app-parity-2026-10-08. Initial remote head matched local HEAD and checkout was clean. Exposed read-only database tools still provide table/column names only; no supported Cloudflare SQL/index/journal/resource-ID reader appeared. Did not repeat completed column inspection or inaccessible identity checks. Moved to one bounded candidate mobile fix.

## Verified source gap and implementation

Customer-profile Payments used a general customer-record flex row containing details, monetary amount and RefundPayment. Prior payment-history layout improvements did not apply to these rows. This is a verified source layout difference, not a reported iPhone screenshot observation.

Added customer-payment-record to payment articles and customer-payment-amount to their monetary value. Scoped CSS uses a two-column grid on desktop with details that can shrink/wrap and an unbroken amount; refund action spans the full row with 44px minimum height. At <=760px, details, amount and refund action occupy separate rows in a single shrinkable column. No new colors/backgrounds, general record layouts, contact/profile header, invoice rows, refund eligibility/handlers, money expressions, fee details, reference-copy callbacks, API routes, auth adapters, migration or Stripe settings changed. Fully refunded/negative records retain the existing no-refund-action behavior.

Applied through shared source and materialized identically into isolated LIVE, Doomsday and staging candidates. Candidate paths, independent local snapshot commit IDs and changed-file SHA256 hashes are in CUSTOMER_PAYMENTS_MOBILE_EVIDENCE.json and CANDIDATE_COMMITS.json. These snapshot commits are local-only materializations; the containing development-branch commit preserves their canonical source and adapters. They are not Sites/Worker deployed commit IDs.

## Tests and limits

Extended existing test-payment-mobile-ui.mjs with actual TSX AST assertions for the profile payment row and parsed CSS checks for grid/wrapping/action placement. Existing handler tests still cover refund/check-refund eligibility, pending retry IDs/amount, unconfirmed manual-refund blocking, fee/tip/net amounts, history/report semantics and dialog scrolling.

- Payment mobile checks: 11/11 per target, 33/33 executions; two new profile checks per target, 6/6 new executions.
- Selected suites: payment-mobile UI and final-tip/customer UI regression in all targets, 6/6 runs.
- TypeScript no-emit: 3/3; vinext builds: 3/3. Existing Doomsday /login classification warning remains, no build failure.
- Shared application hash comparison: 118/118 match; new script/changed-file hashes also match all targets.
- git diff --check, evidence/status/commit consistency and TSX-only class-change inspection pass before saving.

Used existing staging dependencies read-only via symlinks; installed nothing. No application test runs beyond the affected UI suites; unchanged 57 photo-recovery checks were not rerun. Tests use local synthetic fixtures and mocked requests. No browser rendering, real iPhone light/dark screenshot, remote Stripe delivery or actual refund test was performed. CSS contracts do not establish computed-layout or deployed parity.

## Progress and restrictions

Bounded candidate implementation 1/1 (100%); selected suites 6/6 (100%); UI check executions 33/33 (100%); TypeScript and builds 3/3 each (100%); shared source 118/118 (100%). Formal deployed/mobile comparisons stay 0/32 (0%); full remote schemas/journals stay 0/3 (0%); production readiness stays 3/10 (30%), NOT READY. Staging preflight remains 3/8 (37.5%). Prior 19/19 deployed staging table/163 column-name result remains valid evidence with its existing limits.

LIVE, Doomsday and existing staging publications remain unchanged. No database write/migration, secret change, Stripe endpoint/event replay, charge/refund, paid service, storage activation, source credential or deployment occurred. Rollback copies and records are preserved.

## Next bounded task and QC

Review one remaining invoice/customer mobile layout gap if authenticated schema/sandbox access remains blocked; do not repeat column audits. When an isolated staging release is independently verified and explicitly authorized, capture customer-profile Payments with refundable, pending, negative, fully refunded and fee-bearing rows, long references, 320/375/390/430px widths, light/dark mode and open refund dialog. Confirm readable amounts, action access and no page overflow without issuing a real refund.

Read-only QC may inspect the two runtime diffs and two new tests, verify financial/API/schema source stayed unchanged, and flag missing computed/rendered evidence. No owner action is needed for this candidate save. This batch stops after the verified branch save.
