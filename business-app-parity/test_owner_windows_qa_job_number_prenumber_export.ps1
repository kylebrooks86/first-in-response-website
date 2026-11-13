# FIRE Job # source-only QA25 backup guard contract. NEVER -Export in CI.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$file=Join-Path $PSScriptRoot 'owner_windows_qa_job_number_prenumber_export.ps1'
function Require([bool]$ok,[string]$reason) {
 if(-not $ok){throw ('FIRE JOB # PRENUMBER BACKUP TEST STOP: '+$reason)}
}
Require (Test-Path -LiteralPath $file -PathType Leaf) 'Source backup guard is missing.'
$source=Get-Content -LiteralPath $file -Raw
foreach($needle in @(
 '[switch]$Export',
 'if (-not $Export)',
 "EXPORT_ATTEMPTED=NO; REMOTE_WRITES=NONE; QA_RELEASE_APPROVED=NO",
 'owner_windows_qa_job_number_inventory_readonly.ps1',
 'verify_qa_current25_d1_export.py',
 'job-numbering\preflight_job_history.py',
 'e3028e6f-00b4-4717-8bd3-df558d15a37d',
 '8ccfb1f8-1657-4074-b1b2-47de78f95003',
 'QA_CUSTOMERS=3; QA_ESTIMATES=7; QA_INVOICES=1; QA_PAYMENTS=3; QA_PHOTO_RECORDS=0; NUMBER_TABLES=0',
 "PRIVATE JOB197",
 "type EXPORT ",
 'Read-Host',
 'ReparsePoint',
 'Get-FileHash',
 '--expected-sha256',
 'OFFLINE_CURRENT_QA_25_RESTORE_PASSED',
 'inMemoryBackfillRehearsalPassed',
 'privateExportSha256',
 'offDeviceEncryptedCustodyVerified=$false',
 'activationAuthorized=$false',
 'Invoke-VerifiedQaReview -Stage',
 'd1 export',
 '--remote',
 'KEEP THE SQL AND RECEIPT ENCRYPTED'
)){
 Require ($source.Contains($needle)) ('Missing explicit safety marker: '+$needle)
}
$dry=$source.IndexOf('if (-not $Export)')
Require ($dry -ge 0 -and $dry -lt $source.IndexOf("Get-Command 'wrangler.cmd'")) 'Dry run must return before provider lookup.'
Require ($dry -lt $source.IndexOf('Read-Host')) 'Dry run must skip owner export prompts.'
Require ($source.IndexOf('Read-Host') -lt $source.IndexOf('d1 export')) 'Exact owner authorization must precede the D1 export.'
Require ($source.IndexOf("Invoke-VerifiedQaReview -Stage 'Pre-export'") -lt $source.IndexOf('d1 export')) 'Fresh QA identity verification must precede export.'
Require ($source.IndexOf("Invoke-VerifiedQaReview -Stage 'Post-export'") -gt $source.IndexOf('d1 export')) 'Post-export identity revalidation missing.'
Require ($source.IndexOf("Invoke-VerifiedQaReview -Stage 'Post-private-numbering-history'") -gt $source.IndexOf('d1 export')) 'History/QA revalidation missing.'
Require (-not $source.Contains('d1 migrations apply')) 'Never run D1 migrations from the backup helper.'
Require (-not $source.Contains('wrangler deploy')) 'Never deploy a Worker from the backup helper.'
Require (-not $source.Contains('956f023b-8134-4a66-9598-56c25fb6afab')) 'The current backup cannot use an obsolete Worker version.'
$before=@(Get-ChildItem -LiteralPath $PSScriptRoot -File).Count
$out=(& $file 6>&1 2>&1 | Out-String)
$after=@(Get-ChildItem -LiteralPath $PSScriptRoot -File).Count
Require ($out.Contains('DRY RUN ONLY: no Cloudflare connection')) 'Default did not safely dry run.'
Require ($out.Contains('EXPORT_ATTEMPTED=NO; REMOTE_WRITES=NONE; QA_RELEASE_APPROVED=NO')) 'Dry run must prohibit exports and any hosted writes.'
Require ($before -eq $after) 'Default unexpectedly changed repository files.'
Write-Host 'PASS: current-QA pre-Job # private export helper dry-runs without provider/file access, preserves exact identity, and demands owner confirmation and offline restore.'
