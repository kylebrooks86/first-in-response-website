# FIRE Business App — Full pre-QA usability, spacing and workflow audit
**Existing FIRE app only; not the public website.** User-requested pre-release inspection, Oct 31 Tulsa / Nov 1 UTC. Owner-approved visual identity and compact iPhone look are preserved. No new features, customer sends, backend migrations, Cloudflare publication, LIVE writes or Stripe actions.

## Evidence and interpretation
- **Starting combined candidate**: draft [PR #77](https://github.com/kylebrooks86/first-in-response-website/pull/77) includes PR #76 mobile picker fixes and PR #74 customer Text/Email guards.
- **Prior combined CI**: exact commit `eeceb0f71cb46196bec799edeb4dafca101edc84` had 13/13 successful workflows including New Estimate, full app build, customer writes/history, offline photos/auth, source/mobile menus, and 71 React/Radix customer messaging browser checks.
- **New audit source**: same PR #77 adds a scoped 44px reminder/control correction plus a compiled real-app-CSS synthetic iPhone header/notification/bottom-action browser test. On first source checkpoint `b88dff4a1dd9cb406134101611ec194b9d463366`, new audit [CI 41271794598](https://github.com/kylebrooks86/first-in-response-website/actions/runs/41271794598) passed **50/50** at 320×568, 375×667, 390×844, 430×932, 667×375, in light/dark. More small customer disclosure corrections and test assertions were then added; **re-run latest exact-head CI before treating new commit as green**.
- **IMPORTANT**: Source inspection and Chrome simulated-touch fixtures are **not** a visual/functional audit of every loaded state on an actual iPhone. Hosted QA is currently the older owner-accepted `a193a571f0164231659b157584c350bc0506bb9b` version. The draft has not been deployed. Keep real Safari/installed Home Screen checks explicitly OPEN.
- Production release gates **3/10** unchanged. These are release-evidence gates, not percentage of UI code written.

## Confirmed source findings corrected in draft (not deployed)
| ID | Screen | Source finding and correction | Exit evidence |
|---|---|---|---|
| UX-TAP-11 | Notifications / Needs attention | Refresh and All/Priority buttons were 36px high; raised to 44px without changing commands, reminder counts or position. | Compiled CSS browser audit and updated scoped source rules; device still open |
| UX-TAP-12 | Notifications / older reminders | 'Show next' and pagination/reminder coverage buttons had 40px minimum; now 44px. No change to load limits or data. | Compiled CSS browser audit; device still open |
| UX-TAP-13 | Customer activity, yard sign disclosure | Sign details summary had 30px base / 40px customer flag override; now 44px minimum. All sign content and action unchanged. | New synthetic style assertion added; must pass latest exact-head CI |
| UX-TAP-01 | New Estimate, Edit Estimate, Edit Invoice | 50+-item service menu: Custom first, compact scroll, final option clearance, mobile tap target. Existing PR #76 correction retained. | Original 124 source + 92 Chrome touch browser assertions; earlier intermittent 390×844 dark last-row failure passed on rerun; real iPhone still open |
| UX-SAVE-01 | Edit Estimate | Prevent deleting final service line and leaving an unsavable empty estimate; keep 44px delete hit area. | Existing targeted regression; real QA save/reopen still needed |
| UX-CONTACT-01 | Customer Text / Email | Explicit valid contact and nonblank message before preparation; distinguish never-sent vs prepared, require owner confirmation, Google Voice primary. | Current PR #77 71 actual composer browser checks in 8 viewport/theme combinations; actual OS handoff still open |
| UX-COPY-01 | Estimate line editors | Fixed scope-description auto-growing textarea; compact scrollable editor across create/edit/final-invoice. Labels/help shortened without changing saved descriptions, discounts or finance rules. | Existing full source/build and New Estimate regression; final iPhone readability still open |

## Source-mapped screen and workflow checklist (not a claim of physical acceptance)
Legend: **Source** = code/design/control location reviewed or existing regression evidence observed. **Device** = targeted owner iPhone Safari/PWA check after separately approved QA-only update. **No new unrelated retests** for earlier owner-accepted areas unless the new candidate changed them.

| Surface | Source/automation evidence | Device/remaining acceptance — do not infer PASS |
|---|---|---|
| Home / Today | `DashboardView`, dashboard route, next job/card/notification actions, bottom navigation; header synthetic overlap and final-bottom-action checks | Header actions in compact 320–430 view (including 39px deliberate tight header), touch with thumb; no clipped last card |
| Customers list / Add / Edit | `CustomersView`, `AddCustomer`, `EditCustomer` and existing customer-write/auth browser suites | Save/reopen/refresh identity, error and retry, keyboard above bottom action, clear first action |
| Customer profile / record tabs | Estimates, Payments, Invoices, Photos, Messages, Notes; existing mobile customer-profile browser; sign disclosure fix | Every tab end, long names/addresses, full search and empty states, photo count expectation (cloud vs on-device) needs design decision |
| New Estimate / service catalog | Original 50+ prices, per-job override, custom-first selector and scoped description editor; 568 estimate regression previously passed | Last service after scrolling, custom service, add/reuse/move, amount and deposit; iPhone keyboard and safe-area, both modes |
| Edit Estimate / signed quote | Last-item deletion fix, edit-scopes, bundle/percent stacking, original IDs and accepted quote snapshots | Save/reopen, approval signature integrity, last line/lowest control tap; no artificial minimum |
| Invoice / agreements / share | `EditInvoiceDialog`, `InvoicesView`, `ContractsView`; shared app/regression suites | Invoice footer, customer-facing preview theme, payment amount and send/share, Safari modal keyboard |
| Schedule / calendar / routes | `ScheduleView`, `ScheduleMonthCalendar`, calendar date/button source, routing conditional on actual scheduled addresses | Today/next day, short landscape, no false route when jobs missing, last calendar action, weather swipe |
| Follow-ups / messages | `FollowUpsView`, per-customer message handling, recovered prepared drafts and signed history | Buttons/actions near bottom, correct customer identity, no auto-send/duplicate receipt, transparent fallback |
| Payments / refund / closeout | `PaymentsView`, `RecordPayment`, `RefundPayment`, `JobReport`, `JobCost`, `ReconcileCheckout` | Owner payment/refund modals, exact cents, no clipped submission; live refund DB/provider gates independent |
| Door knocking / Territory | `DoorKnocking`, `TerritoryMap`, filters and movable pin card; map is a different scroll/tap pattern | Map pin card above bottom nav, swipe/pan vs buttons, inline keyboard/long addresses, offline caveats |
| Business / tasks / expenses | `BusinessView`, owner checklist and task history with idempotent-save guards | Add/edit/undo, end-of-long-list actions, collapsed extra tools, errors/retries |
| Insights | `InsightsView`, error/loading/refresh source | Empty, loading, long statistics and narrow charts; no horizontal clipping |
| Settings / services / owner account | `SettingsView`, `PricingSettings`, owner account source, editable rate/scope controls | All 50+ catalog rows, manual service override, editable inputs and dialog bottom; avoid hidden defaults |
| Search / navigation / notifications | `GlobalSearch`, `NotificationBell`, `NotificationAttention`, bottom/mobile nav; new 50 CSS browser checks | 320–430 hit and overflow, actual iOS menu/dropdown stack, notification Mark all as read when real unread exists; no fabricated notifications |
| Photos / offline / restore | `OfflineCustomerPhotos` and protected vault, offline auth test, old on-device owner acceptance retained | Only candidate-affected surfaces: photo buttons, label count distinction, last photo/grid, genuine backup custody; **do not redo prior destructive restore** |
| Shared popups / sheets / modals | Radix shared Select, Dropdown, Popover, Sheet, Dialog, AlertDialog; 92 simulated touch checks prior PR | Physical short-height keyboard, focus, dismiss, first/last option and 44px targets, light/dark, installed PWA and Safari |

## Audit watchlist (not automatically blockers)
1. **IPHONE-HEADER-01 / layout tradeoff**: mobile header buttons intentionally shrink to **39×39px at widths <=430** to fit Back/Home/Theme/Menu and financial/notification shortcuts. Synthetic CSS layout passed overlap/visibility, but 39px targets deserve physical owner tap testing before changing proven user-approved design. Avoid blindly expanding buttons into overlaps. If actual misses occur, fix responsive arrangement with tested widths, not a wholesale redesign.
2. **IPHONE-MODAL-02 / low-height keyboard**: exact OS keyboard, dynamic viewport and on-device focus reveal cannot be certified from Chrome emulation. First/last buttons and save controls must stay above keyboard and fixed tabs. Device remains OPEN.
3. **IPHONE-NOTIF-02 / unread persistence**: prior reported bell/Mark all read was not reproduced with genuinely unread notifications in newer QA. Do not manufacture data or mark PASS from source-only tests.
4. **IPHONE-MESSAGING-03 / external handoff**: 71 browser checks are meaningful but do not prove Google Voice or Mail launched in iOS. Retain owner-approved earlier business-number delivery; only changed-path visual handoff needs verification.
5. **IPHONE-PHOTO-04 / badge ambiguity**: customer tab currently says 'Photos' without numeric count. `customerPhotos.length` reflects a server/legacy collection while actual user photos may live in a separate on-device vault; **do not show a misleading badge**. Only add a count when source-of-truth scope is established and tested.
6. **COPY-02 / optional simplification**: financial, legal consent, recovery warnings and customer-facing scope must remain intact. Keep noncritical help under existing disclosures; don't shorten warnings into misleading claims. Avoid reopening already accepted layout for a tiny word change.
7. **RELEASE-04/05/09/10**: LIVE physical resources/refund tables, full numbered-identity recovery, independent Stripe test webhook/refund reconciliation, and final build/backup/rollback seals are NOT app styling issues and remain distinct release gates.

## Mandatory exit criteria before updating QA
- [ ] Newest exact PR head has full CI success (including new spacing browser + cross-app regressions); investigate intermittent tests rather than hiding failure.
- [ ] Source audit decisions reviewed: no known unaddressed P0/P1 shown by evidence, and any P2/P3 deferred items justified by owner workflow impact. **An absence of a reproduced P1 is not proof of full screen coverage.**
- [ ] Read-only authenticated Acer/Cloudflare identity, full QA 25-journal, private DB-backup custody, known rollback, and device-photo status verified; legacy publisher remains locked until separate explicit authorization.
- [ ] Owner approves an exact new QA-only code/assets publication. No automatic deployment.
- [ ] Real Safari and installed PWA focused device acceptance for all changed functions plus remaining touch/keyboard/open items at realistic viewport settings.
- [ ] No merge/LIVE/Stripe/migration/numbering activation without their own distinct release approvals.

**Owner objective:** one clean, reliable, fast app that preserves existing navigation, business pricing and workflows. A complete release needs source proof AND actual device/provider proof; neither alone closes all gates.
