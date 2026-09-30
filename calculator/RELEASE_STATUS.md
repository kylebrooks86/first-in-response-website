# FIRE Business Calculator — Release Status

## Current status

**NOT SYNCHRONIZED**

The production/live calculator and independent disaster-recovery calculator currently both identify as v18, but they do not yet share a proven identical FIRE Calculator Core fingerprint. They must not be described as identical, synchronized, complete, or production-ready as a dual-deployment pair.

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
- Shared-core fingerprint is generated and tracked in `SHARED_CORE_MANIFEST.json`.
- Production and DR infrastructure-adapter boundaries are defined.
- Formula regression suite currently passes 56/56 approved/default cases.
- Confirmed live-vs-independent differences are recorded in `CURRENT_PARITY_AUDIT.md`.
- Shared staging code has been corrected for confirmed live wording/state gaps including recipe-title formatting, Elemonator checked-state behavior, X-Jet factory guidance, timer warning, and Field Safety wording.
- Bundle/discount stacking behavior remains audit-gated until current live behavior is directly verified; no new stacking formula has been invented.
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
