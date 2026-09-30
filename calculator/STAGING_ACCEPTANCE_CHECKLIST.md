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

- [ ] Customer quote clipboard output matches.
- [ ] Any share/export output matches.
- [ ] Backup JSON schema matches.
- [ ] Production staging backup restores into DR staging.
- [ ] DR staging backup restores into production staging.
- [ ] Invalid backup produces the same safe error behavior.
- [ ] Restore does not silently omit fields.

## Mobile / iPhone

- [ ] Portrait layout matches at current iPhone viewport.
- [ ] Keyboard does not obscure critical active field/action.
- [ ] Numeric keyboards/input modes match.
- [ ] Sticky/fixed controls do not jump or overlap.
- [ ] Tab/navigation touch targets match.
- [ ] Close/reopen preserves the same state.

## DR independence

- [ ] Disable network after initial install/cache and launch DR successfully.
- [ ] SH Mix works offline.
- [ ] Equipment works offline.
- [ ] Chemicals/Index work offline.
- [ ] Job Math works offline.
- [ ] Field Tools/Guide work offline.
- [ ] Save/load works offline.
- [ ] Export backup works offline.
- [ ] Close/reopen in airplane mode works.
- [ ] No ChatGPT/OpenAI sign-in is required.
- [ ] No normal calculator operation requires an OpenAI request.

## Final acceptance

- [ ] `PARITY_MATRIX.md` has no required NOT YET VERIFIED rows.
- [ ] Every required row is VERIFIED IDENTICAL or a documented INTENTIONAL INFRASTRUCTURE DIFFERENCE.
- [ ] Release status updated to SYNCHRONIZED.
- [ ] Production switch/promote explicitly approved after staging passes.
