# In-memory TEST Worker Access fixtures: never touch the real Cloudflare network.
$ErrorActionPreference='Stop'
$preflight=Join-Path $PSScriptRoot 'owner_gate9_access_readonly_preflight.ps1'
$mutator=Join-Path $PSScriptRoot 'owner_add_exact_gate9_webhook_access_override.ps1'
foreach($file in @($preflight,$mutator)) {
  $tokens=$null; $parseErrors=$null
  [System.Management.Automation.Language.Parser]::ParseFile(
    $file,[ref]$tokens,[ref]$parseErrors
  ) | Out-Null
  if (@($parseErrors).Count -ne 0) {
    throw "STOP: PowerShell parser rejected one of the Gate9 Access scripts"
  }
}

function Read-Host {
  param([string]$Prompt,[switch]$AsSecureString)
  if (-not $AsSecureString) {throw 'unexpected interactive prompt'}
  return (ConvertTo-SecureString 'synthetic-temporary-read-token' -AsPlainText -Force)
}
function Invoke-RestMethod {
  param([string]$Method,[string]$Uri,[hashtable]$Headers,[int]$TimeoutSec)
  $script:providerMethods+=@($Method)
  if ($Method -cne 'Get' -or $Uri -notlike 'https://api.cloudflare.com/client/v4/accounts/*/access/apps/*') {
    throw 'mock: forbidden method/host'
  }
  return [pscustomobject]@{success=$true;result=$script:Fixture}
}
function New-SyntheticFixture([bool]$withWebhook) {
  $paths=@('/estimate/*','/invoice/*','/pay/*','/_next/static/*',
           '/assets/*','/fire-app-logo.png','/favicon.ico')
  if($withWebhook) {$paths+=@('/api/payments/webhook')}
  $overrides=@($paths | ForEach-Object {
    [pscustomobject]@{behavior='public';path_pattern=$_}
  })
  return [pscustomobject]@{
    id='09dbb414-997f-494f-85a5-a3a65a5a92ef'
    name='fire-stripe-test-20261101 - Cloudflare Workers'
    type='self_hosted'
    destinations=@([pscustomobject]@{
      type='worker'
      worker_id='72f9cab371974bc8811da05f44976fa9'
      overrides=$overrides
    })
    policies=@([pscustomobject]@{
      id='synthetic-allow-policy'
      reusable=$true
      decision='allow'
      include=@([pscustomobject]@{email=@('synthetic-owner@example.invalid')})
      exclude=@()
      require=@()
    })
  }
}
function Run-SyntheticCase([string]$expected) {
  $script:providerMethods=@()
  $output=(& $preflight 6>&1 2>&1 | Out-String)
  if ($script:providerMethods.Count -ne 1 -or $script:providerMethods[0] -cne 'Get') {
    throw 'Read-only script made an unexpected provider request'
  }
  if (-not $output.Contains($expected)) {
    throw "Expected sanitized output $expected, got $output"
  }
}
$script:Fixture=New-SyntheticFixture $false
Run-SyntheticCase 'READ_ONLY: EXACT_SEVEN'
$script:Fixture=New-SyntheticFixture $true
Run-SyntheticCase 'READ_ONLY: EXACT_EIGHT'
$script:Fixture=New-SyntheticFixture $true
$script:Fixture.destinations[0].overrides+=@([pscustomobject]@{
  behavior='public';path_pattern='/api/*'
})
Run-SyntheticCase 'STOP at exact public-path inventory'
$script:Fixture=New-SyntheticFixture $false
$script:Fixture.policies[0].decision='bypass'
Run-SyntheticCase 'STOP at pinned app/worker/policy identity'
Write-Output 'PASS: Gate9 Access PowerShell parsed; 7/8 exact-path fixture allowed, unsafe path/policy stopped; GET only, no provider network.'
