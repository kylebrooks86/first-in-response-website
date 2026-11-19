# Synthetic-only Windows PowerShell tests. No owner data, cloud, deploy, or payments.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'owner_backup_cadence_review.ps1'
if (-not (Test-Path -LiteralPath $script)) { throw 'Checker missing' }
$uuid = '8ccfb1f8-1657-4074-b1b2-47de78f95003'
$root = Join-Path $env:USERPROFILE ('FIRE-G7-SYNTHETIC-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $root -ErrorAction Stop | Out-Null
$records = Join-Path $root 'synthetic.sql'
$photos = Join-Path $root 'synthetic.firephotos'
function Invoke-Check {
    param([string]$TargetUuid = $uuid,[int]$Age=7,[string]$ProfileOverride='')
    $previousProfile = $env:USERPROFILE
    try {
        if ($ProfileOverride) { $env:USERPROFILE = $ProfileOverride }
        $lines = @(& powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $script -SqlFile $records -PhotosFile $photos -ExpectedD1Uuid $TargetUuid -MaxAgeDays $Age 2>&1 | ForEach-Object { [string]$_ })
        $exitCode = $LASTEXITCODE
    } finally {
        $env:USERPROFILE = $previousProfile
    }
    return @{ Exit=$exitCode; Lines=($lines -join [char]10) }
}
function Must([bool]$Passed,[string]$Reason) {if (-not $Passed) { throw ('FAIL: '+$Reason) }}
try {
    # These are fake fixtures, NOT real SQL/customer records or decryptable photos.
    [IO.File]::WriteAllText($records, '-- synthetic SQL only', [Text.UTF8Encoding]::new($false))
    $hash = (Get-FileHash -LiteralPath $records -Algorithm SHA256).Hash.ToLowerInvariant()
    $saved = @{status='OFFLINE_CURRENT_QA_25_RESTORE_PASSED';assertedQAUuid=$uuid;
               exportSha256=$hash;exportBytes=(Get-Item $records).Length}
    [IO.File]::WriteAllText(($records+'.restore-review.json'),
        ($saved|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
    $hdr = [byte[]]::new(48)
    [Text.Encoding]::ASCII.GetBytes('FIREPX01').CopyTo($hdr,0)
    [BitConverter]::GetBytes([uint32]1048576).CopyTo($hdr,32)
    [BitConverter]::GetBytes([uint64]8).CopyTo($hdr,36)
    [BitConverter]::GetBytes([uint32]1).CopyTo($hdr,44)
    $fake = [byte[]]::new(72)
    [array]::Copy($hdr,0,$fake,0,48)
    [IO.File]::WriteAllBytes($photos,$fake)

    $good=Invoke-Check
    Must ($good.Exit -eq 0) 'synthetic header and SQL receipt should be recognized'
    foreach($marker in @('LOCAL_SQL_HASH_RECEIPT=PASS',
      'ENCRYPTED_PHOTO_HEADER_STRUCTURE=PASS',
      'CADENCE=CAPTURE_AGE_UNVERIFIED',
      'AUTHENTIC_BACKUP_CAPTURE_AGE_VERIFIED=NO',
      'RECORDS_LOCAL_FILE_AGE_DAYS=0',
      'PHOTOS_LOCAL_FILE_AGE_DAYS=0',
      'RECORDS_PHOTOS_PAIRED_SNAPSHOT_VERIFIED=NO',
      'PHOTOS_AES_OR_ORIGINAL_HASH_VERIFIED=NO',
      'OFF_DEVICE_CUSTODY_VERIFIED=NO',
      'REMOTE_WRITES_OR_DEPLOYMENT=NONE')) {
        Must ($good.Lines.Contains($marker)) ('missing bounded marker '+$marker)
    }
    Must (-not $good.Lines.Contains($hash)) 'private hash must not be printed'
    Must (-not $good.Lines.Contains($records)) 'private path must not be printed'
    # A downloaded/copied OLD snapshot can have today's local file timestamp.
    # The review must NOT certify such an archive as fresh just for being copied.
    (Get-Item $records).LastWriteTimeUtc = [DateTime]::UtcNow
    (Get-Item $photos).LastWriteTimeUtc = [DateTime]::UtcNow
    $copiedOldBackup=Invoke-Check
    Must ($copiedOldBackup.Exit -eq 0 -and
          $copiedOldBackup.Lines.Contains('CADENCE=CAPTURE_AGE_UNVERIFIED') -and
          $copiedOldBackup.Lines.Contains('AUTHENTIC_BACKUP_CAPTURE_AGE_VERIFIED=NO')) 'copied old backup must never be certified fresh'
    Must (-not $copiedOldBackup.Lines.Contains('WITHIN_LOCAL_AGE_WINDOW')) 'no false freshness claim'
    # A lookalike sibling such as "owner-other" must not be mistaken for
    # a folder INSIDE "owner" just because the absolute path starts alike.
    $notReallyAnAncestor = $root.Substring(0, $root.Length - 1)
    $prefix = Invoke-Check -ProfileOverride $notReallyAnAncestor
    Must ($prefix.Exit -ne 0 -and $prefix.Lines.Contains('RECORDS_OUTSIDE_OWNER_PROFILE')) 'text-prefix-only owner profile escape must be refused'
    Must (-not $prefix.Lines.Contains($records)) 'rejected path must stay private'
    $wrong=Invoke-Check -TargetUuid '00000000-0000-0000-0000-000000000001'
    Must ($wrong.Exit -ne 0 -and $wrong.Lines.Contains('RECORDS_RECEIPT_MISMATCH')) 'wrong D1 UUID refused'
    [IO.File]::AppendAllText($records, 'tamper')
    $tamper=Invoke-Check
    Must ($tamper.Exit -ne 0 -and $tamper.Lines.Contains('RECORDS_RECEIPT_MISMATCH')) 'altered file length refused'
    [IO.File]::WriteAllText($records,'-- synthetic SQL only',[Text.UTF8Encoding]::new($false))
    $fake[0]=0
    [IO.File]::WriteAllBytes($photos,$fake)
    $header=Invoke-Check
    Must ($header.Exit -ne 0 -and $header.Lines.Contains('PHOTO_ENVELOPE_HEADER_INVALID')) 'invalid encrypted header refused'
    $fake[0]=70
    [IO.File]::WriteAllBytes($photos,$fake)
    (Get-Item $records).LastWriteTimeUtc = [DateTime]::UtcNow.AddDays(-15)
    $stale=Invoke-Check
    Must ($stale.Exit -eq 0 -and $stale.Lines.Contains('CADENCE=REVIEW_NEW_BACKUP_DUE')) 'stale records trigger review, not claim verified'
    Write-Output 'PASS: synthetic G7 backup cadence accepted/invalid/stale; no provider or private data.'
} finally {
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}
