# FIRE Business mobile controls/accessibility — 2026-10-09

Resumed development branch `work/fire-business-app-parity-2026-10-08` at `a333c0fc548dead529bd5f81338fb98e209f65bb`, clean checkout and matching remote head. FIRE Business App only; all completed work preserved.

## Confirmed issue and shared fix

Business task/expense forms had eight controls without persistent associated labels. The due-date input had no label or placeholder. Added visible labels with unique control IDs; customer/category/job selectors explicitly reference their labels. Existing placeholders, state handling and submissions are retained.

Task completion buttons now have a stable spoken action name plus completion and working state (`aria-pressed`/`aria-busy`). The labels stay stable when completion changes. Optimistic updates, failures and rollback are unchanged. At narrow widths (up to 760px), Business fields/task buttons declare 44px minimum height, inputs/textarea retain 16px text, selectors fill field width and long task text wraps. Existing themes/layouts remain shared across the three adapter candidates.

## Exact local verification

All three isolated candidates passed:

- New Business accessibility/interaction suite: **69/69 per target; 207/207 total**.
- Existing loading/recovery suite: **961/961 per target**.
- Existing Payments mobile structural suite: **11/11 per target**.
- Selected suite runs: **9/9**; TypeScript: **3/3**; builds: **3/3**.
- Shared app files: **119/119 matched**.
- Six Business handler bodies (`load`, task add/toggle, expense add, backup choose/restore) are byte-identical to the saved checkpoint.
- Negative controls reject the previous unlabeled component and previous missing mobile sizing declarations.

Tests execute the actual component/hooks and synthetic handlers, checking all eight labels, unique IDs, selectors, date/decimal entry, submitted task/expense payloads, task state/busy announcements and failure rollback. CSS declaration tests do not prove rendered viewport fit, theme contrast or screen-reader behavior. No browser/iPhone evidence was captured. Actual mobile/hosted parity remains **0/32**; do not count these as mobile release-gate passes.

Exact new local candidate commits/paths and file/result hashes are in `BUSINESS_MOBILE_ACCESSIBILITY_EVIDENCE.json`; historical candidate records remain unchanged. The latest verified candidate pointer now identifies this batch. Historical manifests, including `RELIABILITY_RELEASE_REVIEW_MANIFEST.json`, are retained and expected stale after this source change. They do not seal these new candidates. Future review must consume the latest verified evidence without rewriting the older reliability proof.

## Release status and next bounded batch

**Overall verified readiness remains 3/10 gates (30%); NOT READY.** Complete remote schema/journals remain **0/3**. LIVE still lacks the observed `payment_refunds` table required by the candidate; Doomsday deployment identity/resource/schema and the remaining auth/photo/mobile/sandbox/rollback gates are unverified.

No production/staging deployment, database write, operational migration, secret change, Stripe call, purchase or background automation. Cost **$0**; overnight runs remain stopped.

Next bounded batch: review one estimate/invoice mobile entry flow with synthetic interaction checks, fixing only a confirmed shared usability gap. For future release review, bind the latest verified candidate/evidence pointer and preserve historical proof files. Do not run legacy deployment/migration wrappers or infer hosted parity from source/structural checks. Stop after saving this checkpoint.
