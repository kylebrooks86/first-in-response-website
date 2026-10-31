# Offline, no-clone Windows guard for exact QA Git checkout staging.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$script=Join-Path $PSScriptRoot 'owner_windows_stage_exact_qa_source.ps1'
function Require([bool]$good,[string]$why){if(-not $good){throw ('FIRE QA SOURCE TEST STOP: '+$why)}}
Require (Test-Path -LiteralPath $script -PathType Leaf) 'Expected owner staging script missing.'
$source=Get-Content -LiteralPath $script -Raw
$must=@(
  '[switch]$Stage','[Parameter(Mandatory=$true)][string]$ExpectedCommit',
  "if(-not $Stage)",'DRY RUN ONLY. No network',
  "^[0-9a-f]{40}$","'FIREQA'",'git.exe',
  "core.autocrlf=false clone --depth 1 --single-branch --branch",
  "rev-parse HEAD","refs/remotes/origin/","status --porcelain --untracked-files=no",
  "Remote branch changed or exact expected source not available",
  "FIREQA already exists. Never overwrite or delete",
  "BUILT=NO; DEPLOYED=NO; CLOUD_WRITES=NONE"
)
foreach($needle in $must){Require ($source.Contains($needle)) ('Missing source security condition: '+$needle)}
foreach($forbidden in @('wrangler.cmd','d1 execute','d1 export','d1 migrations',
 'secret put','Cloudflare:workers','git reset','git clean','-Force -Recurse','Invoke-WebRequest',
 'Invoke-RestMethod','git push','git pull','git checkout','--hard','Remove-Item','-Publish')){
 Require (-not $source.Contains($forbidden)) ('Unwanted action in Git stage helper: '+$forbidden)
}
Require ($source.IndexOf('if(-not $Stage)') -lt $source.IndexOf('& $git.Source -c core.autocrlf=false clone')) 'Default no-network guard is too late.'
Require ($source.IndexOf('FIREQA already exists. Never overwrite') -lt $source.IndexOf('& $git.Source -c core.autocrlf=false clone')) 'Overwrite refusal must occur before clone.'
Require ($source.IndexOf('Require ($actual -ceq $ExpectedCommit') -gt $source.IndexOf('rev-parse HEAD')) 'Exact Git SHA verification must come after clone.'
$sha=('a'*40)
$existing=Test-Path -LiteralPath (Join-Path $env:USERPROFILE 'FIREQA')
Require (-not $existing) 'CI synthetic test requires a clean, nonexistent FIREQA directory; never interfere with an existing checkout.'
$out=(& $script -ExpectedCommit $sha 6>&1 2>&1 | Out-String)
Require ($out.Contains('DRY RUN ONLY. No network')) 'Default script did not report no-network dry run.'
Require ($out.Contains('STAGED=NO; DEPLOYED=NO; CLOUD_WRITES=NONE; CUSTOMER_RECORDS_READ=NONE')) 'Dry run must deny stage/deploy/customer reads.'
Require (-not (Test-Path -LiteralPath (Join-Path $env:USERPROFILE 'FIREQA'))) 'Dry run created a checkout.'
Write-Host 'PASS: Exact QA source staging only with explicit -Stage, pinned full SHA, no network or local files by default.'
