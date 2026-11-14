# FIRE Gate 5 — approved DR-only initial 26 D1 migrations

Owner explicitly replied "approve" on November 13, 2026 to applying the 26 reviewed migrations to the existing fire-fullapp-dr-db ONLY, **after physical empty-schema verification**. The approval is one target and one execution only. It does not authorize NEW LIVE, QA, STAGING, Worker creation/upload/binding, Access, Stripe, R2, subscriptions, Git merge or legacy retirement.

Approved database: fire-fullapp-dr-db / 5e55c5b7-cd67-4c8f-a52e-40f71b5d3145.
Explicitly excluded NEW LIVE database: fire-fullapp-new-live-db / 0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662.

Current DRAFT PR264 source commitment: 1d76039bcdf109b356054d7b3264ecd7c1d74acd. The reviewed script is business-app-parity/owner_approved_dr_d1_migrate_20261113.mjs with focused offline-only negative tests in test_owner_approved_dr_d1_migrate_20261113.mjs. Do not change SQL blob pins or run an unreviewed newer version. The shared PR264 branch may advance with other source work; this handoff intentionally uses the tested exact ancestor commit, never the moving branch tip.

Normal ChatGPT cannot operate the owner's Acer or its Cloudflare authentication. **No remote D1 migration has been performed by ChatGPT at this checkpoint.** The owner can run the script once in PowerShell using their existing Acer session after latest exact-head focused CI passes. The script authenticates read-only D1 name+UUID including distinct NEW LIVE, verifies DR has no application SQL objects, validates all immutable 26 source SQL blobs, records a one-shot local execution marker, applies migration to DR alone, and performs real read-only schema/journal/financial/index/Job #0001 verification. No automatic retries.

## Exact Acer PowerShell block

Use the same existing Acer checkout path already recorded in Issue #19. This does not modify the existing QA worktree or GitHub main. It creates a separate detached source worktree.

~~~powershell
$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\Kyleb\FIREQA-PR172'
$branch = 'work/fire-app-main-candidate-unified-20261113'
$sha = '1d76039bcdf109b356054d7b3264ecd7c1d74acd'
$review = Join-Path $env:USERPROFILE 'FIRE-DR-GATE5-SOURCE-20261113-1d76039'
if (-not (Test-Path $repo)) { throw 'Original Acer FIRE repository missing. STOP.' }
if (Test-Path $review) { throw 'DR Gate5 source already exists. STOP; check the previous attempt.' }
git -C $repo fetch --no-tags origin $branch
if ($LASTEXITCODE -ne 0) { throw 'Git fetch failed; no remote D1 touched.' }
# The shared PR branch can advance. Always use the exact previously
# reviewed source SHA; refuse a force-rewritten/unrelated head.
$sourceType = (git -C $repo cat-file -t $sha).Trim()
if ($LASTEXITCODE -ne 0 -or $sourceType -ne 'commit') { throw 'Exact reviewed Git commit unavailable. STOP.' }
git -C $repo merge-base --is-ancestor $sha FETCH_HEAD
if ($LASTEXITCODE -ne 0) { throw 'Reviewed DR source is not an ancestor of fetched PR. STOP.' }
git -C $repo worktree add --detach $review $sha
if ($LASTEXITCODE -ne 0) { throw 'Local detached worktree failed; no D1 touched.' }
Push-Location (Join-Path $review 'business-app-parity\shared')
try {
    corepack pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw 'Pinned dependencies failed; no D1 touched.' }
} finally { Pop-Location }
$runner = Join-Path $review 'business-app-parity\owner_approved_dr_d1_migrate_20261113.mjs'
$wrangler = Join-Path $review 'business-app-parity\shared\node_modules\wrangler\bin\wrangler.js'
node $runner $wrangler --execute-approved-dr-only
if ($LASTEXITCODE -ne 0) {
    throw 'DR migration was blocked or its result is uncertain. DO NOT rerun. Preserve local receipt.'
}
~~~

A successful run prints FIRE_DR_26_MIGRATIONS_PHYSICALLY_VERIFIED and saves POST-MIGRATION-DR-READBACK.json under %USERPROFILE%\FIRE-DR-GATE5-APPROVED-20261113. Owner may share only final non-secret status lines, never tokens or customer records. Any failed/uncertain attempt is a HARD STOP. Do not re-execute, delete receipt, repair database or apply another migration without a fresh assessment. A remote D1 schema migration is not an accepted full Gate5 by itself.

Formal accepted gates G1/G2/G3/G8 = 4/10. G4/G5/G6/G7/G9/G10 remain OPEN; NEW LIVE NO-GO.
