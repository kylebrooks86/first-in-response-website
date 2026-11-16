# FIRE QA — frozen exact-code release branch, SAFE Acer worktree, no provider deployment
Date: November 16, 2026 (CST). **READ-ONLY PREPARATION. NO CLOUDFARE WRITE.**

## Solved actual release-preparation obstruction

Existing guarded owner QA builder/reviewer/publisher require an exact local Git `HEAD`, fetched `refs/remotes/origin/<CandidateBranch>` and `-ExpectedCommit` to be **identical**. The general main-target DRAFT PR270 development branch had advanced from the 26/26 validated application code `15bd714c435a585f695ed7166cf06d2c31ea1a8e` to docs-only checkpoint `4151cd22a968bb17fd4e887eb622d66d9fb69115`. An Acer checkout of PR270's latest tip with the code-validated SHA as `-ExpectedCommit` would therefore **FAIL CLOSED**. Using later docs-only SHA as the code-validated release version would also misstate the source of the accepted 26/26 checks. DO NOT weaken the exact-source code guards; DO NOT re-run already accepted 26 groups just for documentation commits.

**Solution created/physically verified on GitHub:** independently named frozen QA-specific Git branch **`work/fire-qa-release-15bd714c-20261116`**, branch tip exactly **`15bd714c435a585f695ed7166cf06d2c31ea1a8e`** at creation and read back from GitHub branch API. [Frozen branch](https://github.com/kylebrooks86/first-in-response-website/tree/work/fire-qa-release-15bd714c-20261116) **does not move** during new documentation-only PR270 updates. Branch is not a merge, release, hosted update or approval. All existing code at this SHA is identical to the 26/26 validated version; no new branch-version code exists. Owner offline-built exact source review ZIP remains [private Drive](https://drive.google.com/file/d/1oaeKK56XRmmuhTkMix26vtqyemN5Ohj-/view), SHA256 `32efe27c38e15348346dbc22b223eff2c846a48bf44f66fa013a4f29542ef5e6`. ZIP includes owner REVIEW assets/receipts, excludes provider hosting config and actual customer D1/photo records; it CANNOT substitute for the guarded real QA code-release procedure.

## Minimum safe Acer worktree preparation (when owner is at Acer, NOT a deployment)

In a **PowerShell terminal already inside the owner's existing repo checkout**, use the exact reviewed QA branch; do not reset, switch or modify any existing worktree or owner files. All commands must stop on a failed exit. They prepare a separate detached worktree whose HEAD equals its fetched origin branch tip (which existing `-AllowDetachedWorktree` guards explicitly support). The main working checkout and original QA secrets/customer/photo vault remain untouched.

```powershell
$ErrorActionPreference = 'Stop'
$sha = '15bd714c435a585f695ed7166cf06d2c31ea1a8e'
$release = 'work/fire-qa-release-15bd714c-20261116'
$root = (& git rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or -not $root) { throw 'STOP: Open PowerShell inside the existing FIRE Git repository.' }
$origin = (& git -C $root remote get-url origin).Trim()
if ($LASTEXITCODE -ne 0 -or $origin -notmatch '^(https://github\.com/|git@github\.com:)kylebrooks86/first-in-response-website(\.git)?$') {
  throw 'STOP: This is not the reviewed FIRE repository.'
}
& git -C $root fetch --no-tags origin ('+refs/heads/' + $release + ':refs/remotes/origin/' + $release)
if ($LASTEXITCODE -ne 0) { throw 'STOP: Frozen release branch fetch failed.' }
$remoteSha = (& git -C $root rev-parse ('refs/remotes/origin/' + $release)).Trim()
if ($LASTEXITCODE -ne 0 -or $remoteSha -cne $sha) { throw 'STOP: Exact frozen source no longer matches. Do NOT proceed.' }
$dest = Join-Path $env:LOCALAPPDATA 'FIRE-QA-Frozen-15bd714c'
if (Test-Path -LiteralPath $dest) { throw 'STOP: Existing release worktree. Preserve it; do not overwrite/retry.' }
& git -C $root worktree add --detach $dest $sha
if ($LASTEXITCODE -ne 0) { throw 'STOP: Could not prepare isolated review worktree.' }
$head = (& git -C $dest rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $head -cne $sha) { throw 'STOP: Exact code is not in isolated worktree.' }
Write-Host ('PASS: EXACT approved QA source worktree isolated at ' + $dest)
Write-Host 'NO build, provider sign-in, Worker, D1, payments, files outside worktree, merge or deployment.'
```

**Do not run the publisher here.** Existing `business-app-parity/owner_windows_build_qa_candidate.ps1` can then do a separately authorized LOCAL candidate build by passing `-CandidateBranch $release -ExpectedCommit $sha -AllowDetachedWorktree -Build` from its own frozen worktree. Existing `owner_windows_qa_update_review.ps1` and default-read-only `owner_windows_qa_update_publish.ps1` likewise accept the exact detached worktree; their physical QA version, QA D1, protected staging identity, migration source and photo rules remain in effect. Preserve historic first-hosted QA source `f650d25b18d23bc9f71a4d55c9322bfd5870ef75` and existing release safety scripts; never delete old backups.

## Actual publication boundary

**NOT AUTHORIZED BY THIS WORK:** A one-time CODE ONLY updated publish of already existing Cloudflare Worker `fire-fullapp-qa-20261016`, upgrading from accepted 100%-active version `6d77bd7c-20d3-49aa-9816-c651d98953cb` (old `2be6407d...` rollback retained), retaining exact existing QA D1 `8ccfb1f8-1657-4074-b1b2-47de78f95003`, source SHA `15bd714c435a585f695ed7166cf06d2c31ea1a8e`. A NEW explicit exact owner approval is necessary before any remote code upload and before publisher `-Publish`. No R2 bucket/subscription, paid plan, SQL/migrations, data restore, secret/Access change, Stripe or payments, DR, STAGING, NEW LIVE, DNS, production or Git merge is authorized. No repeated prior owner iPhone/Acer/Cloudflare evidence; new tests ONLY for changed hosted QA functionality after a future authorized publish.

Formal 4/10 accepted G1/G2/G3/G8; G4/G5/G6/G7/G9/G10 OPEN. NEW LIVE DARK NO-GO. Source CI 26/26 successful, hosted current-source release NOT performed.
