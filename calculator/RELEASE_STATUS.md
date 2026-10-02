# FIRE Business Calculator — Release Status

## Current status

**STAGING / DISASTER-RECOVERY CANDIDATE VERIFIED — PRODUCTION NOT SYNCHRONIZED**

The production/live calculator and independent disaster-recovery calculator both identify as v18. The independent staging/DR candidate has now passed the automated LIVE-vs-DR visual and behavior parity suite, independent LIVE-backup → DR takeover, reverse DR-backup → isolated-LIVE restore, invalid-backup safe-handling parity, and real service-worker airplane-mode DR acceptance.

Production remains the untouched master reference and has **not** been migrated, redeployed, synchronized, or altered by this verification work.

## Verified calculator state

- Branch: `fire-calculator-exact-live-clone`
- Final calculator gate anchor: `c3bfa3c86ee85d40d2a7c41b0f6a5d0fdeba8611`
- Portable-backup / offline acceptance verification: `2ce908d790f240d44ee4c7e6ab35c71b6be78f0b`
- Governed shared-core fingerprint: `579dd1c259fe8fc7eea92455244442acdcdb9f14e3441a249a4a743d34a79814`
- Offline cache generation: `65`
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

The dedicated `FIRE Calculator Offline DR Acceptance` workflow passed against cache generation 65. With browser networking disabled it verified:

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

The automated calculator disaster-recovery/parity batch is complete. The release is intentionally still **NOT_SYNCHRONIZED** because production has not been promoted to the governed shared-core deployment.

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
