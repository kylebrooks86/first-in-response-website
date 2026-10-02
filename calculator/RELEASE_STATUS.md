# FIRE Business Calculator — Release Status

## Current status

**STAGING CANDIDATE VERIFIED — NOT SYNCHRONIZED**

The production/live calculator and independent disaster-recovery calculator both identify as v18. The current staging candidate has passed the automated LIVE-vs-DR parity suite and independent backup-takeover test, but the release is **not synchronized** because production has not been converted to/deployed from this governed shared-core release. Production remains the untouched master reference.

## Verified staging candidate

- Branch: `fire-calculator-exact-live-clone`
- Verified head: `40495a629786d4dbd8b04b6bb225124fd729b748`
- Shared-core fingerprint: `e0318dc8ff02f5bcb1506ad18abd499440ce287f792fabc3b4ca0455e9e869ab`
- Offline cache generation: `62`
- Release status remains `STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED` in `SHARED_CORE_MANIFEST.json`.
- Production/live hosting, DNS, deployment and real customer data were not modified.

## Exact-head automated verification

The exact governed head above passed:

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

The DR takeover test restores disposable LIVE backup state into local DR staging and verifies customer/job name, House Wash quantity, discount, area and SH inventory. It is isolated in its own staging-only workflow and does not deploy anything.

## Architecture target

One shared codebase:

**FIRE Calculator Core**

Deployed independently to:

1. Production / Live FIRE Calculator
2. Independent Disaster-Recovery FIRE Calculator

All visible UI, formulas, pricing logic, validation, navigation, state handling, saved-data schema, export/restore behavior, warnings and business rules belong to the shared core. Only infrastructure adapters may differ.

## Remaining promotion gates

The automated staging parity candidate is green, but synchronization is intentionally still blocked by the remaining release-level work:

- native-device acceptance for iPhone safe-area / keyboard / OS share-print presentation where browser automation cannot certify native chrome
- broader optional state coverage beyond the required paired regression set where desired
- final airplane-mode/offline DR acceptance using disposable data
- production migration/deployment planning only after staging acceptance
- production and DR must ultimately run the exact same governed shared-core release/fingerprint before status may become synchronized

## Change classification rule

Every future change must be classified as exactly one of:

- **SHARED FIRE CALCULATOR CHANGE** — must ship to both deployments from the same core release.
- **INFRASTRUCTURE-ONLY CHANGE** — may differ between deployments and must not change user-visible or business-functional behavior.

If a shared change reaches only one deployment after synchronization, release status immediately becomes **SYNCHRONIZATION FAILURE** until corrected.

## Production safety

The existing working live calculator is not to be overwritten while the recovery/shared-core rebuild is still a staging candidate. Work remains isolated on `fire-calculator-exact-live-clone` until explicit production promotion is approved.
