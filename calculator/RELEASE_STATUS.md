# FIRE Business Calculator — Release Status

## Current status

**NOT SYNCHRONIZED**

The production/live calculator and independent disaster-recovery calculator currently both identify as v18, but they do not yet share a proven identical FIRE Calculator Core fingerprint in production. They must not be described as identical, synchronized, complete, or production-ready as a dual-deployment pair.

## Architecture target

One shared codebase:

**FIRE Calculator Core**

Deployed independently to:

1. Production / Live FIRE Calculator
2. Independent Disaster-Recovery FIRE Calculator

All visible UI, formulas, pricing logic, validation, navigation, state handling, saved-data schema, export/restore behavior, warnings, and business rules belong to the shared core.

Only infrastructure adapters may differ. Examples: hosting provider, deployment URL, secrets, database/storage identifiers, environment variables, and backup destinations.

## Current staging progress

- Isolated staging branch: `fire-calculator-exact-live-clone`
- Production/live calculator has not been overwritten.
- Current staging shared-core fingerprint: `290a2479c351d2cca65a28541739a38eb402e90d6c8998e9a2fb75de6bc919db`.
- Shared-core fingerprint is generated and tracked in `SHARED_CORE_MANIFEST.json`.
- Production and DR infrastructure-adapter boundaries are defined.
- Formula regression suite currently passes 66/66 approved/default and SH Mix reference cases.
- Confirmed live-vs-independent differences are recorded in `CURRENT_PARITY_AUDIT.md` and `JOB_MATH_PARITY_AUDIT.md`.
- Shared staging code has been corrected for confirmed live wording/state gaps including recipe-title formatting, Elemonator checked-state behavior, X-Jet factory guidance, timer warning, Field Safety wording, live Job Math quick navigation, Stock SH header behavior, and first-screen SH Mix controls.
- Job Math Estimate workflow now mirrors the verified live controls for 0.5-point discount increments, whole-dollar final-price override increments, Clear discount, Copy customer quote, Share quote, and Print / Save PDF. The older visible Save estimate draft button is hidden while draft persistence remains available internally.
- The parity gate now scans the estimator-parity module as part of the live-reference contract.
- The DR staging service worker caches the shared estimator-parity module so that workflow remains available offline.
- A paired iPhone-size visual parity harness has been added. It opens the current live calculator and a locally served staging calculator at 390×844, captures launch plus SH Mix, Equipment, Chemicals, Chemical Index, Job Math, Field Guide, and Tools states, and uploads paired screenshots as a GitHub Actions artifact. Screenshot creation alone does not certify visual parity.
- Current staging estimator calculation semantics are explicitly documented as: subtotal → one combined discount percentage → minimum-job floor → positive final-price override replaces the calculated result → deposit percentage. This is staging behavior only and is NOT yet certified as matching live.
- Bundle/discount stacking math, minimum-job ordering, override ordering, exact quote/share/print output, Crew job sheet actions, and full service-estimator state parity remain audit-gated until current live behavior is directly verified. No unverified pricing formula has been invented.
- Visual/iPhone parity, complete state parity, cross-deployment backup restore, and DR takeover are still not verified.

## Change classification rule

Every future change must be classified as exactly one of:

- **SHARED FIRE CALCULATOR CHANGE** — must ship to both deployments from the same core release.
- **INFRASTRUCTURE-ONLY CHANGE** — may differ between deployments and must not change user-visible or business-functional behavior.

If a shared change reaches only one deployment, release status immediately becomes **SYNCHRONIZATION FAILURE** until corrected.

## Promotion gates

A candidate release may be called synchronized only after all of these pass:

- shared-core fingerprints match
- parity matrix contains no NOT YET VERIFIED items for required release scope
- all formula regression tests pass
- iPhone/mobile behavior is visually and functionally verified
- blank, zero, invalid, very large, and normal-value states are verified
- save/load/export/restore are verified
- independent deployment works without ChatGPT/OpenAI dependencies
- recovery handoff is tested with disposable data
- production is not modified until staging acceptance is complete

## Production safety

The existing working live calculator is not to be overwritten while the recovery/shared-core rebuild is in progress. Work proceeds on `fire-calculator-exact-live-clone` until acceptance criteria pass.
