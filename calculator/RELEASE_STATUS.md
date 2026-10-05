# FIRE Business Calculator — Release Status

## Current status

**STAGING REAL-DEVICE PARITY RE-AUDIT IN PROGRESS — PRODUCTION NOT SYNCHRONIZED**

The production/live calculator and independent disaster-recovery calculator both identify as v18. Previous automated gates were insufficient to establish real-device visual parity: owner iPhone testing found material mismatches in Index and Mixes. The staging/DR candidate is therefore back in section-by-section parity re-audit while production remains untouched.

Production remains the untouched master reference and has **not** been migrated, redeployed, synchronized, or altered by this verification work.

## Verified calculator state

- Branch: `fire-calculator-exact-live-clone`
- Latest calculator gate anchor: `44b5eb0bc9f9b1ba45d248493e23d4c2c9bf0558`
- Latest offline acceptance verification: `44b5eb0bc9f9b1ba45d248493e23d4c2c9bf0558`
- Governed shared-core fingerprint: `8bc01e24e095f80224e0a64157376092c5a2c9de56274979b06a05ffe06d7cdf`
- Offline cache generation: `68`
- Release status remains `STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED` in `SHARED_CORE_MANIFEST.json`.
- Production/live hosting, DNS, deployment and real customer data were not modified.

A later repository commit, `25ba82ab4ae572b5dfdcf2cce662491620fab461`, added an unrelated D1-only v138 app DR helper and does not change calculator shared-core code or calculator verification scope.

## Verified automated gates

The staging/DR candidate has verified coverage for:

- Formula regression and LIVE-reference contract
- Offline-cache contract and shared-core fingerprint integrity
- Independent LIVE-backup → DR restore/takeover
- DR portable backup → isolated LIVE restore
- Invalid/corrupt backup safe handling
- Job Math behavior and shortcuts
- Pricing Editor behavior
- Estimator edge states
- Customer/draft behavior
- Bundle/promotion behavior
- Save/reload/clear behavior
- Quote copy/share/print behavior
- Mobile numeric-input behavior
- Chemical compatibility behavior
- Equipment, Job Math and Field Tools key-card geometry
- LIVE-vs-staging card/layout geometry measurements
- light/dark computed-style comparison
- 390×844 iPhone-viewport captures
- light/dark visual-difference measurement

The reverse portability check is now a **hard release gate** rather than a continue-on-error probe. A failure in DR → LIVE backup portability fails the calculator takeover workflow.

## Airplane-mode DR acceptance

The dedicated `FIRE Calculator Offline DR Acceptance` workflow passed against cache generation 68 after the parity corrections. With browser networking disabled it verified:

- all seven major routes open: SH Mix, Equipment, Chemicals, Chemical Index, Job Math, Field Tools, Field Guide
- SH Mix performs a real dependent recalculation offline
- saved estimate/planning state survives an offline reload
- Job Math continues calculating offline
- a portable v3 backup can be generated while offline
- the portable backup includes the LIVE-compatible estimate projection plus required DR stores
- the calculator can be fully closed and reopened while still offline with state and math preserved
- no OpenAI/ChatGPT network request was observed
- no OpenAI/ChatGPT sign-in requirement was present

This closes the automated DR-independence / airplane-mode gate.

## Backup portability status

Required backup recovery directions are now covered:

1. **LIVE → DR:** verified.
2. **DR → isolated LIVE restore:** verified and enforced as a hard gate.
3. **Invalid/corrupt backup:** verified to fail safely without silently damaging state.

The portable backup contract remains FIRE Field Calculator Backup v3 / appVersion 18 and preserves DR-specific stores in addition to the LIVE-compatible estimate projection.

## Architecture target

One shared codebase:

**FIRE Calculator Core**

Deployed independently to:

1. Production / Live FIRE Calculator
2. Independent Disaster-Recovery FIRE Calculator

All visible UI, formulas, pricing logic, validation, navigation, state handling, saved-data schema, export/restore behavior, warnings and business rules belong to the shared core. Only infrastructure adapters may differ.

## What remains before synchronization

The automated disaster-recovery checks remain useful, but the visual/behavior parity batch is **not complete** because real-device findings reopened the audit. The release remains **NOT_SYNCHRONIZED** and production has not been promoted.

Remaining release-level work is limited to:

- physical-device owner acceptance where browser automation cannot certify native iPhone keyboard, safe-area and OS share/print presentation
- explicit owner approval before any production promotion
- production migration/deployment from the governed shared-core release only after that approval
- post-promotion verification that LIVE and DR report the exact same governed shared-core fingerprint

No production promotion is implied by automated staging success.

## Change classification rule

Every future calculator change must be classified as exactly one of:

- **SHARED FIRE CALCULATOR CHANGE** — must ship to both deployments from the same core release.
- **INFRASTRUCTURE-ONLY CHANGE** — may differ between deployments and must not change user-visible or business-functional behavior.

If a shared change reaches only one deployment after synchronization, release status immediately becomes **SYNCHRONIZATION FAILURE** until corrected.

## Production safety

The existing working live calculator must not be overwritten merely because staging/DR automation is green. Work remains isolated on `fire-calculator-exact-live-clone` until explicit production promotion is approved.
