# FIRE Calculator — Release Acceptance Gate

**Candidate:** Best-of-Both staging, cache generation 202, `full-v18.js?v=71`  
**Status:** NOT APPROVED — STAGING CANDIDATE ONLY — NOT SYNCHRONIZED  
**Rule:** Never point production/LIVE to this branch without explicit owner approval. Do not change production while running this checklist.

## Staging-only automated checks

The branch contains `.github/workflows/calculator-staging-checks.yml`. It is scoped to calculator changes on `fire-calculator-best-of-both`, with read-only repository permissions, and runs Node syntax, contract/offline-manifest, and both simulated backup-runtime suites. It has **no deployment step**. On successful checks, it also packages the calculator folder and required logo into a **14-day downloadable staging artifact** named `fire-calculator-best-of-both-staging`. This artifact is **not an accessible web preview** and does not update GitHub Pages or the LIVE calculator. Workflow file creation is confirmed, but GitHub Actions execution status is **not yet verified**; do not treat its presence as a passing CI run.

## Stage A: verified code-level checks

- [x] Nine Quick Presets and chemistry/source contract (recent run)
- [x] Entry/loader/service-worker parity: 38 versioned assets, 27 loader modules, none missing from cache (recent run)
- [x] Independent repository source-file verification: 44/44 unique service-worker-referenced files confirmed through direct staging-branch GitHub reads (including binary logo with base64). Re-verified on 2026-10-07 against staging cache generation 202; 0 missing.
- [ ] New automated source-file existence assertion in `tests/best-of-both-contract.mjs` still awaits an observed CI execution. A documentation-only staging commit was used to trigger the existing push-scoped workflow without changing runtime calculator assets.
- [x] Portable backup synthetic hydration simulated runtime: 5/5
- [x] Imported helper restoration simulated runtime: 6/6
- [x] Syntax parsing of touched JavaScript modules
- [ ] Re-run the older **68 formula** and **13 chemistry** regression suites from source in a runnable environment (historical results alone do not count as a fresh run)
- [ ] Confirm every service-worker asset returns HTTP 200 from the **actual staging-hosted build** (repository existence alone is insufficient)
  - Run `node calculator/tests/staging-deployment-smoke.mjs https://YOUR-VERIFIED-STAGING-HOST/calculator/` once there is a genuine separate staging deployment. This fails closed for known LIVE/production and unverified Pages hosts and checks generation 202, loader/module versions, and deployed assets.

## Stage B: staging identity — required before iPhone testing

- [ ] Open an actual preview built from `fire-calculator-best-of-both`; verify it is running generation **202** and `full-v18.js?v=71`.
- [ ] Confirm URL, deployment SHA, source branch, and active service-worker cache are for this candidate, not the separate LIVE calculator and not a GitHub Pages production deployment.
- [ ] Use a **copy** of any important saved mixes, estimates or backups. Do not overwrite your only working backup.

**Blocking issue:** The known GitHub Pages calculator URL is not verified to deploy the staging branch. Do not label a test on that URL a staging test until verified.

## Stage C: iPhone Safari functional acceptance

Mark each item **PASS**, **FAIL** (include screenshot/steps), or **NOT TESTED**.

| Scenario | Status |
|---|---|
| Open SH Mix, Mixes, Index, Job Plan; navigate back without losing state | NOT TESTED |
| Select all 9 Quick Presets; confirm icons, correct targets, no clutter | NOT TESTED |
| Change Light/Medium/Heavy; verify preset value updates without resetting on a new preset | NOT TESTED |
| Switch stock between 10% and 12.5%; check impossible target rejection | NOT TESTED |
| 1 / 2 / 4 / 5-gal quick batch, custom size, stock override and Elemonator | NOT TESTED |
| Save and reuse a named custom mix; verify surfactant, batch, SH, stock, dirtiness | NOT TESTED |
| Close/reopen Safari and confirm saved mixes and last selected state persist | NOT TESTED |
| Compare Mixes and Index with LIVE reference (labels, layout, interactions) | NOT TESTED |
| Job Plan: coverage, measurement, estimate and collapsed cost/profit | NOT TESTED |
| Equipment: X-Jet, downstream, collapsed advanced/future rig | NOT TESTED |
| Backup/export then import a **test** backup: state, saved mixes, estimate, rig and X-Jet | NOT TESTED |
| Reload following backup hydration; verify no values revert or disappear | NOT TESTED |
| Airplane mode, close/reopen installed PWA or cached Safari page; recipe and navigation work offline | NOT TESTED |
| iPhone text focus does not zoom; all controls fit; keyboard/safe-area layout works | NOT TESTED |
| Dark/light mode, touch targets, back/home controls, menu not obscured | NOT TESTED |

## Stage D: final decision

- [ ] All Stage A/B prerequisites PASS.
- [ ] All Stage C scenarios PASS (or documented exceptions explicitly accepted by owner).
- [ ] No unreviewed data loss, broken math, blank screens, stale offline assets, or unexpectedly changed LIVE-style Mixes/Index sections.
- [ ] Owner explicitly approves final synchronization/promotion.

**Result: NO-GO until a verified staging deployment passes real-iPhone checks.**

**Release discipline:** Freeze unrelated features. Apply only necessary, measured fixes to the staging branch. Repeat the relevant tests after each fix; increment cache/version only for runtime asset changes, not documentation changes.
