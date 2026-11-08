# FIRE permanent Job # inventory: owner Windows, READ-ONLY, no migrations.
# Default dry run makes NO provider or private-file access.
# Opt-in -Inspect reads only pinned QA Worker/D1 metadata and aggregate counts.
[CmdletBinding()]
param([switch]$Inspect)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$worker='fire-fullapp-qa-20261016'
$database='fire-fullapp-qa-db-20261016'
$qaUuid='8ccfb1f8-1657-4074-b1b2-47de78f95003'
$active='e3028e6f-00b4-4717-8bd3-df558d15a37d'
$rollback='89ae853c-f4bb-4159-8df1-9c18a50008e1'
$config=Join-Path $PSScriptRoot 'wrangler.qa-migrations.json'
$review=Join-Path $PSScriptRoot 'owner_windows_qa_release_preflight.ps1'
$validator=Join-Path $PSScriptRoot 'verify_qa_worker_version_bindings.ps1'
function Require([bool]$okay,[string]$why){
 if(-not $okay){throw ('FIRE JOB # QA HOLD: '+$why)}
}
Write-Host 'FIRE permanent Job # — QA activation readiness; no changes authorized.'
if(-not $Inspect){
 Write-Host 'DRY RUN: no Cloudflare calls, owner backup or private file reads.'
 Write-Host 'REMOTE_READS=NONE; REMOTE_WRITES=NONE; NUMBERS_ACTIVATED=NO'
 return
}
Require ($env:OS -eq 'Windows_NT') 'Only original owner Windows account.'
foreach($file in @($config,$review,$validator)){
 Require (Test-Path -LiteralPath $file -PathType Leaf) 'Reviewed QA source missing.'
 Require (-not ((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'Linked source refused.'
}
$cfg=Get-Content -LiteralPath $config -Raw | ConvertFrom-Json
Require ($cfg.name -ceq $worker -and @($cfg.d1_databases).Count -eq 1) 'Unexpected QA config.'
Require ($cfg.d1_databases[0].binding -ceq 'DB' -and
 $cfg.d1_databases[0].database_name -ceq $database -and
 $cfg.d1_databases[0].database_id -ceq $qaUuid) 'Unexpected physical QA DB.'
$wrangler=Get-Command 'wrangler.cmd' -ErrorAction SilentlyContinue
Require ($null -ne $wrangler) 'Authenticated Wrangler missing; never switch account.'
# Existing, separately reviewed full QA preflight rechecks protected staging
# separation, full ordered 25 D1 journal and mandatory schema/indices.
$preflightOutput=@(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $review 2>$null)
Require ($LASTEXITCODE -eq 0 -and
 ($preflightOutput -join [Environment]::NewLine).Contains(
 'PASS: Full QA D1 has exactly 25 ordered migrations')) 'Pinned 25-schema QA preflight failed.'
function ProviderJson {
 param([string[]]$CommandArgs,[string]$Step)
 $before=$ErrorActionPreference
 try {
  $ErrorActionPreference='Continue'
  $raw=@(& $wrangler.Source @CommandArgs 2>$null)
  $code=$LASTEXITCODE
 } finally {$ErrorActionPreference=$before}
 Require ($code -eq 0 -and $raw.Count -gt 0) ($Step+' unavailable.')
 try {return ConvertFrom-Json -InputObject ($raw -join [Environment]::NewLine)}
 catch {throw ('FIRE JOB # QA HOLD: '+$Step+' invalid JSON.')}
}
function CheckTraffic {
 $response=ProviderJson -CommandArgs @('deployments','status','--name',$worker,'--json') -Step 'QA Worker traffic'
 $list=@($response.versions)
 Require ($list.Count -eq 1 -and $null -ne $list[0] -and
  [string]$list[0].version_id -ceq $active -and
  [double]$list[0].percentage -eq 100) 'Expected single 100-percent Worker changed.'
}
CheckTraffic
foreach($version in @($active,$rollback)){
 $detail=ProviderJson -CommandArgs @('versions','view',$version,'--name',$worker,'--json') -Step 'Worker version bindings'
 $check=& $validator -Json ($detail | ConvertTo-Json -Compress -Depth 40) -ExpectedVersion $version -ExpectedDatabaseId $qaUuid
 Require ($check.bindingVerified -eq $true -and $check.remoteWrites -eq $false) 'Worker or rollback DB/no-R2 verification failed.'
}
$info=ProviderJson -CommandArgs @('d1','info',$database,'--json') -Step 'Physical QA D1 identity'
Require ([string]$info.name -ceq $database -and [string]$info.uuid -ceq $qaUuid) 'Physical D1 changed.'
# Aggregate-only SELECT: no identities, names, signed text, money, tokens or photo bytes.
$sql="SELECT (SELECT COUNT(*) FROM customers) AS customers, " +
 "(SELECT COUNT(*) FROM estimates) AS estimates, " +
 "(SELECT COUNT(*) FROM invoices) AS invoices, " +
 "(SELECT COUNT(*) FROM payments) AS payments, " +
 "(SELECT COUNT(*) FROM customer_photos) AS photo_records, " +
 "(SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('fire_job_numbers','fire_job_estimate_links','fire_customer_numbers')) AS number_tables"
$results=@(ProviderJson -CommandArgs @('d1','execute',$database,'--remote',
 ('--config='+$config),('--command='+$sql),'--json') -Step 'QA aggregate inventory')
Require ($results.Count -eq 1 -and $results[0].success -eq $true -and
 @($results[0].results).Count -eq 1) 'Ambiguous QA count query.'
$row=@($results[0].results)[0]
foreach($field in @('customers','estimates','invoices','payments','photo_records','number_tables')){
 $value=$row.$field
 Require ($null -ne $value -and [string]$value -cmatch '^[0-9]{1,7}$' -and
  [double]$value -le 1000000) 'Unexpected/unbounded QA count.'
}
Require ([int]$row.number_tables -eq 0) 'Permanent numbering schema already exists; stop for independent reconciliation.'
CheckTraffic
Write-Host 'PASS: Current QA and rollback Worker bindings match isolated D1; no R2.'
Write-Host 'PASS: Full 25-migration QA journal and protected staging identity verified.'
Write-Host ('QA_CUSTOMERS='+$row.customers+'; QA_ESTIMATES='+$row.estimates+
 '; QA_INVOICES='+$row.invoices+'; QA_PAYMENTS='+$row.payments+
 '; QA_PHOTO_RECORDS='+$row.photo_records+'; NUMBER_TABLES='+$row.number_tables)
Write-Host 'PASS: Aggregate-only readiness inspection completed; Job # is still OFF.'
Write-Host 'REMOTE_WRITES=NONE; NUMBERS_ACTIVATED=NO; CUSTOMER_ROWS_PRINTED=NO; DEPLOYED=NO'
Write-Host 'LIMIT: This is not a current private v2 recovery proof or authorization to migrate.'
