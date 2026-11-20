# Local-only Customer # and Job # historical preflight against the user's
# already-verified Oct 31 current-25 QA SQL archive. NO provider/network writes.
# Default dry run. -Inspect reads private rows in memory only and emits counts.
# Not a database migration, feature activation, app build, or release approval.
[CmdletBinding()]
param([switch]$Inspect)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
function Require([bool]$ok,[string]$why){
  if(-not $ok){throw ('FIRE PRIVATE NUMBER HISTORY STOP: '+$why)}
}
$folder=Join-Path $env:USERPROFILE 'FIRE-Private-Backups'
$sql=Join-Path $folder 'FIRE-QA-CURRENT25-20261031-111316.sql'
$receipt=$sql+'.restore-review.json'
$verify=Join-Path $PSScriptRoot 'verify_qa_current25_d1_export.py'
$customer=Join-Path $PSScriptRoot 'customer-numbering\preflight_customer_history.py'
$job=Join-Path $PSScriptRoot 'job-numbering\preflight_job_history.py'
Write-Host 'FIRE QA historical Customer # and Job # — private source-only preflight'
Write-Host 'No Cloudflare, app changes, migrations, payments, customer contact or data export.'
if(-not $Inspect){
  Write-Host 'DRY RUN ONLY: local private backup is not opened, queried or changed.'
  Write-Host 'PRIVATE_SQL_READ=NO; CLOUD_WRITES=NONE; NUMBERS_ACTIVATED=NO; DEPLOYED=NO'
  return
}
Require ($env:OS -eq 'Windows_NT') 'Owner Windows device is required.'
Require (Test-Path -LiteralPath $folder -PathType Container) 'Private backup folder not found.'
Require (Test-Path -LiteralPath $sql -PathType Leaf) 'Only the owner-verified current-25 QA SQL archive is accepted.'
Require (Test-Path -LiteralPath $receipt -PathType Leaf) 'Current-25 owner offline restore receipt is missing.'
foreach($p in @($folder,$sql,$receipt)){
  Require (-not ((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'Linked private backup or folder refused.'
}
foreach($p in @($verify,$customer,$job)){
  Require (Test-Path -LiteralPath $p -PathType Leaf) 'Reviewed local source preflight missing.'
  Require (-not ((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'Linked source file refused.'
}
$py=Get-Command 'python.exe' -ErrorAction SilentlyContinue
Require ($null -ne $py) 'Owner local Python 3 is required. No installs are performed.'
try{$proof=Get-Content -LiteralPath $receipt -Raw -ErrorAction Stop | ConvertFrom-Json}
catch{throw 'FIRE PRIVATE NUMBER HISTORY STOP: Owner archive verification receipt is malformed.'}
Require ($proof.format -ceq 'fire-private-qa-current25-offline-validation-v1' -and
  $proof.status -ceq 'OFFLINE_CURRENT_QA_25_RESTORE_PASSED' -and
  $proof.assertedQAUuid -ceq '8ccfb1f8-1657-4074-b1b2-47de78f95003' -and
  $proof.remoteOperationsPerformed -eq $false -and
  $proof.qaUpdateAuthorized -eq $false -and
  $proof.productionReleaseAuthorized -eq $false) 'Saved receipt does not prove the correct owner QA local recovery.'
$hash=(Get-FileHash -LiteralPath $sql -Algorithm SHA256).Hash.ToLowerInvariant()
Require ($proof.exportSha256 -ceq $hash) 'Private SQL bytes changed since the recovered archive receipt.'
Require ((Get-Item -LiteralPath $sql).Length -eq $proof.exportBytes) 'Owner SQL archive size differs from saved verification.'
Write-Host 'PASS: Private QA SQL checksum and existing offline recovery receipt agree.'
# Re-validate against the exact pinned 25-migration source, not just JSON.
$actual=@(& $py.Source $verify $sql --expected-sha256 $hash 2>$null)
$verifyExit=$LASTEXITCODE
Require ($verifyExit -eq 0 -and $actual.Count -gt 0) 'Offline 25-schema verifier failed, no numbering proposal.'
try{$verified=ConvertFrom-Json -InputObject ($actual -join [Environment]::NewLine)}
catch{throw 'FIRE PRIVATE NUMBER HISTORY STOP: Fresh private recovery verification malformed.'}
Require ($verified.status -ceq 'OFFLINE_CURRENT_QA_25_RESTORE_PASSED' -and
  $verified.exportSha256 -ceq $hash -and
  $verified.assertedQAUuid -ceq $proof.assertedQAUuid -and
  $verified.qaUpdateAuthorized -eq $false) 'Fresh read-only recovered QA SQL did not match owner receipt.'
Write-Host 'PASS: Fresh exact-25 SQLite restore and financial integrity review.'
function Invoke-PrivateCountPreflight {
  param([string]$Name,[string]$Source)
  # Preflight CLIs remove raw mappings, IDs, email and private paths from JSON.
  # Never print raw stderr, exceptions or SQL, even on a blocked private file.
  $data=@(& $py.Source $Source --sql-export $sql 2>$null)
  $code=$LASTEXITCODE
  Require ($code -eq 0 -and $data.Count -gt 0) ($Name+' historical identity preflight is BLOCKED; owner review required.')
  try{$result=ConvertFrom-Json -InputObject ($data -join [Environment]::NewLine)}
  catch{throw ('FIRE PRIVATE NUMBER HISTORY STOP: '+$Name+' safe summary invalid.')}
  Require ($result.historicalNumberAssignmentProposedOnly -eq $true -and
    $result.inMemoryBackfillRehearsalPassed -eq $true -and
    $result.hostedMigrationApplied -eq $false -and
    $result.remoteD1Changed -eq $false -and
    $result.deployedAppChanged -eq $false) ($Name+' result lacks all no-write/complete rehearsal safeguards.')
  return $result
}
$c=Invoke-PrivateCountPreflight -Name 'Customer #' -Source $customer
$j=Invoke-PrivateCountPreflight -Name 'Job #' -Source $job
Write-Host ('PASS: Customer # in-memory ordering and mapping. Historic customers='+$c.historicalCustomers+', timestamp ties='+$c.timestampTies)
Write-Host ('PASS: Job # in-memory revision lineage and mapping. Distinct jobs='+$j.distinctJobs+', revisions='+$j.revisionLinks+', completed jobs='+$j.completedJobs)
Write-Host 'PRIVATE_SQL_READ=YES; PRIVATE_ROWS_PRINTED=NO; CLOUD_WRITES=NONE; NUMBERS_ACTIVATED=NO; DEPLOYED=NO'
Write-Host 'LIMIT: This is a local proposed historical rehearsal; it does NOT approve a hosted migration, enabled numbering, v2 JSON recovery, photo restore or production release.'
