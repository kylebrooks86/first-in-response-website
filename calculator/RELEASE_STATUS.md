# FIRE Business Calculator — Release Status

## Current status

**AUTOMATED PARITY ACCEPTANCE COMPLETE — PHYSICAL IPHONE ACCEPTANCE PENDING — PRODUCTION NOT SYNCHRONIZED**

The production/live calculator remains the untouched source of truth. The independent DR candidate has completed the current automated LIVE-vs-DR parity, behavior, visual-geometry, backup/takeover and offline acceptance suite. Physical iPhone acceptance remains the final pre-promotion gate because native iOS rendering, keyboard, share and print presentation cannot be fully proven by browser automation.

Production/live hosting, DNS, deployment and real customer data have not been modified by this verification work.

## Current governed calculator state

- Branch: `fire-calculator-exact-live-clone`
- Governed shared-core fingerprint: `796216b88d011eb781870d9bcb83eeaedcc38f39ffc7a26c7d4808fd98facaad`
- Offline cache generation: `106`
- Release status: `STAGING_CANDIDATE_ONLY_NOT_SYNCHRONIZED`
- The manifest is authoritative for the current shared-core file set and fingerprint.
- Later unrelated FIRE Business App / v138 DR commits on this repository do not change calculator synchronization status and must remain outside this calculator audit.

## Automated verification

Automated formula, contract, offline, backup/restore, estimator, Job Math, pricing, input, persistence, navigation, light/dark screenshot and geometry checks all pass on the current staging candidate. Focused card geometry is within small tolerance across the audited sections, and the shared mobile shell/header/warning/navigation/safe-area geometry has been corrected against LIVE. These checks establish the automated baseline, but they do not replace physical iPhone acceptance.

The DR offline design remains intentional: the calculator must operate independently without requiring ChatGPT/OpenAI connectivity or sign-in. Infrastructure may differ only where it does not alter shared user-visible or business-functional behavior.

## Real-device parity re-audit

The automated re-audit against the actual LIVE rendered calculator is complete. Remaining acceptance focus is:

1. Physical iPhone portrait and safe-area confirmation
2. Native iOS keyboard presentation/dismissal
3. Native OS share sheet and print/save-PDF presentation
4. Explicit owner approval before any production promotion

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
