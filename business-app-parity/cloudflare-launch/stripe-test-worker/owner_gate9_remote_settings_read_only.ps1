# FIRE Gate 9 remote settings receipt. READ ONLY. No hosted or local secret writes.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$worker='fire-stripe-test-20261101'
$expectedVersion='96e32262-fa33-4f04-a161-bee11f0353e2'
$expectedDb='dba421ba-fc66-4cf8-9c31-51616f8249ba'
$expectedSecrets=@('FIRE_ACCESS_AUD','FIRE_ACCESS_OWNER_EMAIL','FIRE_ACCESS_TEAM_DOMAIN','STRIPE_WEBHOOK_SECRET')
function Need([bool]$good,[string]$reason){if(-not $good){throw ('STOP READ ONLY: '+$reason)}}
function WranglerJson([string[]]$argv){
  $raw=(& $script:wrangler @argv 2>$null | Out-String).Trim()
  Need ($LASTEXITCODE -eq 0) 'Authenticated Wrangler metadata read failed'
  Need ($raw.Length -gt 2) 'Wrangler returned empty JSON'
  try{return ConvertFrom-Json -InputObject $raw -ErrorAction Stop}
  catch{throw 'STOP READ ONLY: Cannot parse Wrangler JSON; raw data withheld'}
}
function Parse-PrettySecretNames([string]$raw){
  # Actual observed Wrangler 4.151.0 output: "Secret Name: NAME" per entry.
  # DO NOT print raw text; it is treated as untrusted provider output.
  $lines=@($raw -split '\r?\n'|Where-Object {$_ -match '^\s*Secret Name:'})
  $names=@()
  foreach($line in $lines){
    if($line -notmatch '^\s*Secret Name:\s*([A-Z][A-Z0-9_]*)\s*$'){
      throw 'STOP READ ONLY: Unrecognized Wrangler pretty-format secret entry'
    }
    $names+= $Matches[1]
  }
  Need ($names.Count -gt 0) 'No Wrangler pretty-format secret names recognized'
  Need ((@($names|Sort-Object -Unique)).Count -eq $names.Count) 'Duplicate secret names encountered'
  return @($names|Sort-Object)
}
function PrettySecretNames(){
  $raw=(& $script:wrangler secret list --name $script:worker --format pretty 2>$null | Out-String)
  Need ($LASTEXITCODE -eq 0) 'Wrangler secret list read failed'
  return @(Parse-PrettySecretNames $raw)
}
function Field($obj,[string]$key){
  if($null -eq $obj){return $null}
  if(@($obj.PSObject.Properties.Name) -contains $key){return $obj.$key}
  return $null
}
function Flag($v){if($v -is [bool]){return $v.ToString().ToLowerInvariant()};return 'not_exposed'}
function GetCloudflare([string]$account,[string]$suffix){
  Need ($account -match '^[a-f0-9]{32}$') 'Malformed account identifier'
  Need ($suffix -in @('settings','script-settings')) 'Unapproved Cloudflare API endpoint'
  $uri="https://api.cloudflare.com/client/v4/accounts/$account/workers/scripts/$script:worker/$suffix"
  return Invoke-RestMethod -Method Get -Uri $uri -Headers $script:authorization -TimeoutSec 25 -MaximumRedirection 0 -ErrorAction Stop
}
try {
  $wrangler=(Get-Command wrangler.cmd -ErrorAction Stop).Source
  Write-Host 'Gate 9: read-only verification of exact existing TEST Worker.'
  $status=WranglerJson @('deployments','status','--name',$worker,'--json')
  $serving=@($status.versions)
  Need ($serving.Count -eq 1) 'TEST Worker does not have exactly one serving version'
  $id=[string]$serving[0].version_id
  Need ($id -ceq $expectedVersion -and [double]$serving[0].percentage -eq 100) 'Serving version drifted from accepted predecessor'
  $ver=WranglerJson @('versions','view',$id,'--name',$worker,'--json')
  Need ([string]$ver.id -ceq $id -and $null -ne $ver.resources.bindings) 'Cannot establish immutable Worker binding details'
  $b=@($ver.resources.bindings)
  $d1=@($b|Where-Object {$null -ne $_ -and $_.type -ceq 'd1'})
  Need ($d1.Count -eq 1 -and [string]$d1[0].name -ceq 'DB' -and [string]$d1[0].id -ceq $expectedDb) 'Wrong physical TEST D1 UUID'
  Need (@($b|Where-Object {$null -ne $_ -and $_.type -in @('r2','r2_bucket')}).Count -eq 0) 'Unexpected R2 bound'
  $mode=@($b|Where-Object {$null -ne $_ -and $_.name -ceq 'FIRE_STRIPE_MODE'})
  Need ($mode.Count -eq 1 -and $mode[0].type -ceq 'plain_text' -and $mode[0].text -ceq 'disabled') 'Stripe disabled binding not verified'
  $names=@(PrettySecretNames)
  Need ($names.Count -eq 4 -and ($names -join ',') -ceq (@($expectedSecrets|Sort-Object) -join ',')) 'Encrypted secret name inventory differs from four-name allowlist'
  Write-Host 'PASS: Existing TEST version 100%, exact D1, four encrypted secrets, Stripe disabled, no R2.'

  $who=WranglerJson @('whoami','--json')
  $accounts=@(Field $who 'accounts')
  Need ($accounts.Count -ge 1 -and $accounts.Count -le 25) 'No usable Wrangler account list'
  $auth=WranglerJson @('auth','token','--json')
  Need ($auth.type -in @('oauth','api_token')) 'Existing Wrangler authentication is not bearer-type'
  Need ($auth.token -is [string] -and $auth.token.Length -gt 15) 'Existing Wrangler bearer credential unavailable'
  $authorization=@{Authorization=('Bearer '+$auth.token)}
  $auth=$null
  $found=@()
  foreach($a in $accounts){
    if($null -eq $a -or [string]$a.id -notmatch '^[a-f0-9]{32}$'){continue}
    try{
      $reply=GetCloudflare ([string]$a.id) 'settings'
      if($reply.success -eq $true -and $null -ne $reply.result){
        $found+=@([pscustomobject]@{accountId=[string]$a.id;accountName=[string]$a.name;configuration=$reply.result})
      }
    }catch{
      # Different account or insufficient permission. Never print raw HTTP errors.
    }
  }
  Need ($found.Count -eq 1) 'Exactly one matching TEST Worker could not be read through Cloudflare GET'
  $target=$found[0]
  try{$sr=GetCloudflare $target.accountId 'script-settings'}
  catch{throw 'STOP READ ONLY: Cloudflare script-level settings GET unavailable'}
  Need ($sr.success -eq $true -and $null -ne $sr.result) 'Script-level GET did not return trustworthy metadata'

  # Never print raw config: it can include plaintext vars and metadata.
  $remote=$target.configuration
  $scriptObs=Field $sr.result 'observability'
  $versionObs=Field $remote 'observability'
  $scriptLogs=Field $scriptObs 'logs'
  $versionLogs=Field $versionObs 'logs'
  $assets=Field $remote 'assets'
  $assetFields=if($null -ne $assets){@($assets.PSObject.Properties.Name|Sort-Object)}else{@()}
  $types=@((@(Field $remote 'bindings')|Where-Object {$null -ne $_}|ForEach-Object {[string]$_.type}|Sort-Object))
  Write-Host 'PASS: Cloudflare read-only GET confirmed existing Worker metadata.'
  Write-Host ('CLOUDFLARE_ACCOUNT: '+$target.accountName)
  Write-Host ('SERVING_VERSION: '+$id+' (100%)')
  Write-Host ('TEST_DB_UUID: '+$expectedDb)
  Write-Host ('FOUR_SECRET_NAMES: '+($names -join ', '))
  Write-Host ('SCRIPT_OBSERVABILITY_ENABLED: '+(Flag (Field $scriptObs 'enabled')))
  Write-Host ('SCRIPT_LOGS_ENABLED: '+(Flag (Field $scriptLogs 'enabled')))
  Write-Host ('SCRIPT_LOGS_INVOCATIONS: '+(Flag (Field $scriptLogs 'invocation_logs')))
  Write-Host ('SCRIPT_REDACT_QUERY_STRING: '+(Flag (Field $scriptObs 'redact_query_string')))
  Write-Host ('VERSION_OBSERVABILITY_ENABLED: '+(Flag (Field $versionObs 'enabled')))
  Write-Host ('VERSION_LOGS_ENABLED: '+(Flag (Field $versionLogs 'enabled')))
  Write-Host ('VERSION_REDACT_QUERY_STRING: '+(Flag (Field $versionObs 'redact_query_string')))
  Write-Host ('VERSION_ASSETS_PRESENT: '+($null -ne $assets))
  Write-Host ('VERSION_ASSET_FIELD_NAMES: '+($assetFields -join ', '))
  Write-Host ('VERSION_BINDING_TYPES: '+($types -join ', '))
  Write-Host 'REMOTE_CONFIG_READ_COMPLETE=TRUE; REMOTE_WRITES=ZERO; STRIPE_DISABLED=TRUE.'
}catch{
  Write-Host ('BLOCKED: '+$_.Exception.Message) -ForegroundColor Yellow
  Write-Host 'No hosted writes. No retry or deployment. Send this sanitized result only.' -ForegroundColor Yellow
  exit 1
}finally{
  $authorization=$null
  $auth=$null
}
