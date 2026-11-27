# Run ONLY in GitHub Windows CI using a temporary mock npx.cmd.
# No real Cloudflare, credential, route, payment, D1 or deployment interaction.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$script=Join-Path $PSScriptRoot 'owner_dr_dark_postcreate_readonly.ps1'
if($env:CI -ne 'true') { throw 'FIRE DR mock test must run only in CI' }
$source=[IO.File]::ReadAllText($script)
foreach($required in @(
  'FIRE_DR_AUTH_ENABLED',
  'FIRE_PHOTO_STORAGE_MODE',
  'b7c42773-5a93-4c6c-91d2-83cdb8e857d9',
  '5e55c5b7-cd67-4c8f-a52e-40f71b5d3145',
  'OFFLINE_MOCK_ONLY_NO_PROVIDER'
)) {
  if(-not $source.Contains($required)) { throw ('required source lock missing: '+$required) }
}
if($source.Contains('wrangler@4.162.0'+"' deploy") -or
   $source.Contains("'d1','execute'") -or
   $source.Contains("'versions','upload'")) {
  throw 'FIRE DR postcreate checker contains forbidden provider write command'
}
$folder=Join-Path $env:TEMP ('fire-dr-dark-readonly-mock-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $folder | Out-Null
$good=Join-Path $folder 'npx-good.cmd'
$badVersion=Join-Path $folder 'npx-version.cmd'
$badAuth=Join-Path $folder 'npx-auth.cmd'
$badDb=Join-Path $folder 'npx-db.cmd'
$version='b7c42773-5a93-4c6c-91d2-83cdb8e857d9'
$dbId='5e55c5b7-cd67-4c8f-a52e-40f71b5d3145'
$mock=@'
@echo off
if not "%~1"=="--yes" exit /b 70
if not "%~2"=="wrangler@4.162.0" exit /b 71
if /I "%~3"=="deployments" (
  echo {"versions":[{"version_id":"b7c42773-5a93-4c6c-91d2-83cdb8e857d9","percentage":100}]}
  exit /b 0
)
if /I "%~3"=="versions" (
  echo {"id":"b7c42773-5a93-4c6c-91d2-83cdb8e857d9","bindings":[{"name":"DB","type":"d1_database","id":"5e55c5b7-cd67-4c8f-a52e-40f71b5d3145"},{"name":"FIRE_ENV","type":"plain_text","text":"isolated-dr"},{"name":"FIRE_DR_AUTH_ENABLED","type":"plain_text","text":"blocked"},{"name":"FIRE_PHOTO_STORAGE_MODE","type":"plain_text","text":"owner-device-zip"},{"name":"SITE_ORIGIN","type":"plain_text","text":"https://fire-fullapp-dr.kyle-bfc.workers.dev"}]}
  exit /b 0
)
if /I "%~3"=="d1" (
  echo [{"name":"fire-fullapp-dr-db","uuid":"5e55c5b7-cd67-4c8f-a52e-40f71b5d3145"}]
  exit /b 0
)
exit /b 72
'@
$utf8=New-Object System.Text.UTF8Encoding($false)
function Save-Fake([string]$path,[string]$bytes){
  [IO.File]::WriteAllText($path,$bytes,$utf8)
}
function Expected-Refusal([string]$mockPath){
  $threw=$false
  try {
    $output=& $script -Capture -MockNpxCommand $mockPath 2>&1 | Out-String
  } catch {
    $threw=$true
    if($_.Exception.Message -notmatch 'FIRE DR READ-ONLY STOP') {
      throw ('Unrecognized fail-closed error: '+$_.Exception.GetType().FullName)
    }
  }
  if(-not $threw) { throw 'Tampered provider response unexpectedly accepted' }
}
try {
  Save-Fake $good $mock
  $result=& $script -Capture -MockNpxCommand $good | Out-String | ConvertFrom-Json
  if($result.result -cne 'OFFLINE_MOCK_ONLY_NO_PROVIDER' -or
     $result.ownerObservedVersionIdMatched -cne $version -or
     $result.actualHostedD1UuidMatched -cne $dbId -or
     $result.ownerAuthBlockedInVersion -ne $true -or
     $result.publicRoutesProviderVerified -ne $false -or
     $result.gate4Accepted -ne $false -or
     $result.releaseGatesAccepted -ne 4) {
    throw 'Valid offline mock failed to return sanitized, non-gate-closing result'
  }
  Save-Fake $badVersion ($mock.Replace($version,'00000000-0000-4000-8000-000000000000'))
  Expected-Refusal $badVersion
  Save-Fake $badAuth ($mock.Replace('"text":"blocked"','"text":"owner-approved"'))
  Expected-Refusal $badAuth
  Save-Fake $badDb ($mock.Replace($dbId,'11111111-1111-4111-8111-111111111111'))
  Expected-Refusal $badDb
  $default=& $script 6>&1 | Out-String
  if($default -notmatch 'No provider requests') {
    throw 'Default mode is not offline-only'
  }
  Write-Host 'PASS FIRE DR on Windows: offline fake npx.cmd, 3 read-only commands, current version, D1 UUID, dark login, all 3 tamper refusals, no provider calls.'
} finally {
  Remove-Item -LiteralPath $folder -Recurse -Force -ErrorAction SilentlyContinue
}
