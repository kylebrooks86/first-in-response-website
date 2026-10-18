# Review an UPDATED QA Business App after the first successful hosted deployment.
# READ ONLY: never deploys, uploads secrets, touches D1 data, or changes device vaults.
# The first-publish script MUST NOT be reused on an existing Worker.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$branch = 'work/fire-business-app-parity-2026-10-08'
$workerName = 'fire-fullapp-qa-20261016'
$qaDatabase = 'fire-fullapp-qa-db-20261016'
$qaId = '8ccfb1f8-1657-4074-b1b2-47de78f95003'
# Only recognize the one serving version of the previously owner-observed
# October 17 QA Worker update. Never accept old deployment history versions.
$expectedActiveVersionPrefix = 'd3c33191-469f-4c08-8399-'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
function Require([bool]$ok, [string]$reason) {
    if (-not $ok) { throw ('FIRE QA UPDATE STOP: ' + $reason) }
}
function Require-Exit([string]$stage) {
    Require ($LASTEXITCODE -eq 0) ($stage + ' failed. No remote changes were attempted.')
}
Write-Host 'FIRE QA FULL-APP UPDATE REVIEW: NO PUBLISH, NO DATABASE WRITES'
Require ($env:OS -eq 'Windows_NT' -and -not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) 'Owner Acer Windows profile required.'
$git = Get-Command 'git.exe' -ErrorAction SilentlyContinue
$python = Get-Command 'python.exe' -ErrorAction SilentlyContinue
$node = Get-Command 'node.exe' -ErrorAction SilentlyContinue
$wrangler = Get-Command 'wrangler.cmd' -ErrorAction SilentlyContinue
Require ($null -ne $git -and $null -ne $python -and $null -ne $node -and $null -ne $wrangler) 'Existing Git, Python, Node and authenticated global Wrangler are required.'
$actualBranch = (& $git.Source -C $repo branch --show-current).Trim()
Require-Exit 'Git branch'
Require ($actualBranch -ceq $branch) 'Working branch does not match FIRE QA branch.'
$head = (& $git.Source -C $repo rev-parse HEAD).Trim()
Require-Exit 'Git HEAD'
$originHead = (& $git.Source -C $repo rev-parse ('refs/remotes/origin/' + $branch)).Trim()
Require-Exit 'Fetched origin HEAD'
Require ($head -cmatch '^[a-f0-9]{40}$' -and $head -ceq $originHead) 'Run a safe fast-forward Git pull first.'
$dirty = @(& $git.Source -C $repo status --porcelain --untracked-files=no)
Require-Exit 'Tracked Git changes'
Require ($dirty.Count -eq 0) 'Keep local changes; stop before review.'
$candidate = Join-Path $env:LOCALAPPDATA ('FIRE-QA-Builds\qa-' + $head)
$manifest = Join-Path $candidate 'dist\server\wrangler.json'
$sourceCheck = Join-Path $PSScriptRoot 'verify_materialized_candidate.py'
$runtimeCheck = Join-Path $PSScriptRoot 'check_qa_runtime_config.mjs'
$prepare = Join-Path $PSScriptRoot 'prepare_qa_deploy_config.mjs'
foreach ($path in @($candidate, $manifest, $sourceCheck, $runtimeCheck, $prepare)) {
    Require (Test-Path -LiteralPath $path) 'Missing latest isolated QA build or source verifier. Build the new candidate locally first.'
}
Require (-not ((Get-Item -LiteralPath $candidate).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'Refusing symbolic-link QA build directory.'
# An update must not quietly change schema expectations while keeping the
# pre-existing D1 contents. Compare every local SQL migration with the exact
# candidate that first published this QA Worker, including file names/order.
$firstSource = 'f650d25b18d23bc9f71a4d55c9322bfd5870ef75'
$original = Join-Path $env:LOCALAPPDATA ('FIRE-QA-Builds\qa-' + $firstSource)
Require (Test-Path -LiteralPath (Join-Path $original 'drizzle') -PathType Container) 'The preserved first-release QA migration baseline is missing.'
Require (-not ((Get-Item -LiteralPath $original).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'First-release QA candidate must not be a symbolic link.'
$previousSQL = @(Get-ChildItem -LiteralPath (Join-Path $original 'drizzle') -Filter '*.sql' -File)
$nextSQL = @(Get-ChildItem -LiteralPath (Join-Path $candidate 'drizzle') -Filter '*.sql' -File)
Require ($previousSQL.Count -eq 23 -and $nextSQL.Count -eq $previousSQL.Count) 'QA migration count changed since first deployment. Stop.'
$baseline = @{}
foreach ($file in $previousSQL) { $baseline[$file.Name] = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash }
foreach ($file in $nextSQL) {
    Require ($baseline.ContainsKey($file.Name) -and
        $baseline[$file.Name] -ceq (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash) 'QA migration bytes differ from original published app. Stop without touching D1.'
}
Write-Host 'PASS: All 23 original QA migrations are byte-for-byte unchanged. No migrations run.'
& $python.Source $sourceCheck qa $candidate --built
Require-Exit 'Latest full-app QA compiled source verification'
& $node.Source $runtimeCheck $manifest
Require-Exit 'Exactly isolated QA Worker/D1 bindings'
# Read-only Wrangler D1 LIST works with the owner's current token even when
# d1 info returns API code 10000. Check BOTH QA and protected staging identities,
# fail closed on collisions, and never infer schema from num_tables metadata.
$identityHelper = Join-Path $PSScriptRoot 'qa_d1_identity_from_list.ps1'
Require (Test-Path -LiteralPath $identityHelper -PathType Leaf) 'Strict read-only D1 identity validator is missing.'
$databaseRaw = @(& $wrangler.Source d1 list --json)
Require-Exit 'Read-only existing QA/staging D1 list'
$databaseInfo = & $identityHelper -Json ($databaseRaw -join [Environment]::NewLine)
Require ($databaseInfo.qaName -ceq $qaDatabase -and $databaseInfo.qaUuid -ceq $qaId) 'Isolated QA D1 identity differs. No publish.'
# Verify exactly the sole ACTIVE version, not arbitrary historical status text.
$deploymentRaw = @(& $wrangler.Source deployments status --name $workerName --json)
Require-Exit 'Read-only current QA Worker status'
try { $deploymentInfo = ConvertFrom-Json -InputObject ($deploymentRaw -join [Environment]::NewLine) }
catch { throw 'FIRE QA UPDATE STOP: Cloudflare deployment status is not valid JSON.' }
Require ($null -ne $deploymentInfo -and $null -ne $deploymentInfo.versions) 'Current QA deployment does not identify versions. Stop.'
$activeVersions = @($deploymentInfo.versions)
Require ($activeVersions.Count -eq 1) 'QA Worker traffic is split or ambiguous. Stop.'
Require ([double]$activeVersions[0].percentage -eq 100) 'Exactly one QA Worker version must serve 100 percent of requests.'
$activeVersion = [string]$activeVersions[0].version_id
Require ($activeVersion -cmatch ('^' + [regex]::Escape($expectedActiveVersionPrefix) + '[a-f0-9]{12}$')) 'Active QA Worker differs from owner-observed October 17 successful update. Stop.'
Write-Host ('PASS: Active QA Worker is exactly one 100-percent deployment: ' + $activeVersion)
Write-Host ('PASS: Existing QA database name and UUID match: ' + $qaDatabase)
# Dry-run requires ONLY a disposable normalized manifest, outside any app data.
$temporaryManifest = Join-Path (Split-Path -Parent $manifest) (
    'wrangler.fire-qa-firstpublish-' + [Guid]::NewGuid().ToString('D') + '.json')
try {
    & $node.Source $prepare $manifest $temporaryManifest
    Require-Exit 'QA-only Wrangler config compatibility'
    Push-Location $candidate
    try {
        & $wrangler.Source deploy --dry-run --config $temporaryManifest --name $workerName
        Require-Exit 'No-upload QA update dry run'
    } finally { Pop-Location }
} finally {
    if (Test-Path -LiteralPath $temporaryManifest -PathType Leaf) {
        Remove-Item -LiteralPath $temporaryManifest -Force
    }
}
Write-Host ('REVIEW PASS: New QA candidate Git source ' + $head)
Write-Host 'NO PUBLISH. Existing QA Worker, private credentials and D1 customer records are untouched.'
Write-Host 'Further steps require owner approval of a distinct UPDATE release and retained rollback version.'
