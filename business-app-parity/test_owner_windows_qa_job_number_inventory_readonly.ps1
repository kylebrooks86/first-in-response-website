# Offline contract: do NOT invoke hosted QA inventory or read any private data.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot 'owner_windows_qa_job_number_inventory_readonly.ps1'
function Require([bool]$okay,[string]$reason){
 if(-not $okay){throw ('FIRE JOB # QA INVENTORY TEST STOP: '+$reason)}
}
Require (Test-Path -LiteralPath $source -PathType Leaf) 'Reviewed source missing.'
$s=Get-Content -LiteralPath $source -Raw
foreach($needle in @(
 '[switch]$Inspect',
 'if(-not $Inspect)',
 'e3028e6f-00b4-4717-8bd3-df558d15a37d',
 '89ae853c-f4bb-4159-8df1-9c18a50008e1',
 '8ccfb1f8-1657-4074-b1b2-47de78f95003',
 'owner_windows_qa_release_preflight.ps1',
 'verify_qa_worker_version_bindings.ps1',
 'ProviderJson',
 'CheckTraffic',
 'versions',
 'view',
 'd1',
 'info',
 'sqlite_master',
 "'fire_job_numbers','fire_job_estimate_links','fire_customer_numbers'",
 'number_tables -eq 0',
 'REMOTE_WRITES=NONE; NUMBERS_ACTIVATED=NO; CUSTOMER_ROWS_PRINTED=NO; DEPLOYED=NO'
)){
 Require ($s.Contains($needle)) ('Missing read-only identity or denial: '+$needle)
}
$guard=$s.IndexOf('if(-not $Inspect)')
$firstProvider=$s.IndexOf("Get-Command 'wrangler.cmd'")
$firstFile=$s.IndexOf('Get-Content -LiteralPath $config')
Require ($guard -ge 0 -and $firstProvider -gt $guard -and $firstFile -gt $guard) 'Dry-run must not open private files or provider.'
foreach($forbidden in @(
 'd1 migrations apply','d1 export','wrangler.cmd deploy',
 'Set-Content','Out-File','Copy-Item','Move-Item','Remove-Item',
 'Invoke-WebRequest','Invoke-RestMethod','-Publish','-Apply','--output='
)){
 Require (-not $s.Contains($forbidden)) ('Unexpected mutation path: '+$forbidden)
}
$out=(& $source 6>&1 2>&1 | Out-String)
Require ($out.Contains('DRY RUN: no Cloudflare calls')) 'Dry run must skip provider.'
Require ($out.Contains('REMOTE_READS=NONE; REMOTE_WRITES=NONE; NUMBERS_ACTIVATED=NO')) 'Dry run must not read or write QA resources.'
Write-Host 'PASS: QA Job # inventory is default no-provider and strictly gated to aggregate-only approved QA identifiers.'
