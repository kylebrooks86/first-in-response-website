# Synthetic no-data-read Windows contract for QA customer/job history rehearsal.
# This test NEVER opens a real private SQL file or runs an -Inspect.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot 'owner_windows_qa_numbering_history_readonly.ps1'
function Require([bool]$ok,[string]$reason){
  if(-not $ok){throw ('FIRE QA HISTORY TEST STOP: '+$reason)}
}
Require (Test-Path -LiteralPath $source -PathType Leaf) 'Required owner local history script missing.'
$s=Get-Content -LiteralPath $source -Raw
$need=@(
  '[switch]$Inspect',
  'if(-not $Inspect)',
  'FIRE-QA-CURRENT25-20261031-111316.sql',
  'FIRE-Private-Backups',
  'verify_qa_current25_d1_export.py',
  'customer-numbering\preflight_customer_history.py',
  'job-numbering\preflight_job_history.py',
  'OFFLINE_CURRENT_QA_25_RESTORE_PASSED',
  'fire-private-qa-current25-offline-validation-v1',
  'Get-FileHash -LiteralPath $sql -Algorithm SHA256',
  '$proof.exportSha256 -ceq $hash',
  '$proof.assertedQAUuid',
  '8ccfb1f8-1657-4074-b1b2-47de78f95003',
  '--expected-sha256 $hash',
  '--sql-export $sql',
  'ReparsePoint',
  'inMemoryBackfillRehearsalPassed',
  'historicalNumberAssignmentProposedOnly',
  'PRIVATE_ROWS_PRINTED=NO; CLOUD_WRITES=NONE; NUMBERS_ACTIVATED=NO; DEPLOYED=NO'
)
foreach($needle in $need){Require ($s.Contains($needle)) ('Missing exact local QA historical safety: '+$needle)}
$pre=$s.IndexOf('if(-not $Inspect)')
$firstRead=$s.IndexOf('Get-Content -LiteralPath $receipt')
Require ($pre -ge 0 -and $firstRead -gt $pre) 'Default must return before private receipt is opened.'
$firstSql=$s.IndexOf('Get-FileHash -LiteralPath $sql')
Require ($firstSql -gt $pre) 'Private SQL must be untouched in dry run.'
$recovery=$s.IndexOf('$actual=@(& $py.Source $verify')
$customer=$s.IndexOf("Invoke-PrivateCountPreflight -Name 'Customer #'")
$job=$s.IndexOf("Invoke-PrivateCountPreflight -Name 'Job #'")
Require ($recovery -gt $firstSql -and $customer -gt $recovery -and $job -gt $customer) 'Fresh verified SQL restore must precede historical number rehearsals.'
foreach($forbidden in @('wrangler.cmd','deploy --config','d1 export','d1 execute','d1 migrations',
  'secret put','Invoke-WebRequest','Invoke-RestMethod','git clone','git checkout','cloudflare.com',
  'Set-Content','Out-File','Copy-Item','Move-Item','Remove-Item','Start-Process',
  'System.IO.File]::WriteAllText','-Publish','-Build','-Stage')){
  Require (-not $s.Contains($forbidden)) ('Unexpected private/remote write operation: '+$forbidden)
}
$out=(& $source 6>&1 2>&1 | Out-String)
Require ($out.Contains('DRY RUN ONLY: local private backup is not opened')) 'Default must report local no-read.'
Require ($out.Contains('PRIVATE_SQL_READ=NO; CLOUD_WRITES=NONE; NUMBERS_ACTIVATED=NO; DEPLOYED=NO')) 'Default must leave backups, app and numbering unchanged.'
Write-Host 'PASS: Private QA history source defaults to no file or network reads and can only inspect opt-in verified backup.'
