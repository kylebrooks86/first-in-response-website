# Validate independently fetched read-only Cloudflare D1 INFO responses.
# This is a strict alternative to an unavailable d1 list endpoint, NOT a bypass.
# Never runs Wrangler, opens credentials, writes data, or emits provider JSON.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$QaJson,
  [Parameter(Mandatory=$true)][string]$StagingJson
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$qaName = 'fire-fullapp-qa-db-20261016'
$qaUuid = '8ccfb1f8-1657-4074-b1b2-47de78f95003'
$stagingName = 'fire-app-staging-db'
$stagingUuid = 'afb2c05a-d794-4a9a-b580-924ce01c26ad'

function Stop-Identity([string]$reason) { throw ('FIRE QA INDIVIDUAL D1 INFO STOP: ' + $reason) }
function Parse-Info([string]$json, [string]$label) {
  if ([string]::IsNullOrWhiteSpace($json) -or -not $json.TrimStart().StartsWith('{')) {
    Stop-Identity ($label + ' info is missing or not a single JSON object')
  }
  try { $parsed = ConvertFrom-Json -InputObject $json -ErrorAction Stop }
  catch { Stop-Identity ($label + ' info is not valid JSON') }
  if ($null -eq $parsed -or $parsed -is [array] -or $parsed -isnot [pscustomobject]) {
    Stop-Identity ($label + ' info is not a single database object')
  }
  $keys = @($parsed.PSObject.Properties.Name)
  if ($keys -notcontains 'name' -or $keys -notcontains 'uuid' -or
      $parsed.name -isnot [string] -or $parsed.uuid -isnot [string]) {
    Stop-Identity ($label + ' info lacks string name and UUID')
  }
  return $parsed
}
$qa = Parse-Info -json $QaJson -label 'QA'
$stage = Parse-Info -json $StagingJson -label 'protected staging'
if ($qa.name -cne $qaName -or $qa.uuid -cne $qaUuid) {
  Stop-Identity 'QA info name/UUID differs from the pinned physical QA database'
}
if ($stage.name -cne $stagingName -or $stage.uuid -cne $stagingUuid) {
  Stop-Identity 'Protected staging info name/UUID differs from its pinned physical database'
}
if ($qa.uuid -ceq $stage.uuid -or $qa.name -ceq $stage.name) {
  Stop-Identity 'QA/staging physical database identity collision'
}
[pscustomobject]@{
  qaName = $qaName
  qaUuid = $qaUuid
  stagingName = $stagingName
  stagingUuid = $stagingUuid
  evidence = 'independently-queried-d1-info'
}