# FIRE Business Calculator — Release Status

## Current status

**STAGING CANDIDATE VERIFIED — NOT SYNCHRONIZED**

The production/live calculator and independent disaster-recovery calculator both identify as v18. The current staging candidate has passed the automated LIVE-vs-DR parity suite, independent backup-takeover test, and real service-worker airplane-mode DR acceptance, but the release is **not synchronized** because production has not been converted to/deployed from this governed shared-core release. Production remains the untouched master reference.

## Verified staging candidate

- Branch: `fire-calculator-exact-live-clone`
- Latest exact-head parity/takeover verification: `e93435f213304d476c31a6abb958e336c0e0e48b`
- Airplane-mode DR acceptance evidence: `83ced5c857dfed4e1165813fbe25d38a3330ec30`
- Shared-core fingerprint: `e0318dc8ff02f5bcb1506ad18abd499440ce287f792fabc3b4ca0455e9e869ab`
- Offline cache generation: `62`
- Release status remains `STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED` in `SHARED_CORE_MANIFEST.json`.
- Production/live hosting, DNS, deployment and real customer data were not modified.

The commits after the original calculator parity candidate in this sequence changed tests/governance only; the governed calculator shared core and fingerprint above did not change.

## Exact-head automated verification

The latest exact-head suite passed:

- Formula regression
- LIVE-reference contract
- Offline-cache contract
- Shared-core fingerprint integrity
- Independent LIVE-backup → DR restore/takeover
- Job Math behavior
- Job Math shortcuts
- Pricing Editor behavior
- Estimator edge states
- Customer/draft behavior
- Bundle/promotion behavior
- Save/reload/clear behavior
- Quote copy/share/print behavior
- Mobile numeric-input behavior
- Chemical compatibility behavior
- Equipment key-card geometry
- Job Math key-card geometry
- Field Tools key-card geometry
- LIVE-vs-staging card/layout geometry measurements
- light/dark computed-style comparison
- 390×844 iPhone-viewport captures
- light/dark visual-difference measurement

The expanded LIVE-backup takeover now verifies 17 restored values across both durable DR storage and restored UI where applicable: customer/job name, House Wash, gutter quantity, custom-service description and amount, estimate notes, discount, Job Math area, coverage, reserve, measurement length/height/sections/subtraction, calibration area/mix-used, and SH inventory.

## Airplane-mode DR acceptance

The dedicated `FIRE Calculator Offline DR Acceptance` workflow passed with the real DR service worker and cache generation 62. With browser networking disabled it verified:

- all seven major routes open: SH Mix, Equipment, Chemicals, Chemical Index, Job Math, Field Tools, Field Guide
- SH Mix performs a real dependent recalculation offline
- saved estimate/planning state survives an offline reload
- Job Math continues calculating offline
- backup JSON can be generated while offline
- the calculator can be fully closed and reopened while still offline with state and math preserved
- no OpenAI/ChatGPT network request was observed
- no OpenAI/ChatGPT sign-in requirement was present

This closes the automated DR-independence/airplane-mode gate. It does not change production synchronization status.

## Architecture target

One shared codebase:

**FIRE Calculator Core**

Deployed independently to:

1. Production / Live FIRE Calculator
2. Independent Disaster-Recovery FIRE Calculator

All visible UI, formulas, pricing logic, validation, navigation, state handling, saved-data schema, export/restore behavior, warnings and business rules belong to the shared core. Only infrastructure adapters may differ.

## Remaining promotion gates

The automated staging parity and DR-recovery candidate is green, but synchronization is intentionally still blocked by the remaining release-level work:

- native-device acceptance for iPhone safe-area / keyboard / OS share-print presentation where browser automation cannot certify native chrome
- remaining optional/alternate state matrices required by the final parity matrix
- reverse DR → production-staging backup/restore acceptance and invalid-backup safe-error parity before any production migration
- production migration/deployment planning only after staging acceptance
- production and DR must ultimately run the exact same governed shared-core release/fingerprint before status may become synchronized

## Change classification rule

Every future change must be classified as exactly one of:

- **SHARED FIRE CALCULATOR CHANGE** — must ship to both deployments from the same core release.
- **INFRASTRUCTURE-ONLY CHANGE** — may differ between deployments and must not change user-visible or business-functional behavior.

If a shared change reaches only one deployment after synchronization, release status immediately becomes **SYNCHRONIZATION FAILURE** until corrected.

## Production safety

The existing working live calculator is not to be overwritten while the recovery/shared-core rebuild is still a staging candidate. Work remains isolated on `fire-calculator-exact-live-clone` until explicit production promotion is approved.
