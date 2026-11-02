# Second (and later) QA Business App deployment. No writes unless -Publish,
# and a fresh exact typed owner approval confirms updating this EXISTING Worker.
# Runs the separately tested read-only update review first. The D1 and both
# independent QA login secrets MUST remain in place. No R2 storage or billing,
# no Stripe or LIVE. Device-local photo vault/backups are not touched.
[CmdletBinding()]
param(
    [switch]$Publish,
    [switch]$OwnerConfirmedPhotoZipBackup,
    [switch]$OwnerConfirmedNoLocalPhotos,
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
# Owner independently reran the exact existing QA read-only reviewer on Nov 1.
# It verified the pinned sole 100% active QA version and physical QA D1 binding.
# Preserve that current active version for code-only rollback if later approved.
# This observation NEVER authorizes publication: require a fresh exact source,
# two independently verified database identities, 25-journal, device-photo
# protection and typed owner consent before any existing QA Worker update.
$expectedActiveVersion = '92708a01-34d6-4c07-b236-ff418b0cabad'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$review = Join-Path $PSScriptRoot 'owner_windows_qa_update_review.ps1'
$prepare = Join-Path $PSScriptRoot 'prepare_qa_deploy_config.mjs'
$bindingHelper = Join-Path $PSScriptRoot 'verify_qa_worker_version_bindings.ps1'
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
Require (Test-Path -LiteralPath $bindingHelper -PathType Leaf) 'QA active physical D1 binding check missing.'
& $ps.Source -NoProfile -ExecutionPolicy Bypass -File $review -CandidateBranch $CandidateBranch -ExpectedCommit $ExpectedCommit
Require-Exit 'Existing Worker/data protection read-only update review'
if (-not $Publish) {
    Write-Host 'REVIEW ONLY PASS. No Worker update or secret upload. No database changes.'
    Write-Host 'A separate explicit owner approval is required to update existing QA Worker.'
    return
}
# Cloudflare cannot read local iPhone/other device photo vaults. Require
# exactly one truthful owner attestation before touching the QA Worker.
Require ($OwnerConfirmedPhotoZipBackup.IsPresent -xor $OwnerConfirmedNoLocalPhotos.IsPresent) 'Choose exactly one: -OwnerConfirmedPhotoZipBackup after SAVE to Files/iCloud, VERIFY saved ZIP; or -OwnerConfirmedNoLocalPhotos only if no QA photos exist on any device.'
if ($OwnerConfirmedNoLocalPhotos.IsPresent) {
    Write-Warning 'Owner attests no local QA photos exist on any device. No empty ZIP backup needed. Not remotely verifiable.'
} else {
    Write-Warning 'Owner attests saved and verified all-local-photos ZIP outside FIRE.'
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
$beforeBindingRaw = @(& $wrangler.Source versions view $expectedOldVersion --name $workerName --json)
Require-Exit 'Read-only pre-approval physical QA Worker binding'
$beforeBinding = & $bindingHelper -Json ($beforeBindingRaw -join [Environment]::NewLine) -ExpectedVersion $expectedOldVersion -ExpectedDatabaseId $dbId
Require ($beforeBinding.bindingVerified -eq $true -and $beforeBinding.remoteWrites -eq $false) 'Before-approval Worker D1 binding could not be proven.'
$approval = 'UPDATE QA ' + $workerName + ' ' + $dbId + ' ' + $photoMode + ' ' + $head + ' FROM ' + $expectedOldVersion
Write-Warning 'Cloudflare cannot verify local photos. Release relies on the exact owner photo attestation above.'
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
# After explicit approval, independently reconfirm BOTH exact QA and protected
# staging physical database identities. The D1 LIST endpoint can fail with 10000
# on Windows even while two individual D1 INFO endpoints work. A successful but
# malformed LIST must fail closed; only a nonzero LIST exit permits exact INFO.
# Never query staging customer records, deploy staging, or mutate any D1 database.
$identityHelper = Join-Path $PSScriptRoot 'qa_d1_identity_from_list.ps1'
$individualInfoHelper = Join-Path $PSScriptRoot 'qa_d1_identity_from_info.ps1'
$qaD1Config = Join-Path $PSScriptRoot 'wrangler.qa-migrations.json'
Require (Test-Path -LiteralPath $identityHelper -PathType Leaf) 'Strict full D1 LIST identity validator missing.'
Require (Test-Path -LiteralPath $individualInfoHelper -PathType Leaf) 'Strict dual D1 INFO identity validator missing.'
Require (Test-Path -LiteralPath $qaD1Config -PathType Leaf) 'Pinned QA-only D1 info config missing.'
$previousErrorAction = $ErrorActionPreference
try {
    $ErrorActionPreference = 'Continue'
    $rawD1 = @(& $wrangler.Source d1 list --json 2>$null)
    $listExit = $LASTEXITCODE
} finally { $ErrorActionPreference = $previousErrorAction }
if ($listExit -eq 0) {
    $d1 = & $identityHelper -Json ($rawD1 -join [Environment]::NewLine)
    Write-Host 'PASS: Fresh QA/staging physical IDs verified from complete D1 LIST.'
} else {
    Write-Host 'LIMIT: D1 LIST unavailable; verifying fresh QA and protected staging IDs from two separate INFO requests.'
    $qaInfoRaw = @(& $wrangler.Source d1 info $dbName "--config=$qaD1Config" --json 2>$null)
    Require-Exit 'Post-approval exact QA D1 INFO'
    $stageInfoRaw = @(& $wrangler.Source d1 info 'fire-app-staging-db' "--config=$qaD1Config" --json 2>$null)
    Require-Exit 'Post-approval protected staging D1 INFO'
    $d1 = & $individualInfoHelper -QaJson ($qaInfoRaw -join [Environment]::NewLine) -StagingJson ($stageInfoRaw -join [Environment]::NewLine)
}
Require ($null -ne $d1 -and $d1.qaName -ceq $dbName -and $d1.qaUuid -ceq $dbId -and
    $d1.stagingName -ceq 'fire-app-staging-db' -and
    $d1.stagingUuid -ceq 'afb2c05a-d794-4a9a-b580-924ce01c26ad' -and
    $d1.qaUuid -cne $d1.stagingUuid
) 'QA/staging physical D1 identity changed after exact owner approval. Refusing overwrite.'
# Bindings may change without a different listed D1. Verify the actual still-serving
# immutable Worker version again after approval, just before any code upload.
$afterBindingRaw = @(& $wrangler.Source versions view $expectedOldVersion --name $workerName --json)
Require-Exit 'Fresh, read-only pre-deploy physical QA Worker binding'
$afterBinding = & $bindingHelper -Json ($afterBindingRaw -join [Environment]::NewLine) -ExpectedVersion $expectedOldVersion -ExpectedDatabaseId $dbId
Require ($afterBinding.bindingVerified -eq $true -and $afterBinding.remoteWrites -eq $false) 'Worker binding changed after owner approval. Refusing overwrite.'
# Normalize ONLY the obsolete, default legacy_env=true. The build's original
# manifest and all D1 customer rows must be preserved. No secrets are read,
# written, generated, displayed, or submitted during a code-only QA update.
$script:qaUploadAttempted = $false
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
        # A CLI error may follow a committed write; NEVER auto-retry.
        $script:qaUploadAttempted = $true
        & $wrangler.Source deploy --config $temporaryManifest --name $workerName
        Require-Exit 'Authorized existing synthetic QA Worker code update'
    } finally { Pop-Location }
    # The upload command alone does not prove the new code is serving requests.
    $publishedRaw = @(& $wrangler.Source deployments status --name $workerName --json)
    Require-Exit 'Fresh post-upload active QA Worker deployment'
    try { $published = ConvertFrom-Json -InputObject ($publishedRaw -join [Environment]::NewLine) }
    catch { throw 'FIRE QA POST-DEPLOY UNCERTAIN: Invalid active deployment JSON.' }
    Require ($null -ne $published -and $null -ne $published.versions) 'Post-upload deployment status missing; inspect read-only. Do not repeat deploy.'
    $publishedVersions = @($published.versions)
    Require ($publishedVersions.Count -eq 1 -and [double]$publishedVersions[0].percentage -eq 100) 'Post-upload traffic is not exactly one 100-percent QA version. Do not repeat deploy.'
    $newActiveVersion = [string]$publishedVersions[0].version_id
    Require ($newActiveVersion -cmatch '^[0-9a-f]{8}-[0-9a-f-]{27,} 'New QA version is absent or unverified. Do not repeat deploy.'
    $newBindingRaw = @(& $wrangler.Source versions view $newActiveVersion --name $workerName --json)
    Require-Exit 'Fresh post-upload physical QA D1 binding'
    $newBinding = & $bindingHelper -Json ($newBindingRaw -join [Environment]::NewLine) -ExpectedVersion $newActiveVersion -ExpectedDatabaseId $dbId
    Require ($newBinding.bindingVerified -eq $true -and $newBinding.remoteWrites -eq $false) 'New QA version does not prove physical D1 isolation and no R2. Do not repeat deploy.'
    Write-Host ('PASS: One NEW 100-percent active QA Worker version: ' + $newActiveVersion)
    Write-Host ('PASS: New version physically binds only QA D1 ' + $dbId + ' with no R2.')
    Write-Host ('Previously working code rollback version: ' + $expectedOldVersion)
    Write-Host ('Reviewed local Git source: ' + $head)
    Write-Warning 'LIMIT: Wrangler version/D1 metadata does NOT prove remote Worker bytes equal local Git source. Exact source-to-binary attestation remains OPEN.'
    Write-Host 'Verify only changed payment links and Void on iPhone; preserve earlier customer, photo and Voice acceptance.'
} catch {
    if ($script:qaUploadAttempted) {
        Write-Warning 'FIRE QA UPLOAD MAY HAVE OCCURRED. DO NOT REPEAT PUBLISH. Inspect Wrangler deployments status and versions view READ ONLY. Preserve original rollback and D1; no automatic retry, rollback or migration.'
    }
    throw
} finally {
    if (Test-Path -LiteralPath $temporaryManifest -PathType Leaf) {
        Remove-Item -LiteralPath $temporaryManifest -Force
    }
}
 -and
        $newActiveVersion -cne $expectedOldVersion) 'New QA version is absent or unverified. Do not repeat deploy.'
    $newBindingRaw = @(& $wrangler.Source versions view $newActiveVersion --name $workerName --json)
    Require-Exit 'Fresh post-upload physical QA D1 binding'
    $newBinding = & $bindingHelper -Json ($newBindingRaw -join [Environment]::NewLine) -ExpectedVersion $newActiveVersion -ExpectedDatabaseId $dbId
    Require ($newBinding.bindingVerified -eq $true -and $newBinding.remoteWrites -eq $false) 'New QA version does not prove physical D1 isolation and no R2. Do not repeat deploy.'
    Write-Host ('PASS: One NEW 100-percent active QA Worker version: ' + $newActiveVersion)
    Write-Host ('PASS: New version physically binds only QA D1 ' + $dbId + ' with no R2.')
    Write-Host ('Previously working code rollback version: ' + $expectedOldVersion)
    Write-Host ('Reviewed local Git source: ' + $head)
    Write-Warning 'LIMIT: Wrangler version/D1 metadata does NOT prove remote Worker bytes equal local Git source. Exact source-to-binary attestation remains OPEN.'
    Write-Host 'Verify only changed payment links and Void on iPhone; preserve earlier customer, photo and Voice acceptance.'
} catch {
    if ($script:qaUploadAttempted) {
        Write-Warning 'FIRE QA UPLOAD MAY HAVE OCCURRED. DO NOT REPEAT PUBLISH. Inspect Wrangler deployments status and versions view READ ONLY. Preserve original rollback and D1; no automatic retry, rollback or migration.'
    }
    throw
} finally {
    if (Test-Path -LiteralPath $temporaryManifest -PathType Leaf) {
        Remove-Item -LiteralPath $temporaryManifest -Force
    }
}
