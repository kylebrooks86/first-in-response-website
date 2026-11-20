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
    foreach($issue in @($parseErrors)) {
      Write-Output ("PARSE STOP "+([IO.Path]::GetFileName($file))+
        " line "+$issue.Extent.StartLineNumber+
        " column "+$issue.Extent.StartColumnNumber+
        " reason "+$issue.Message)
    }
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
  $global:FIRE_MOCK_PROVIDER_METHODS+=@($Method)
  if ($Method -cne 'Get' -or $Uri -notlike 'https://api.cloudflare.com/client/v4/accounts/*/access/apps/*') {
    throw 'mock: forbidden method/host'
  }
  return [pscustomobject]@{success=$true;result=$global:FIRE_MOCK_FIXTURE}
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
  $global:FIRE_MOCK_PROVIDER_METHODS=@()
  $output=(& $preflight 6>&1 2>&1 | Out-String)
  if ($global:FIRE_MOCK_PROVIDER_METHODS.Count -ne 1 -or $global:FIRE_MOCK_PROVIDER_METHODS[0] -cne 'Get') {
    throw ('Unexpected mock provider methods: '+($global:FIRE_MOCK_PROVIDER_METHODS -join ',')+'; sanitized script output: '+$output)
  }
  if (-not $output.Contains($expected)) {
    throw "Expected sanitized output $expected, got $output"
  }
}
$global:FIRE_MOCK_FIXTURE=New-SyntheticFixture $false
Run-SyntheticCase 'READ_ONLY: EXACT_SEVEN'
$global:FIRE_MOCK_FIXTURE=New-SyntheticFixture $true
Run-SyntheticCase 'READ_ONLY: EXACT_EIGHT'
$global:FIRE_MOCK_FIXTURE=New-SyntheticFixture $true
$global:FIRE_MOCK_FIXTURE.destinations[0].overrides+=@([pscustomobject]@{
  behavior='public';path_pattern='/api/*'
})
Run-SyntheticCase 'STOP at exact public-path inventory'
$global:FIRE_MOCK_FIXTURE=New-SyntheticFixture $false
$global:FIRE_MOCK_FIXTURE.policies[0].decision='bypass'
Run-SyntheticCase 'STOP at pinned app/worker/policy identity'
Write-Output 'PASS: Gate9 Access PowerShell parsed; 7/8 exact-path fixture allowed, unsafe path/policy stopped; GET only, no provider network.'
