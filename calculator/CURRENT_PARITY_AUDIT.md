# Current LIVE vs Independent FIRE Calculator Audit

Audit status: **REAL-DEVICE PARITY RE-AUDIT IN PROGRESS — NOT SYNCHRONIZED**

Current governed staging shared-core fingerprint: `9e3c7d705165e5d74ee369e484f428eecafcddd80cdf92a54dfad8fd5dd6604d`

Current DR offline cache generation: `72`

Sources:

- Production/LIVE: current rendered ChatGPT-hosted FIRE Field Calculator v18, reference only
- Independent/Doomsday DR: calculator on `fire-calculator-exact-live-clone`

The manifest is authoritative for the current governed shared-core file set/fingerprint. Older gate anchors and cache generations are historical evidence only and must not be presented as the current build.

Owner iPhone testing found material visual/functional mismatches despite earlier green automated checks. Automated checks therefore remain supporting evidence and cannot independently establish visual parity. Production remains untouched and the DR candidate stays NOT SYNCHRONIZED.

## Current re-audit findings and corrections

The re-audit has addressed or reopened the following areas against the actual LIVE render:

- Index/Mixes: removed the wrong generic Chemical + Mix Index / Custom Mixes interpretation and restored the LIVE Chemical Use Index / SH recipe workflow direction.
- iPhone delivery: stale cache behavior was identified as capable of retaining pre-fix Index/Mixes assets; the current DR cache generation is 72.
- Equipment: X-Jet card treatment, unit pills, result grouping, reverse-calculator grouping, proportioner grouping, and mobile card geometry received direct LIVE-render parity corrections.
- Job Math: quick-navigation placement/visible labels were corrected after light-mode controls rendered incorrectly.
- Governance: real-device discrepancies now explicitly override prior visual-green conclusions.

These corrections do not by themselves promote any affected section to VERIFIED IDENTICAL. Physical-device acceptance and remaining same-state comparisons are still required.

## Automated evidence retained

Existing automated coverage remains useful for regression detection, including formula/contract behavior, estimator states, Job Math, pricing, customer/draft persistence, bundle/promotion behavior, save/reload/clear, quote copy/share/print payload behavior, numeric-input contracts, chemical compatibility, backup/restore, offline operation, and route/card geometry.

Automated screenshot/geometry checks are supporting evidence only. A real-device mismatch reopens the affected area even if those checks pass.

## Offline / disaster-recovery boundary

The independent calculator must remain usable without ChatGPT/OpenAI connectivity or authentication. Service-worker/offline behavior is an intentional infrastructure difference only where it does not alter shared calculator UI, calculations, business rules, state behavior, navigation, validation, or backup semantics.

The current cache identifier is `fire-field-calculator-v18-exact-clone-72`.

## Backup portability target

The governed target remains FIRE Field Calculator Backup v3 / appVersion 18 compatibility, including:

- LIVE-compatible state projection into DR
- DR portable backup suitable for isolated LIVE-compatible restore testing
- invalid/corrupt backup rejection without silently damaging existing state

Backup portability is a release gate but does not substitute for rendered/device parity.

## Current section-by-section acceptance queue

1. SH Mix / Mixes and Chemical Index
2. Equipment
3. Chemicals
4. Job Math
5. Field Tools
6. Field Guide
7. Shared header/navigation and initial render
8. Light mode route-by-route
9. Dark mode route-by-route
10. iPhone portrait safe-area / fixed-navigation behavior
11. Native numeric keyboard presentation/dismissal
12. Native OS share and print/save-PDF presentation

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
