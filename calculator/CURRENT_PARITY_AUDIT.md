# Current LIVE vs Independent FIRE Calculator Audit

Audit status: **REAL-DEVICE PARITY RE-AUDIT IN PROGRESS — NOT SYNCHRONIZED**

Latest core/offline gate verification: `44b5eb0bc9f9b1ba45d248493e23d4c2c9bf0558`

Airplane-mode DR acceptance evidence: `44b5eb0bc9f9b1ba45d248493e23d4c2c9bf0558`

Current staging shared-core fingerprint: `bee43bb803a857f40464b46d21b71816bfe963538926606c4c32566644d46b65`

Sources compared:

- Production/live: current rendered ChatGPT-hosted FIRE Field Calculator v18
- Independent/recovery: current rendered calculator from `fire-calculator-exact-live-clone`

This audit distinguishes automated checks from real-device parity and dual-deployment synchronization. Owner iPhone testing found material visual/functional mismatches despite earlier green automated checks, so those checks are no longer treated as sufficient evidence of visual parity. Production remains the untouched reference and the DR candidate stays NOT SYNCHRONIZED.

## Automated parity result

Core formula/contract and offline DR checks are green on the current corrected staging build, but visual parity is reopened and is being re-audited section-by-section against the actual LIVE render.

The suite passed:

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

The staging-only takeover workflow restores a disposable LIVE v3 backup into local DR staging after reload. The expanded takeover now verifies 17 restored values:

- customer/job name
- House Wash quantity
- gutter quantity
- custom-service description
- custom-service amount
- estimate notes
- discount
- Job Math area
- coverage
- reserve
- measurement length
- measurement height
- measurement sections
- measurement subtraction
- calibration area
- calibration mix used
- SH inventory

The corresponding UI values match after restore, and the migrated customer/job/estimate state is persisted into DR storage rather than only painted into the DOM.

## Airplane-mode / offline DR acceptance

The dedicated offline acceptance workflow warms the real service worker/cache, disables browser networking, reloads the calculator, and then verifies actual offline use.

Verified offline behavior includes:

- cache generation `fire-field-calculator-v18-exact-clone-69` controls the page
- all seven major routes open offline
- SH Mix produces a changed dependent calculation after an offline input change
- saved estimate/planning state survives offline reload
- Job Math continues to calculate offline
- backup JSON exports offline using `FIRE-Field-Calculator-v18-offline` version 18
- a full page close and new-page reopen succeeds while still offline
- saved state and calculated total survive that reopen
- zero OpenAI/ChatGPT network requests were observed during the acceptance run
- no OpenAI/ChatGPT sign-in requirement appeared

The automated airplane-mode DR-independence gate is therefore closed.

## Real-device parity re-audit findings

The owner’s iPhone test invalidated the previous visual-parity conclusion. The current re-audit has already addressed:

- stale cache delivery that could keep old Index/Mixes UI on iPhone
- Equipment X-Jet card treatment, unit pills, result grouping, reverse-calculator structure, and proportioner grouping
- Job Math quick-navigation placement and visible labels, which were previously rendered as empty red-outlined buttons in light mode

Index/Mixes remain the first acceptance focus, followed by Equipment, Chemicals, Job Math, Field Tools, and Field Guide. Automated screenshot and geometry checks are supporting evidence only; they no longer override a real-device mismatch.

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

The following are not current automated parity failures; they remain promotion/acceptance work:

- native iPhone safe-area and software-keyboard chrome acceptance
- native OS share / print presentation acceptance
- reverse DR → production-staging backup/restore acceptance
- invalid-backup safe-error parity
- remaining optional/alternate state matrices required by final acceptance
- production migration to the governed shared core
- final proof that both independently deployed instances report/run the same shared-core fingerprint

Until those release steps are deliberately completed, keep status **NOT SYNCHRONIZED** and do not alter production.
