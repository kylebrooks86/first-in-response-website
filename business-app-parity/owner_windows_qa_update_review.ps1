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
$priorVersion = '82fba39a-5736-41d7-a944-d55776ccc670'
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
# Remote checks are individually scoped and READ ONLY. Never run SQL or migrations remotely.
$databaseRaw = @(& $wrangler.Source d1 info $qaDatabase --json)
Require-Exit 'Read-only existing QA database identity'
try { $databaseInfo = ConvertFrom-Json -InputObject ($databaseRaw -join [Environment]::NewLine) }
catch { throw 'FIRE QA UPDATE STOP: Malformed D1 identity response.' }
Require ($databaseInfo.name -ceq $qaDatabase -and $databaseInfo.uuid -ceq $qaId) 'QA D1 identity differs. No publish.'
# Check the currently deployed Worker without interpreting old versions as current.
# If the deployment changes or the JSON shape differs, stop for manual review.
$deploymentRaw = @(& $wrangler.Source deployments status --name $workerName --json)
Require-Exit 'Read-only current QA Worker status'
$deploymentText = $deploymentRaw -join [Environment]::NewLine
try { $deploymentInfo = ConvertFrom-Json -InputObject $deploymentText }
catch { throw 'FIRE QA UPDATE STOP: Cloudflare deployment status is not valid JSON.' }
Require (-not [string]::IsNullOrWhiteSpace($deploymentText) -and
    $deploymentText -match [regex]::Escape($priorVersion)) 'Current QA deployment differs from the owner-observed first deployment. Review before any update.'
Write-Host ('PASS: Existing QA deployment reports original version ' + $priorVersion)
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
