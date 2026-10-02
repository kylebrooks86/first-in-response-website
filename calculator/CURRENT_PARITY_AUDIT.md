# Current LIVE vs Independent FIRE Calculator Audit

Audit status: **STAGING PARITY VERIFIED — NOT SYNCHRONIZED**

Verified staging head: `40495a629786d4dbd8b04b6bb225124fd729b748`

Verified shared-core fingerprint: `e0318dc8ff02f5bcb1506ad18abd499440ce287f792fabc3b4ca0455e9e869ab`

Sources compared:

- Production/live: current rendered ChatGPT-hosted FIRE Field Calculator v18
- Independent/recovery: current rendered calculator from `fire-calculator-exact-live-clone`

This audit distinguishes **automated LIVE-vs-staging parity** from **dual-deployment synchronization**. The current staging candidate is green in the governed automated parity suite. It is still not synchronized because production is maintained separately and has not been migrated to the same governed shared core/fingerprint.

## Automated parity result

No current automated parity assertion failure remains on the verified head.

The exact-head suite passed:

- formula regression and LIVE-reference contract
- offline-cache and shared-core-fingerprint contracts
- Job Math behavior and shortcuts
- Pricing Editor behavior
- estimator blank/zero/negative/decimal/large/invalid/missing-rate states
- customer/job defaults and draft persistence
- bundle and promotion stacking behavior
- save/reload/clear behavior
- customer quote copy/share/print behavior
- mobile numeric-input metadata/default/focus behavior
- chemical compatibility behavior
- Equipment, Job Math and Field Tools focused geometry
- route/card/layout geometry measurement
- light/dark computed-style audit
- paired 390×844 captures and light/dark visual-difference measurement
- independent LIVE-backup → DR restore takeover

## Disaster-recovery takeover

The dedicated staging-only takeover workflow now completes successfully instead of competing for time at the end of the general behavior job.

A disposable LIVE v3 backup is copied into local DR staging and restored after reload. The verified takeover state includes:

- customer/job name
- House Wash quantity
- discount
- Job Math area
- SH inventory

The migrated customer/job name is also persisted into DR's durable parity draft rather than only being painted into the UI.

## Important fixes made during takeover diagnosis

The DR startup freeze was traced to the `fire-v18-parity-loaded` event and then to the Equipment structure parity listener. Duplicate MutationObservers could leave an older observer reacting indefinitely to its own DOM adjustments. The observer lifecycle is now single-owner/idempotent and the renderer no longer locks during restore.

House Wash input behavior was also split correctly into two distinct LIVE behaviors:

- a fresh draft starts House Wash at `0`
- after a user explicitly clears the field, it remains blank instead of being repeatedly coerced back to zero

The initial zero now belongs to first-draft initialization, not to a recurring input-normalization loop.

## Confirmed business-rule state in current governed core

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

Unapproved services remain configurable at $0. No guessed rate was introduced during parity work.

## Remaining non-automated / release-level verification

The following are not current automated parity failures; they remain promotion/acceptance work outside the exact-head browser regression evidence:

- native iPhone safe-area and software-keyboard chrome acceptance
- native OS share / print presentation acceptance
- final airplane-mode/offline recovery acceptance with disposable data
- optional broader state matrices beyond the required paired suite
- production migration to the governed shared core
- final proof that both independently deployed instances report/run the same shared-core fingerprint

Until those release steps are deliberately completed, keep status **NOT SYNCHRONIZED** and do not alter production.
