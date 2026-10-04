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

## Paired iPhone screenshot findings now verified

The paired live/staging iPhone capture exposed and confirmed these live defaults and workflow details:

### Mix planning

- Measured area default: `2000 ft²`
- Coverage per gallon default: `300 ft²`
- Overspray / reserve default: `15%`
- Sprayer / container default: `4 gallons — FlowZone`
- The default plan therefore produces about `7.67 gal` finished mix.
- At the current 1% target and 10% stock strength, the default planned stock SH requirement is about `98.1 fl oz`.
- Default planned Elemonator requirement is about `7.7 fl oz`.

### Measure card

Live shows these shortcut actions after calculated area:

- `Use for mix planning`
- `Use for house price`
- `Use for fence price`

Staging now implements all three against the existing shared fields.

### Chemical cost

Live fresh defaults observed in the paired screenshot:

- SH price per gallon: `$4.50`
- Elemonator price per gallon: `$45`
- Planned-job chemical cost is shown in a green status-style box below the current recipe cost.

Staging now mirrors these fresh-state defaults and the status-box presentation without changing any customer service pricing.

### Estimate card

A staging ordering bug previously allowed the hidden legacy estimator card to win after both estimator cards temporarily shared the heading `Price the whole job`. This caused the visible full estimator to disappear in staging.

That selector/order bug is fixed. The full FIRE estimator is now the visible `jobEstimateCard` between Chemical Cost and Loadout.

### Customer quote actions

Live shows:

- `Copy customer quote`
- `Share quote`
- `Print / Save PDF`

Staging now implements all three.

### Crew job sheet actions

Live shows:

- `Copy crew job sheet`
- `Share crew sheet`
- `Clear this estimate`

Staging now implements all three. `Clear this estimate` clears estimate/job-entry state only; it does not erase the pricing table or business-rule configuration.

### Loadout

Live rendered DOM confirms:

- loadout status element: `#loadoutStatus`
- deduct action: `#deductJobLoadout`
- button label: `Deduct planned job chemicals`

The paired live screenshot shows the default fresh state as `Loadout is short`, comparing on-truck SH and Elemonator against the planned job amounts.

Staging now:

- calculates planned stock SH and Elemonator from the same Mix Plan state
- compares those amounts with device inventory
- renders a shortage/readiness status box
- provides `Deduct planned job chemicals`
- deducts the planned quantities from device inventory when the action is used
- initializes fresh staging inventory to zero where the old standalone defaults had preloaded 5 gal SH / 1 gal Elemonator, matching the observed live fresh-loadout state

## Verified live Estimate workflow details

The following are directly observed in the rendered live Estimate card:

- Stackable discount input exists and accepts 0.5 percentage-point increments.
- Final-price override is labeled `Final-price override (0 = calculated)` and uses whole-dollar increments.
- A visible `Clear` discount action exists.
- Customer quote section includes Copy / Share / Print-Save-PDF actions.
- A Crew job sheet section follows the customer quote section.

## Staging corrections now applied

Shared staging core now:

- changes discount step to 0.5
- changes final-price override step to 1
- adds Clear discount
- keeps Copy customer quote
- adds Share quote
- adds Print / Save PDF
- hides the standalone-only visible Save estimate draft button while preserving draft persistence in code
- adds live Crew job sheet actions
- adds live Measure shortcuts
- aligns fresh Mix Plan and chemical-cost defaults
- fixes the full-estimator ordering bug
- mirrors the live Loadout shortage/deduct workflow

These changes are loaded by the shared-core loader, included in the DR offline cache, included in the live-reference parity gate where applicable, and included in the shared-core fingerprint.

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

## Still not verified — do not assume parity

The following remain open:

- exact service-row order and grouping across every collapsed Estimate section
- every service row's blank/zero/invalid/large-value behavior
- exact live discount stacking math
- whether bundle discounts are represented as one accumulated percentage or sequential operations
- minimum-job application order relative to discounts and override
- final-price override interaction with minimum job and discount
- exact deposit calculation timing and wording in all states
- customer quote line ordering and exact Share/Print payload behavior
- Crew job sheet exact text formatting
- loadout behavior when inventory is partially sufficient or fully sufficient
- pricing-editor field order, labels, persistence and validation
- mobile keyboard behavior
- final pixel-level visual parity of all Job Math states

## Latest shared-core checkpoint

Shared-core fingerprint at this audit update:

`a48c927e09eb1dd27a2c8f640a8e0bdcea551fcacb5172ad17264341454f53e0`

The release gate passes formula regression, live-reference contract, and shared-core fingerprint integrity on the staging branch. Production and DR are still NOT SYNCHRONIZED until the full parity matrix is cleared and both deployments use the same shared-core release.
