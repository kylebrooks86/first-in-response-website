# Second (and later) QA Business App deployment. No writes unless -Publish,
# and a fresh exact typed owner approval confirms updating this EXISTING Worker.
# Runs the separately tested read-only update review first. The D1 and both
# independent QA login secrets MUST remain in place. No R2, Stripe or LIVE.
[CmdletBinding()]
param([switch]$Publish)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$workerName = 'fire-fullapp-qa-20261016'
$dbName = 'fire-fullapp-qa-db-20261016'
$dbId = '8ccfb1f8-1657-4074-b1b2-47de78f95003'
$expectedOldVersion = '82fba39a-5736-41d7-a944-d55776ccc670'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$review = Join-Path $PSScriptRoot 'owner_windows_qa_update_review.ps1'
$prepare = Join-Path $PSScriptRoot 'prepare_qa_deploy_config.mjs'
function Require([bool]$ok,[string]$reason) {
    if (-not $ok) { throw ('FIRE QA UPDATE STOP: ' + $reason) }
}
function Require-Exit([string]$action) {
    Require ($LASTEXITCODE -eq 0) ($action + ' failed. Do not retry any remote write.')
}
Write-Host 'FIRE QA: UPDATE EXISTING SYNTHETIC-ONLY WORKER. DEFAULT IS READ ONLY.'
$ps = Get-Command 'powershell.exe' -ErrorAction SilentlyContinue
$git = Get-Command 'git.exe' -ErrorAction SilentlyContinue
$node = Get-Command 'node.exe' -ErrorAction SilentlyContinue
$wrangler = Get-Command 'wrangler.cmd' -ErrorAction SilentlyContinue
Require ($null -ne $ps -and $null -ne $git -and $null -ne $node -and $null -ne $wrangler) 'Windows PowerShell, Git, Node and global Wrangler are required.'
Require (Test-Path -LiteralPath $review -PathType Leaf) 'QA update read-only reviewer missing.'
& $ps.Source -NoProfile -ExecutionPolicy Bypass -File $review
Require-Exit 'Existing Worker/data protection read-only update review'
if (-not $Publish) {
    Write-Host 'REVIEW ONLY PASS. No Worker update or secret upload. No database changes.'
    Write-Host 'A separate explicit owner approval is required to update existing QA Worker.'
    return
}
$head = (& $git.Source -C $repo rev-parse HEAD).Trim()
Require-Exit 'Git source commit'
Require ($head -cmatch '^[0-9a-f]{40}$') 'Invalid Git source checkpoint.'
$candidate = Join-Path $env:LOCALAPPDATA ('FIRE-QA-Builds\qa-' + $head)
$manifest = Join-Path $candidate 'dist\server\wrangler.json'
Require (Test-Path -LiteralPath $manifest -PathType Leaf) 'Verified current QA build missing.'
$approval = 'UPDATE QA ' + $workerName + ' ' + $dbId + ' ' + $head
Write-Warning ('This will REPLACE ONLY the code/assets on existing QA Worker ' + $workerName +
    ' while retaining its current D1 database, fictional customer records and existing owner secrets.')
Write-Warning ('Rollback code version, if needed: ' + $expectedOldVersion +
    '. This update does not reset or roll back database contents.')
$typed = Read-Host ('For this exact QA update only, type ' + $approval)
Require ($typed -ceq $approval) 'Exact QA update owner approval not provided.'
# Protect against races after the typed approval. Never change a different Worker.
$rawStatus = @(& $wrangler.Source deployments status --name $workerName --json)
Require-Exit 'Fresh, read-only active QA deployment identity'
$statusText = $rawStatus -join [Environment]::NewLine
try { $null = ConvertFrom-Json -InputObject $statusText }
catch { throw 'FIRE QA UPDATE STOP: Invalid current deployment status JSON.' }
Require ($statusText -match [regex]::Escape($expectedOldVersion)) 'QA Worker was updated by another operation. Refusing overwrite.'
$rawD1 = @(& $wrangler.Source d1 info $dbName --json)
Require-Exit 'Fresh, read-only QA D1 identity'
try { $d1 = ConvertFrom-Json -InputObject ($rawD1 -join [Environment]::NewLine) }
catch { throw 'FIRE QA UPDATE STOP: Invalid QA D1 identity JSON.' }
Require ($d1.name -ceq $dbName -and $d1.uuid -ceq $dbId) 'QA database identity changed after review. Refusing overwrite.'
# Normalize ONLY the obsolete, default legacy_env=true. The build's original
# manifest and all D1 customer rows must be preserved. No secrets are read,
# written, generated, displayed, or submitted during a code-only QA update.
$temporaryManifest = Join-Path (Split-Path -Parent $manifest) (
    'wrangler.fire-qa-firstpublish-' + [Guid]::NewGuid().ToString('D') + '.json')
try {
    & $node.Source $prepare $manifest $temporaryManifest
    Require-Exit 'Strict QA deployment manifest normalization'
    Push-Location $candidate
    try {
        & $wrangler.Source deploy --dry-run --config $temporaryManifest --name $workerName
        Require-Exit 'Local, no-upload pre-update verification'
        Write-Host 'PASS: No-upload pre-update verification. Owner confirmation and remote identity rechecked.'
        & $wrangler.Source deploy --config $temporaryManifest --name $workerName
        Require-Exit 'Authorized existing synthetic QA Worker code update'
    } finally { Pop-Location }
    Write-Host ('PASS: Existing synthetic QA Worker code updated from ' + $head)
    Write-Host ('Previously working code rollback version: ' + $expectedOldVersion)
    Write-Host 'Verify hosted owner sign-in and synthetic customer persistence before any additional release gate advances.'
} finally {
    if (Test-Path -LiteralPath $temporaryManifest -PathType Leaf) {
        Remove-Item -LiteralPath $temporaryManifest -Force
    }
}
