# FIRE Business App — release-focused simplicity and workflow audit
**Date:** November 2, 2026. **Target:** Existing FIRE Business App, source candidate draft PR #86 `eddf8208586830d56ef3b222f178fd63b83aece6`, with focused follow-up draft PR #87. **Not** the marketing website.

## Boundary and evidence discipline
This is a **source-led, full-surface release review**, incorporating the prior detailed October 31 audit and previously accepted synthetic browser/iPhone/owner evidence. The app's 598 KB dashboard source, owner shared UI, public estimate/invoice/pay routes, dialog close controls and release checkpoint were inspected. This is **not** a claim that every dynamic state, 3rd-party handoff or on-device keyboard/viewport was physically retested; only changed paths warrant another focused hosted iPhone check. No historical D1, photo, Voice, isolated signature or other accepted test is repeated to inflate counts.

**Release decision stays 3/10 formally accepted production gates (30%), NO-GO** pending environment, recovery, Stripe and exact-owner seal. UI source improvements do not close deployment gates.

## Findings requiring action **before the next QA code upload**
| Priority | Actual finding | Decision |
|---|---|---|
| **P1 security/clarity** | Legacy `/pay/[id]` displayed customer name/scope, balance and manual Cash App/Venmo instructions for a quote whose status later became `declined`/withdrawn; the safer `/estimate/[token]` flow had already been locked. | Fixed in draft PR #87: neutral unavailable *before* fetching items. No old quote payment instruction or scope exposure. |
| **P1 customer payment integrity** | `/pay/[id]` and `/invoice/[token]` showed manual payment options without demanding persisted accepted **and signed** agreement, safe whole-cent balance and absence of pending payment review. | Fixed in draft PR #87 using one shared fail-closed policy. Invoice card action also gated. Existing payment POST remains authoritative. |
| **P2 misleading deposit copy** | Older pay page claimed a flat **50% deposit**, even for owner-selected/customized deposit terms. | Fixed in draft PR #87: refer to *saved signed estimate* instead of inventing a fixed amount. |
| **P2 dead-end after Void** | Owner Estimate → More tools still displayed **Customer view** for an inactive `declined` or `superseded` public link. | Fixed in draft PR #87: hide unavailable shortcut; retain historical quote in Lost. No record deletion. |

## Complete owner-screen review and disposition
| App surface | Findings / release-focused disposition |
|---|---|
| **Home / Today** | Existing compact next job, follow-up, metrics and shortcuts retained. No demonstrated new breakage; no layout rewrite. |
| **Customer directory / Add / Edit** | Save/refresh, identity, search, beforeunload and duplicate submit guards already covered by accepted browser and QA checks. Keep owner-approved inputs; no repeat synthetic customer creation. |
| **Customer record** | Back to all customers, primary call/Text/Email, More actions, Estimates/Invoices/Payments/Photos/Messages/Notes and per-device photo-count badge present. Photo badge specifically scopes count to **this device**; do not merge with cloud count. |
| **Estimate create, catalog and edit** | 50 original services, custom-first picker, no automatic minimum, per-job override and bundle/promotion math protected by existing exact-head tests. Safe editor and last-service controls retained. |
| **Estimate detail / Void** | Saved estimate and confirmation exist in More tools, not cluttering primary actions. Voids *unaccepted* estimates only; never label this permanent Delete/Trash/Restore. Stale Customer view shortcut found and fixed; accepted/signed/financially linked records protected. |
| **Customer-facing estimate and approval** | Existing declined quote page neutral and signed approval guarded. Remains distinct from payment page: now all public entrypoints follow retired/signed-only policy. |
| **Invoices / agreement previews** | Invoices/Agreements are accessible with separate history and owner preview/close. Public invoice payment options corrected; signed history/ledger unchanged. |
| **Schedule / month calendar / weather** | Existing upcoming job, date and route controls retained. Tulsa/Central time guard in Estimate detail rejects ambiguous DST appointments. No unrelated calendar rewrite or weather refresh. |
| **Follow-ups / messaging / Google Voice** | Business-number-first manual handoff, prepared-vs-sent acknowledgement and 24-hour+ viewed quote filtering preserved. Previously accepted actual Voice sends need **no repeat**. |
| **Payments / refunds / job closeout** | Existing in-flight dialog, exact-cents, payment recovery and signed-report guards preserved. Public payment messaging corrected; real provider refund/webhook reconciliation is **Gate 9**, not a cosmetic task. |
| **Door knocking / territory map** | Existing separate mobile map/visit workflow and offline draft controls retained; no evidence supports a map UX redesign before release. |
| **Business tasks / expenses** | Existing dirty/save navigation protection and collapsed secondary tools retained; avoid adding labels/cards without reported friction. |
| **Insights** | Current empty/loading/error and 30-day/YTD/lifetime controls exist. No speculative dashboard visualization or KPI changes. |
| **Settings / service catalog / templates** | Service editor and repeat-service settings are in disclosures; editable templates warn on unsaved changes; restore/save actions and their lock preserved. No repricing or hidden minimum introduced. |
| **Notifications / search / bottom navigation** | Existing visible bell Mark All Read, search navigation guard and mobile Back/Home/menu/X source preserved. True unread persistence and native short-height keyboard must be checked only when meaningful data/state naturally exists. |
| **Shared dialogs / Safari PWA** | Shared Radix dialog supplies labeled 44px X; edit/save guards retained. Source and Chromium are not native Safari/installed PWA guarantees. Narrow physical acceptance remains on changed screens only. |

## Scope and acceptance decisions
- All code in PR #87 is **draft/source-only/unmerged/undeployed**. No D1 migration, R2, Stripe, LIVE website, QA Worker, Access, auth, DNS, data restore, customer messages, schema or real transaction changes.
- Do not deploy PR #85's October 31 based update; it risks undoing November 1 accepted QA source. Keep PR #86 frozen while reviewing PR #87 on top of it.
- Dedicated small public-link test checks withdrawn, unsigned, signed, invalid cents and pending financial review. Existing source/build/TypeScript checks must pass for the **actual latest SHA** before owner Acer build; never reuse the PR #86 15/15 as proof of PR #87.
- After separately approved QA-only deployment, inspect the *changed* retired/unsigned/signed links and basic owner Void behavior on iPhone. Do **not** redo previous accepted photos, Google Voice sends, synthetic customer persistence or signing tests.
- Open, independent gates: provider-attested LIVE source/physical D1 and refund journal (4–5); target auth/storage/recovery and real-device changed-path acceptance (6–8); isolated Stripe TEST webhook/refund ledger (9); exact production target/candidate/backup/rollback with fresh owner approval (10).
- Future optional visual details, any true recoverable Delete/Trash functionality, biometric/passkey/PIN auth and permanent Customer/Job # migration remain separate from this focused fix. Do not activate partially implemented numbering without migration and recoverable numbered backups.

**No source-only audit can certify a fully polished live iPhone app across every dynamic state. This review deliberately produces one safer incremental draft rather than another unbounded redesign.**
