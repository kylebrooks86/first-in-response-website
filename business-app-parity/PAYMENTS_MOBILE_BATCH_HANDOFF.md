# Payments mobile candidate batch — 2026-10-09

Checkpoint: b42fc36745a8c22fa49320374f93cc9895cd1cd5. Fresh fetch at start and immediately before saving matched that branch head. Canonical source was clean; existing LIVE local evidence preserved. Scope is FIRE Business App only.

## Brief read-only access check

One browser inventory attempt failed with exec-server transport disconnected. One request to the independent Doomsday /api/app-version endpoint returned HTTP 404. No retry loops, sign-in changes or credentials were attempted. These results do not identify the deployed commit or verify Cloudflare schema/journal/indexes. No authenticated Cloudflare inspection was possible. Remote schema verification remains 0/3; do not infer corruption or rerun migrations.

## Implemented in all three isolated candidates

1. Payment-history refund/check-refund trigger has an explicit action class and spans the details/amount columns rather than implicitly falling under the icon. Mobile rows place details, amount and refund action separately; action minimum height is 44px.
2. Long payment-history customer/detail text wraps within its grid column. Monetary values remain unbroken.
3. Processing-fee report is inside a labeled, keyboard-focusable horizontal scroll region. Table header scopes are explicit. This avoids forcing the parent page wider on small screens while retaining all four columns.
4. Refund dialog is constrained to 90dvh with vertical scrolling, matching the existing payment dialog approach.

Changed runtime files: shared/app/dashboard.tsx and shared/app/globals.css. Shared test added: scripts/test-payment-mobile-ui.mjs. No calculation, refund API, reconciliation handler, database schema, invoice template, customer-edit logic, authentication, Stripe configuration or migration changed.

## Verified local results

- New actual React function/handler/static-markup and parsed-CSS checks: 9/9 per candidate, 27/27 executions. Tests cover Refund/Check refund eligibility, negative/fully refunded rows, mobile dialog scrolling classes, pending Stripe retry preserving payment ID/request ID/amount, unconfirmed manual-refund submission blocked without a request, fee/tip/net display, accessible report headings/scroll region, amount class placement and mobile CSS row rules.
- test-processing-fees.mjs: passed in all three candidates. Covers actual fee/gross/net calculations, no fee, partial payment, tip plus fee, deposit, overpayment rejection, refund ledger, invoice revision, backup/restore, legacy compatibility and invalid/orphan/conflicting records.
- test-final-tip-ui.mjs: passed in all three candidates. Actual selector and mocked checkout requests, final-only visibility, invoice business links and approved customer/edit/Owner UI guards retained.
- Total selected suite runs: 9/9. Shared app parity gate: 118/118 files match, with nine deployment adapters still requiring separate verification. New test script separately copied identically to all targets.
- TypeScript: 3/3; framework builds: 3/3. DR build retains the existing static-classification warning for /login; no build failure. No dependencies installed. Initial new-test startup failed because pnpm does not expose transitive postcss at the root; resolved through the existing @tailwindcss/postcss dependency without adding a dependency. Final executions all passed.
- Prior 57 photo-recovery checks were not rerun because recovery source is unchanged.

All tests use local synthetic fixtures and mocked refund requests. They do not verify iPhone rendering, computed browser layout, real Stripe delivery or Cloudflare behavior. Do not count them as screenshots or hosted end-to-end tests.

## Saved candidates and restrictions

LIVE local candidate: 16228a4b619570a924345a089da8f1e47dce40d2.
Independent DR local candidate: 217478020ee6103495b1f078d994625a11110984.
Staging local candidate: 1cc2cf2ae7e376e32e9940bfc5b14d14fc673591.
Shared GitHub branch: work/fire-business-app-parity-2026-10-08 (see containing commit for this batch).

LIVE and independent Doomsday production are unchanged. No staging deployment, remote migration, database write, storage activation, charge, refund or Stripe endpoint update occurred. Independent records/settings/rollback copies remain untouched. The existing hosted staging app does NOT yet include this batch.

## Accurate progress scopes and blockers

This batch implementation 4/4 (100%); selected suites 9/9 (100%); new UI checks 27/27 (100%); target TypeScript/build checks 3/3 each (100%); shared-source parity 118/118 (100%). These are candidate-only scopes.
Formal LIVE/DR functional comparisons and mobile visual comparisons remain 0/32 (0%); saved baseline LIVE captures remain 11/32, independent registered captures 0/32. Remote schema/journal verification remains 0/3 (0%). Production-readiness gates remain 3/10 (30%), NOT READY. Hosted sandbox reconciliation is still unverified; the previously observed sandbox endpoint points to LIVE and lacks refund subscriptions, so never replay test events there.

## Next bounded batch and read-only QC

When browser access returns, review this candidate on an isolated synthetic staging deployment after target/database/sandbox routing/rollback verification and any needed authorization. Capture Payments history with refundable, pending, negative and fully refunded entries; long customer/reference text; fee table; open refund dialog; 320/375/390/430px widths; light and dark mode. Confirm no document-wide horizontal overflow, readable principal/tip/fee/net amounts, accessible actions and scroll behavior. Never submit a real refund. Continue read-only deployed identity/schema inspection only when available; do not retry inaccessible access repeatedly.

QC chat: inspect only the two runtime diffs, the new nine-check script and saved test evidence. Confirm that refund handlers/calculation expressions and migrations are unchanged, evaluate mobile CSS placement and keyboard focus/scroll semantics, and identify missing rendered evidence. Do not modify branches, apps, databases or Stripe. No owner action is required to preserve this checkpoint; authenticated browser/Cloudflare access and verified isolated Stripe routing remain required for hosted evidence. Stop cleanly after this batch.
