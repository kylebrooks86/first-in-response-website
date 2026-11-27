# Invoice revision mobile layout batch — October 9, 2026

Resumed ea23b19be01fd8ecabd2cf57f70069b23aef44c3 on work/fire-business-app-parity-2026-10-08. Initial remote head matched local HEAD and checkout was clean. Scope: one FIRE Business App invoice revision layout task. Completed schema audits were not repeated.

## Source gap and scoped fix

Invoice revision history used side-by-side flex rows for service labels/details and quantity/amount, with no explicit shrinking or long-text wrapping. Summary rows also lacked explicit wrapping and a 44px minimum height. Existing revision-row overflow:hidden could conceal oversized contents. These are source stylesheet findings, not observed iPhone defects.

Changed shared/app/globals.css only: revision summaries can shrink/wrap and have a 44px minimum height; chevrons do not shrink. Desktop service rows use minmax(0,1fr) auto; <=760px rows use a single shrinking column. Long names/descriptions/units wrap within their cells. Historical totals remain unbroken. Mobile summary spans can wrap to a second line. Existing text, colors, data, money expressions, JSX, handlers, invoice save/hydration, APIs, revisions and migration histories remain unchanged.

Materialized identically into isolated LIVE, Doomsday and staging candidates. Exact local snapshot commits/paths and changed-file hashes are in INVOICE_REVISION_MOBILE_EVIDENCE.json and CANDIDATE_COMMITS.json. Local snapshot commits are not deployment identities; shared source/adapters are preserved in the containing GitHub development-branch commit.

## Validation and limitations

New test-invoice-revision-mobile.mjs executes the actual EditInvoiceDialog function with synthetic revision state and mocked UI/hook dependencies. It verifies the five-revision display limit, initially collapsed history, real expand/collapse callbacks and aria-expanded, only one revision open, long text and original historical totals/percentage discounts, and zero requests/saves during history review. Parsed CSS checks cover 320/375/390/430/760px stacking, 761/1363px desktop columns, shrink/wrap behavior and unbroken totals/chevrons.

New checks: 7/7 per target, 21/21 executions. Existing payment-mobile UI suite: 11/11 per target, 33/33 executions. Selected suite runs: 6/6. Shared-source parity: 118/118 hashes match; new script separately matches all targets. Final build results are recorded in the evidence file. Initial concurrent LIVE/staging build logs stopped before completion despite exit0; they were not counted and were retried individually. Doomsday completed with its unchanged /login static-classification warning.

Runtime change is CSS-only, so the prior customer-payment TypeScript 3/3 result was preserved instead of repeated. No dependencies installed; reused existing dependencies through read-only symlinks. Unchanged financial/API and 57 photo-recovery tests were not repeated. git diff --check and evidence/status/hash consistency are checked before saving.

These tests are static markup/handler/CSS contracts, not computed browser layout or real iPhone light/dark evidence. No candidate was rendered in a browser or deployed. Full remote schemas/journals remain 0/3; formal deployed/mobile comparisons 0/32; overall production readiness 3/10 (30%), NOT READY. Candidate source parity is 100%, distinct from deployed parity. Staging preflight remains 3/8 (37.5%).

No LIVE/Doomsday/staging deployment, remote migration/database write, Stripe operation, event replay, secret/config change, storage activation or paid service occurred. Records and historical rollback copies remain untouched.

## Next bounded task

Prioritize a verified isolated staging/mobile evidence path when schema/isolation/sandbox credentials and rollback permit it. If those remain inaccessible, review one remaining customer/invoice candidate workflow gap. Do not repeat passed column audits or report candidate CSS contracts as mobile parity. A future authorized staging review should capture expanded revision history with very long text at 320/375/390/430px in light/dark mode, check whole-page overflow, accessible summary taps, and readable historic money without saving an invoice.

Read-only QC can inspect the CSS diff and seven new tests, confirm dashboard.tsx/API/schema files stayed unchanged, and flag missing rendered evidence. No owner intervention is required for this candidate save. Stop cleanly after the verified branch save.

Pre-save remote check found newer commit af67d5af1142399a89df5897c1dfd77180adae7a adding DEPLOYED_PARITY_FREE_VERIFICATION_PLAN.md only. Inspected its diff and fast-forwarded the local branch while retaining this nonconflicting batch. The new verification plan is preserved unchanged; no runtime input changed and no tests were repeated. Next batch should follow its read-only deployed screenshot priority when the available browser permits it.
