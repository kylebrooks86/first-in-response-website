# READ-ONLY reconciliation of the ONE consumed STAGING inactive-version attempt.
# This file cannot upload, create, activate, deploy, rotate a credential or modify D1.
# Use only with the previously authenticated local Wrangler cache; NO login, NO retries.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$CandidateDirectory)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$account='bfc00939cfb2f8dfd8581a7a7f5f1307'
$worker='fire-app-independent-staging'
$db='afb2c05a-d794-4a9a-b580-924ce01c26ad'
$oldDeployment='10215e59-2ff0-485c-92f6-11d7f0405060'
$oldVersion='7838d0ea-be89-49c6-9984-d3b021082d72'
$cutoff=[datetimeoffset]'2026-11-22T23:00:00Z'
$base='https://api.cloudflare.com/client/v4/accounts/'+$account+'/workers/scripts/'+$worker
$lock=Join-Path $env:LOCALAPPDATA 'FIRE-STAGING-Private\g404-one-inactive-version-attempt-20261122.lock'
$priorAccount=$env:CLOUDFLARE_ACCOUNT_ID
$priorToken=$env:CLOUDFLARE_API_TOKEN
$priorEnv=$env:CLOUDFLARE_ENV
$priorOffline=$env:npm_config_offline
$priorYes=$env:npm_config_yes
$priorMetrics=$env:WRANGLER_SEND_METRICS
$priorCfFetch=$env:CLOUDFLARE_CF_FETCH_ENABLED
$entered=$false; $token=$null; $authJson=$null; $authRecord=$null
$stage='LOCAL_PREREQUISITES'
$script:reason='UNCLASSIFIED'
function Need([bool]$pass,[string]$code='VALIDATION_FAILED') {
  if(-not $pass) {$script:reason=$code; throw 'Read-only evidence incomplete'}
}
function GetOnly([string]$suffix) {
  Need ($suffix -match '^/(deployments\?page=1&per_page=1|versions\?page=[1-3]&per_page=100|versions/[0-9a-f-]{36})$') 'UNEXPECTED_GET_PATH'
  # Exactly GET; never print raw response, HTTP exceptions or headers.
  try {
    $response=Invoke-RestMethod -Method Get -Uri ($base+$suffix) -Headers @{Authorization=('Bearer '+$token)} -TimeoutSec 25
  } catch {
    # Report ONLY an HTTP status category, not token, body, response headers or exception text.
    $httpCode=0
    if($null -ne $_.Exception.Response) {
      try {$httpCode=[int]$_.Exception.Response.StatusCode} catch {$httpCode=0}
    }
    $script:reason=$(if($httpCode -in @(400,401,403,404,409,429,500,502,503,504)){'GET_HTTP_'+$httpCode}else{'GET_TRANSPORT_OR_OTHER_HTTP_ERROR'})
    throw 'Read-only GET unavailable'
  }
  # Cloudflare can return HTTP 200/success=true/errors=null on Workers
  # version APIs. PowerShell @($null) has Count=1, so normalize only null
  # to an empty error array. Any actual provider error still stops closed.
  Need ($response.success -eq $true) 'GET_RESPONSE_SUCCESS_FALSE'
  $providerErrors=@()
  if($null -ne $response.errors){$providerErrors=@($response.errors)}
  Need ($providerErrors.Count -eq 0) 'GET_RESPONSE_ERRORS_PRESENT'
  Need ($null -ne $response.result) 'GET_RESPONSE_RESULT_MISSING'
  return $response.result
}
function Binding($list,[string]$name) { return @($list | Where-Object { $_.name -ceq $name }) }
try {
  Need (($env:OS -eq 'Windows_NT') -and (-not $env:CI) -and (-not $env:GITHUB_ACTIONS))
  Need (Test-Path -LiteralPath $lock -PathType Leaf)
  Need ([bool](Get-Command npx -ErrorAction SilentlyContinue))
  Need (-not $env:CLOUDFLARE_API_KEY -and -not $env:CLOUDFLARE_EMAIL)
  $candidate=(Resolve-Path -LiteralPath $CandidateDirectory).Path
  Need (Test-Path -LiteralPath (Join-Path $candidate 'dist\server\wrangler.json') -PathType Leaf)
  Push-Location -LiteralPath $candidate
  $entered=$true
  $env:CLOUDFLARE_ACCOUNT_ID=$account
  Remove-Item Env:CLOUDFLARE_ENV -ErrorAction SilentlyContinue
  Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
  $env:npm_config_offline='true'
  $env:npm_config_yes='false'
  $env:WRANGLER_SEND_METRICS='false'
  $env:CLOUDFLARE_CF_FETCH_ENABLED='false'
  $stage='EXISTING_CACHED_AUTH_NO_LOGIN'
  $cachedVersion=(& npx --no-install wrangler@4.162.0 --version 2>$null | Out-String).Trim()
  Need (($LASTEXITCODE -eq 0) -and ($cachedVersion -ceq '4.162.0'))
  $authJson=(& npx --no-install wrangler@4.162.0 auth token --json 2>$null | Out-String)
  Need ($LASTEXITCODE -eq 0)
  $authRecord=$authJson | ConvertFrom-Json
  Need ((@('oauth','api_token') -ccontains $authRecord.type) -and ($authRecord.token -is [string]))
  Need (($authRecord.token.Length -ge 20) -and ($authRecord.token.Length -le 4096) -and ($authRecord.token -notmatch '\s'))
  $token=$authRecord.token; $authRecord=$null; $authJson=$null
  $stage='READ_SERVING_DEPLOYMENT'
  $deploymentResult=GetOnly '/deployments?page=1&per_page=1'
  Need (@($deploymentResult.deployments).Count -eq 1)
  $serving=$deploymentResult.deployments[0]
  $servingUnchanged=($serving.id -ceq $oldDeployment) -and (@($serving.versions).Count -eq 1) -and
    ($serving.versions[0].version_id -ceq $oldVersion) -and ($serving.versions[0].percentage -eq 100)
  $stage='READ_OLD_VERSION_BINDING_BASELINE'
  $old=GetOnly ('/versions/'+$oldVersion)
  Need ($old.id -ceq $oldVersion)
  $oldBindings=@($old.resources.bindings)
  $oldDB=@(Binding $oldBindings 'DB')
  Need (($oldDB.Count -eq 1) -and ($oldDB[0].type -ceq 'd1') -and ($oldDB[0].database_id -ceq $db))
  $oldPayment=@($oldBindings | Where-Object {$_.name -cne 'FIRE_STRIPE_MODE' -and $_.name -match '^(STRIPE_|PAYMENT_|FIRE_STRIPE_)'} | ForEach-Object {$_.name} | Sort-Object)
  Need ($oldPayment.Count -eq 1)
  $stage='READ_STAGING_VERSION_LIST'
  $recent=@()
  $covered=$false
  $newestToOldest=[datetimeoffset]::MaxValue
  # The first page can be full. Read up to three GET-only pages and refuse
  # a negative classification unless the authorization window is covered.
  for($page=1;$page -le 3;$page++){
    $versionList=$(if($page -eq 1){GetOnly '/versions?page=1&per_page=100'}else{GetOnly ('/versions?page='+$page+'&per_page=100')})
    Need ($null -ne $versionList.items) 'VERSION_LIST_ITEMS_MISSING'
    $items=@($versionList.items)
    Need ($items.Count -le 100) 'VERSION_LIST_PAGE_OVERFULL'
    foreach($item in $items) {
      Need (($item.id -is [string]) -and ($item.id -match '^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$')) 'VERSION_LIST_ITEM_ID_INVALID'
      Need ([bool]$item.metadata.created_on) 'VERSION_LIST_ITEM_DATE_MISSING'
      $createdValue=[datetimeoffset]::MinValue
      Need ([datetimeoffset]::TryParse([string]$item.metadata.created_on,[ref]$createdValue)) 'VERSION_LIST_ITEM_DATE_INVALID'
      $created=$createdValue.ToUniversalTime()
      Need ($created -le $newestToOldest) 'VERSION_LIST_NOT_NEWEST_FIRST'
      $newestToOldest=$created
      if($created -ge $cutoff -and $item.id -cne $oldVersion) {
        $recent+=([pscustomobject]@{id=$item.id;created=$created.ToString('o')})
      }
      Need ($recent.Count -le 10) 'TOO_MANY_RECENT_VERSIONS_FOR_SAFE_CLASSIFICATION'
    }
    if($items.Count -lt 100 -or $items.Count -eq 0 -or $newestToOldest -lt $cutoff){
      $covered=$true
      break
    }
  }
  Need ($covered) 'VERSION_LIST_WINDOW_NOT_FULLY_COVERED'
  $stage='GET_RECENT_VERSION_BINDINGS'
  $matching=@()
  foreach($entry in $recent) {
    $version=GetOnly ('/versions/'+$entry.id)
    Need ($version.id -ceq $entry.id)
    $bindings=@($version.resources.bindings)
    $hash=@(Binding $bindings 'FIRE_ADMIN_PASSWORD_HASH')
    $mode=@(Binding $bindings 'FIRE_STRIPE_MODE')
    $session=@(Binding $bindings 'FIRE_SESSION_SECRET')
    $database=@(Binding $bindings 'DB')
    $payment=@($bindings | Where-Object {$_.name -cne 'FIRE_STRIPE_MODE' -and $_.name -match '^(STRIPE_|PAYMENT_|FIRE_STRIPE_)'} | ForEach-Object {$_.name} | Sort-Object)
    $r2=@($bindings | Where-Object {$_.type -match '^r2_bucket'})
    $fits=($hash.Count -eq 1) -and ($hash[0].type -ceq 'secret_text') -and
      ($mode.Count -eq 1) -and ($mode[0].type -ceq 'plain_text') -and ($mode[0].text -ceq 'disabled') -and
      ($session.Count -eq 1) -and ($session[0].type -ceq 'secret_text') -and
      ($database.Count -eq 1) -and ($database[0].type -ceq 'd1') -and ($database[0].database_id -ceq $db) -and
      (($payment -join '|') -ceq ($oldPayment -join '|')) -and ($r2.Count -eq 0)
    if($fits){$matching+=$entry}
  }
  $stage='READONLY_CLASSIFICATION'
  $status='REVIEW_NO_EXACT_INACTIVE_MATCH_NO_RETRY'
  if(-not $servingUnchanged){$status='STOP_SERVING_CHANGED_NO_RETRY'}
  elseif($matching.Count -gt 1){$status='STOP_MULTIPLE_MATCHES_NO_RETRY'}
  elseif($matching.Count -eq 1){$status='READONLY_ONE_INACTIVE_VERSION_METADATA_MATCH'}
  [pscustomobject]@{
    result=$status
    worker=$worker
    consumingAttemptLockPresent=$true
    currentServingDeploymentUnchanged=$servingUnchanged
    oldVersionStillAt100Percent=$servingUnchanged
    versionsSinceAuthorizationWindow=$recent.Count
    exactConfiguredVersionMatches=$matching.Count
    inactiveVersionId=$(if($matching.Count -eq 1){$matching[0].id}else{$null})
    uploadRetryAuthorized=$false
    configuredVersionActivated=$(if($servingUnchanged){$false}else{$null})
    remoteCodeBytesVerified=$false
    hostedAppLoginVerified=$false
    gate4Accepted=$false
    note='Version metadata only; never proves script-byte parity or Stripe transactions'
  } | ConvertTo-Json -Depth 4
} catch {
  Write-Host ('STAGING READ-ONLY STOP at '+$stage+' ['+$script:reason+']: evidence incomplete. NO RETRY; NO CLOUD WRITE.')
  exit 1
} finally {
  $token=$null; $authRecord=$null; $authJson=$null
  if($entered){ Pop-Location }
  foreach($x in @(
    @{key='CLOUDFLARE_ACCOUNT_ID';value=$priorAccount},
    @{key='CLOUDFLARE_API_TOKEN';value=$priorToken},
    @{key='CLOUDFLARE_ENV';value=$priorEnv},
    @{key='npm_config_offline';value=$priorOffline},
    @{key='npm_config_yes';value=$priorYes},
    @{key='WRANGLER_SEND_METRICS';value=$priorMetrics},
    @{key='CLOUDFLARE_CF_FETCH_ENABLED';value=$priorCfFetch}
  )) {
    if($null -ne $x.value){Set-Item -Path ('Env:'+$x.key) -Value $x.value}
    else{Remove-Item ('Env:'+$x.key) -ErrorAction SilentlyContinue}
  }
}
