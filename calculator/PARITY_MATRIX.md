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
| Header / FIRE branding | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Live stock-strength structure is now mirrored on staging with `.stock-pill` and `#stockPill`; exact dimensions, colors, title/subtitle spacing, install/theme controls and iPhone rendering still require paired visual verification. |
| Top navigation | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Live six-tab model is now mirrored on staging: SH Mix, Equipment, Chemicals, Chemical Index, Job Math, Field Guide. Field Tools is no longer an extra top tab. Active indicator/scroll/touch visuals still require paired verification. |
| Job Math quick navigation | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Staging now mirrors live `#topJobNav` / `.top-job-nav` with Mix plan, Measure, Estimate, Loadout and matching target-card IDs. Sticky position, spacing and iPhone behavior still require paired visual verification. |
| Bottom navigation | NOT YET VERIFIED | Same six controls, icons, order, labels, active states and fixed/safe-area behavior required. |
| SH Mix — surface selector | NOT YET VERIFIED | Exact options/order/default and state behavior required. |
| SH Mix — growth selector | NOT YET VERIFIED | Light/Moderate/Heavy labels, defaults, active state and target update behavior required. |
| SH Mix — batch presets | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Exact expanded preset list and Custom amount option are mirrored in staging; paired rendering, selector behavior and quick-chip state still require visual/state verification. |
| SH Mix — recipe output | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Staging now matches the live `4.00 gal medium house wash` title format and basic SH/water/surfactant output logic; every surface/growth combination and visual formatting still require paired verification. |
| SH Mix — stock-strength correction | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Exact live sentence format is mirrored in staging; edge values and paired visual verification remain. |
| Elemonator enable/rate behavior | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Checkbox now reflects stored/current rate instead of forcing checked; total-volume behavior and paired live-state verification remain. |
| Equipment — X-Jet estimate | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Independent calculation exists and live factory wording is mirrored; compare defaults, ratio values and visual card exactly. |
| Equipment — reverse X-Jet | NOT YET VERIFIED | Compare desired surface strength, pickup-bucket recipe, surfactant warning and edge states. |
| Equipment — bucket draw test | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Staging includes the live draw-test instructions; timed draw formula, ratio, rounding and edge states still require paired verification. |
| Equipment — downstream estimate | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Formula exists independently; paired state audit required. |
| Equipment — real injector ratio | NOT YET VERIFIED | Paired functional/visual audit required. |
| Equipment — proportioner planner | NOT YET VERIFIED | Water/SH/soap percentages, GPM, tank/runtime behavior and validation require paired audit. |
| Equipment — fill-time estimate | NOT YET VERIFIED | Paired functional/visual audit required. |
| Chemicals — product selector | NOT YET VERIFIED | Exact product list, order, default and product-specific behavior required. No generic dosage may be applied to unverified products. |
| Chemicals — dilution/dose | NOT YET VERIFIED | Product-specific labels/rates and custom dilution math require audit. |
| Chemical Index | NOT YET VERIFIED | Exact entries, rank/search behavior, wording and ordering required. |
| Job Math — mix planning | NOT YET VERIFIED | Area, coverage, reserve, fill size, SH/water/surfactant loadout and blank-state defaults require exact audit. |
| Job Math — measurement helpers | NOT YET VERIFIED | Area and real-coverage helpers require exact audit. |
| Job Math — batch chemical cost | NOT YET VERIFIED | Defaults, price inputs, rounding and outputs require exact audit. |
| Job Math — service estimator | NOT YET VERIFIED | Every service row, unit, rate, quantity, section order, open/closed state and calculation require exact audit. |
| Job Math — minimum job | NOT YET VERIFIED | Approved $150 minimum must be regression-tested in both deployments. |
| Job Math — discounts | NOT YET VERIFIED | Stacking/order/rounding must match the live calculator exactly; no independent interpretation allowed. |
| Job Math — bundle behavior | NOT YET VERIFIED | Verify whether and how live calculator represents bundles before implementing tests. |
| Job Math — final-price override | NOT YET VERIFIED | Exact zero/default behavior and output effects require audit. |
| Job Math — deposit / remaining balance | NOT YET VERIFIED | 50% deposit and remaining-balance wording/math must match live behavior wherever shown. |
| Customer/job information | NOT YET VERIFIED | Exact fields, persistence, blank states and output inclusion required. |
| Customer quote | NOT YET VERIFIED | Line ordering, wording, rates, totals, notes, copy result and error behavior required. |
| Crew/job sheet | NOT YET VERIFIED | Exact fields, output, missing-rate behavior and copy/export behavior required. |
| Job loadout / profitability | NOT YET VERIFIED | Exact inputs, formulas, defaults and output states required. |
| Pricing editor | NOT YET VERIFIED | Same service schema, rates, units, minimum/deposit business rules and persistence required. |
| Quick Mix Favorites | NOT YET VERIFIED | Same favorites, labels, navigation and resulting state required. |
| Stain & Surface Finder | NOT YET VERIFIED | Same inputs, recommendations, warnings and ordering required. |
| Chemical Compatibility Checker | NOT YET VERIFIED | Same combinations, safety warnings and invalid states required. |
| Batch History / Mix Log | NOT YET VERIFIED | Save/reuse/delete/order/persistence behavior required. |
| Chemical Inventory | NOT YET VERIFIED | Same schema, use/clear behavior and persistence required. |
| Application Timer | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Independent timer exists and live warning text is mirrored; compare presets, background behavior, state transitions and formatting. |
| Weather Adjustment Guide | FUNCTIONALLY VERIFIED BUT NOT VISUALLY VERIFIED | Independent guide exists; exact rules/messages and visual output require paired verification. |
| Custom Chemical Builder | NOT YET VERIFIED | Schema, validation, save/edit/delete and persistence required. |
| Version / update UI | NOT YET VERIFIED | Same user-visible version and wording required. Hosting-specific update plumbing may differ invisibly. |
| Backup / restore UI | NOT YET VERIFIED | Same exported schema and restore behavior required; backup destination itself may differ invisibly. |
| Field Safety Card | NOT YET VERIFIED | Exact content/order/icons/wording required. |
| Field Guide | NOT YET VERIFIED | Every section and preset must be audited. |
| Light mode | NOT YET VERIFIED | Route-by-route screenshot comparison required. |
| Dark mode | NOT YET VERIFIED | Route-by-route screenshot comparison required. |
| iPhone portrait layout | NOT YET VERIFIED | Safe areas, sticky/fixed elements, scrolling, keyboard avoidance and tap targets required. |
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
