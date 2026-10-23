# Second (and later) QA Business App deployment. No writes unless -Publish,
# and a fresh exact typed owner approval confirms updating this EXISTING Worker.
# Runs the separately tested read-only update review first. The D1 and both
# independent QA login secrets MUST remain in place. No R2 storage or billing,
# no Stripe or LIVE. Device-local photo vault/backups are not touched.
[CmdletBinding()]
param(
    [switch]$Publish,
    [string]$ApprovalText,
    [string]$CandidateBranch = 'work/fire-business-app-parity-2026-10-08',
    [string]$ExpectedCommit = ''
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$workerName = 'fire-fullapp-qa-20261016'
$dbName = 'fire-fullapp-qa-db-20261016'
$dbId = '8ccfb1f8-1657-4074-b1b2-47de78f95003'
$photoMode = 'ON-DEVICE-PHOTOS-NO-R2'
$expectedActiveVersion = '58a467fa-9dbc-45a3-971e-b5a4e478f54d'
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
& $ps.Source -NoProfile -ExecutionPolicy Bypass -File $review -CandidateBranch $CandidateBranch -ExpectedCommit $ExpectedCommit
Require-Exit 'Existing Worker/data protection read-only update review'
if (-not $Publish) {
    Write-Host 'REVIEW ONLY PASS. No Worker update or secret upload. No database changes.'
    Write-Host 'A separate explicit owner approval is required to update existing QA Worker.'
    return
}
$head = (& $git.Source -C $repo rev-parse HEAD).Trim()
Require-Exit 'Git source commit'
Require ($head -cmatch '^[0-9a-f]{40}$') 'Invalid Git source checkpoint.'
if (-not [string]::IsNullOrEmpty($ExpectedCommit)) {
    Require ($head -ceq $ExpectedCommit) 'Current code differs from owner-reviewed exact commit; no hosted writes.'
}
$candidate = Join-Path $env:LOCALAPPDATA ('FIRE-QA-Builds\qa-' + $head)
$manifest = Join-Path $candidate 'dist\server\wrangler.json'
Require (Test-Path -LiteralPath $manifest -PathType Leaf) 'Verified current QA build missing.'
# Identify the exact active deployed version before requesting any approval.
$beforeRaw = @(& $wrangler.Source deployments status --name $workerName --json)
Require-Exit 'Read-only pre-approval active QA deployment'
try { $before = ConvertFrom-Json -InputObject ($beforeRaw -join [Environment]::NewLine) }
catch { throw 'FIRE QA UPDATE STOP: Invalid pre-approval deployment status JSON.' }
Require ($null -ne $before -and $null -ne $before.versions) 'Missing active QA Worker version.'
$beforeVersions = @($before.versions)
Require ($beforeVersions.Count -eq 1 -and [double]$beforeVersions[0].percentage -eq 100) 'QA Worker must have one active 100-percent code version.'
$expectedOldVersion = [string]$beforeVersions[0].version_id
Require ($expectedOldVersion -ceq $expectedActiveVersion) 'Unknown currently active QA Worker version. Stop.'
$approval = 'UPDATE QA ' + $workerName + ' ' + $dbId + ' ' + $photoMode + ' ' + $head + ' FROM ' + $expectedOldVersion
Write-Warning ('This will REPLACE ONLY the code/assets on existing QA Worker ' + $workerName +
    ' while retaining its current D1 database, synthetic customer records and owner secrets. No R2 bucket is bound or billed; photos remain on this device only.')
Write-Warning ('Exact active QA code version retained for rollback: ' + $expectedOldVersion +
    '. This update does not reset or roll back database contents.')
# An explicit CLI approval avoids clipboard/prompt confusion on the owner's Acer.
# Both paths enforce the same full, current code/Worker/D1/rollback identity.
if ($PSBoundParameters.ContainsKey('ApprovalText')) {
    $typed = $ApprovalText
    Write-Host 'Checking exact QA owner approval passed with -ApprovalText.'
} else {
    $typed = Read-Host ('For this exact QA update only, type ' + $approval)
}
Require ($typed -ceq $approval) 'Exact QA update owner approval not provided.'
# Check AGAIN immediately before the change: fully ordered 25-migration
# schema, protected D1 and exact Git source are all mandatory.
# A stale first preflight is not enough to publish after owner confirmation.
& $ps.Source -NoProfile -ExecutionPolicy Bypass -File $review -CandidateBranch $CandidateBranch -ExpectedCommit $ExpectedCommit
Require-Exit 'Fresh post-approval read-only 25-schema, D1 and source revalidation'
# Race protection: refuse if active Worker changed after owner confirmation.
$rawStatus = @(& $wrangler.Source deployments status --name $workerName --json)
Require-Exit 'Fresh, read-only active QA deployment identity'
try { $after = ConvertFrom-Json -InputObject ($rawStatus -join [Environment]::NewLine) }
catch { throw 'FIRE QA UPDATE STOP: Invalid current deployment status JSON.' }
Require ($null -ne $after -and $null -ne $after.versions) 'Active QA Worker deployment missing or ambiguous.'
$afterVersions = @($after.versions)
Require ($afterVersions.Count -eq 1 -and [double]$afterVersions[0].percentage -eq 100 -and
    [string]$afterVersions[0].version_id -ceq $expectedOldVersion) 'QA Worker was updated by another operation. Refusing overwrite.'
# Repeat the WORKING read-only D1 listing after exact owner confirmation.
# Check exact QA and protected staging UUIDs; do not trust stale table-count
# metadata from Wrangler's list response.
$identityHelper = Join-Path $PSScriptRoot 'qa_d1_identity_from_list.ps1'
Require (Test-Path -LiteralPath $identityHelper -PathType Leaf) 'QA-only D1 identity validator missing.'
$rawD1 = @(& $wrangler.Source d1 list --json)
Require-Exit 'Fresh, read-only QA/staging D1 identities'
$d1 = & $identityHelper -Json ($rawD1 -join [Environment]::NewLine)
Require ($d1.qaName -ceq $dbName -and $d1.qaUuid -ceq $dbId) 'QA database identity changed after review. Refusing overwrite.'
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
