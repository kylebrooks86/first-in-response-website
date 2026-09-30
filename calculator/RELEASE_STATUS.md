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

All visible UI, formulas, pricing logic, validation, navigation, state handling, saved-data schema, export/restore behavior, warnings, and business rules belong to the shared core. Only infrastructure adapters may differ.

## Current staging progress

- Isolated staging branch: `fire-calculator-exact-live-clone`.
- Production/live calculator has not been overwritten.
- Current staging shared-core fingerprint: `944aab0b4ac3b256b03f4a725cf76f10813afc09a7f1fe59cf537f772faabd46`.
- Shared-core fingerprint is generated and tracked in `SHARED_CORE_MANIFEST.json`.
- Production and DR infrastructure-adapter boundaries are defined.
- Formula regression suite passes the approved/default pricing and SH Mix reference cases.
- Direct live-vs-staging Job Math scenarios now verify the current live order/behavior for minimum job, discounts, final-price override, and 50% deposit.
- Bundle/promotion behavior is directly verified: $220 baseline → +10% bundle = 10% / $198 → +15% promotion = 25% / $165 → Clear = 0% / $220 on both live and staging.
- Pricing Editor behavior is directly verified against live and the live 30-service structure is mirrored without intentionally changing approved rate values.
- Estimator edge-state parity is directly verified for blank, zero, negative, decimal, very large, invalid-text, and missing-rate Roof Cleaning cases. Invalid numeric text is sanitized to blank on both deployments.
- Customer/job field defaults/placeholders and reload persistence have matched live in direct paired testing; the current live customer name is not inserted into the customer quote by default and staging mirrors that behavior.
- The paired iPhone-size visual parity harness now retries route activation, asserts the intended route, captures launch plus all seven top routes at 390×844, and exports both screenshots and structured DOM audits.
- SH Mix, Equipment, Chemicals, Chemical Index, Job Math, Field Tools, and Field Guide all have shared-core parity modules and are substantially aligned functionally. Pixel-level/variant visual certification remains incomplete.
- DR staging caches the shared calculator assets and does not require ChatGPT/OpenAI calls for normal calculator operation, but full offline takeover/backup-restore acceptance has not yet been performed.

## Remaining major gates

- launch/first-paint visual certification
- light-mode route-by-route visual certification
- dark-mode route-by-route parity
- iPhone safe-area, keyboard and numeric-input interaction behavior
- reset/clear scope and state restoration
- save/load state round-trip beyond the already-tested customer field
- exact copy/share/export outputs and failure fallbacks
- full backup/export/restore round-trip between deployments
- remaining Field Tools persistence/alternate-state scenarios
- final DR offline takeover test with disposable data
- production and DR must ultimately deploy the exact same shared-core release/fingerprint

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
