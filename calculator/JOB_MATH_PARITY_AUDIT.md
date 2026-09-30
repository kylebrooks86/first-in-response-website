# FIRE Business Calculator — Job Math Parity Audit

Status: staging audit artifact. Production/live remains unchanged.

## Master reference

Current LIVE FIRE Field Calculator at `fire-field-calculator-fir.kylebrooks8605.chatgpt.site`.

## Verified live Job Math structure

Live route/section: `#view-job`.

Live quick navigation:

1. Mix plan → `jobMixCard`
2. Measure → `jobMeasureCard`
3. Estimate → `jobEstimateCard`
4. Loadout → `jobLoadoutCard`

Visible quick-nav structure uses `#topJobNav.top-job-nav`.

## Verified live Estimate workflow details

The following are directly observed in the rendered live Estimate card:

- Stackable discount input exists and accepts 0.5 percentage-point increments.
- Final-price override is labeled `Final-price override (0 = calculated)` and uses whole-dollar increments.
- A visible `Clear` discount action exists.
- Customer quote section includes:
  - `Copy customer quote`
  - `Share quote`
  - `Print / Save PDF`
- A `Crew job sheet` section follows the customer quote section.

## Confirmed staging differences found during this audit

Before this audit, staging used the older standalone controls:

- discount step 0.1
- override step 0.01
- only `Copy customer quote`
- visible `Save estimate draft`
- no Share quote action
- no Print / Save PDF action
- no Clear discount action

## Staging corrections now applied

Shared staging core now:

- changes discount step to 0.5
- changes final-price override step to 1
- adds Clear discount
- keeps Copy customer quote
- adds Share quote
- adds Print / Save PDF
- hides the standalone-only visible Save estimate draft button while preserving draft persistence in code

These changes are implemented in `calculator/v18-live-estimator-parity.js`, loaded by the shared-core loader, included in the DR offline cache, included in the live-reference parity gate, and included in the shared-core fingerprint.

## Current staging calculation semantics — NOT YET CERTIFIED AS LIVE PARITY

The current staging estimator calculates in this order:

1. Sum priced service lines and custom service amount into `subtotal`.
2. Apply one combined discount percentage to produce the discounted subtotal.
3. If the calculated subtotal is greater than zero, apply the configured minimum-job floor.
4. If final-price override is greater than zero, the override replaces the calculated/minimum result.
5. Calculate deposit as the configured deposit percentage of the final customer total.

In compact form:

`subtotal → combined % discount → minimum-job floor → positive final-price override replaces result → deposit %`

Current staging defaults remain:

- Minimum job: $150
- Deposit percent: 50%

This section documents staging only. It must not be treated as proof that the live calculator uses the same ordering. No formula-order change should be made until the live behavior is directly verified.

## Not yet verified — do not assume parity

The following still require paired live/staging verification before promotion:

- exact service-row order and grouping in the live Estimate card
- every live estimator field/default
- exact live discount stacking math
- whether the displayed `Stackable discount total` is one accumulated percentage or derived from multiple sequential discount operations
- bundle behavior
- minimum-job application order relative to discounts and override
- final-price override interaction with minimum job and discount
- exact deposit calculation timing and wording
- customer quote line ordering and formatting
- Share quote payload/fallback behavior
- Print / Save PDF output scope and formatting
- Crew job sheet button set and behavior
- pricing-editor field order, labels, persistence and validation
- blank/zero/negative/very-large estimator states
- mobile keyboard and iPhone layout
- visual parity of all Job Math cards

## Release rule

This audit does not certify Job Math as identical. Production and DR remain NOT SYNCHRONIZED until all required parity-matrix rows are verified and both deployments use the same shared-core fingerprint.
