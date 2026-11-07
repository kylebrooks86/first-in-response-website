# Offline-only Windows test for the new QA current-25 backup wrapper.
# Never invokes -Export, Wrangler, a provider, customer SQL or a restore.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$file=Join-Path $PSScriptRoot 'owner_windows_qa_backup_current25.ps1'
function Require([bool]$ok,[string]$reason) { if(-not $ok){throw ('CURRENT25 BACKUP TEST STOP: '+$reason)} }
Require (Test-Path -LiteralPath $file -PathType Leaf) 'Missing current-25 owner wrapper.'
$text=Get-Content -LiteralPath $file -Raw
$checks=0
$expect=@(
    '[switch]$Export',
    'if (-not $Export)',
    "EXPORT_ATTEMPTED=NO; REMOTE_WRITES=NONE; QA_RELEASE_APPROVED=NO",
    "owner_windows_qa_current_readonly.ps1",
    "verify_qa_current25_d1_export.py",
    "8ccfb1f8-1657-4074-b1b2-47de78f95003",
    "99fa8c27-df83-48d3-b953-9a84eb295334",
    "fire-fullapp-qa-db-20261016",
    "Read-Host",
    "EXPORT ",
    "PRIVATE CURRENT25",
    "ReparsePoint",
    "Get-FileHash",
    "--expected-sha256",
    "OFFLINE_CURRENT_QA_25_RESTORE_PASSED",
    "RemoteOperationsPerformed",
    "QA_RELEASE_APPROVED=NO",
    "d1 export",
    "--remote"
)
foreach($needle in $expect){
    Require ($text.Contains($needle) -or $text.ToLowerInvariant().Contains($needle.ToLowerInvariant())) ('Missing required safety invariant: '+$needle)
    $checks++
}
Require ($text.IndexOf('if (-not $Export)') -lt $text.IndexOf("Get-Command 'wrangler.cmd'")) 'Dry run must return before any provider lookup.'
Require ($text.IndexOf('if (-not $Export)') -lt $text.IndexOf("Read-Host")) 'Dry run must not ask for export consent.'
Require ($text.IndexOf("Read-Host") -lt $text.IndexOf('d1 export')) 'Typed owner confirmation must precede remote export.'
Require ($text.IndexOf('owner_windows_qa_current_readonly.ps1') -lt $text.IndexOf('d1 export')) 'Read-only identity preflight must precede export.'
Require ($text.Contains('Test-Path -LiteralPath $PrivateFolder -PathType Container')) 'Never implicitly create potentially unencrypted private folders.'
Require ($text.Contains("PRIVATE CURRENT25")) 'Separate private-custody approval missing.'
Require ($text.Contains("KEEP THE SQL AND RECEIPT ENCRYPTED")) 'Owner custody warning missing.'
Require ($text.Contains('powershell.exe -NoProfile -ExecutionPolicy Bypass -File $review')) 'Owner QA runtime preflight must use a fresh, separately verified PowerShell process.'
Require ($text.Contains('Require ($reviewExit -eq 0)')) 'Nonzero QA proof exit code must prevent backup export.'
Require ($text.Contains("'REMOTE_WRITES=NONE; DEPLOYED=NO; CUSTOMER_ROWS_READ=NONE; RELEASE_APPROVED=NO'")) 'Preflight must verify full no-write proof marker.'
Require ($text.Contains("Invoke-VerifiedQaReview -Stage 'Pre-export'")) 'Pre-export full QA identity review missing.'
Require ($text.Contains("Invoke-VerifiedQaReview -Stage 'Post-export'")) 'Post-export full QA identity review missing.'
Require ($text.IndexOf("Invoke-VerifiedQaReview -Stage 'Pre-export'") -lt $text.IndexOf('& $wrangler.Source d1 export')) 'Pre-export review must execute before D1 export.'
Require ($text.IndexOf("Invoke-VerifiedQaReview -Stage 'Post-export'") -gt $text.IndexOf('& $wrangler.Source d1 export')) 'Post-export review must execute after D1 export.'
Require (-not $text.Contains([Environment]::NewLine+'& $review'+[Environment]::NewLine)) 'Nested same-process QA review must not be used again.'
$checks+=8
$checks+=7
$before=Get-ChildItem -LiteralPath $PSScriptRoot -File | Measure-Object
$output = (& $file 6>&1 2>&1 | Out-String)
$after=Get-ChildItem -LiteralPath $PSScriptRoot -File | Measure-Object
Require ($output -match 'DRY RUN ONLY: no Cloudflare connection') 'Default must print dry run with no cloud action.'
Require ($output -match 'EXPORT_ATTEMPTED=NO; REMOTE_WRITES=NONE; QA_RELEASE_APPROVED=NO') 'Default must not claim export or release.'
Require ($before.Count -eq $after.Count) 'Default created or deleted files in the repo.'
$checks+=3
Write-Host ("PASS "+$checks+"/"+$checks+": Current25 owner-only archive guard and default no-network/no-file dry run.")
