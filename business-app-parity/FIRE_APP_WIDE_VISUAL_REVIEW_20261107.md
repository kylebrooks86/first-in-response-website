# FIRE Business App — 100% visual consistency review: tracked scope and acceptance

**Owner request:** Apply all five standards across the **entire existing FIRE Business App**: button geometry and pressed/focus feedback; polished but restrained cards; active navigation distinction; typography/amount alignment; mobile overflow and cut-off fixes. Not a redesign. Do not put a red outline around every control.

**Working source:** draft PR #193, stacked on #192 > #191 > #188 > #190 > #187 > #186; all unmerged and not deployed. CI must be verified against the **final exact head SHA**, not an earlier stacked branch. No hosted QA or LIVE writes are authorized.

## Design system rules
- **Red** is the FIRE active/important brand accent. **Green** means documented completion/settlement, **blue** informational/scheduled/viewed, **amber** actionable due/attention, **red alerts** actual exceptions and errors. Routine/unknown/declined states are **not** all emergencies. Never rely only on color: always retain label + meaningful icon.
- Existing card variants/financial badges remain authoritative. Shared light/dark card border and soft shadow are used where an owner is reading or navigating, with subtle lift only on true hover devices. Keyboard focus always remains visible; reduced-motion preference is respected.
- **44px minimum** touch targets in ordinary action groups, **48px** job/customer/contact controls where grouped, **16px** standard app-action icons, **19px** sidebar and **20px** phone bottom-nav icons. Small X in top-right with **44px** target and 16px icon.
- Tabular financial figures, safe responsive wrapping, no overlap with action arrows or close controls. Do not change any saved amount, payment state, estimate status, mobile phone handoff, privacy rule or customer content.

## Complete surface inventory and evidence matrix

**Evidence legend:** S = owner UI source and shared style rules inspected/mapped; C = synthetic source/compiled browser tests added or pre-existing; H = authenticated hosted QA still requires exact-version observation; D = real Acer/iPhone/tablet acceptance not established. **S or C does not mean 100% visual PASS.** Confirm every state and width before closing.

| Owner surface | Applied/reused style source | Evidence now | Pending hosted/device acceptance |
|---|---|---|---|
| Global header / search | Existing compact header, search focus, touch targets, overflow safeguards | S, existing C | H, D: long search, 200% zoom, on-screen keyboard |
| Sidebar / More tools | 19px icons, 44px rows, active group emphasis, keyboard outline | S, new C | H, D: light/dark, long tool labels, open drawer |
| Bottom navigation | 20px icons, active accent halo, 52px targets, safe-area from existing CSS | S, new C | H, D: physical iPhone Home Screen/safe areas, landscape |
| Home metrics and recent estimates | Shared card depth; #192 arrow gutter, forecast scroll hint, KPI tabular numerals | S, new C | H, D: live saved records, both themes, small phone |
| Customers directory | Shared border/depth + hover/focus, status copy, overflow handling | S, new C | H, D: empty/error, long names, multiple customer records |
| Customer profile / contacts | #191 48px Call/Text/Email/Maps/Territory and distinct personal backups; 16px icons | S, existing C | H, D: optional actions, personal-number warning, keyboard |
| Customer Photos / media | Shared panel and 48px photo controls, photo permission separate from actual saved media | S, existing C | H, D: before/after, upload, empty/offline/recovery, real photos |
| New / Edit Estimate | Earlier 50+ service picker/touch fixes; standard editor actions and statuses | S, existing C | H, D: full list first/last, long descriptions, save/reopen |
| Estimate detail / job | #190 48px action geometry, concise photo permission badge, existing milestone icons/colors | S, existing C | H, D: full scroll, long signatures, all payment/status combinations |
| Edit / Send Invoice | Existing guarded editor and #191 uniform invoice actions | S, existing C | H, D: balance/overpayment, keyboard, readable footer |
| Contracts / agreements | Shared card contrast; preserved signed status and customer-facing preview | S, existing C | H, D: long agreement, status and last-row tap |
| Schedule / calendar | Shared calendar/panel depth, contrast, action focus | S, existing C | H, D: full calendar, weather route, day/week, landscape |
| Follow-ups / callbacks | Existing due/handled phone icons, shared action geometry and accessible cards | S, existing C | H, D: overdue/due now/handled semantics, long names |
| Payments / tips / refunds | Tabular amounts, secondary legibility, preserved explicit payment/review colors | S, existing C | H, D: large/zero numbers, negative refunds, provider states |
| Business tasks / expenses | Shared headings, panels, 44px actions and readable secondary text | S, existing C | H, D: task due/status, forms, errors and complete history |
| Insights / reports | KPI cards, tabular financial values, deep vs soft contrast, light/dark | S, new C | H, D: long amount, empty/no-data, graph labels and colors |
| Territory / door knocking | Existing 44px map/door actions and keyboard focus retained, never alter map controls | S, existing C | H, D: pins, small screen, selected statuses and action menus |
| Settings / templates | Reused 44px save/edit, labels, readable headings, overflow and long templates | S, existing C | H, D: unsaved state, long editor and keyboard close |
| Notifications / attention | Existing unread/priority icon semantics, shared border/target/focus styles | S, existing C | H, D: unread naturally present, mark all persistence |
| Job report / job costs | Earlier 48px buttons, wrapped names, numeric alignment, no finance mutations | S, existing C | H, D: long notes, values and final save/close |
| Voice call/text modals | Actual Google Voice Call+Text dialogs now scroll contents inside a body and leave top-right X outside | S, new C | H, D: physical Safari/Android keyboard, number handoff and close |

## Exact-width and state matrix required for claim of completion
For each relevant surface, check **320, 350, 375, 390, 430, 667 landscape, 760, 768, 820, 1024, 1366 px**. Both **light/dark**. Real mobile browser, 200% text zoom, reduced-motion, physical keyboard/screen keyboard, empty/loading/offline/error/success/disabled, long customer names/amounts and deeply scrolled dialogs. Synthetic browser tests only exercise representative controls, **not every actual view/data state**.

## Findings / disposition
1. **Owner-confirmed visual defect:** job-details action sizes on Acer differed from backups/tools. Draft #190/#191 normalize owner action geometry. Needs hosted acceptance.
2. **Owner-requested wording:** agreement photo permission becomes *Photos: Yes/No/Not recorded* with icon; do not infer any photos were saved. Draft #190.
3. **Small-screen Home:** card arrow and amount text crowded and seven-day weather clipping seemed accidental. Draft #192 reserves arrow gutter and provides a phone swipe cue.
4. **Visual cohesion:** new #193 shared tokens, card depth, light/dark selected navigation, headings, numeric alignment, secondary text and motion/focus restrictions. No blanket red outlines.
5. **Voice dialog close:** earlier synthetic browser check exposed long scrolling root that moved X offscreen (1366px dark). #193 uses actual separate scrollable content in both Google Voice call and text dialogs and updates the synthetic test target; must still pass exact source run and real device.
6. **Narrow phone dashboard hiding critical metrics:** a legacy `@media(max-width:430px)` rule hid KPI cards 3 and 4, which correspond to Saved Estimates and Completed Jobs. New app-wide rules restore all four cards with 2-column layouts on ordinary phones and 1-column layout at <=350px. New actual compiled-CSS browser fixture includes all four and asserts visible, nonclipped geometry in dark/light at 320–1366px.
7. **Unequal invoice action heights at 320px:** synthetic Chrome exposed different Open/Record payment button heights from flex wrapping. Draft now uses an equal-height two-column invoice action grid and equalized personal-backup row sizing; exact-head browser validation still required.
8. **Potential other defects:** all H/D state rows remain **OPEN** until their exact version is rendered, observed, and signed off. Source controls in 43 named React components are NOT exhaustively proven by 19 core source contracts.

## Release guard and evidence
- Test files: `scripts/test-appwide-visual-system.mjs`, `scripts/test-appwide-visual-browser.mjs`, `scripts/test-job-action-consistency-browser.mjs`, `scripts/test-customer-invoice-visual-browser.mjs`, `scripts/test-customer-write-browser.mjs`, and prior iPhone menu/theme regressions.
- No live QA/production deployments, no database migration or D1/R2/Stripe/provider writes, no customer emails/texts, no payments or site changes. Owner's previously accepted Google Voice handoffs and offline photo custody are not to be repeated without a regression.
- **Production gate #19 remains 3/10 accepted, NO-GO.** Only an independently authorized QA code/assets change following exact-head CI, target-resource verification and rollback review can precede real-device acceptance. Keep LIVE out of scope.

This document prevents a false “100% done” claim when a visual source-wide rule has been authored but complete hosted and physical-device acceptance has not occurred.
