# FIRE Business Calculator — Release Status

## Current status

**STAGING REAL-DEVICE PARITY RE-AUDIT IN PROGRESS — PRODUCTION NOT SYNCHRONIZED**

The production/live calculator remains the untouched source of truth. Previous automated gates were insufficient to establish real-device visual parity after owner iPhone testing found material mismatches in Index and Mixes. The independent DR candidate therefore remains in section-by-section real-device parity re-audit.

Production/live hosting, DNS, deployment and real customer data have not been modified by this verification work.

## Current governed calculator state

- Branch: `fire-calculator-exact-live-clone`
- Governed shared-core fingerprint: `9e3c7d705165e5d74ee369e484f428eecafcddd80cdf92a54dfad8fd5dd6604d`
- Offline cache generation: `72`
- Release status: `STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED`
- The manifest is authoritative for the current shared-core file set and fingerprint.
- Later unrelated FIRE Business App / v138 DR commits on this repository do not change calculator synchronization status and must remain outside this calculator audit.

## Automated verification

Automated formula, contract, offline, backup/restore, estimator, Job Math, pricing, input, persistence, navigation and screenshot/geometry checks remain supporting evidence. They are not sufficient by themselves to mark visual parity VERIFIED IDENTICAL after the real-device mismatch.

The DR offline design remains intentional: the calculator must operate independently without requiring ChatGPT/OpenAI connectivity or sign-in. Infrastructure may differ only where it does not alter shared user-visible or business-functional behavior.

## Real-device parity re-audit

The re-audit is being performed against the actual LIVE rendered calculator, section by section. Current acceptance focus remains:

1. SH Mix / Mixes and Chemical Index
2. Equipment
3. Chemicals
4. Job Math
5. Field Tools
6. Field Guide
7. Shared navigation, light/dark presentation, iPhone portrait/safe-area behavior, native keyboard behavior, and OS share/print presentation

A section is not promoted to VERIFIED IDENTICAL merely because a source-level or browser-automation gate passes. Real-device discrepancies take precedence and reopen the affected area.

## Backup portability

The governed target remains portable FIRE Field Calculator Backup v3 / appVersion 18 behavior in both directions, with invalid/corrupt backup handling failing safely. Backup compatibility is a release gate but does not substitute for visual/device acceptance.

## Architecture target

One shared codebase:

**FIRE Calculator Core**

Deployed independently to:

1. Production / LIVE FIRE Calculator
2. Independent Doomsday / DR FIRE Calculator

All visible UI, formulas, pricing logic, validation, navigation, state handling, saved-data schema, export/restore behavior, warnings and business rules belong to the shared core. Only infrastructure adapters may differ.

## Promotion rule

Do not synchronize or promote production while required parity work remains unresolved. Production promotion requires explicit owner approval after real-device acceptance. After intentional promotion, both independent deployments must report the exact same governed shared-core fingerprint before release status can change to synchronized.

## Change classification rule

Every future calculator change must be classified as exactly one of:

- **SHARED FIRE CALCULATOR CHANGE** — must ultimately ship to both deployments from the same governed core release.
- **INFRASTRUCTURE-ONLY CHANGE** — may differ between deployments and must not change user-visible or business-functional behavior.

If a shared change reaches only one deployment after synchronization, release status immediately becomes **SYNCHRONIZATION FAILURE** until corrected.

## Production safety

The existing working LIVE calculator must not be overwritten merely because staging/DR automation is green. Work remains isolated on `fire-calculator-exact-live-clone` until explicit production promotion is approved.
