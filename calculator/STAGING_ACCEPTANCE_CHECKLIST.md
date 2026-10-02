# FIRE Business Calculator — Staging Acceptance Checklist

Do not promote a release until every required item is checked in BOTH staging deployments using disposable test data.

## Release identity

- [ ] Both show the same FIRE Calculator version.
- [ ] Both expose the same shared-core fingerprint.
- [ ] `SHARED_CORE_MANIFEST.json` matches byte-for-byte.
- [ ] Formula regression suite passes with zero failures.
- [ ] No shared-core file differs between deployments.

## Launch / layout

- [ ] Same initial screen.
- [ ] Same header, FIRE badge, title, subtitle, version and stock-SH display.
- [ ] Same warning banner.
- [ ] Same top tabs, order, labels, active state and scrolling.
- [ ] Same bottom navigation, order, icons, labels and active state.
- [ ] Same card order, width, spacing, borders, shadows and backgrounds.
- [ ] Same light-mode colors.
- [ ] Same dark-mode colors.
- [ ] Same iPhone safe-area handling.
- [ ] No top-edge blur/transparency difference.

## SH Mix

- [ ] Every surface option matches.
- [ ] Growth options/default match.
- [ ] Every batch preset and quick-batch option matches.
- [ ] Custom units/defaults match.
- [ ] Recipe wording and rounding match.
- [ ] SH/water/Elemonator values match.
- [ ] Elemonator enable/rate behavior matches.
- [ ] Stock-strength correction matches.
- [ ] Blank/zero/invalid/large inputs match.

## Equipment

- [ ] X-Jet defaults, labels and outputs match.
- [ ] Reverse X-Jet matches.
- [ ] Bucket draw test matches.
- [ ] Downstream estimate matches.
- [ ] Injector-ratio test matches.
- [ ] Three-port proportioner planner matches.
- [ ] Tank/runtime planning matches.
- [ ] Fill-time calculator matches.
- [ ] Every warning/help paragraph matches.

## Chemicals / Index

- [ ] Product list and order match.
- [ ] Dose/dilution controls match.
- [ ] Custom dilution math matches.
- [ ] Search behavior matches.
- [ ] Rank filtering matches.
- [ ] Stain/surface recommendations match.
- [ ] Compatibility warnings match.
- [ ] No unverified product inherits a generic dose silently.

## Job Math

- [ ] Mix-planning fields/defaults match.
- [ ] Area helpers match.
- [ ] Coverage calibration matches.
- [ ] Chemical cost matches.
- [ ] Every service row appears in the same group/order.
- [ ] Every approved rate matches.
- [ ] Every unapproved rate remains unpriced/configurable.
- [ ] Minimum-job behavior matches.
- [ ] Discount behavior matches.
- [ ] Bundle behavior matches.
- [ ] Override behavior matches.
- [ ] Deposit and remaining-balance math/wording match.
- [ ] Customer/job fields match.
- [ ] Customer quote text/order matches.
- [ ] Crew sheet text/order matches.
- [ ] Loadout/profitability fields and math match.
- [ ] Pricing editor behavior and persistence match.

## Field Tools / Guide

- [ ] Quick Mix Favorites match.
- [ ] Batch History / Mix Log matches.
- [ ] Chemical Inventory matches.
- [ ] Timer presets/state/messages match.
- [ ] Weather guide inputs/messages match.
- [ ] Custom Chemical Builder matches.
- [ ] Version/update screen matches.
- [ ] Backup/restore UI and output schema match.
- [ ] Field Safety Card matches.
- [ ] Field Guide content/order matches.

## State / persistence

- [ ] First-run state matches.
- [ ] Reloaded state matches.
- [ ] Saved estimate restores identically.
- [ ] Saved rates restore identically.
- [ ] Timer/weather state restores identically.
- [ ] Mix history restores identically.
- [ ] Custom chemicals restore identically.
- [ ] Theme restores identically.
- [ ] Reset/clear confirmation and resulting state match.

## Value-state matrix

For each relevant numeric field test:

- [ ] blank
- [ ] zero
- [ ] normal value
- [ ] decimal value where valid
- [ ] negative value
- [ ] very large value
- [ ] pasted invalid/non-numeric value where possible

## Copy / export / restore

Automated recovery evidence now verifies the portable FIRE Field Calculator Backup v3 contract in both directions and validates safe handling of invalid backups. Reverse DR → isolated LIVE portability is a hard release gate.

- [x] Production/LIVE backup restores into DR staging.
- [x] DR staging portable backup restores into isolated LIVE acceptance target.
- [x] Invalid backup produces safe error behavior without silently damaging saved state.
- [x] Restore preserves the required tested estimate/planning fields.
- [ ] Customer quote clipboard output matches on physical device.
- [ ] Native OS share/export presentation matches on physical device.

## Mobile / iPhone

- [ ] Portrait layout matches at current iPhone viewport on physical device.
- [ ] Keyboard does not obscure critical active field/action.
- [x] Automated numeric input modes/behavior match.
- [ ] Sticky/fixed controls do not jump or overlap under native keyboard/safe-area conditions.
- [ ] Tab/navigation touch targets match on physical device.
- [x] Automated close/reopen preserves the same state offline.

## DR independence

Automated acceptance evidence: `FIRE Calculator Offline DR Acceptance` passed on calculator verification commit `2ce908d790f240d44ee4c7e6ab35c71b6be78f0b` with the real service worker/cache generation 65, browser network disabled, all seven major routes exercised, an SH Mix dependent calculation changed offline, a portable v3 backup generated, and a full close/reopen completed while still offline. The run observed zero OpenAI/ChatGPT requests and no OpenAI/ChatGPT sign-in requirement.

- [x] Disable network after initial install/cache and launch DR successfully.
- [x] SH Mix works offline.
- [x] Equipment works offline.
- [x] Chemicals/Index works offline.
- [x] Job Math works offline.
- [x] Field Tools/Guide works offline.
- [x] Save/load works offline.
- [x] Export portable backup works offline.
- [x] Close/reopen in airplane mode works.
- [x] No ChatGPT/OpenAI sign-in is required.
- [x] No normal calculator operation requires an OpenAI request.

## Automated parity evidence

The browser automation suite has passed the current calculator candidate for Job Math, shortcuts, Pricing Editor, estimator edge states, customer/draft behavior, bundles/promotions, save/reload/clear, quote copy/share/print behavior, mobile numeric-input behavior, chemical compatibility, visual geometry, and light/dark visual comparison.

These automated checks reduce the remaining acceptance work to native-device presentation items and explicit production-promotion approval; they do not authorize production changes.

## Final acceptance

- [ ] Complete remaining physical-device iPhone acceptance items.
- [ ] Confirm no required parity-matrix row remains unresolved for production promotion.
- [ ] Obtain explicit owner approval for production switch/promote.
- [ ] Deploy the same governed shared-core release to production and DR.
- [ ] Verify both deployments report the exact same shared-core fingerprint.
- [ ] Only then update release status to SYNCHRONIZED.
