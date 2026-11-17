# FIRE Business App — SNOWBALL MASTER RELEASE CHECKLIST

Status at creation: 2026-11-16/17 CST. **FORMAL ACCEPTANCE 4/10**: Gates G1/G2/G3/G8 accepted. G4/G5/G6/G7/G9/G10 OPEN. NEW LIVE DARK / NO-GO. This is a living working list, **not** deployment/payment/merge authorization.

**How to check off:** Tick each atomic step ONLY after the linked accepted evidence actually demonstrates the exact target/source and requirement. An individual checked subtask **does not close its parent gate**. Work top-to-bottom, but parallelize independent read-only tasks. Never repeat existing accepted checks. User decisions are required only when an action actually modifies providers, merges, activates, migrates, spends money or cuts over.

**November 17 update — 42/95 complete, 53 open, 4/10 formal gates accepted.** [G9-01](#g9-01-hosted-stripe-test-baseline) is complete for the established isolated TEST Worker, D1 refund schema, configured secret names and protected owner origin. Fresh preflight and exact-candidate authorization remain G9-03.

**Previous November 17 update — 41/95 complete, 54 open, 4/10 formal gates accepted.** [G5-07](#g5-07-reviewed-new-live-schema-recovery) closes the separately reviewed and approved NEW LIVE schema recovery. The recorded pre-write D1 had no FIRE schema or records, and the exact target-specific SQL was archived before execution.

**New TEST review archive.** The [telemetry-disabled source build](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44088970112) pins logs, invocation logs and traces off in the Worker-only manifest and its external seal. Source `19011d3173dfb6b502b971670b4c296f31796a36`, [artifact 14331340202](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44088970112/artifacts/14331340202), 3,150,025 bytes, GitHub-reported SHA-256 `97ecc66403e608423792253e733760d345840a4ac1bb108e811177da0c285916`. CI re-downloaded and verified the seal and booted the package offline. The previous privately archived TEST ZIP stays historical. G6-09 and G9-03 remain open for hosted evidence and exact approval respectively.

**Previous November 17 update — 40/95 complete, 55 open, 4/10 formal gates accepted.** [G5-04](#g5-04-new-live-clean-start-evidence) closes the pre-activation Job #0001 clean-start check. [G9-02](#g9-02-historical-test-upload-failure-disposition) closes historical TEST upload failure disposition. The first production job and the new hosted Stripe TEST candidate are still pending.

**Previous November 17 update — 38/95 complete, 57 open, 4/10 formal gates accepted.** G4-08 and G4-09 are complete for the separately authorized DR and NEW LIVE code-only updates to frozen QA source `15bd714c435a585f695ed7166cf06d2c31ea1a8e`. [Approval, execution and hosted readback evidence](#g4-08-and-g4-09-dark-code-update-evidence).

**Previous November 17 update — 36/95 complete, 59 open, 4/10 formal gates accepted.** G4-03 is complete from existing authenticated binding and physical D1 inventory evidence. The four-environment record is below. In parallel, [the spent Stripe TEST upload command was made preflight-only](https://github.com/kylebrooks86/first-in-response-website/commit/2e7fd8124dcb4147ebcc0aca89bbaa4d175e9f47), and [the saved Worker-only fallback passed Wrangler packaging plus 7/7 local workerd denial probes](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44086158101). G9-02 and G9-03 remain open for provider resolution and target-bound approval/preflight respectively. NEW LIVE remains DARK.

## Evidence base
- SOURCE OF TRUTH: https://github.com/kylebrooks86/first-in-response-website/issues/19
- Continuity: business-app-parity/FIRE_CONTINUITY_AND_LOGIN_EVIDENCE_20261113.md
- Current integrated review: https://github.com/kylebrooks86/first-in-response-website/pull/270
- Owner postupdate evidence: business-app-parity/evidence/FIRE_NEW_LIVE_POSTUPDATE_OWNER_DASHBOARD_20261116.md
- Gate contracts: business-app-parity/release/20261105_GATE4_TO_GATE10_EVIDENCE_CLOSEOUT.md
- Current Stripe read-only evidence: business-app-parity/evidence/FIRE_STRIPE_GATE9_PROVIDER_READONLY_20261116.md

## Current source CI truth
- Existing Draft PR270 development head may advance; do not equate docs-only `[skip ci]` SHA with the changed-code SHA.
- **Newer exact executable-code SHA `8c2b50d5a4e311afdd98d2ae1d64fef42c2f82a2` has 27/27 GitHub workflows SUCCESS** (independently fetched by commit SHA); [staging/native SQLite/Chrome run #44024946759](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44024946759) all six jobs SUCCESS. Earlier `0c0a334f` queued/cancelled status is superseded, NOT PASS. Later PR270 documentation-only `[skip ci]` commits are not separately compiled code. B05 is now checked; no hosted proof implied.
- Latest active NEW LIVE immutable physical version: `cfacbb3d-43de-4d2c-8008-c6732d78f756`. This is **not** the new unmerged PR270 runtime.

**PREVIOUS SNOWBALL PROGRESS UPDATE — November 16–17 CST: 35/95 atomic tasks checked (initial 22; A01–A18/B01–B15 complete, plus G7-08 exact offline fail-closed negative recovery PASS 91/91 and G10-05 planning approval). 60 remain. No new formal gate accepted (4/10).**

**Actual G9-03 SOURCE SEAL now completed, but checkbox STILL OPEN pending exact provider-action approval/hosted preflight:** The isolated TEST Worker-only candidate from source `ec32566f6c512914fecca04f868253c20374d972` passed [full local Gate9 build+24/24 source negative tests+real same-run GitHub saved-artifact readback](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44034840220), with 192 original SSR modules, 41 actual client Data assets, dedicated TEST D1 source binding, `FIRE_STRIPE_MODE=disabled`, private activation `blocked`, no R2 and predecessor rollback reference. Exact immutable ZIP artifact `14307460618` / raw SHA256 `3f163ecaebf0637671afd1615078999e49dd79e678f7d3b55ab7a45fcd4dd983` / **3,149,992 bytes** / 240 ZIP entries CRC PASS was uploaded to existing PRIVATE FIRE Drive backup folder as a NEW file, and independently raw re-downloaded matching exactly (shared:false). [Full custody / no-approval boundary](../evidence/FIRE_G9_TEST_INACTIVE_IMMUTABLE_SOURCE_SEAL_PRIVATE_DRIVE_20261117.md). **G9-03 remains [ ]** because exact new Cloudflare POST authorization and current target-bound Access/refund schema/serving-version readback have not happened; older failed 10013/HTTP400 locks are spent. Source-only release package ≠ hosted inactive version or Gate9 acceptance. **35/95 unchanged; zero provider writes.**

**November 17 offline progress.** The active PR no longer fetches expired historical artifacts 14101337096, 14101058770 and 14101977692. Exact private ZIPs passed offline (16/16 DR existing-D1, 28/28 DR DARK first-create, 31/31 NEW LIVE DARK). The Stripe TEST Worker-only fallback passed 24/24 offline and now verifies an external receipt SHA-256. **35/95 complete, 60 open, 4/10 formal gates accepted.** [Source and verification evidence](../evidence/FIRE_OFFLINE_ARCHIVE_CI_AND_STRIPE_TEST_FALLBACK_20261117.md).
 Source-frozen QA review: [branch](https://github.com/kylebrooks86/first-in-response-website/tree/work/fire-qa-release-8c2b50d5-20261117), [post-QA patch review](../evidence/FIRE_POST_QA_MASTER_DELTA_SOURCE_REVIEW_20261117.md).

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
- [x] **B05** — Exact changed-source regression resolved: code SHA 8c2b50d5a4e311afdd98d2ae1d64fef42c2f82a2 has 27/27 workflows SUCCESS, including staging/native SQLite/Chrome run 44024946759 six jobs SUCCESS. Earlier 0c0a334f run was superseded, not falsely marked PASS. [Proof](../evidence/FIRE_SNOWBALL_QUICK_WINS_AND_HOSTED_EVIDENCE_MATRIX_20261117.md).
- [x] **B06** — Pinned independent QA review branch `work/fire-qa-release-8c2b50d5-20261117` at exact tested source SHA `8c2b50d5a4e311afdd98d2ae1d64fef42c2f82a2`, GitHub SHA↔branch compare **identical, zero ahead/behind**; older frozen QA branch and physical rollback untouched. Code-source review freeze only, not build artifact, deploy or all-target seal. [QA review packet](FIRE_QA_TARGETED_CODE_UPDATE_REVIEW_PR270_20261117.md).
- [x] **B07** — Reviewed all **24 changed owner app API/UI/helper paths** (81-file total actual diff) from accepted QA source `15bd714c` to exact 27/27 green source `8c2b50d5`; classified streamed bounded writes, saved D1 lost-ACK handling, synthetic-only properties and encrypted records owner UI. No reproduced source launch-blocker; real hosted multi-target parity remains G4/G10 OPEN. [Exact source-delta review](../evidence/FIRE_POST_QA_MASTER_DELTA_SOURCE_REVIEW_20261117.md).
- [x] **B08** — Finalized owner QA-master source feature inventory for customer Save/lookup, permanent numbering, photos, pricing/minimum, estimates, deposits, invoices, scheduling, tasks/follow-ups, Google Voice/text/email, notifications, payments/refunds, reports, backups, security and mobile; per-feature hosted evidence explicitly remains OPEN. [Proof](../evidence/FIRE_SNOWBALL_QUICK_WINS_AND_HOSTED_EVIDENCE_MATRIX_20261117.md).
- [x] **B09** — Explicit release decision: candidate-only customer-properties/service-locations/estimate-association/recovery/workflow synthetic flags remain OFF on production targets unless separately reviewed, migrated, hosted-proven and owner-approved; NEW LIVE auth remains DARK. This is flag POLICY, not a provider config change. [Proof](../evidence/FIRE_SNOWBALL_QUICK_WINS_AND_HOSTED_EVIDENCE_MATRIX_20261117.md).
- [x] **B10** — Reconciled all target SOURCE manifest guards: QA temporary manifest strips historical compiled R2 placeholder, STAGING rejects all R2, DR/NEW LIVE require owner-device-zip and r2_buckets=[], Stripe TEST manifest has D1 only. No paid Cloudflare/R2. Still requires Gate4 hosted confirmation and Gate7 recoverability. [Proof](../evidence/FIRE_SNOWBALL_QUICK_WINS_AND_HOSTED_EVIDENCE_MATRIX_20261117.md).
- [x] **B11** — Physically retrieved exact GitHub Actions QA compiled source-review ZIP for frozen 8c2b50d5; verified **1,030/1,030** source/build module and static-asset SHA256 receipts (242 build, 788 source), build fingerprint, original ZIP hash, and exact **private Google Drive saved-file readback SHA256** (6,257,528 bytes); retained earlier QA master/rollback archive independently. **Not a deployable hosting manifest or hosted-byte attestation**; G4/G10 remain OPEN. [Physical artifact seal](../evidence/FIRE_QA_8C2B_OFFLINE_COMPILED_ARCHIVE_PRIVATE_SEAL_20261117.md).
- [x] **B12** — Prepared pinned QA code-only REVIEW package with **new frozen 8c2b50d5 code branch**, accepted QA master source/version, independent QA D1, actual 81-file reviewed delta and exact stop/authorization rules. **B11's compiled source-review archive is now verified separately; it is NOT an approved deployable Worker bundle and cannot establish hosted parity or permission to upload.** [Review packet](FIRE_QA_TARGETED_CODE_UPDATE_REVIEW_PR270_20261117.md).
- [x] **B13** — Saved target-by-target evidence matrix distinguishing accepted QA/DR/NEW LIVE/Stripe TEST/owner screenshots from only still-missing hosted source bytes, account ingress, Access, security, schema, recovery and signed Stripe deliveries. Do not repeat accepted captures. [Proof](../evidence/FIRE_SNOWBALL_QUICK_WINS_AND_HOSTED_EVIDENCE_MATRIX_20261117.md).
- [x] **B14** — Recorded actual third-party/owner blockers, Cloudflare assets-upload-session 10013 already filed (issues workers-sdk #16882 / developer-platform #149), no Worker-specific Access, Stripe TEST signed delivery dependency; legacy Sites support #19701066 is historical and NOT a clean-new-LIVE migration blocker. Protected no-retry/no-paid alternatives recorded. [Proof](../evidence/FIRE_SNOWBALL_QUICK_WINS_AND_HOSTED_EVIDENCE_MATRIX_20261117.md).
- [x] **B15** — Audited historic draft PR supersession with evidence, preserving unmerged head branches and actual content distinctions. Initial [PR #268](https://github.com/kylebrooks86/first-in-response-website/pull/268) had exact 3/3 Git blob parity and [PR #265](https://github.com/kylebrooks86/first-in-response-website/pull/265) exact 5/5 parity versus active Draft #270: both CLOSED unmerged. **Additional semantic review now completed** on all changed paths of [PR #266](https://github.com/kylebrooks86/first-in-response-website/pull/266) (5/5 paths), [PR #267](https://github.com/kylebrooks86/first-in-response-website/pull/267) (5/5 paths) and [PR #269](https://github.com/kylebrooks86/first-in-response-website/pull/269) (3/3 paths); each CLOSED UNMERGED with comment-level technical justification. Their differing runtime SHA versions are **not** represented as exact duplicates: the newer #270 adapter intentionally pins DR/NEW LIVE targets and denies all DARK first requests, replacing the older unbound preapproval route. Original tests/commits preserved. This is follow-through within one already checked B15 item, not 3 additional checklist points, a Gate 4 pass or release. [Semantic review and GitHub comment links](../evidence/FIRE_HISTORICAL_PR266_267_269_SEMANTIC_SUPERSESSION_20261117.md).

### C. Gate 4 — exact hosted app parity, identities and ingress (physical evidence required)

- [ ] **G4-01** — Pin a single reviewed runtime source/build for QA, STAGING, DR and NEW LIVE; record independently hosted version/traffic for each target after any separately authorized code update.
- [ ] **G4-02** — Attest full immutable served Worker executable modules AND auxiliary/static assets byte-for-byte to the reviewed source/build, not just a version prefix or local ZIP.
- [x] **G4-03** — Matched the hosted `DB` aliases for QA, STAGING, DR and NEW LIVE to four distinct physical D1 UUIDs using archived Worker binding captures and provider inventory. No shared D1 binding was found among those targets. [Four-environment proof below](#g4-03-hosted-d1-binding-evidence).
- [ ] **G4-04** — Verify environment-specific origin, secret *names* and scopes, TEST-vs-LIVE payment mode isolation, photo mode and absence of R2 without publishing secrets.
- [ ] **G4-05** — Check account/zone-wide routes, hostnames, preview aliases, externally reachable endpoints and Access policy scope; existing Worker-level OFF/empty screenshot is accepted but NOT complete ingress proof.
- [ ] **G4-06** — Resolve the visible NO Worker-specific Access warning with an owner-approved protected/private ingress design, using no unapproved paid feature; verify the actual effect before any URL exposure.
- [ ] **G4-07** — Complete independently hosted STAGING candidate (correct app/D1/rollback), not an old unrelated Sites refund-staging project, with exact-source verification.
- [x] **G4-08** — Separately authorized DR code-only update of the approved QA-master package completed. Independent readback confirmed the new serving version, original isolated D1, blocked authentication, no R2 and predecessor retained. DR recovery evidence custody remains separate. [Evidence](#g4-08-and-g4-09-dark-code-update-evidence).
- [x] **G4-09** — Separately authorized NEW LIVE code-only update of the exact frozen candidate completed while DARK. Independent readback confirmed the new serving version, original D1, blocked authentication and retained rollback. Original first-create and update locks remain spent. [Evidence](#g4-08-and-g4-09-dark-code-update-evidence).
- [ ] **G4-10** — Compare every required QA-master screen/workflow/navigation/mobile calculation across QA, STAGING, DR and NEW LIVE on the *actual hosted candidate*, noting deliberate environment-specific controls only.
- [ ] **G4-11** — Collect scoped owner/provider evidence for exact target serving identities, source bytes, isolation, ingress and parity; obtain formal Gate 4 acceptance (not automatically from CI).

### D. Gate 5 — independently bound D1 schema, numbering and finances

- [ ] **G5-01** — Read the actually bound schema and *ordered applied migration journal* on each candidate's own QA/STAGING/DR/NEW LIVE D1, not a Git SQL inventory. Never reapply accepted 26/26 DR or NEW LIVE migrations.
- [ ] **G5-02** — Confirm required table/column/index/trigger contracts, especially payment_refunds journal, provider uniqueness, refund statuses, settlement locks and owner/customer relations.
- [ ] **G5-03** — Verify actual permanent Customer # / Job # uniqueness, immutability, monotonic reservation and records/estimate/invoice/notification cross-links on migrated independent targets.
- [x] **G5-04** — Verified the bound NEW LIVE D1 had zero operational data and no numbering history at physical prelaunch inspection. The reviewed atomic allocation and unique root-estimate constraint reserve #0001 for the first real job after activation. [Evidence](#g5-04-new-live-clean-start-evidence).
- [ ] **G5-05** — Check invoice/deposit/50%/principal/tip/refund/discount rounding, rate overrides, legitimate stacked promotions and manual payments against saved hosted test records with exact cents.
- [ ] **G5-06** — Verify saved customer, estimates, schedule, invoice status, follow-up, property and contact relationships survive real hosted readbacks without cross-customer leakage.
- [x] **G5-07** — Reconciled the NEW LIVE missing application schema and zero migration journal through an independently backed-up, exact-target 26-migration install. It added the FIRE schema to an empty target after separate owner authorization and verified the result. [Evidence](#g5-07-reviewed-new-live-schema-recovery).
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
- [x] **G7-08** — **Source-only fail-closed recovery negative modes VERIFIED** with actual 26-reviewed-migration synthetic SQLite + saved encrypted records/photos, including newly tested preexisting interrupted-output refusal (does not overwrite or create misleading ZIP). Exact test-only commit `240f337b`, focused [run 44028504296](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44028504296) **PASS 91/91**, existing full-table recovery guards **55/55** and browser paired restore **39/39**. This closes the offline fail-closed *subtask only*, not a physical power-cut kill drill, real owner/Cloudflare D1 photo restore, off-device custody or formal Gate 7. [Exact-mode evidence](../evidence/FIRE_G7_08_FAIL_CLOSED_OFFLINE_RECOVERY_20261117.md).
- [ ] **G7-09** — Exercise an explicitly authorized isolated code AND database/photo rollback/recovery drill; a previous Worker version merely being listed Ready is not rollback proof.
- [ ] **G7-10** — Save an owner-operable no-paid-service backup schedule and recovery instructions; formally accept Gate 7 on real target-bound paired backup/restore evidence.

### G. Gate 9 — isolated real signed Stripe TEST and exact-cent reconciliation

- [x] **G9-01** — Verified the established isolated TEST Worker and its physical TEST D1, applied refund schema, configured secret names and protected owner origin from existing provider evidence. [Evidence](#g9-01-hosted-stripe-test-baseline).
- [x] **G9-02** — Disposed of both historical TEST upload failures. The MIME correction was followed by a separately approved successful hosted inactive version; the current Worker-only fallback bypasses the failed asset-session endpoint and passed offline packaging and boot. Both legacy write commands are retired. [Evidence](#g9-02-historical-test-upload-failure-disposition).
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
- [x] **G10-05** — **OWNER-REVIEWED PLANNING DOCUMENT APPROVED ONLY (2026-11-17 CST).** Target-by-target plan for QA/STAGING/DR/NEW LIVE/Stripe TEST, distinct D1/keys, no paid Cloudflare/R2, immutable versions, stop lines and code+records+photos rollback prepared and reviewed in [G10-05 plan](FIRE_G10_05_TARGET_BY_TARGET_GUARDED_RELEASE_AND_ROLLBACK_REVIEW_20261117.md). Owner explicitly replied **“approve”** to **“Can you approve G10-05 as a planning document only?”** This closes the documentation/review step only; it does **NOT** authorize or execute any specific deployment, migration, merge, Stripe/Access/routes/DNS change, rollback, payment or LIVE cutover. Each actual action still requires separate exact owner approval and target-current review. Formal Gate10 OPEN.
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

**Subtask snapshot (latest).** 42/95 items checked, 53 open. Formal gate count is 4/10.

### G4-03 hosted D1 binding evidence

| Environment | Hosted Worker | D1 binding | Physical D1 UUID | Existing evidence |
| --- | --- | --- | --- | --- |
| QA | `fire-fullapp-qa-20261016` | `DB → fire-fullapp-qa-db-20261016` | `8ccfb1f8-1657-4074-b1b2-47de78f95003` | [Version binding readback](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6921614028) |
| STAGING | `fire-app-independent-staging` | `DB → fire-app-staging-db` | `afb2c05a-d794-4a9a-b580-924ce01c26ad` | [Hosted Worker binding](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6853475014) + [physical name-to-ID inventory](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6866906104) |
| DR | `fire-fullapp-dr` | `DB → fire-fullapp-dr-db` | `5e55c5b7-cd67-4c8f-a52e-40f71b5d3145` | [Post-update version binding readback](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6927144670) |
| NEW LIVE | `fire-fullapp-new-live` | `DB → fire-fullapp-new-live-db` | `0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662` | [Post-update version binding readback](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6937417820) |

The four recorded `DB` bindings resolve to **four different physical D1 IDs**. The QA, DR and NEW LIVE version readbacks show no R2, and the STAGING Worker binding capture shows its sole visible D1 binding and no visible R2. STAGING is corroborated by matching the exact database name to the independent D1 inventory; its screenshot only shows the short version prefix. **G4-03 covers binding-level isolation for the recorded hosted versions.** Full hosted source parity, current-candidate STAGING validation, ingress and data-level testing remain open under their own checklist items. This evidence review used prior owner records without contacting Cloudflare.

### G4-08 and G4-09 dark code-update evidence

Both existing Workers were updated separately using distinct archives of the owner-approved QA-master source `15bd714c435a585f695ed7166cf06d2c31ea1a8e`. Each update was code-only and retained its independently verified D1 database and rollback version.

| Target | Owner-approved archive SHA-256 | Installed version at 100% | Retained predecessor | Evidence |
| --- | --- | --- | --- | --- |
| DR | `eee57f2a5f98c4c9aa84c881818414094868bae5fef41d45c339073e269ecfb0` | `f7b7e27c-986b-44b5-b0f9-5e8e4b623426` | `b7c42773-5a93-4c6c-91d2-83cdb8e857d9` | [Approval](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6923894536), [CLI completion](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6926866811), [hosted readback](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6927144670), [Worker URLs off](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6928068767) |
| NEW LIVE | `8c19774e4e11f08c011c5e274d815ab341e287cdcf714cce1c647a782b75d67c` | `cfacbb3d-43de-4d2c-8008-c6732d78f756` | `adb5fd7c-ddd0-4e97-87e7-6a4045d42d09` | [Approval](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6931059249), [CLI completion](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6937179152), [hosted readback](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6937417820), [Worker URLs off](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6938656649) |

DR retained its independent D1 and [off-device encrypted recovery evidence](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6872378378). NEW LIVE retained its [original first-create lock and receipt](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6897281548); both later update locks are also spent. Source and archive hashes identify what the guarded publisher reviewed. Full hosted source and static asset byte attestation is still G4-02, account/zone ingress and Access remain G4-05/G4-06, visual and workflow parity remain G4-10, and actual records/photos recovery or rollback remains Gate 7. No provider action was performed to reconcile these records.

### G5-04 NEW LIVE clean-start evidence

[Owner-executed exact D1 post-migration inspection](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6889484598) confirmed 26/26 applied migrations, six immutable numbering/link triggers, zero operational rows and no number high-water on `fire-fullapp-new-live-db` (`0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662`). The success receipt and both consumed operation locks were [encrypted and independently read back from private off-device storage](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6891448726). The later [Worker readback](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6937417820) confirmed the same D1 and blocked authentication. No synthetic job was entered into that database for the check.

The [applied permanent-number schema](../adapters/independent-live/drizzle/0025_independent_permanent_numbers.sql) uses an autoincrement primary key and a unique root estimate. The [estimate write](../shared/app/api/estimates/route.ts) includes allocation in the same D1 batch, and the [clean-start guard](../shared/lib/new-live-clean-start.mjs) refuses inconsistent or inherited job history. Together with the physical zero high-water, these establish readiness for one first allocation of Job #0001. The actual first genuine job remains G10-08 and no job was created for this evidence review.

### G9-02 historical TEST upload failure disposition

- **Inactive version HTTP 400 / 10162:** the [actual provider error](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6785132652) was an unsupported module content type per [Cloudflare's error documentation](https://developers.cloudflare.com/workers/observability/errors/). The envelope used `application/json` for three generated Vinext metadata modules. The reviewed correction changed those bytes' MIME to `text/plain`, a [supported version-upload module type](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/). The [accepted source](<https://github.com/kylebrooks86/first-in-response-website/blob/a655ecbd77769add27d9ed6c5bc86c3376723563/business-app-parity/cloudflare-launch/stripe-test-worker/gate9_offline_version_envelope.mjs>) retains the correction, and a separate historical approval produced a [successful inactive version and independent 0% readback](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6786144101). Exact offending file was never returned by the provider.
- **Asset registration HTTP 500 / 10013:** the original incident was [tracked in the provider project](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6840724274). The separately sealed Worker-only fallback embeds the 41 assets as Data modules with no ASSETS binding or assets-upload-session, and [the exact saved fallback packaged and booted offline with all seven inactive denial probes passing](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44086158101). FIRE's source disposition is a verified bypass. A provider-side fix to the asset registration endpoint has not been established.
- Both legacy execution entrypoints are preflight/review-only ([Node](https://github.com/kylebrooks86/first-in-response-website/commit/2e7fd8124dcb4147ebcc0aca89bbaa4d175e9f47), [PowerShell](https://github.com/kylebrooks86/first-in-response-website/commit/fcd30f96483e5136253a428e978708fef0b00c2d)). The original approvals and attempt locks remain spent. New TEST upload authorization, target-bound preflight, actual 0% hosting proof for the new candidate and signed Stripe TEST delivery remain G9-03 onward.

### G5-07 reviewed NEW LIVE schema recovery

1. [Read-only baseline](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6886832802) identified the exact independent NEW LIVE D1, zero journal entries, zero sequence rows and zero FIRE schema objects. The original attempt's response remained unknown and its lock was preserved. There were no application records to back up from this target.
2. [Pre-write private SQL custody](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6879497092) retained the exact 26 reviewed migrations with their source manifest and independent D1 binding. The [reviewed recovery design](../NEW_LIVE_POSTLOCK_RECOVERY_OWNER_DECISION_20261114.md) required the same empty baseline immediately before adding the application schema, a separate durable attempt lock and a full post-write readback.
3. [Separate exact owner authorization](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6887775645) preceded the one recovery operation. [Physical success evidence](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6889484598) confirmed the exact ordered 26 migrations and expected empty application state. [Off-device receipt readback](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6891448726) preserves both locks and the success receipt with a verified encrypted archive hash.

This closes the known NEW LIVE discrepancy and applies only to the empty prelaunch target. The migration was previously completed. Remaining QA/STAGING schema and ledger verification stays open. No legacy LIVE database change or replay was made.

### G9-01 hosted Stripe TEST baseline

- [Owner physical initialization PASS](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6565851852): the exact independent `fire-stripe-test-db-20261101` D1 UUID `dba421ba-fc66-4cf8-9c31-51616f8249ba` applied all 25 migrations, with required payment/refund/deposit schema and index confirmed by the guarded postflight. [Later physical inventory](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6692317019) independently observed the migration, payment, refund and checkout tables.
- [Authenticated Worker readback](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6835793246): `fire-stripe-test-20261101`, serving predecessor `96e32262-fa33-4f04-a161-bee11f0353e2` at 100%, binds this exact D1. Stripe mode was disabled and Access required. The four configured names were `FIRE_ACCESS_AUD`, `FIRE_ACCESS_OWNER_EMAIL`, `FIRE_ACCESS_TEAM_DOMAIN` and `STRIPE_WEBHOOK_SECRET`. No key or secret value was inspected. [Later deployment view](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6901852627) corroborates the serving predecessor and confirms the newer Ready versions were not serving.
- [Owner origin check](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6900892600) verified the anonymous owner API returned a Cloudflare Access login redirect. This covers the owner route at the protected TEST origin. Exact webhook exemption and signed ingress are still subject to their separate checks.

This baseline covers the established TEST resources. Any future provider write still requires fresh targeted checks, the new candidate's exact approval and a genuinely signed synthetic event to reconcile. The 25-migration authorization is spent.
