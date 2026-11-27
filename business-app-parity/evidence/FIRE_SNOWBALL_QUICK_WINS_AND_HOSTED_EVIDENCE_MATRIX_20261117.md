# FIRE Business App — 95-task snowball: verified quick wins and live evidence matrix
Date: November 16–17, 2026 CST. Scope: source/documentation review on existing UNMERGED DRAFT PR #270 only. No deployment, merge, schema/SQL, provider, login/Access, Stripe, payment, communication or public website change. This evidence is not formal release acceptance.

## B05 — resolved superseded changed-source CI blocker
- The original checklist described code SHA 0c0a334fc1e9d6c0344e10833809e1cfc20614f6 at 25/27, with staging still outstanding. That moving source revision was superseded; its canceled workflow must not be labeled successful.
- Latest actual executable-source SHA **8c2b50d5a4e311afdd98d2ae1d64fef42c2f82a2** now has **27/27 GitHub pull-request workflows completed SUCCESS**, zero failures/cancellations. Confirmed with GitHub commit workflow-run API, not inferred from stale text. Shared-app staging/native SQLite/Chrome run **44024946759** is SUCCESS, all six jobs SUCCESS.
- Includes original changed real-API door-knocking save/lost acknowledgement, review-snooze input bounds and source-browser regression tests. Following PR branch head **da4f81a84134c397eaeb56b1de1736fe9a4b2b69** is docs-only [skip ci] per existing continuity; not a separate built/executable approval.
- This closes checklist **B05 testing conclusion only**. It does NOT close B06 final source freeze, B07 2,037-file PR review, hosted QA/STAGING/DR/NEW LIVE parity, signed Stripe TEST, real photo/D1 restore or any formal release gate.

## B08 — explicit QA-master feature inventory, source versus hosted boundaries
For every item below, owner-approved QA is the **functional AND visual master**. The shared candidate code paths or already accepted source tests establish a source feature inventory, **not that the exact PR270 code is actively serving on all four Workers**.

| Feature / workflow to preserve | Representative existing candidate or accepted evidence | Release-hosted status |
| --- | --- | --- |
| Customer create, Save, lookup, profiles, contact history and persistent Customer # | shared/app/api/customers/route.ts; shared/app/api/search/route.ts; source 27/27 | Exact candidate hosted multi-target parity OPEN |
| Job # permanent numbering, cross-links, Job Reports/closeout | shared/app/api/job-reports/route.ts; accepted separate independent 26-step D1 preparation | NEW LIVE first actual #0001 still INACTIVE; hosted full journal OPEN |
| Customer properties and multiple service addresses | shared/app/api/customer-properties/route.ts; shared/components/customer-properties.tsx | Candidate synthetic-only flags OFF for release by default; not promoted |
| Before/after photos, customer association, offline vault, original bytes | shared/app/api/customer-photos/route.ts; shared/app/api/backup/photos/route.ts; shared/lib/local-photo-vault.ts | Owner-device ZIP architecture accepted; real complete paired hosted restore OPEN |
| Pricing, service catalog, house-wash minimum/overrides | shared/app/api/service-pricing/route.ts; shared/components/service-pricing.tsx | Exact cents and user-selected overrides to verify hosted; no invented fixed prices |
| New/Edit estimates, quotes, packages, stored versions, signatures/approval/share | shared/app/api/estimates/route.ts; shared/app/api/quote-packages/route.ts; existing estimate public-token routes | Hosted feature/share-denial and visual parity OPEN |
| Promotions, bundles, 50% deposits and legitimate stacking | shared/app/api/saved-promotions/route.ts; shared/app/api/estimates/[id]/promotions/route.ts | Apply owner pricing choices; financial exact-cents hosted proof OPEN |
| Invoices, outstanding balances, manual payment and reminder state | shared/app/api/invoices/route.ts; shared/app/api/payments/route.ts | Hosted invoice/ledger verification OPEN |
| Stripe TEST checkout, webhooks, refunds and provider idempotency | shared/app/api/payments/checkout/route.ts; shared/app/api/payments/webhook/route.ts; shared/app/api/payments/refund/route.ts | Genuine signed isolated TEST D1 receipts NOT proven; Gate9 OPEN |
| Scheduling, tasks, follow-ups, callbacks and review snoozes | shared/app/api/tasks/route.ts; shared/app/api/followups/route.ts; shared/app/api/followup-actions/route.ts | Final protected hosted parity OPEN |
| Customer text/email preparation, Google Voice handoff, sent-versus-prepared semantics | shared/app/api/customer-messages/route.ts; previous owner QA Google Voice evidence | Existing owner QA acceptance retained; do not re-send actual customer texts |
| Notifications, payment exceptions, financial alerts and customer activity | shared/app/api/notifications/route.ts; current native SQLite bounded-write CI | Changed-source protection PASS; hosted parity OPEN |
| Expenses, business preferences, reports, dashboard metrics and search | shared/app/api/expenses/route.ts; shared/app/api/business-preferences/route.ts; shared/app/api/dashboard-summary/route.ts; job-reports | Hosted target readback/source identity OPEN |
| Prospecting, door-knocking, territory, Maps and saved follow-up | shared/app/api/door-knocking/route.ts; shared/app/api/territory/route.ts | Current source-UI lost-ACK source tests PASS; hosted parity OPEN |
| Backup/restore, protected .firerecords/.firephotos, rollback and financial journals | shared/app/api/backup/route.ts; accepted isolated SQLite/ZIP source recovery tests | One actual paired target D1+original photo isolated restore NOT proven |
| Owner PIN/passkey/logout, sessions, estimate/invoice share tokens, permissions | cloudflare-launch/app-auth.ts; shared/app/chatgpt-auth.ts; public tokens and source auth tests | No Worker-specific Access on DARK DR/NEW LIVE; hosted owner/nonowner checks OPEN |
| Mobile responsive/light-dark/installed app, navigation, photo UI | FIRE_APP_WIDE_VISUAL_REVIEW_20261107.md and accepted Gate8 iPhone results | Existing accepted device runs preserved; changed-candidate multi-target hosted parity OPEN |

**Decision:** Existing app functionality is not to be removed or redesigned. No final release acceptance from this inventory alone. Additional launch-impact defects discovered in exact-source/hosted review belong to B07 or G4/G5/G6, not invented tasks.

## B09 — candidate-only feature-flag release decision (policy, NOT activation)
Source: shared/lib/customer-properties.ts and actual owner customer-property route. The candidate endpoints are fail-closed when their prerequisite flags are absent.
- Keep FIRE_SERVICE_LOCATIONS_CANDIDATE, FIRE_CUSTOMER_PROPERTIES_CANDIDATE, FIRE_PROPERTY_ESTIMATES_CANDIDATE, FIRE_PROPERTY_RECOVERY_CANDIDATE and FIRE_PROPERTY_WORKFLOW_CANDIDATE **NOT ENABLED** in production/DR/STAGING by default. Synthetic-only and synthetic-tests-only values are test switches, not permission to expose a production service or run candidate schema migration.
- Do not turn on a customer-property/workflow feature based merely on 27/27 tests. Require owner-approved additive schema, a migrated independent target, authenticated hosted verification and separate explicit approval before any production flag activation.
- Keep NEW LIVE owner authentication DARK/blocked, first real Job #0001 inactive, Stripe LIVE unactivated. Distinguish reviewed permanent-number schema requirements from candidate-only synthetic feature activation.
- This records the explicit safe release choice; verifying actual hosted flag values after authorized target deployments remains G4-04/G5, not B09.

## B10 — no paid Cloudflare/R2/storage rule pinned for all target candidates
- QA: check_qa_runtime_config.mjs accepts only the historically reviewed optional *compiled legacy placeholder*; prepare_qa_deploy_config.mjs explicitly **deletes r2_buckets from the disposable deployment manifest** and fails on unapproved resources.
- STAGING: check_independent_staging_runtime_config.mjs requires empty r2_buckets and disallows unapproved bindings, Stripe variables and routes.
- DR/NEW LIVE: prepare_new_independent_release_manifest.mjs hard-stops when an R2 bucket/subscription is requested, locks FIRE_PHOTO_STORAGE_MODE to owner-device-zip and outputs r2_buckets=[] for both candidate targets.
- Stripe TEST: cloudflare-launch/stripe-test-worker/wrangler.json names only independent TEST D1, not R2. Existing live provider screenshots showed no R2 on NEW LIVE, and historical DR evidence says no R2.
- **No paid Cloudflare plan, subscription, R2 activation or upgrade.** Real off-device ZIP custody, restore and cloud-photo availability remain OPEN G7; source no-R2 guard is NOT proof that all targets are currently deployed/working.

## B13 — accepted versus missing evidence by target; do not duplicate owner capture
| Environment / gate | Already accepted observation, reuse | ONLY still missing for release |
| --- | --- | --- |
| QA / Gate8 | Owner QA/iPhone/mobile customer and photo passes; separate QA Worker/D1/rollback identity; 27/27 changed-source CI separately | Exact PR270 candidate serving bytes/assets and changed-hosted parity if a separately authorized QA update occurs |
| STAGING / Gate4+5 | Candidate config and distinct planned staging D1 source guard; native SQLite staging workflow SUCCESS | Correct newly hosted independent staging version/module/assets, live D1 mapping/schema, same QA-master UI/feature |
| DR / Gate4+7 | Actual DARK DR independent Worker/D1, consumed first-create/update consent, accepted 26 migrations, protected worker-level URL/preview OFF, access warning observed | Candidate source-byte attest, full account-wide ingress/Access policy, target functionality, paired recovery/rollback |
| NEW LIVE / Gate4+5 | Actual DARK version cfacbb3d-43de-4d2c-8008-c6732d78f756 at 100%, prior adb5fd7c listed; physical distinct D1 0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662; 26 migration prelaunch; six accepted owner postupdate screenshots; Worker URL/preview OFF; no Worker-specific Access (negative finding) | Full served source/modules/assets, account-wide route/Access scope, protected hosted parity/financial journaling, clean Job #0001 on separate activation, tested rollback |
| Stripe TEST / Gate9 | Independent TEST D1 binding/Worker, current Stripe sandbox endpoint enabled for six event types, legacy Sites endpoint disabled, historical Oct test checkout/refund | Provider upload HTTP10013 resolution/new separately authorized inactive version/activation, fresh *signed* events and exact independent FIRE ledger/refund proof |
| G6 security | Prior approved QA owner positive tests/source negative tests | Protected distinct nonowner and cross-customer/expired/revoked hosted denial on approved candidate; do not expose DARK Worker to test |
| G7 recoverability | Source encrypted complete records/photo ZIP and disposable SQLite tests, no R2; no claim old Sites real-customer migration needed | ONE actual target-bound same-snapshot future D1 + original photo archive, private off-device custody, isolated end-to-end restore |
| G10 release | Four accepted gates G1/G2/G3/G8; no user records yet in NEW LIVE | All six remaining gates formally accepted, explicit owner approvals, controlled cutover and later separate legacy Sites retirement |

**Security note:** An empty Worker-listed routes panel is not a complete account-wide ingress proof; no Worker-specific Access policy is a documented negative, NOT an Access PASS. No extra owner Cloudflare screenshots requested for already accepted six tab captures, DR domain/Access or existing account Domains inventory.

## B14 — external blocker ownership and safe next work
- **Cloudflare TEST upload:** authenticated one-shot first POST to assets-upload-session failed HTTP 500/code 10013. Existing Cloudflare workers-sdk issue **#16882** and developer-platform issue **#149** already tracked. Later separate HTTP 400/inactive-version outcomes are spent attempts as documented in continuity; NEVER auto-retry or treat old approval as authorization. Next safe action is source/support evidence analysis and a newly sealed TEST-only plan; new provider POST requires a NEW exact owner approval.
- **No Worker-specific Cloudflare Access on DARK DR/NEW LIVE:** known provider dashboard negative; do NOT press Protect, enable routes/URLs or assume protection. Next safe action is a no-paid private-ingress design/review with explicit owner Access authorization before changing anything.
- **OpenAI Sites support #19701066:** historical case about old Sites physical identity. Under Nov 12 owner's QA-as-master/clean-new-LIVE direction, a legacy Sites customer/photo migration is NOT a release prerequisite. Do not reopen the superseded historical blocking gate; support correspondence may remain informative.
- **Stripe TEST provider:** six-event enabled endpoint read-only attested; old transactions predate its creation. Signed delivery/actual D1 reconciliation requires a freshly authorized TEST deployment and synthetic payment/refund evidence, not another routine historical list query.
- **Owner-controlled dependencies:** independent provider writes/authorization, final protected ingress, real hosted restores and release/cutover are still blocked by exact approvals or physically missing evidence; a source-only workaround does not close G4–G10.
- **Immediate safe parallel work:** B07 exact changed-file review and B11/B12 offline candidate artifact and QA review package when code is frozen; B06 is NOT marked while branch development remains open. No duplicate branch or generic full-device retest.

Formal status unchanged: **4/10 gates accepted G1/G2/G3/G8; G4/G5/G6/G7/G9/G10 OPEN; NEW LIVE DARK/NO-GO.** All B-item check-offs here are documentation/source-state closure, NOT Cloudflare-hosted functionality or release acceptance.
