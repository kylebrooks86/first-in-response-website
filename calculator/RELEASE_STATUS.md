# FIRE Business Calculator — Release Status

## Current status

**NOT SYNCHRONIZED**

The production/live calculator and independent disaster-recovery calculator currently both identify as v18, but they are not yet a certified identical dual-deployment release. Production remains the reference baseline and has not been overwritten.

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
- Current staging shared-core fingerprint: `0f41f23ebbcbad92d7456b280b7269c718577f60a827ce815df8b4f2820b543f`.
- Shared-core fingerprint is generated and tracked in `SHARED_CORE_MANIFEST.json`.
- Formula regression, live-reference contract, and shared-core fingerprint integrity gates pass.
- Direct live-vs-staging Job Math scenarios verify minimum-job behavior, discounts, final-price override ordering, and 50% deposit calculations.
- Bundle/promotion behavior is directly verified: $220 baseline → +10% bundle = $198 → +15% promotion stacks to 25% / $165 → Clear returns to $220.
- Pricing Editor behavior is directly verified against live and the live 30-service structure is mirrored without changing approved prices.
- Estimator edge-state parity is directly verified for blank, zero, negative, decimal, very large, invalid-text, and missing-rate Roof Cleaning cases.
- Customer/job field defaults, placeholders, quote inclusion behavior, and reload persistence match live in direct paired testing.
- Save/reload/clear now matches live for customer name, House Wash quantity, estimate notes, discount, pricing preservation, and Job Math planning/measurement/calibration fields.
- Customer quote copy text, share payload, and Print / Save PDF action behavior match live in paired export testing.
- SH Mix, Equipment, Chemicals, Chemical Index, Job Math, Field Tools, and Field Guide all have shared-core parity modules and are substantially aligned functionally.
- The paired 390×844 iPhone harness captures light/dark screenshots, structured DOM audits, and computed-style diagnostics for every top route.
- The visual audit still reports significant measurable differences, so the staging calculator is not yet visually identical.
- DR staging caches the shared calculator assets and does not require ChatGPT/OpenAI calls for normal calculator operation.
- Live-backup → DR-restore takeover verification is actively being hardened; this is not yet promoted to complete until the restored-value assertion passes end-to-end.

## Remaining major gates

- reduce route-by-route light/dark visual differences to the verified-identical threshold
- launch/first-paint and iPhone safe-area certification
- keyboard/numeric-input interaction behavior across all supported numeric fields
- remaining Field Tools alternate-state/persistence scenarios
- live-backup → DR restore restored-value assertion
- final airplane-mode/offline DR takeover acceptance with disposable data
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
- blank, zero, invalid, very large, and normal-value states are verified for required inputs
- save/load/export/restore are verified
- independent deployment works without ChatGPT/OpenAI dependencies
- recovery handoff is tested with disposable data
- production is not modified until staging acceptance is complete

## Production safety

The existing working live calculator is not to be overwritten while the recovery/shared-core rebuild is in progress. Work proceeds on `fire-calculator-exact-live-clone` until acceptance criteria pass.
