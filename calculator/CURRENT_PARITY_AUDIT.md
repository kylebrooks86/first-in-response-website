# Current LIVE vs Independent FIRE Calculator Audit

Audit status: **NOT SYNCHRONIZED**

Sources compared:

- Production/live: current rendered ChatGPT-hosted FIRE Field Calculator v18
- Independent/recovery: current rendered GitHub-hosted calculator and recovery-source branch

This document records only confirmed differences or explicitly unverified areas. It does not infer parity from similar code.

## Confirmed architecture difference

### Production/live

The live calculator is a ChatGPT Site projection and is maintained separately from the independent GitHub calculator.

### Independent/recovery

The independent calculator currently originates from an older standalone base document plus multiple v18 extension/parity modules.

**Result:** synchronization failure. Two separately evolved codebases are not a valid dual deployment of one shared core.

## Confirmed rendered differences

### SH Mix recipe title

- Live rendered/source wording: `4.00 gal medium house wash`
- Independent rendered wording: `4-gallon moderate house wash`

Differences include number formatting, unit wording, and growth label (`medium` vs `moderate`).

Status: **NOT YET VERIFIED / CONFIRMED DIFFERENCE**

### Equipment X-Jet factory guidance

- Live: `Factory proportions are estimates based on a 4 GPM pressure washer at 100 PSI. Hose length, pressure, orifice, elevation and equipment condition can change the draw. Use the measured test below for your real result.`
- Independent rendered text omits `based on a 4 GPM pressure washer at 100 PSI.`

Status: **NOT YET VERIFIED / CONFIRMED DIFFERENCE**

### Application Timer safety warning

Live includes:

`A timer never replaces the product label. Watch the surface continuously and rinse sooner if drying or a reaction appears.`

The current independent rendered extraction does not contain this warning in the same rendered state.

Status: **NOT YET VERIFIED / CONFIRMED DIFFERENCE**

### Quick safety order

Live includes the wording:

- `Wear eye/skin protection and keep people, pets, and plants clear.`
- final step: `Rinse tools and do not seal or store mixed SH long-term.`

Independent rendered state currently shows different PPE wording and does not include the same final step in the extracted rendered list.

Status: **NOT YET VERIFIED / CONFIRMED DIFFERENCE**

## Confirmed business-rule state in current independent core

Approved defaults currently represented in the independent core:

- House wash: $0.22/sq ft
- Gutter cleaning + downspout flush: $1.50/linear ft
- Existing gutter guard removal + reinstall: $0.50/linear ft
- Gutter brightening: $2.00/linear ft
- Fence cleaning: $0.40/sq ft
- Standard windows: $7 first floor / $11 second floor
- French panes: $12 first floor / $18 second floor
- Screens: $3 first floor / $6 second floor
- Driveway: $175 each
- Front sidewalk + curb: $75 each
- Side sidewalk: $25 each
- RV wash: $150 each
- Minimum job: $150
- Deposit default: 50%

Unapproved services are represented with a $0 configurable rate. This includes Trash Bin Cleaning, Roof Cleaning, Dryer Vent, underground drains/downspouts, AC condenser rinse, and multiple specialty services. These must not be assigned guessed rates during parity work.

## Important unresolved behavior

The independent estimator currently represents its discount as one total discount percentage. The exact production/live stacking/bundle semantics have not yet been paired and verified under the new model.

**Do not freeze or change a bundle-stacking algorithm until production behavior is verified.**

## Areas still requiring exhaustive paired verification

- full launch/header/tab/bottom-nav visual geometry
- every SH surface/growth state
- every batch preset and custom-unit state
- Equipment card order and every formula/default
- product list/dose behavior in Chemicals
- entire Chemical Index content/ranking/search
- every Job Math service, input, default, quantity, rate and validation state
- discount/bundle behavior
- quote/crew-sheet exact text
- pricing editor persistence
- Field Tools behavior and order
- Field Guide content/order
- dark mode
- iPhone keyboard and safe-area behavior
- reset/clear
- backup/export/restore cross-deployment round trip
- blank/zero/negative/large/invalid states
- offline behavior in DR

These remain **NOT YET VERIFIED** in `PARITY_MATRIX.md` until paired evidence exists.
