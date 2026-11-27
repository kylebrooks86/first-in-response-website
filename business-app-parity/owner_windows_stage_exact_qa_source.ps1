# Stage a SEPARATE exact-commit Git checkout for the existing FIRE QA app.
# DRY RUN by default. No Cloudflare, data export, deployment or migration.
# This avoids using a downloaded ZIP (which lacks .git) for strict QA release
# review. No existing local checkout, photos, backup, or secrets are touched.
[CmdletBinding()]
param(
  [switch]$Stage,
  [Parameter(Mandatory=$true)][string]$ExpectedCommit,
  [string]$CandidateBranch = 'work/fire-permanent-customer-numbers-history-2026-10-31'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoUrl = 'https://github.com/kylebrooks86/first-in-response-website.git'
$branch = $CandidateBranch
$destination = Join-Path $env:USERPROFILE 'FIREQA'
function Require([bool]$condition,[string]$reason){
  if(-not $condition){throw ('FIRE QA SOURCE STAGE STOP: '+$reason)}
}
function Check-Git([string]$stage){
  Require ($LASTEXITCODE -eq 0) ($stage+' failed. Preserve current files; do not overwrite or reset.')
}
Require ($env:OS -eq 'Windows_NT' -and
  -not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) 'Use the owner Acer Windows profile.'
Require ($ExpectedCommit -cmatch '^[0-9a-f]{40}$') 'An exact reviewed lowercase 40-character SHA is required.'
Require ($branch -cmatch '^work/fire-[a-z0-9][a-z0-9-]{1,110}$') 'Only a specifically named FIRE work branch can be staged.'
Require (-not (Test-Path -LiteralPath $destination)) 'FIREQA already exists. Never overwrite or delete a working checkout.'
$git = Get-Command 'git.exe' -ErrorAction SilentlyContinue
Require ($null -ne $git) 'Git for Windows is required; no installer is downloaded or run.'
Require (-not ((Get-Item -LiteralPath $env:USERPROFILE).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'Linked owner profile directory refused.'
Write-Host 'FIRE QA Git source stage — existing Business App only.'
Write-Host ('EXACT_REQUIRED_SHA='+$ExpectedCommit)
Write-Host ('BRANCH='+$branch)
Write-Host ('SEPARATE_LOCAL_DESTINATION='+$destination)
Write-Host 'Existing Downloads ZIP, F folder, protected backups, customer photos and vault are preserved.'
if(-not $Stage){
  Write-Host 'DRY RUN ONLY. No network, checkout, file creation, worker update or D1 access.'
  Write-Host 'STAGED=NO; DEPLOYED=NO; CLOUD_WRITES=NONE; CUSTOMER_RECORDS_READ=NONE'
  return
}
Write-Host 'Owner-directed local Git clone only. Does NOT start a build or QA deployment.'
# Keep text migrations byte-identical; do not alter user's global git config.
& $git.Source -c core.autocrlf=false clone --depth 1 --single-branch --branch $branch $repoUrl $destination
Check-Git 'Git clone'
Require (Test-Path -LiteralPath (Join-Path $destination '.git') -PathType Container) 'Missing authenticated Git checkout metadata.'
& $git.Source -C $destination config --local core.autocrlf false
Check-Git 'Local Git line-ending config'
$actual=(& $git.Source -C $destination rev-parse HEAD).Trim()
Check-Git 'Actual Git source'
$remote=(& $git.Source -C $destination rev-parse ('refs/remotes/origin/'+$branch)).Trim()
Check-Git 'Fetched remote source'
$actualBranch=(& $git.Source -C $destination branch --show-current).Trim()
Check-Git 'Local branch'
$origin=(& $git.Source -C $destination remote get-url origin).Trim()
Check-Git 'Clone origin'
$dirty=@(& $git.Source -C $destination status --porcelain --untracked-files=no)
Check-Git 'Tracked source cleanliness'
Require ($actual -ceq $ExpectedCommit -and $remote -ceq $ExpectedCommit) 'Remote branch changed or exact expected source not available. Stop. Do not deploy this checkout.'
Require ($actualBranch -ceq $branch) 'Local branch differs from exact FIRE QA candidate.'
Require ($origin -ceq $repoUrl) 'Remote Git repository differs from reviewed FIRE source.'
Require ($dirty.Count -eq 0) 'Unexpected local changes: source checkout is not accepted.'
Require (Test-Path -LiteralPath (Join-Path $destination 'business-app-parity\owner_windows_build_qa_candidate.ps1') -PathType Leaf) 'FIRE QA builder missing from checked source.'
Write-Host 'PASS: Separate local FIRE QA branch and exact Git source match, with no tracked edits.'
Write-Host ('CHECKOUT_DIR='+$destination)
Write-Host ('EXACT_SHA='+$actual)
Write-Host 'STAGED=YES; BUILT=NO; DEPLOYED=NO; CLOUD_WRITES=NONE; CUSTOMER_RECORDS_READ=NONE'
Write-Host 'Only after later source review may the existing local QA builder be run. This is not authorization to publish.'
