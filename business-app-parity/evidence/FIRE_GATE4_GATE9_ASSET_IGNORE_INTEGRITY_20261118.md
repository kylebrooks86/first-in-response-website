# November 18, 2026 — Gate 4 / Gate 9 exact compiled asset-ignore integrity, no deploy

## Existing accepted history preserved

Start from the already verified 50/95 checklist, four accepted formal gates G1/G2/G3/G8, physical Acer G7-07 original 3-photo recovery, NEW QA visual/functional master, source-only QA/STAGING PIN/Job # manifest alignment, and accepted prior Cloudflare account/host screenshots. **Do not request old QA iPhone/Acer photo, original SQL, R2, owner Cloudflare Work sign-in or Stripe tests again without changed-scope evidence.** This evidence relates ONLY to the TEST full-app local source/asset integrity workflow.

## Actual source weakness fixed

Previous `cloudflare-launch/stripe-test-worker/gate9_offline_asset_manifest.mjs` walked `dist/client` but **silently skipped `.assetsignore` without inspecting its contents**. That left a gap in source-level asset completeness review: release tooling could report a valid file manifest without checking whether the generated ignore control could suppress compiled JS, CSS, or other actual public assets in a provider packaging workflow. This was a potential source attestation ambiguity, **not evidence that a deployed FIRE Worker omitted assets**.

The [final updated local asset inspector](https://github.com/kylebrooks86/first-in-response-website/blob/work/fire-main-qa-dr-live-unified-source-20261114/business-app-parity/cloudflare-launch/stripe-test-worker/gate9_offline_asset_manifest.mjs) now:
1. Scans every allowed compiled public file before validating ignore-control rules; `_headers` and `_redirects` remain separate text Worker modules, `.vite` remains private build metadata.
2. Requires `.assetsignore` to be an actual regular, non-symlink, bounded UTF-8 text file; rejects NULL, malformed/unsafe pattern syntax and excessive rules.
3. Matches each simple pattern **conservatively** against actual scanned asset paths; refuses any exclusion that could hide a current public JS, CSS, HTML, image, or font file. Legitimate exclusions that match no actual public assets remain accepted; no global wildcard allowlist or silent bypass.
4. Derives a SHA-256 fingerprint for the ignored build-control file (local metadata only). The direct-asset and future upload simulations rederive the same constrained manifest from the source tree; no provider network calls, secrets, deployment or remote writes.

[Focused actual synthetic regression tests](https://github.com/kylebrooks86/first-in-response-website/blob/work/fire-main-qa-dr-live-unified-source-20261114/business-app-parity/cloudflare-launch/stripe-test-worker/gate9_offline_asset_manifest.test.mjs) exercise harmless private exclusions, blanket `**/*`, matching chunk/CSS patterns, malformed rules, symlink rejection, binary/text refusal, existing asset hashes, stable file ordering and separate Worker control modules. The [Gate9 offline CI workflow](https://github.com/kylebrooks86/first-in-response-website/blob/work/fire-main-qa-dr-live-unified-source-20261114/.github/workflows/fire-gate9-fullapp-offline-build.yml) now executes this suite BEFORE building the whole fake TEST app; the website protection gate pins **only that exact workflow Git blob** `b4898e399ac09a11b054f5ba1df6925e6883fcb1`, not a wildcard CI file exception. A missing or malformed build cannot get a green release seal.

### Actual CI and temporary red workflow clarification

The FIRST strict allowlist attempt failed at [run #44430586144](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44430586144), with no provider writes. A redacted follow-up identified `UNREVIEWED_ASSET_IGNORE_RULE` for an otherwise legitimate generated build-control pattern. This was **not** a failed deployment or leaked secret; a static rule-name allowlist was too restrictive. The final checker instead tests whether patterns overlap the actual compiled public files, preserving the safety property. The next local [build run #44431503581](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44431503581) **SUCCEEDED** including full app build, local Worker boot, simulated complete asset protocol and exact-head signed candidate seal. The newly wired unit suite then caught one narrow **test expectation** discrepancy: a symlink to `.assetsignore` is rejected even earlier as `DOT_ENTRY`, not the `ASSET_IGNORE_CONTROL_SHAPE` code. [Test-only correction `fe035e3`](https://github.com/kylebrooks86/first-in-response-website/commit/fe035e3908ddcf28116dd953375840167142dc65) accepts either fail-closed stage; neither permits a symlink.

**Final executable source/test SHA:** `fe035e3908ddcf28116dd953375840167142dc65`. [FIRE Gate 9 full-app LOCAL build, never deploy run #44432021135](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44432021135) **COMPLETED SUCCESS**, zero failed/aborted steps:
- **13 of 13** new and previous isolated asset-integrity unit tests PASS; 0 failed.
- Actual synthetic/disabled-Stripe full-app typecheck/build PASS.
- Source inventory proves 41 actual compiled TEST assets; four simulated upload buckets, total simulated byte count 5,315,551; NO HTTP/JWT/Cloudflare session.
- Local offline Worker startup, disabled owner routes and strict TEST context PASS; compiled modules, static assets, fake JWT strip, exact-head candidate seal / artifact re-download/re-hash, and Worker-only fallback PASS.
- [Website/calculator preservation #44432020864](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44432020864) and [Verify FIRE website #44432021278](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44432021278) **SUCCESS** on that same executable source. No public website or calculator path was modified.

## Release-gate scope

This is **actual development/test progress** contributing to source-level G4-02 and the inactive TEST candidate preparation for G9-03; it is NOT actual Cloudflare served-module+asset byte attestation, Stripe TEST webhook delivery, hosted Access, payment authorization or a ready-to-deploy asset JWT. Thus **G4-02 [ ], G9-03 [ ] remain OPEN**. The user has **not** approved provider POST, 0% version creation, TEST activation, Access bypass, D1 migrations, any R2 subscription (including free-allowance activation), Git merge or LIVE release.

**Authoritative checklist remains 50/95 complete, 45 open; formal 4/10 G1/G2/G3/G8 accepted; G4/G5/G6/G7/G9/G10 remain OPEN, NEW LIVE DARK NO-GO and first genuine NEW LIVE Job #0001 unused.** Keep PR270 draft/unmerged and do not reopen accepted owner QA/photo/backup evidence.
