# FIRE Business Calculator — Production vs Disaster-Recovery Parity Matrix

Status values are restricted to:

- **VERIFIED IDENTICAL**
- **FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED**
- **NOT YET VERIFIED**
- **INTENTIONAL INFRASTRUCTURE DIFFERENCE**

A row may not be promoted to VERIFIED IDENTICAL without checking both deployments in the same release and state.

## Current audit summary

The current production/live calculator and the independent/recovery calculator are **not yet synchronized**. The independent calculator historically grew from a standalone base with additional v18 parity modules, while the live calculator is a separate ChatGPT Site projection. That is not a valid single-source dual-deployment architecture.

| Area / state | Current status | Audit note / acceptance requirement |
| --- | --- | --- |
| Launch / initial render | NOT YET VERIFIED | Compare first paint, header, warning banner, top tabs, active state, viewport/safe-area behavior, bottom nav and initial saved-state restoration. |
| Header / FIRE branding | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Header structure is mirrored on staging; exact pixel-level title/control spacing and all iPhone saved/install states remain below VERIFIED IDENTICAL threshold. |
| Top navigation | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Verified live seven-tab order is mirrored on staging: SH Mix, Equipment, Chemicals, Chemical Index, Job Math, Field Tools, Field Guide. Route-asserting screenshot harness now verifies the intended route actually opens before capture. |
| Job Math quick navigation | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Staging mirrors live `#topJobNav` / `.top-job-nav` with Mix plan, Measure, Estimate, Loadout and matching target-card behavior. Sticky-position fine comparison remains. |
| Bottom navigation | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Six controls/order are mirrored: SH Mix, Equipment, Mixes, Index, Job Math, Tools. Fixed/safe-area and active-state fine comparison remain. |
| SH Mix — surface selector | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Exact 15-option live surface list/order is present in staging, with House wash as the first/default option. |
| SH Mix — growth selector | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Light / Moderate / Heavy labels and Moderate default are mirrored in staging. |
| SH Mix — batch presets | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Expanded preset list through 250 gallons, Custom amount, quick-batch controls and custom units are mirrored in staging. |
| SH Mix — recipe output | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Staging matches the live `4.00 gal medium house wash` title format and the verified default SH/water/surfactant example. Every surface/growth combination still needs state-matrix testing. |
| SH Mix — stock-strength correction | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Exact live sentence format and stock-card structure are mirrored in staging; edge values remain. |
| Elemonator enable/rate behavior | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Checkbox reflects stored/current rate and total-volume behavior is retained; full saved-state matrix remains. |
| Equipment — X-Jet estimate | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Live default state, measured-percentage control, target-bracketing guidance and pickup/water guidance are mirrored. Final pixel-level iPhone spacing/style certification remains. |
| Equipment — reverse X-Jet | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Desired strength, stock strength, pickup-bucket amount, required bucket strength, exact reverse instruction and surfactant warning now match the live DOM audit. Edge-state matrix remains. |
| Equipment — bucket draw test | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Verified live default is mirrored: 64 fl oz draw → 4.00:1 → 2.00% measured surface strength, including `Use this measured draw`. Edge states remain. |
| Equipment — downstream estimate | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Source-strength/ratio controls, 0.91% default result and exact formula guidance match the live DOM audit. Edge states remain. |
| Equipment — real injector ratio | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Water/chemical draw controls, 10.0:1 default result and measured-surface-strength behavior match the live DOM audit. Edge states remain. |
| Equipment — proportioner planner | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Pump/stock/target/soap controls, valve targets, tank sizes, continuous spray time, 61.5 gal availability and planning warning match the live DOM audit. Edge states remain. |
| Equipment — fill-time estimate | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | 100 gal / 5 GPM → 20 min default state and control structure match the live DOM audit. Edge states remain. |
| Chemicals — product selector | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Live-style 10-product browser/order/default is implemented. Unverified products do not inherit Ettore dosage. Fine screenshot differences remain. |
| Chemicals — dilution/dose | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Verified default Ettore 1–2 fl oz/gal behavior and custom dilution controls are mirrored. Other products remain label-controlled unless verified. |
| Chemical Index | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Live-style 10-product ranked guide, search, and BEST USE / GOOD OPTION / TEST FIRST / AVOID filtering are implemented; copy/spacing fine pass remains. |
| Job Math — mix planning | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Verified fresh defaults 2000 ft² / 300 ft² per gal / 15% reserve and live plan display are mirrored. |
| Job Math — measurement helpers | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Area helper plus Use for mix planning / house price / fence price shortcuts are implemented. |
| Job Math — batch chemical cost | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Verified fresh defaults $4.50 SH and $45 Elemonator plus planned-job status are mirrored. |
| Job Math — service estimator | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Full Estimate card is rendered in live order; service-row/state matrix remains before VERIFIED IDENTICAL. |
| Job Math — minimum job | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Direct live-vs-staging Playwright scenarios match: $22 subtotal floors to $150 total and a $75 deposit; discounted totals above the minimum also match exactly. |
| Job Math — discounts | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Direct live-vs-staging scenarios match 10% discount behavior exactly: $176 → $158.40 and $220 → $198, with matching deposit outputs. |
| Job Math — bundle behavior | NOT YET VERIFIED | Verify whether and how live calculator represents bundles before implementing tests. |
| Job Math — final-price override | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Direct live-vs-staging scenarios prove the override wins after calculated pricing/discount/minimum logic: $100 and $200 overrides produce identical totals and deposits. |
| Job Math — deposit / remaining balance | NOT YET VERIFIED | 50% deposit calculation is directly verified across all five live-vs-staging scenarios; remaining-balance behavior/output still requires a dedicated paired audit before this combined row can be promoted. |
| Customer/job information | NOT YET VERIFIED | Exact fields, persistence, blank states and output inclusion required. |
| Customer quote | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Copy / Share / Print-Save-PDF action set is mirrored; exact output/failure behavior still requires state tests. |
| Crew/job sheet | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Copy crew job sheet / Share crew sheet / Clear this estimate are mirrored; output-state matrix remains. |
| Job loadout / profitability | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Verified default shortage state, planned chemical deduction and blank-profit state are mirrored; nonblank profitability scenarios remain. |
| Pricing editor | NOT YET VERIFIED | Same service schema, rates, units, minimum/deposit business rules and persistence required. |
| Quick Mix Favorites | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Live four default favorites, Save current SH mix, and saved-favorites empty state are implemented; resulting-state tests remain. |
| Stain & Surface Finder | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Live default labels/recommendation copy are mirrored; alternate selections remain. |
| Chemical Compatibility Checker | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Exact live default SH + F9 BARC DO NOT MIX warning is enforced after older core updates; alternate combinations remain. |
| Batch History / Mix Log | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Log/Clear controls and empty-state copy are mirrored; reuse/delete/order/persistence scenarios remain. |
| Chemical Inventory | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Seven live inventory rows/units are mirrored with conversion into shared Job Math inventory state; persistence/use actions need scenario testing. |
| Application Timer | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Live default controls, Pause label and warning are mirrored; background/time-complete behavior still needs scenario testing. |
| Weather Adjustment Guide | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Live fresh 75°F / 5 mph / Mixed / 50% state and default caution copy are mirrored; alternate conditions remain. |
| Custom Chemical Builder | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Live placeholders, default dose, add-button wording and empty state are mirrored; validation/edit/delete persistence remain. |
| Version / update UI | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Live v18/offline inset, update action and exact device-local wording are mirrored; hosting-specific plumbing may differ invisibly. |
| Backup / restore UI | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Live Download backup / Copy backup text / file restore UI and shared schema are mirrored; full restore round-trip remains. |
| Field Safety Card | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Five live safety items including Exposure response are mirrored; visual fine pass remains. |
| Field Guide | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Live-style starting-strength matrix, service-warning accordions and safety order are mirrored; two obscured matrix values remain provisional until separately confirmed. |
| Light mode | NOT YET VERIFIED | Route-by-route screenshot comparison required. |
| Dark mode | NOT YET VERIFIED | Route-by-route screenshot comparison required. |
| iPhone portrait layout | NOT YET VERIFIED | Route-by-route screenshots exist at 390×844; keyboard/safe-area/state variants still remain. |
| Keyboard / numeric input behavior | NOT YET VERIFIED | Input mode, focus, scrolling, decimals, negatives and dismissal behavior required. |
| Reset / clear | NOT YET VERIFIED | Scope, confirmation and resulting default state must be identical. |
| Save / load | NOT YET VERIFIED | Same schema and restoration order required. |
| Copy / share / export | NOT YET VERIFIED | Same output and failure handling required. Native share availability may be platform-specific but fallback behavior must match. |
| Blank values | NOT YET VERIFIED | Required per formula/input. |
| Zero values | NOT YET VERIFIED | Required per formula/input. |
| Negative / invalid values | NOT YET VERIFIED | Same clamping/error/validation behavior required. |
| Very large values | NOT YET VERIFIED | Same handling and no overflow/format divergence. |
| Missing-rate service | NOT YET VERIFIED | Must never silently underquote; exact live behavior must be established and then shared. |
| Network offline — normal calculator | INTENTIONAL INFRASTRUCTURE DIFFERENCE | DR must run without ChatGPT/OpenAI. Shared calculator behavior must remain the same; only asset/data availability plumbing may differ. |
| ChatGPT/OpenAI dependency | INTENTIONAL INFRASTRUCTURE DIFFERENCE | DR shared core must have no mandatory OpenAI/ChatGPT calls or auth for normal calculator operation. Optional adapters must live outside shared core. |
| Hosting URL/domain | INTENTIONAL INFRASTRUCTURE DIFFERENCE | May differ; must not affect UI/logic. |
| Hosting secrets/environment variables | INTENTIONAL INFRASTRUCTURE DIFFERENCE | May differ; must not affect shared user-visible behavior. |

## Mandatory value-state test set

Every numeric calculator input is tested with at least:

1. blank
2. zero
3. smallest valid positive value
4. normal field value
5. decimal value where allowed
6. very large value
7. negative value
8. non-numeric/paste-invalid input where the platform permits it

## Promotion rule

No release is synchronized while any required shared-core row remains NOT YET VERIFIED or while either deployment has a different shared-core fingerprint.
