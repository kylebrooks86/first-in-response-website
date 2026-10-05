# Current LIVE vs Independent FIRE Calculator Audit

Audit status: **AUTOMATED PARITY ACCEPTANCE COMPLETE — PHYSICAL IPHONE ACCEPTANCE PENDING — NOT SYNCHRONIZED**

Current governed staging shared-core fingerprint: `796216b88d011eb781870d9bcb83eeaedcc38f39ffc7a26c7d4808fd98facaad`

Current DR offline cache generation: `106`

Sources:

- Production/LIVE: current rendered ChatGPT-hosted FIRE Field Calculator v18, reference only
- Independent/Doomsday DR: calculator on `fire-calculator-exact-live-clone`

The manifest is authoritative for the current governed shared-core file set/fingerprint. Older gate anchors and cache generations are historical evidence only and must not be presented as the current build.

Owner iPhone testing previously found material visual/functional mismatches despite earlier green automation. Those mismatches drove a new section-by-section LIVE-render audit. The current cache-106 candidate now passes the rebuilt automated visual, behavior, offline and recovery gates. Production remains untouched and the DR candidate stays NOT SYNCHRONIZED until physical iPhone acceptance and explicit promotion approval.

## Current re-audit findings and corrections

The completed automated re-audit addressed the following areas against the actual LIVE render:

- Index/Mixes: removed the wrong generic Chemical + Mix Index / Custom Mixes interpretation and restored the LIVE Chemical Use Index / SH recipe workflow direction.
- iPhone delivery: stale cache behavior was identified as capable of retaining pre-fix assets; the current DR cache generation is 106.
- Equipment: X-Jet card treatment, unit pills, result grouping, reverse-calculator grouping, proportioner grouping, and mobile card geometry received direct LIVE-render parity corrections.
- Job Math: quick-navigation placement/visible labels were corrected after light-mode controls rendered incorrectly.
- Governance: real-device discrepancies now explicitly override prior visual-green conclusions.

Current automated same-state comparisons, focused geometry, behavior parity, backup/takeover and offline acceptance all pass. Physical-device/native-iOS acceptance is still required before promotion.

## Automated evidence retained

Existing automated coverage remains useful for regression detection, including formula/contract behavior, estimator states, Job Math, pricing, customer/draft persistence, bundle/promotion behavior, save/reload/clear, quote copy/share/print payload behavior, numeric-input contracts, chemical compatibility, backup/restore, offline operation, and route/card geometry.

Automated screenshot/geometry checks are supporting evidence only. A real-device mismatch reopens the affected area even if those checks pass.

## Offline / disaster-recovery boundary

The independent calculator must remain usable without ChatGPT/OpenAI connectivity or authentication. Service-worker/offline behavior is an intentional infrastructure difference only where it does not alter shared calculator UI, calculations, business rules, state behavior, navigation, validation, or backup semantics.

The current cache identifier is `fire-field-calculator-v18-exact-clone-106`.

## Backup portability target

The governed target remains FIRE Field Calculator Backup v3 / appVersion 18 compatibility, including:

- LIVE-compatible state projection into DR
- DR portable backup suitable for isolated LIVE-compatible restore testing
- invalid/corrupt backup rejection without silently damaging existing state

Backup portability is a release gate but does not substitute for rendered/device parity.

## Remaining acceptance queue

Automated section-by-section LIVE-vs-DR acceptance is complete for SH Mix, Chemical Index, Equipment, Chemicals, Job Math, Field Tools, Field Guide, shared shell/navigation, light/dark routes, persistence, numeric-input behavior, backup portability and offline operation.

Remaining pre-promotion checks:

1. Physical iPhone portrait/safe-area confirmation
2. Native keyboard presentation/dismissal
3. Native OS share and print/save-PDF presentation
4. Explicit owner approval for production promotion

No row is VERIFIED IDENTICAL solely because source-level, formula, or browser-automation tests pass.

## Business-rule preservation

This parity project must not silently change calculator business rules while matching UI. Current governed calculator values remain whatever is encoded by the shared core and its pricing editor; unapproved services remain configurable rather than being assigned guessed prices. The parity pass is not a venue for unrelated pricing changes.

## Separation from FIRE Business App work

Unrelated FIRE Business App / v138 Cloudflare/D1/Doomsday work may coexist in the same repository. It is outside this calculator audit and must not be treated as calculator parity evidence or merged conceptually into this release.

## Remaining release-level work

Before synchronization:

- complete same-state LIVE-vs-DR rendered comparison for the remaining queue
- complete physical iPhone acceptance for native safe-area, keyboard, share, and print presentation
- retain backup portability and invalid-backup safety
- obtain explicit owner approval before production promotion
- promote only the governed shared core intentionally
- prove both independent deployments report the exact same governed shared-core fingerprint after promotion

Until those steps are deliberately completed, keep status **NOT SYNCHRONIZED** and do not alter production.
