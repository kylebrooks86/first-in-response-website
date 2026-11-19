# FIRE owner-operated local backup check — READ ONLY; no Cloudflare or scheduled task.
# Checks a specifically selected encrypted photo file and SQL+receipt pair.
# NEVER claims photos were decrypted, customer IDs paired or offsite custody proven.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$SqlFile,
    [Parameter(Mandatory=$true)][string]$PhotosFile,
    [Parameter(Mandatory=$true)][string]$ExpectedD1Uuid,
    [ValidateRange(1,365)][int]$MaxAgeDays = 7
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
function Stop-Review([string]$Code) {
    Write-Output ('BACKUP_CADENCE_STOP=' + $Code)
    exit 1
}
function Safe-LocalFile([string]$Location,[string]$Code) {
    if (-not (Test-Path -LiteralPath $Location -PathType Leaf)) { Stop-Review ($Code+'_NOT_FOUND') }
    $item = Get-Item -LiteralPath $Location -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        Stop-Review ($Code+'_LINK_REFUSED')
    }
    if (-not $item.FullName.StartsWith($env:USERPROFILE, [StringComparison]::OrdinalIgnoreCase)) {
        Stop-Review ($Code+'_OUTSIDE_OWNER_PROFILE')
    }
    return $item
}
if ($ExpectedD1Uuid -notmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') {
    Stop-Review 'TARGET_UUID_INVALID'
}
$sql = Safe-LocalFile $SqlFile 'RECORDS'
$receipt = Safe-LocalFile ($sql.FullName+'.restore-review.json') 'RECORDS_RECEIPT'
$photos = Safe-LocalFile $PhotosFile 'PHOTOS'
if ($sql.Length -lt 1 -or $sql.Length -gt 134217728) { Stop-Review 'RECORDS_SIZE_INVALID' }
if ($receipt.Length -lt 30 -or $receipt.Length -gt 1048576) { Stop-Review 'RECORDS_RECEIPT_SIZE_INVALID' }
try {
    $saved = Get-Content -LiteralPath $receipt.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
    Stop-Review 'RECORDS_RECEIPT_INVALID'
}
if ($saved.status -cne 'OFFLINE_CURRENT_QA_25_RESTORE_PASSED' -or
    $saved.assertedQAUuid -cne $ExpectedD1Uuid -or
    $saved.exportBytes -ne $sql.Length -or
    $saved.exportSha256 -notmatch '^[a-f0-9]{64}$') {
    Stop-Review 'RECORDS_RECEIPT_MISMATCH'
}
$actualHash = (Get-FileHash -LiteralPath $sql.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -cne $saved.exportSha256) { Stop-Review 'RECORDS_HASH_MISMATCH' }
# Quick protected photo envelope shape check, NOT authentication or content recovery.
if ($photos.Length -lt 65 -or $photos.Length -gt (161MB + 4096)) {
    Stop-Review 'PHOTO_ENVELOPE_SIZE_INVALID'
}
$reader = [IO.File]::Open($photos.FullName, [IO.FileMode]::Open, [IO.FileAccess]::Read,
    [IO.FileShare]::ReadWrite)
try {
    $header = New-Object byte[] 48
    $countRead = $reader.Read($header, 0, 48)
} finally {
    $reader.Dispose()
}
if ($countRead -ne 48 -or [Text.Encoding]::ASCII.GetString($header,0,8) -cne 'FIREPX01') {
    Stop-Review 'PHOTO_ENVELOPE_HEADER_INVALID'
}
$chunk = [BitConverter]::ToUInt32($header,32)
$plain = [BitConverter]::ToUInt64($header,36)
$chunks = [BitConverter]::ToUInt32($header,44)
$expectCount = [math]::Ceiling([double]$plain/1048576)
if ($chunk -ne 1048576 -or $plain -lt 1 -or $plain -gt (161MB) -or
    $chunks -lt 1 -or $chunks -ne $expectCount -or
    $photos.Length -ne (48 + [long]$plain + 16*[long]$chunks)) {
    Stop-Review 'PHOTO_ENVELOPE_STRUCTURE_INVALID'
}
# Times identify a review cadence; they do not prove a cross-device atomic snapshot.
$now = [DateTime]::UtcNow
$daysRecords = [math]::Max(0,[math]::Floor(($now-$sql.LastWriteTimeUtc).TotalDays))
$daysPhotos = [math]::Max(0,[math]::Floor(($now-$photos.LastWriteTimeUtc).TotalDays))
Write-Output 'LOCAL_SQL_HASH_RECEIPT=PASS'
Write-Output 'ENCRYPTED_PHOTO_HEADER_STRUCTURE=PASS'
Write-Output ('RECORDS_AGE_DAYS='+$daysRecords)
Write-Output ('PHOTOS_AGE_DAYS='+$daysPhotos)
Write-Output ('CADENCE='+$(if ($daysRecords -gt $MaxAgeDays -or $daysPhotos -gt $MaxAgeDays) {'REVIEW_NEW_BACKUP_DUE'} else {'WITHIN_LOCAL_AGE_WINDOW'}))
Write-Output 'PHOTOS_AES_OR_ORIGINAL_HASH_VERIFIED=NO'
Write-Output 'RECORDS_PHOTOS_PAIRED_SNAPSHOT_VERIFIED=NO'
Write-Output 'OFF_DEVICE_CUSTODY_VERIFIED=NO'
Write-Output 'HOSTED_RESTORE_OR_RELEASE_APPROVED=NO'
Write-Output 'REMOTE_WRITES_OR_DEPLOYMENT=NONE'
