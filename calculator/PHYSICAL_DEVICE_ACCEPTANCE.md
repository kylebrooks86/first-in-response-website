# FIRE Business Calculator — Physical Device Acceptance

This checklist is the final owner-device acceptance step for the verified staging/DR calculator. It does **not** authorize a production deployment.

## Test target

Use the current independent staging/DR calculator on the owner's real iPhone first, then perform a desktop/laptop spot-check.

Production/live remains untouched during this test.

## iPhone acceptance

### Launch and layout

- [ ] Open the calculator in Safari from a normal browser tab.
- [ ] Confirm the header, version, tabs, warning banner and bottom navigation are fully visible.
- [ ] Confirm the top of the calculator does not sit under the Dynamic Island/notch/status area.
- [ ] Confirm the bottom navigation does not collide with the iPhone home indicator.
- [ ] Rotate portrait → landscape → portrait and confirm the layout recovers cleanly.

### Keyboard and fields

- [ ] Open Customer / job name and confirm the keyboard does not hide the active field or required action.
- [ ] Open House Wash, gutter quantity, discount and Job Math numeric fields.
- [ ] Confirm numeric keyboards/input behavior are appropriate.
- [ ] Clear House Wash and confirm it can remain blank after user clearing.
- [ ] Enter a normal House Wash value and verify total updates normally.
- [ ] Scroll while the keyboard is open and verify fixed/sticky controls do not jump or overlap.

### Core calculator routes

Open each route and perform one normal action:

- [ ] SH Mix — change target strength and confirm recipe changes.
- [ ] Equipment — run one normal equipment calculation.
- [ ] Chemicals — open a product and verify dose/dilution controls.
- [ ] Chemical Index — search for a stain/surface and inspect recommendation/compatibility text.
- [ ] Job Math — create a small sample estimate and verify total/deposit math.
- [ ] Field Tools — use one timer or utility and confirm controls respond.
- [ ] Field Guide — open content and confirm normal scrolling/layout.

### Persistence

- [ ] Create disposable test state: customer name, House Wash, gutter quantity, discount and note.
- [ ] Navigate to another route and back; values should remain.
- [ ] Close the Safari tab completely.
- [ ] Reopen the calculator and confirm state returns as expected.

### Backup and restore

Use disposable test data only.

- [ ] Copy/export a backup from DR.
- [ ] Confirm the export completes without error.
- [ ] Restore that backup into a disposable DR session and confirm values return.
- [ ] Try a deliberately invalid JSON file and confirm the safe error reads: `That is not a valid FIRE backup`.
- [ ] Confirm invalid restore does not erase the current estimate.

### Native share / print

These require a physical Apple device because browser automation cannot fully certify native iOS chrome.

- [ ] Use Share and confirm the iOS share sheet opens normally.
- [ ] Verify shared quote text is complete and readable.
- [ ] Use Print and confirm the native print preview opens without clipping or broken layout.
- [ ] Cancel share/print and confirm calculator state remains intact.

### Offline / airplane mode spot-check

The automated airplane-mode gate is already green. This physical-device check confirms the real installed browser environment.

- [ ] Load the calculator once while online.
- [ ] Enable Airplane Mode and disable Wi-Fi.
- [ ] Reload/open the calculator.
- [ ] Open SH Mix, Job Math and Field Tools.
- [ ] Perform one calculation and verify it works.
- [ ] Export a backup while offline.
- [ ] Close and reopen the calculator while still offline.
- [ ] Confirm the saved test state is still present.

## Desktop/laptop spot-check

- [ ] Open staging in a normal desktop browser.
- [ ] Confirm header, tabs, cards and bottom navigation/layout are visually normal.
- [ ] Run one SH Mix calculation.
- [ ] Run one Job Math estimate.
- [ ] Save/reload state.
- [ ] Export a backup.
- [ ] Test Share/Print behavior available on that browser.

## Pass rule

Physical-device acceptance passes only when all required items above are checked or any exception is explicitly documented as an intentional platform-only difference that does not change calculator logic, pricing, state, output, or recovery behavior.

## Failure rule

If any item fails:

1. Do not promote production.
2. Record the exact device/browser, route, field/action, expected behavior and observed behavior.
3. Fix the issue in shared core if user-visible/business-functional.
4. Re-run governed parity, visual/behavior, offline DR and backup portability gates after any shared-core change.
5. Repeat the affected physical-device test.

## Owner approval

Production promotion remains blocked until the owner explicitly confirms physical-device acceptance and explicitly approves production migration.
