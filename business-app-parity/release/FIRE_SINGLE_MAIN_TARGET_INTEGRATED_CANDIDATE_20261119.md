# FIRE Business App — unified main-target candidate source provenance

**Created November 19, 2026 (America/Chicago), no hosted operations.**

## Why this file exists

The prior validated code was staged across an original main-target QA-master Draft PR270 plus stacked Draft PR273/274/275/276/277. Those stacked PRs passed the source-level staging/QA tests but were intentionally rejected by the *main-only* source-preservation workflow because their PR comparison bases were not main. A green local SQLite run is not a main-target release check. To remove this genuine source-review integration bottleneck without merging, publishing or deploying anything, existing **Draft PR277 was re-targeted to `main`** on November 19. Its branch contents have NOT been overwritten, no Git history was rewritten, and PR270 plus all earlier accepted owner and CI evidence remain intact.

**Primary one-piece candidate:** [DRAFT PR277 — main base](https://github.com/kylebrooks86/first-in-response-website/pull/277), head branch `work/fire-g5-closeout-refund-safety-20261119`; prior source+docs head `f535435c740ce0a8d74480631185d94125732795`.

**Original QA-master main-target ancestor:** Draft PR270, branch `work/fire-main-qa-dr-live-unified-source-20261114`, commit `9e14ab10992b689397e7376e105d6a6b33e78d83`. GitHub compare before the PR base change returned **status ahead, 35 descendant commits, 0 behind, 27 net changed files** against PR270, entirely within these buckets: existing staging CI workflow (1); owner-app source files (9); owner-app source-loaded SQLite test files (12); continuity/master tracker and evidence documents (5). No later public website or public calculator file modifications. A main-vs-PR277 compare reported ahead by 1383 commits/behind 0; GitHub compare returns a capped first 300 changed files for this long-running branch, therefore **this document does not misrepresent that truncated listing as a complete full-main diff**. The original exact-main scope verifier must independently attest *all* website/calculator changes and existing pinned workflow/checker identities.

## Integrated reviewed functionality (not deployed)

- The original NEW QA functional/visual master and source parity for QA, STAGING, independent DR and DARK NEW LIVE using existing no-R2 photo storage and source-only full-D1 restoration.
- Original operational customer, estimate, schedule, invoice, deposits, manual/Stripe payments, discounts, notes, service area, job numbering, photo recovery, contact workflows, desktop/mobile UI and owner communications preserved by existing source-level integration checks.
- Previously separately source-reviewed owner GET privacy and customer/estimate/invoice/refund-ledger lookup scope fixes (PR273), estimate history and notification privacy (PR274), follow-up private history and bounded O(n) grouping (PR275), plus consolidated owner message and Wave financial CSV exact-cent handling (PR276).
- PR277 actual financial review queue fix: a succeeded refund lacking its negative payment adjustment cannot trigger a paid-in-full customer review prompt; a misowned invoice cannot establish a job's paid-in-full state. Existing 200+ cursor, valid paid jobs and draft/confirmed message lifecycle retained.

## Verified before the main-target retarget

- [Integrated exact source/test `228ed0aa9af3d6ceae8b13966694cf0e6e9cb7f8`](https://github.com/kylebrooks86/first-in-response-website/commit/228ed0aa9af3d6ceae8b13966694cf0e6e9cb7f8): [STAGING/QA #44636666198](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44636666198) PASS 6/6.
- [Financial closeout exact source/test `958357e1867cf473d98a24d033f903018b048e96`](https://github.com/kylebrooks86/first-in-response-website/commit/958357e1867cf473d98a24d033f903018b048e96): [STAGING/QA #44639553131](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44639553131) PASS 6/6, built QA Worker job 135966756130 **PASS 41 actual native SQLite owner paid closeout checks**, separate [public website verifier #44639553095](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44639553095) SUCCESS.
- Existing source check #44639553037 previously rejected the stacked PR *solely for not targeting main*, by explicit message "BLOCKED: this source-preservation packet only targets main." It must be rerun against the new direct-main PR, without changing or suppressing guard logic. This manifest commit deliberately omits [skip ci] to initiate proper new PR checks. As of creation, new exact main-target run IDs/results are **not yet claimed**.

## Formal release gates remain STOP

Authoritative master 95-item tracker: **50 checked, 45 OPEN, four of ten formal gates accepted (G1 G2 G3 G8). G4, G5, G6, G7, G9 and G10 remain OPEN.** A main-target source pass must never be conflated with actual served Worker/asset hashes, Cloudflare environment-specific Access/secret/route scopes, bound D1 migration journal, live photo archive/isolated restore, signed TEST Stripe events or owner go-live acceptance. DR and NEW LIVE still DARK, NEW LIVE first genuine Job #0001 unused. No code was merged, deployed, activated or published; no Cloudflare/Access/DNS/paid R2 subscription, D1 writes/migrations, Stripe settings/transactions, communication sends, Acer or iPhone retesting. Preserve previously accepted screenshot/photo/evidence records; no repetition without a newly changed hosted function.

**Before any merge/deploy:** obtain separate exact owner authorization for the actual action and environment. Review new exact-head main-target public site guard, QA/staging, local DR+NEW LIVE, Stripe offline, and website verifier outcomes, and reconcile any genuine integration failures. Do not mark official hosted gates complete from local CI.
