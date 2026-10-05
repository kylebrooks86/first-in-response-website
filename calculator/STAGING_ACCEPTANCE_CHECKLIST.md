# FIRE Business Calculator — Staging Acceptance Checklist

Do not promote this release until every required parity item is verified against the actual LIVE calculator and all physical-device acceptance items are complete.

Current release state: **REAL-DEVICE PARITY RE-AUDIT IN PROGRESS — NOT SYNCHRONIZED**

Current governed DR identity:

- Shared-core fingerprint: `9e3c7d705165e5d74ee369e484f428eecafcddd80cdf92a54dfad8fd5dd6604d`
- Offline cache generation: `72`
- Branch: `fire-calculator-exact-live-clone`

The owner’s iPhone test found material Index/Mixes visual/functional mismatches despite earlier green automation. Therefore unchecked rendered/device items below remain true release blockers. Automated checks are regression evidence only and cannot close a real-device mismatch.

## Release identity

- [ ] LIVE and DR show the same FIRE Calculator version after intentional promotion.
- [ ] LIVE and DR expose the same shared-core fingerprint after intentional promotion.
- [ ] `SHARED_CORE_MANIFEST.json` matches the promoted shared core.
- [x] Formula regression/contract automation has passed on staging.
- [ ] No shared-core file differs between independently deployed LIVE and DR after promotion.

## Launch / layout

- [ ] Same initial screen.
- [ ] Same header, FIRE badge, title, subtitle, version and stock-SH display.
- [ ] Same warning banner.
- [ ] Same top tabs, order, labels, active state and scrolling.
- [ ] Same bottom navigation, order, icons, labels and active state.
- [ ] Same card order, width, spacing, borders, shadows and backgrounds.
- [ ] Same light-mode colors route-by-route.
- [ ] Same dark-mode colors route-by-route.
- [ ] Same iPhone safe-area handling.
- [ ] No top-edge blur/transparency difference.

## SH Mix / Mixes

- [ ] Surface options/order match LIVE.
- [ ] Growth options/default match LIVE.
- [ ] Batch presets and quick-batch options match LIVE.
- [ ] Custom units/defaults match LIVE.
- [ ] Recipe wording and rounding match LIVE.
- [ ] SH/water/Elemonator values match LIVE.
- [ ] Elemonator enable/rate behavior matches LIVE.
- [ ] Stock-strength correction matches LIVE.
- [ ] Blank/zero/invalid/large inputs match LIVE.
- [ ] iPhone card structure, spacing and control sizing match LIVE.

## Chemical Index / Chemicals

- [ ] Chemical Use Index product list and order match LIVE.
- [ ] Index card structure/spacing match LIVE on iPhone.
- [ ] Search behavior matches LIVE.
- [ ] Rank filtering matches LIVE.
- [ ] Dose/dilution controls match LIVE.
- [ ] Custom dilution math matches LIVE.
- [ ] Stain/surface recommendations match LIVE.
- [ ] Compatibility warnings match LIVE.
- [ ] No unverified product inherits a generic dose silently.

## Equipment

Direct parity corrections have been applied for X-Jet card treatment, unit pills, result grouping, reverse-calculator grouping and proportioner grouping. These remain acceptance items until compared on the real device.

- [ ] X-Jet defaults, labels, card treatment and outputs match LIVE.
- [ ] Reverse X-Jet structure/results match LIVE.
- [ ] Bucket draw test matches LIVE.
- [ ] Downstream estimate matches LIVE.
- [ ] Injector-ratio test matches LIVE.
- [ ] Three-port proportioner planner structure/results match LIVE.
- [ ] Tank/runtime planning matches LIVE.
- [ ] Fill-time calculator matches LIVE.
- [ ] Every warning/help paragraph matches LIVE.
- [ ] iPhone Equipment card geometry matches LIVE.

## Job Math

Automated behavior remains useful regression evidence, and quick-navigation visibility/placement received a parity correction. Physical/rendered acceptance remains open.

- [ ] Mix-planning fields/defaults match LIVE.
- [ ] Area helpers match LIVE.
- [ ] Coverage calibration matches LIVE.
- [ ] Chemical cost matches LIVE.
- [ ] Service rows/groups/order match LIVE.
- [ ] Approved rates match the governed LIVE calculator release.
- [ ] Unapproved rates remain unpriced/configurable.
- [ ] Minimum-job behavior matches LIVE.
- [ ] Discount and bundle behavior match LIVE.
- [ ] Override behavior matches LIVE.
- [ ] Deposit and remaining-balance math/wording match LIVE.
- [ ] Customer/job fields match LIVE.
- [ ] Customer quote and crew-sheet output/order match LIVE.
- [ ] Loadout/profitability fields and math match LIVE.
- [ ] Pricing editor behavior/persistence match LIVE.
- [ ] iPhone quick navigation and card geometry match LIVE.

## Field Tools / Field Guide

- [ ] Quick Mix Favorites match LIVE.
- [ ] Batch History / Mix Log matches LIVE.
- [ ] Chemical Inventory matches LIVE.
- [ ] Timer presets/state/messages match LIVE.
- [ ] Weather guide inputs/messages match LIVE.
- [ ] Custom Chemical Builder matches LIVE.
- [ ] Version/update screen matches LIVE.
- [ ] Backup/restore UI matches LIVE-compatible behavior.
- [ ] Field Safety Card matches LIVE.
- [ ] Field Guide content/order/card presentation matches LIVE.

## State / persistence

- [ ] First-run state matches LIVE.
- [ ] Reloaded state matches LIVE.
- [ ] Saved estimate restores identically.
- [ ] Saved rates restore identically.
- [ ] Timer/weather state restores identically.
- [ ] Mix history restores identically.
- [ ] Custom chemicals restore identically.
- [ ] Theme restores identically.
- [ ] Reset/clear confirmation and resulting state match LIVE.

## Value-state matrix

For each relevant numeric field compare LIVE and DR for:

- [ ] blank
- [ ] zero
- [ ] normal value
- [ ] decimal value where valid
- [ ] negative value
- [ ] very large value
- [ ] pasted invalid/non-numeric value where possible

## Backup / restore / export

Automated recovery evidence supports the portable FIRE Field Calculator Backup v3 / appVersion 18 contract, but rendered/native presentation remains separate.

- [x] LIVE-compatible backup restores into DR staging in automated acceptance.
- [x] DR portable backup restores into isolated LIVE-compatible acceptance target.
- [x] Invalid backup fails safely in automated acceptance.
- [x] Required tested estimate/planning state survives automated restore.
- [ ] Backup/restore controls and wording match LIVE render.
- [ ] Customer quote clipboard presentation matches on physical iPhone.
- [ ] Native OS share/export presentation matches on physical iPhone.
- [ ] Native print/save-PDF presentation matches on physical iPhone.

## Mobile / iPhone

- [ ] Portrait layout matches LIVE at the owner’s current iPhone viewport.
- [ ] Keyboard does not obscure critical active field/action.
- [x] Automated numeric input metadata/behavior has regression coverage.
- [ ] Sticky/fixed controls do not jump or overlap under native keyboard/safe-area conditions.
- [ ] Tab/navigation touch targets match LIVE on physical device.
- [ ] Light-mode route-by-route physical-device acceptance complete.
- [ ] Dark-mode route-by-route physical-device acceptance complete.
- [x] Automated close/reopen preserves state offline.

## DR independence

- [x] DR has automated offline-launch acceptance evidence.
- [x] SH Mix works offline in automated acceptance.
- [x] Equipment works offline in automated acceptance.
- [x] Chemicals/Index works offline in automated acceptance.
- [x] Job Math works offline in automated acceptance.
- [x] Field Tools/Guide works offline in automated acceptance.
- [x] Save/load works offline in automated acceptance.
- [x] Portable backup export works offline in automated acceptance.
- [x] Close/reopen works offline in automated acceptance.
- [x] No ChatGPT/OpenAI sign-in is required for normal DR calculator operation.

Current service-worker cache identifier: `fire-field-calculator-v18-exact-clone-72`.

## Production safety

- [x] Production/LIVE remains reference-only during this re-audit.
- [x] No production DNS change is authorized.
- [x] No production deployment is authorized.
- [x] No real customer data change is authorized.
- [x] Unrelated FIRE Business App / v138 work is outside this calculator acceptance checklist.

## Final acceptance

- [ ] Complete same-state LIVE-vs-DR rendered comparisons for every required section.
- [ ] Complete remaining physical-device iPhone acceptance items.
- [ ] Confirm no required parity row remains unresolved.
- [ ] Obtain explicit owner approval for production promotion.
- [ ] Deploy the same governed shared-core release intentionally to LIVE and DR.
- [ ] Verify both deployments report the exact same shared-core fingerprint.
- [ ] Only then update release status to SYNCHRONIZED.
