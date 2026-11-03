# FIRE Gate 9 — ONE read-only TEST Worker inventory receipt for the owner Acer.
# Never uploads/deploys, modifies Cloudflare, reads secret values or contacts Stripe.
# Run once after the prior attempted inactive upload to learn what the provider lists.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$worker='fire-stripe-test-20261101'
$previous='96e32262-fa33-4f04-a161-bee11f0353e2'
function Require([bool]$ok,[string]$message){if(-not $ok){throw ('STOP READ ONLY: '+$message)}}
function GetVersionEntries($data){
  if($data -is [array]){$entries=@($data)}
  elseif($null -ne $data -and @($data.PSObject.Properties.Name) -contains 'versions'){$entries=@($data.versions)}
  elseif($null -ne $data -and @($data.PSObject.Properties.Name) -contains 'result'){
    if($data.result -is [array]){$entries=@($data.result)}
    elseif($null -ne $data.result -and @($data.result.PSObject.Properties.Name) -contains 'versions'){$entries=@($data.result.versions)}
    else{throw 'STOP READ ONLY: Unsupported provider versions-list result shape'}
  } else {throw 'STOP READ ONLY: Unsupported provider versions-list shape'}
  Require ($entries.Count -gt 0 -and $entries.Count -le 100) 'Version-list response empty or unreasonably large'
  $ids=@()
  foreach($entry in $entries){
    Require ($null -ne $entry) 'Null version entry'
    $keys=@($entry.PSObject.Properties.Name)
    if($keys -contains 'id'){$id=[string]$entry.id}
    elseif($keys -contains 'version_id'){$id=[string]$entry.version_id}
    else{throw 'STOP READ ONLY: Missing version ID field'}
    Require ($id -match '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$') 'Invalid version ID'
    $ids+= $id.ToLowerInvariant()
  }
  Require (@($ids|Sort-Object -Unique).Count -eq $ids.Count) 'Duplicate recent version IDs'
  return @($ids)
}
function ReadJson([string[]]$argsToRun){
  $raw=(& $script:wrangler @argsToRun 2>$null | Out-String).Trim()
  Require ($LASTEXITCODE -eq 0) 'Wrangler read command failed; no retry or write authorized'
  Require ($raw.Length -gt 2) 'Empty Wrangler response'
  try{return ConvertFrom-Json -InputObject $raw -ErrorAction Stop}
  catch{throw 'STOP READ ONLY: Wrangler JSON format changed; raw output withheld'}
}
try{
  $wrangler=(Get-Command wrangler.cmd -ErrorAction Stop).Source
  Write-Host 'FIRE GATE 9 — PROVIDER INVENTORY, READ ONLY, TARGET TEST WORKER ONLY.'
  $deployment=ReadJson @('deployments','status','--name',$worker,'--json')
  $serving=@($deployment.versions)
  Require ($serving.Count -eq 1) 'Unrecognized multi-version serving deployment; STOP'
  $active=[string]$serving[0].version_id
  $traffic=[double]$serving[0].percentage
  Require ($active -match '^[a-fA-F0-9-]{36}$' -and $traffic -eq 100) 'No single 100% serving version; STOP'
  $versions=ReadJson @('versions','list','--name',$worker,'--json')
  $ids=@(GetVersionEntries $versions)
  $cliVersion=(& $wrangler --version 2>$null | Out-String).Trim()
  Require ($LASTEXITCODE -eq 0) 'Unable to inspect installed Wrangler version'
  # The following commands are purely local help output, no provider mutation.
  $help=(& $wrangler versions upload --help 2>$null | Out-String)
  Require ($LASTEXITCODE -eq 0) 'Unable to inspect inactive-upload CLI capabilities'
  $supported=$help.Contains('--strict') -and $help.Contains('--keep-vars') -and $help.Contains('--config')
  Write-Host 'READ_ONLY_PROVIDER_INVENTORY=PASS'
  Write-Host ('WORKER='+$worker)
  Write-Host ('ACTIVE_VERSION='+$active)
  Write-Host ('ACTIVE_TRAFFIC_PERCENT='+([int]$traffic))
  Write-Host ('PREVIOUS_KNOWN_VERSION_MATCH='+($active -ceq $previous).ToString().ToLowerInvariant())
  Write-Host ('RECENT_VERSION_COUNT='+$ids.Count)
  foreach($id in $ids){Write-Host ('RECENT_VERSION_ID='+$id)}
  Write-Host ('WRANGLER_CLI_VERSION='+($cliVersion -replace '[^\w.\s-]','').Trim())
  Write-Host ('GLOBAL_UPLOAD_REQUIRED_FLAGS_PRESENT='+$supported.ToString().ToLowerInvariant())
  Write-Host 'IMPORTANT: A recent version ID other than the active one DOES NOT establish it came from the declined upload.'
  Write-Host 'NO PROVIDER WRITES. NO UPLOAD AUTHORIZATION. NO SAFE-TO-RETRY CONCLUSION.'
}catch{
  # Only print our own fixed/predictable error, not raw provider JSON or bearer headers.
  Write-Host ('BLOCKED: '+$_.Exception.Message) -ForegroundColor Yellow
  Write-Host 'No remote write; do not retry an uploader based on this result.' -ForegroundColor Yellow
  exit 1
}
