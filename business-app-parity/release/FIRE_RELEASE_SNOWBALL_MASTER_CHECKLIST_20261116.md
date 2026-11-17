# FIRE Business App — SNOWBALL MASTER RELEASE CHECKLIST

Status at creation: 2026-11-16/17 CST. **FORMAL ACCEPTANCE 4/10**: Gates G1/G2/G3/G8 accepted. G4/G5/G6/G7/G9/G10 OPEN. NEW LIVE DARK / NO-GO. This is a living working list, **not** deployment/payment/merge authorization.

**How to check off:** Tick each atomic step ONLY after the linked accepted evidence actually demonstrates the exact target/source and requirement. An individual checked subtask **does not close its parent gate**. Work top-to-bottom, but parallelize independent read-only tasks. Never repeat existing accepted checks. User decisions are required only when an action actually modifies providers, merges, activates, migrates, spends money or cuts over.

## Evidence base
- SOURCE OF TRUTH: https://github.com/kylebrooks86/first-in-response-website/issues/19
- Continuity: business-app-parity/FIRE_CONTINUITY_AND_LOGIN_EVIDENCE_20261113.md
- Current integrated review: https://github.com/kylebrooks86/first-in-response-website/pull/270
- Owner postupdate evidence: business-app-parity/evidence/FIRE_NEW_LIVE_POSTUPDATE_OWNER_DASHBOARD_20261116.md
- Gate contracts: business-app-parity/release/20261105_GATE4_TO_GATE10_EVIDENCE_CLOSEOUT.md
- Current Stripe read-only evidence: business-app-parity/evidence/FIRE_STRIPE_GATE9_PROVIDER_READONLY_20261116.md

## Current source CI truth
- Existing Draft PR270 development head may advance; do not equate docs-only `[skip ci]` SHA with the changed-code SHA.
- Most recent changed-code test candidate observed: `0c0a334fc1e9d6c0344e10833809e1cfc20614f6`. As last checked, **25 of 27** workflows success; [staging/native SQLite](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44024131150) in progress and DR binding parser pending. Do not mark B05 yet. Previous code `bbbaf7b9` had 27/27 PASS; no extrapolation.
- Latest active NEW LIVE immutable physical version: `cfacbb3d-43de-4d2c-8008-c6732d78f756`. This is **not** the new unmerged PR270 runtime.

## Checklist — smallest safe wins first

### A. Already accepted / verified — DO NOT REPEAT

- [x] **A01** — Formal Gate 1 accepted (existing source/release foundation).
- [x] **A02** — Formal Gate 2 accepted (existing isolated regression contract).
- [x] **A03** — Formal Gate 3 accepted (existing compile/release source foundation).
- [x] **A04** — Formal Gate 8 accepted for the already approved QA/iPhone evidence; do not re-open on unchanged functionality.
- [x] **A05** — Owner selected NEW QA app as both the visual AND functional master; legacy ChatGPT Sites is NOT the master.
- [x] **A06** — Prelaunch owner decision: NEW LIVE begins without real customers/photos and the first actual Job # must be 0001; no legacy business-customer migration prerequisite.
- [x] **A07** — QA Worker and independent QA D1/version/rollback identity already owner-verified; original QA device/login/customer/photo/Google Voice tests preserved.
- [x] **A08** — DR Worker physically created DARK and bound to its accepted distinct D1; prior 26/26 migration/owner readback recorded; first-create lock spent.
- [x] **A09** — NEW LIVE Worker physically created DARK and bound to its accepted independent D1; prior 26/26 migration/owner readback recorded; first-create lock spent.
- [x] **A10** — NEW LIVE current version cfacbb3d at 100% and previous adb5fd7c listed Ready; rollback execution itself NOT proved.
- [x] **A11** — NEW LIVE production and preview workers.dev URLs OFF; no Worker-listed custom domain/route. This is NOT an account-wide ingress proof.
- [x] **A12** — NEW LIVE env new-live-prelaunch, auth blocked, owner-device-zip photo mode; sole visible D1 DB binding; no R2 binding.
- [x] **A13** — Worker Access tab documents NO Worker-specific Access policy — negative finding preserved, NOT a security PASS.
- [x] **A14** — Six post-update owner screenshots, hashes, scope and no-repeat rule preserved in GitHub evidence.
- [x] **A15** — Free/no-R2/device-archive approach retained. No paid Cloudflare/R2 subscription or upgrades approved.
- [x] **A16** — Stripe sandbox read-only inventory recorded: dedicated TEST webhook enabled with six event types; older Sites endpoint disabled; prior payments/refund are NOT new signed-delivery proof.
- [x] **A17** — Existing Draft PR #270 is the active main-target integration branch; historical drafts retain provenance and are not to be merged blindly.
- [x] **A18** — Previous code SHA bbbaf7b9 completed 27/27 source workflows; do not attribute that result to newer source revisions.

### B. Quick wins — easiest remaining work FIRST (no provider writes)

- [x] **B01** — Create and save this single, editable, numbered evidence-first snowball checklist on PR #270.
- [x] **B02** — Reconcile Issue #19 and current continuity/AGENTS with the existing 4/10 acceptance and legacy-migration supersession.
- [x] **B03** — Inventory open active PRs; keep #270 central and avoid needless duplicate new branches.
- [x] **B04** — Identify exact latest changed-code SHA vs later documentation-only [skip ci] heads; do not mistake them for separate tested builds.
- [ ] **B05** — Let exact changed-code SHA 0c0a334f staging/native SQLite and remaining workflows complete; inspect failures if any, fix only changed cases; do not claim 27/27 early.
- [ ] **B06** — Freeze a final reviewed candidate Git SHA *after* code settles, keeping accepted QA rollback/old frozen branches intact.
- [ ] **B07** — Review exact PR #270 changed runtime/feature files against the approved QA master; resolve only reproduced launch-breaking functional changes, not cosmetic churn.
- [ ] **B08** — Finalize feature inventory for customer Save/lookup, permanent Customer #/Job #, photos, pricing/minimum, estimates, deposit, invoices, scheduling, tasks, follow-ups, messages, notifications, communications, permissions, reporting, backups and mobile.
- [ ] **B09** — Decide explicit candidate-only feature flags (e.g., customer-property migration) for release: keep OFF unless separately reviewed, migrated, hosted-proven and approved.
- [ ] **B10** — Freeze final no-R2 photo/storage and free Cloudflare requirements in each target manifest; reject upgrades/subscriptions.
- [ ] **B11** — Compile and seal offline final Worker modules/assets manifest plus source-to-build SHA; retain immutable private rollback copy.
- [ ] **B12** — Prepare *one* targeted QA-only code update review package with exact branch/source/destination/rollback/what changed; do not deploy without separate exact owner approval.
- [ ] **B13** — Write an explicit hosted evidence matrix showing *which* observations are already accepted and only missing changed/target-specific observations (no repeat screenshot requests).
- [ ] **B14** — Document any externally owned blocker with its existing support issue/case and safe alternative; do not rerun failed Cloudflare sign-ins or spent one-shots.
- [ ] **B15** — Review older open drafts for proved supersession; close only with verified content parity, without merge, source loss or guessed equivalence. This housekeeping is not itself a release gate.

### C. Gate 4 — exact hosted app parity, identities and ingress (physical evidence required)

- [ ] **G4-01** — Pin a single reviewed runtime source/build for QA, STAGING, DR and NEW LIVE; record independently hosted version/traffic for each target after any separately authorized code update.
- [ ] **G4-02** — Attest full immutable served Worker executable modules AND auxiliary/static assets byte-for-byte to the reviewed source/build, not just a version prefix or local ZIP.
- [ ] **G4-03** — Record distinct physical D1 IDs and correct runtime aliases for all four environments; independently verify no accidental shared data/storage.
- [ ] **G4-04** — Verify environment-specific origin, secret *names* and scopes, TEST-vs-LIVE payment mode isolation, photo mode and absence of R2 without publishing secrets.
- [ ] **G4-05** — Check account/zone-wide routes, hostnames, preview aliases, externally reachable endpoints and Access policy scope; existing Worker-level OFF/empty screenshot is accepted but NOT complete ingress proof.
- [ ] **G4-06** — Resolve the visible NO Worker-specific Access warning with an owner-approved protected/private ingress design, using no unapproved paid feature; verify the actual effect before any URL exposure.
- [ ] **G4-07** — Complete independently hosted STAGING candidate (correct app/D1/rollback), not an old unrelated Sites refund-staging project, with exact-source verification.
- [ ] **G4-08** — Bring DR to approved QA-master functional/visual version only through distinct authorized code-only deployment and verify while protecting backup/recovery independence.
- [ ] **G4-09** — Bring NEW LIVE to exact approved candidate while DARK only through distinct authorization; preserve the consumed first-create lock, current version and rollback history.
- [ ] **G4-10** — Compare every required QA-master screen/workflow/navigation/mobile calculation across QA, STAGING, DR and NEW LIVE on the *actual hosted candidate*, noting deliberate environment-specific controls only.
- [ ] **G4-11** — Collect scoped owner/provider evidence for exact target serving identities, source bytes, isolation, ingress and parity; obtain formal Gate 4 acceptance (not automatically from CI).

### D. Gate 5 — independently bound D1 schema, numbering and finances

- [ ] **G5-01** — Read the actually bound schema and *ordered applied migration journal* on each candidate's own QA/STAGING/DR/NEW LIVE D1, not a Git SQL inventory. Never reapply accepted 26/26 DR or NEW LIVE migrations.
- [ ] **G5-02** — Confirm required table/column/index/trigger contracts, especially payment_refunds journal, provider uniqueness, refund statuses, settlement locks and owner/customer relations.
- [ ] **G5-03** — Verify actual permanent Customer # / Job # uniqueness, immutability, monotonic reservation and records/estimate/invoice/notification cross-links on migrated independent targets.
- [ ] **G5-04** — Verify NEW LIVE's clean, empty *real-business* starting state and that first production Job #0001 will be created exactly once only after activation; no synthetic test job counted.
- [ ] **G5-05** — Check invoice/deposit/50%/principal/tip/refund/discount rounding, rate overrides, legitimate stacked promotions and manual payments against saved hosted test records with exact cents.
- [ ] **G5-06** — Verify saved customer, estimates, schedule, invoice status, follow-up, property and contact relationships survive real hosted readbacks without cross-customer leakage.
- [ ] **G5-07** — If a real schema/journal discrepancy is found, prepare and review a strictly additive, backed-up, target-specific migration; require independent exact authorization before SQL writes.
- [ ] **G5-08** — Record accepted physical schema/number/ledger evidence and formally close Gate 5 only for the intended NEW app targets, never by silently repairing legacy Sites LIVE.

### E. Gate 6 — hosted owner/nonowner, sessions, shares and privacy

- [ ] **G6-01** — Have a protected hosted test candidate and two authorized distinct synthetic identities; do not expose a Worker just to test anonymity.
- [ ] **G6-02** — Physically verify owner Access/login flow, four-digit PIN/passkey/Face ID where approved, private redirects and session reentry on intended devices/contexts.
- [ ] **G6-03** — Verify anonymous/expired session requests to protected APIs fail with no customer/financial data, using the exact hosted candidate.
- [ ] **G6-04** — Verify genuine nonowner identity receives denial to every owner-only route; a blank-login/Cloudflare challenge alone does not prove this.
- [ ] **G6-05** — Verify two distinct synthetic customers cannot see or modify each other's customer, property, estimate, task, invoice, payment or photo records.
- [ ] **G6-06** — Test estimate/invoice/share-token URLs for correct exact-customer scope, invalid/forged/expired/revoked tokens and disallowed state changes.
- [ ] **G6-07** — Verify session logout invalidates the previous same-browser credential; restart/refresh/other-device, stale cookie, PIN/passkey and rate-limit/error cases.
- [ ] **G6-08** — Check CSRF/same-origin protections, unauthorized POST/PATCH, owner financial/refund privilege guards and failed requests making zero writes or Stripe calls.
- [ ] **G6-09** — Ensure private logs, export links and diagnostics never reveal secrets, customer PII, invite tokens or passwords; retain redacted evidence only.
- [ ] **G6-10** — Owner accepts the target-specific hosted negative/positive matrix; close Gate 6 without repeating previously passed iPhone QA sessions.

### F. Gate 7 — complete *future* records + real photos backup, isolated restore and rollback

- [ ] **G7-01** — Make the owner-accessible complete records + saved-photo archive flow available on an *approved hosted candidate*; source-only endpoint/flag checks are insufficient.
- [ ] **G7-02** — Create one owner-authorized protected backup of all test/new-app D1 records, journals, invoices, payments, customer/job numbers, notes, messages, schedule and supplemental tables.
- [ ] **G7-03** — Create and privately retain one full original-photo owner-device ZIP (no R2), metadata manifest, every actual file's bytes and hashes, including representative before/after pairing.
- [ ] **G7-04** — Verify *one matching point-in-time* D1+photo pair: record IDs, file associations, exact hashes, sizes, counts and manifest with no missing/extra bytes.
- [ ] **G7-05** — Keep secure independent/off-Acer custody and reproducible encrypted/versioned copies, with owner-held keys; no sensitive raw JSON/photos in public GitHub.
- [ ] **G7-06** — Restore all required records and ordered schema into a completely empty, isolated disposable destination; prove immutable Customer #/Job # and financial history survive.
- [ ] **G7-07** — Restore and reopen original photo bytes and customer/job associations into the corresponding isolated photo store/device archive, then verify hashes against the paired manifest.
- [ ] **G7-08** — Prove fail-closed detection of wrong destination, altered/missing files, incomplete snapshot, wrong migration, stale key, interrupted import and occupied database.
- [ ] **G7-09** — Exercise an explicitly authorized isolated code AND database/photo rollback/recovery drill; a previous Worker version merely being listed Ready is not rollback proof.
- [ ] **G7-10** — Save an owner-operable no-paid-service backup schedule and recovery instructions; formally accept Gate 7 on real target-bound paired backup/restore evidence.

### G. Gate 9 — isolated real signed Stripe TEST and exact-cent reconciliation

- [ ] **G9-01** — Select/verify the independent TEST Worker, TEST D1 and required refund schema/secret *names* and protected origin; QA/DR/NEW LIVE/legacy are not substitutes.
- [ ] **G9-02** — Resolve previously failed/consumed Cloudflare assets-upload-session and inactive-version HTTP400 attempts through reviewed source/support evidence; NEVER replay those old POST locks.
- [ ] **G9-03** — Seal one exact TEST-only inactive candidate: source SHA, modules/assets digest, isolated bindings, mode, rollback and no-R2; secure new explicit approval before ANY provider POST.
- [ ] **G9-04** — Only on approval, create/verify one inactive TEST Worker version at 0% and independently read back actual modules, assets, D1, secrets names and traffic (no blind retry).
- [ ] **G9-05** — Obtain separate exact approval for protected TEST activation and synthetic transactions/refunds; do not alter live-mode or the legacy production payment system.
- [ ] **G9-06** — Generate fresh genuine TEST Checkout/deposit (50%) and balance/tip scenarios and check resulting customer invoice/job/payment ledger at exact cents.
- [ ] **G9-07** — Verify authentic Stripe-signed webhook delivery/HMAC to exact TEST hosted route, including all configured Checkout success/async failure/async success events.
- [ ] **G9-08** — Verify refund.created/refund.updated/refund.failed, partial principal/tip refunds, status transitions and no double-credit after final provider state.
- [ ] **G9-09** — Prove duplicate/reordered/late/invalid-signature webhook fail-closed behavior and durable idempotent D1 records under the actual hosted TEST app.
- [ ] **G9-10** — Reconcile each new TEST provider event to one independent FIRE D1 payment/refund journal and invoice/customer/job ownership; preserve redacted receipts.
- [ ] **G9-11** — Confirm TEST secrets/routes never touch LIVE Stripe; sign off Gate 9 only after fresh signed provider events and actual FIRE ledger evidence.

### H. Gate 10 — exact owner-approved protected release, no premature legacy retirement

- [ ] **G10-01** — Get formal signed acceptance on Gates 4, 5, 6, 7 and 9 while retaining G1/G2/G3/G8; do not manufacture gate closure from counts of green source jobs.
- [ ] **G10-02** — Freeze the final immutable Git SHA, merged/target branch decision, reproducible build hash, tested code/asset manifest and protected release candidate.
- [ ] **G10-03** — Compare QA, STAGING, DR and NEW LIVE against the full QA-master feature/visual/mobile inventory, rates/discounts/payments/communication/backup; resolve actual release defects.
- [ ] **G10-04** — Seal backups, exact D1 identities and latest application records/photos, routing/auth mode, rollback provenance and tested restoration procedures before traffic changes.
- [ ] **G10-05** — Prepare target-by-target deployment and immediate safe rollback/stop plan, including no paid Cloudflare/R2 and distinct environments/keys; review each action with owner.
- [ ] **G10-06** — Obtain explicit owner permission for any Git merge; *separately* obtain exact approvals for each environment deployment, SQL, Access/routes/DNS and Stripe action.
- [ ] **G10-07** — After those permissions and protection checks, bring final approved app to intended LIVE protected origin with exact serving version/traffic and correct independent DB; avoid public access before controls.
- [ ] **G10-08** — Confirm NEW LIVE first genuine Job #0001 and clean initial customer/photo/payment state; verify core customer→estimate→schedule→invoice workflow once on new target.
- [ ] **G10-09** — Run only a targeted final real-device smoke on changed hosted functions plus owner security and no unexpected Stripe charge/communication; preserve accepted prior QA tests.
- [ ] **G10-10** — Have owner explicitly sign final LIVE go/no-go and rollback acceptance; no implied approval from 'continue', screenshots, a passed CI or prior one-shot.
- [ ] **G10-11** — Retain old ChatGPT Sites app as rollback until NEW LIVE is proven stable; retire/redirect it only after separate owner authorization.
- [ ] **G10-12** — Seal release manifest, versions, owner acceptance, backups, QA parity and zero known P0/P1 blockers in Issue #19; close gates and close release issue only when demonstrably complete.

## Owner authorization boundaries

- **Do not** merge/publish/deploy/migrate/run D1 SQL/enable login or public routes/modify Access, Stripe, webhook, payments, DNS, R2 or paid Cloudflare without the required exact and separate owner approval.
- Original DR and NEW LIVE first-create approvals/one-shot locks are **spent**; do not reuse them. Original 26/26 D1 migrations are completed; do not reapply.
- No unnecessary iPhone, Acer, Cloudflare login, provider screenshot or synthetic regression repetition. Recheck only a specific changed function after an approved change.
- The owner has work data/screenshots available. Ask only for a **specific remaining original hosted evidence gap** after searching the connected records.

**Subtask snapshot:** 22/95 items checked; this is a checklist count, NOT a completion percentage or change to the formal 4/10 release-gate acceptance.
