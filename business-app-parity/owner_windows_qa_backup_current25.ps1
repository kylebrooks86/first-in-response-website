# FIRE current-25 QA D1 private SQL archive: DRY RUN BY DEFAULT.
# SOURCE-ONLY until separately owner-authorized. This is a NEW helper; do not
# substitute the retired 23->25 restoration or the stale pre-0023 backup.
# No D1 row writes, migration, deploy, Stripe, R2, LIVE or staging operations.
[CmdletBinding()]
param(
    [switch]$Export,
    [string]$PrivateFolder = (Join-Path $env:USERPROFILE 'FIRE-Private-Backups')
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

$worker='fire-fullapp-qa-20261016'
$database='fire-fullapp-qa-db-20261016'
$qaUuid='8ccfb1f8-1657-4074-b1b2-47de78f95003'
$version='99fa8c27-df83-48d3-b953-9a84eb295334'
$root=$PSScriptRoot
$review=Join-Path $root 'owner_windows_qa_current_readonly.ps1'
$verifier=Join-Path $root 'verify_qa_current25_d1_export.py'
$configSource=Join-Path $root 'wrangler.qa-migrations.json'
$remoteWrites=0

function Require([bool]$ok,[string]$why) {
    if (-not $ok) { throw ('FIRE QA PRIVATE CURRENT25 STOP: '+$why) }
}
Write-Host 'FIRE QA PRIVATE CURRENT25 ARCHIVE — SOURCE-ONLY OWNER CONTROL'
Write-Host 'No deploy, hosted SQL writes, migration, customer messages or payments.'
Write-Host 'This is not an app release approval. Current production readiness: 3/10.'
if (-not $Export) {
    Write-Host 'DRY RUN ONLY: no Cloudflare connection, private file, backup or new folder.'
    Write-Host 'Export is disabled unless the owner separately approves a bounded QA-only export.'
    Write-Host 'EXPORT_ATTEMPTED=NO; REMOTE_WRITES=NONE; QA_RELEASE_APPROVED=NO'
    return
}

Require ($env:OS -eq 'Windows_NT') 'Only the original owner Acer Windows account may export.'
foreach ($f in @($review,$verifier,$configSource)) {
    Require (Test-Path -LiteralPath $f -PathType Leaf) 'Current reviewed 25-schema backup support files missing.'
    Require (-not ((Get-Item -LiteralPath $f).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'Linked support file refused.'
}
$reviewText=Get-Content -LiteralPath $review -Raw
Require ($reviewText.Contains($version) -and $reviewText.Contains($qaUuid)) 'Current owner read-only runtime guard is missing exact QA pins.'
$cfg=Get-Content -LiteralPath $configSource -Raw | ConvertFrom-Json
Require ($cfg.name -ceq $worker -and @($cfg.d1_databases).Count -eq 1) 'QA config unexpectedly changed.'
Require ($cfg.d1_databases[0].binding -ceq 'DB' -and
    $cfg.d1_databases[0].database_name -ceq $database -and
    $cfg.d1_databases[0].database_id -ceq $qaUuid) 'Wrong database resource: STOP.'

$wrangler=Get-Command 'wrangler.cmd' -ErrorAction SilentlyContinue
$python=Get-Command 'python.exe' -ErrorAction SilentlyContinue
Require ($null -ne $wrangler -and $null -ne $python) 'Installed Wrangler and Python are required. No export started.'

# Must use a preexisting owner-controlled private directory, not Git or a
# symlink/junction. Do not silently create an unencrypted backup destination.
Require (Test-Path -LiteralPath $PrivateFolder -PathType Container) 'Create and verify a private encrypted folder separately before export.'
$private=(Resolve-Path -LiteralPath $PrivateFolder).Path
$repository=(Resolve-Path -LiteralPath (Join-Path $root '..')).Path
Require ($private -cne $repository -and
    -not $private.StartsWith(($repository.TrimEnd('\')+'\'),[StringComparison]::OrdinalIgnoreCase)) 'Never save private D1 SQL under the Git repository.'
$walker=Get-Item -LiteralPath $private
while ($null -ne $walker) {
    Require (-not ($walker.Attributes -band [IO.FileAttributes]::ReparsePoint)) 'Linked private folder or parent refused.'
    $walker=$walker.Parent
}
Write-Warning 'D1 SQL includes private records. This script cannot attest BitLocker encryption or file custody.'
Write-Warning 'D1 exports may temporarily interrupt hosted QA queries; do not use during active app testing.'
$typed=Read-Host ('To authorize QA SQL EXPORT ONLY, type EXPORT '+$qaUuid)
Require ($typed -ceq ('EXPORT '+$qaUuid)) 'Exact QA export-only confirmation not received.'
$custody=Read-Host 'If private storage and the short QA export window are approved, type PRIVATE CURRENT25'
Require ($custody -ceq 'PRIVATE CURRENT25') 'Private backup custody and export window not confirmed.'

# This exact, previously owner-tested reviewer reads only QA D1 inventory,
# current 100%-serving Worker, actual physical binding and 25 schema objects.
# It fails closed on a resource switch; it never exports or updates records.
Write-Host 'READ-ONLY: Checking the active QA Worker, physical DB and all 25 migrations.'
& $review
Write-Host 'PASS: Pre-export exact QA-only identity/schema review.'

$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$out=Join-Path $private ('FIRE-QA-CURRENT25-'+$stamp+'.sql')
$receiptPath=$out+'.restore-review.json'
$tempConfig=Join-Path $private ('FIRE-QA-CURRENT25-CONFIG-'+$stamp+'.json')
foreach ($p in @($out,$receiptPath,$tempConfig)) {
    Require (-not (Test-Path -LiteralPath $p)) 'Existing file refused: never overwrite private backup evidence.'
}
$configBody=@{
    name='fire-qa-private-export-only'
    compatibility_date='2026-10-15'
    d1_databases=@(@{
        binding='DB'
        database_name=$database
        database_id=$qaUuid
    })
} | ConvertTo-Json -Depth 6
[IO.File]::WriteAllText($tempConfig,$configBody,[Text.UTF8Encoding]::new($false))
try {
    # The ONLY remote export command. Explicit QA resource, --remote and
    # temporary pinned UUID config; no migration, mutation or deployment.
    & $wrangler.Source d1 export $database --remote "--config=$tempConfig" "--output=$out"
    $exportCode=$LASTEXITCODE
} finally {
    Remove-Item -LiteralPath $tempConfig -Force -ErrorAction SilentlyContinue
}
Require ($exportCode -eq 0 -and (Test-Path -LiteralPath $out -PathType Leaf)) 'QA-only export failed; any partial SQL is unverified and must not be trusted.'
Require (-not ((Get-Item -LiteralPath $out).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'Linked SQL export refused.'
# Refuse changed source Worker or physical DB before marking a private
# export usable: export success alone is not a rollback seal.
& $review
Write-Host 'PASS: Post-export QA Worker and physical DB identities unchanged.'

$hash=(Get-FileHash -LiteralPath $out -Algorithm SHA256).Hash.ToLowerInvariant()
$validation=@(& $python.Source $verifier $out --expected-sha256 $hash 2>$null)
$validationExit=$LASTEXITCODE
Require ($validationExit -eq 0 -and $validation.Count -gt 0) 'Offline current-25 SQL restore failed or cannot be verified. Keep source privately; do not approve release.'
try { $check=ConvertFrom-Json -InputObject ($validation -join [Environment]::NewLine) }
catch { throw 'FIRE QA PRIVATE CURRENT25 STOP: Offline verifier result malformed; do not trust export.' }
Require ($check.status -ceq 'OFFLINE_CURRENT_QA_25_RESTORE_PASSED' -and
    $check.exportSha256 -ceq $hash -and
    $check.assertedQAUuid -ceq $qaUuid -and
    $check.remoteOperationsPerformed -eq $false -and
    $check.qaUpdateAuthorized -eq $false) 'Private backup receipt does not meet exact current-25 fail-closed contract.'
# Retain a sanitized local receipt adjacent to owner-held private SQL, never
# expose customer rows or token values to the console or to GitHub.
[IO.File]::WriteAllText($receiptPath,($validation -join [Environment]::NewLine),[Text.UTF8Encoding]::new($false))
Write-Host 'PASS: Private current-25 QA SQL export verified by a disposable local SQLite restore.'
Write-Host ('SHA256='+$hash)
Write-Host ('PRIVATE_EXPORT_BYTES='+$check.exportBytes)
Write-Host 'KEEP THE SQL AND RECEIPT ENCRYPTED. DO NOT POST THEM IN CHAT OR GITHUB.'
Write-Host 'LIMIT: Hosting origin, immutable off-device custody and rollback after deployment are not independently established.'
Write-Host 'REMOTE_D1_ROW_WRITES=NONE; DEPLOYED=NO; QA_RELEASE_APPROVED=NO; PRODUCTION_GATES=3/10'
