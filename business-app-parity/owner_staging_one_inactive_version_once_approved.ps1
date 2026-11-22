# Owner-authorized ONE inactive version of fire-app-independent-staging.
# Never deploy, activate, remove existing secrets, migrate, alter routes or use R2.
# Run only on owner Acer with already prepared DPAPI verifier + cached Wrangler.
# Default: OFFLINE preflight. -Execute: one irreversible upload attempt maximum.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$CandidateDirectory,[switch]$Execute)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$worker='fire-app-independent-staging'
$account='bfc00939cfb2f8dfd8581a7a7f5f1307'
$db='afb2c05a-d794-4a9a-b580-924ce01c26ad'
$servingDeployment='10215e59-2ff0-485c-92f6-11d7f0405060'
$servingVersion='7838d0ea-be89-49c6-9984-d3b021082d72'
$base='https://api.cloudflare.com/client/v4/accounts/'+$account+'/workers/scripts/'+$worker
$private=Join-Path $env:LOCALAPPDATA 'FIRE-STAGING-Private'
$recordFile=Join-Path $private 'staging-admin-hash-dpapi.xml'
$lockFile=Join-Path $private 'g404-one-inactive-version-attempt-20261122.lock'
$tmp=$null; $hash=$null; $token=$null; $attempted=$false
$previousToken=$env:CLOUDFLARE_API_TOKEN
function Require([bool]$condition) { if(-not $condition) {throw 'STOP: safety prerequisite failed'} }
function ApiGet([string]$suffix) {
  Require ($suffix -match '^/(deployments\?page=1&per_page=1|versions/[a-f0-9-]{36})$')
  $reply=Invoke-RestMethod -Method Get -Uri ($base+$suffix) -Headers @{Authorization=('Bearer '+$token)} -TimeoutSec 20
  Require (($reply.success -eq $true) -and (@($reply.errors).Count -eq 0) -and ($null -ne $reply.result))
  return $reply.result
}
function VerifyServing {
  $active=ApiGet '/deployments?page=1&per_page=1'
  Require (@($active.deployments).Count -eq 1)
  $deployment=$active.deployments[0]
  Require (($deployment.id -ceq $servingDeployment) -and (@($deployment.versions).Count -eq 1))
  Require (($deployment.versions[0].version_id -ceq $servingVersion) -and ($deployment.versions[0].percentage -eq 100))
}
function SelectBinding($bindings,[string]$name) {
  return @($bindings | Where-Object { $_.name -ceq $name })
}
try {
  Require (($env:OS -eq 'Windows_NT') -and (-not $env:CI) -and (-not $env:GITHUB_ACTIONS))
  Require ([bool](Get-Command node -ErrorAction SilentlyContinue))
  Require ([bool](Get-Command npx -ErrorAction SilentlyContinue))
  $candidate=(Resolve-Path -LiteralPath $CandidateDirectory).Path
  $cfg=Join-Path $candidate 'dist\server\wrangler.json'
  Require (Test-Path -LiteralPath $cfg -PathType Leaf)
  $checker=Join-Path $PSScriptRoot 'check_independent_staging_runtime_config.mjs'
  Require (Test-Path -LiteralPath $checker -PathType Leaf)
  $guardOut=(& node $checker $cfg 2>&1 | Out-String)
  Require ($LASTEXITCODE -eq 0)
  $guard=$guardOut | ConvertFrom-Json
  Require (($guard.candidateBuildIdentityVerified -eq $true) -and ($guard.worker -ceq $worker))
  Require (Test-Path -LiteralPath $recordFile -PathType Leaf)
  $record=Import-Clixml -LiteralPath $recordFile
  Require (($record.targetWorker -ceq $worker) -and ($record.expectedDatabaseId -ceq $db))
  Require (($record.secretName -ceq 'FIRE_ADMIN_PASSWORD_HASH') -and ($record.hashVerifier -is [securestring]))
  Require (($record.uploadedToProvider -eq $false) -and ($record.deploymentAuthorized -eq $false))
  Require (-not (Test-Path -LiteralPath $lockFile))
  if(-not $Execute) {
    Write-Host 'PASS STAGING OFFLINE PREFLIGHT: compiled worker target/DB/disabled Stripe mode and preprepared private verifier.'
    Write-Host 'Cloudflare not contacted; no new version or serving change.'
    return
  }
  # No login, browser, token printing or subscription action. Cached session ONLY.
  Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
  $env:npm_config_offline='true'
  $env:npm_config_yes='false'
  $env:WRANGLER_SEND_METRICS='false'
  $env:CLOUDFLARE_CF_FETCH_ENABLED='false'
  $cachedVersion=(& npx --no-install wrangler@4.162.0 --version 2>$null | Out-String).Trim()
  Require (($LASTEXITCODE -eq 0) -and ($cachedVersion -match '^4\.162\.0$'))
  $authJson=(& npx --no-install wrangler@4.162.0 auth token --json 2>$null | Out-String)
  Require ($LASTEXITCODE -eq 0)
  $authRecord=$authJson | ConvertFrom-Json
  Require ((@('oauth','api_token') -ccontains $authRecord.type) -and ($authRecord.token -is [string]))
  Require (($authRecord.token.Length -ge 20) -and ($authRecord.token.Length -le 4096) -and ($authRecord.token -notmatch '\s'))
  $token=$authRecord.token
  VerifyServing
  $old=ApiGet ('/versions/'+$servingVersion)
  $oldBindings=@($old.resources.bindings)
  $oldDB=@(SelectBinding $oldBindings 'DB')
  Require (($oldDB.Count -eq 1) -and ($oldDB[0].type -ceq 'd1') -and ($oldDB[0].database_id -ceq $db))
  Require (@(SelectBinding $oldBindings 'FIRE_ADMIN_PASSWORD_HASH').Count -eq 0)
  Require (@(SelectBinding $oldBindings 'FIRE_STRIPE_MODE').Count -eq 0)
  $oldSession=@(SelectBinding $oldBindings 'FIRE_SESSION_SECRET')
  Require (($oldSession.Count -eq 1) -and ($oldSession[0].type -ceq 'secret_text'))
  $oldPayment=@($oldBindings | Where-Object { $_.name -cne 'FIRE_STRIPE_MODE' -and $_.name -match '^(STRIPE_|PAYMENT_|FIRE_STRIPE_)' } | ForEach-Object {$_.name} | Sort-Object)
  Require ($oldPayment.Count -eq 1)
  Require (@($oldBindings | Where-Object {$_.type -match '^r2_bucket'}).Count -eq 0)

  # The prepared hash is decrypted locally, never printed or committed.
  $ptr=[IntPtr]::Zero
  try {
    $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($record.hashVerifier)
    $hash=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    Require ($hash -cmatch '^[0-9a-f]{64}$')
  } finally { if($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)} }
  # Cloudflare Wrangler requires a file for an atomic code+secret version upload.
  # This ephemeral owner-local file is deleted in finally even on failure.
  $tmp=Join-Path $private ('g404-one-time-'+[guid]::NewGuid().ToString('n')+'.json')
  [IO.File]::WriteAllText($tmp,('{"FIRE_ADMIN_PASSWORD_HASH":"'+$hash+'"}'),(New-Object System.Text.UTF8Encoding($false)))
  $hash=$null
  # Atomically reserve the ONE permitted upload attempt before invoking it.
  $stream=[IO.File]::Open($lockFile,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try {
    $message=[Text.Encoding]::UTF8.GetBytes('ONE ATTEMPT RESERVED: reconcile read-only; do not repeat')
    $stream.Write($message,0,$message.Length)
  } finally { $stream.Dispose() }
  $attempted=$true
  $uploadArgs=@('--no-install','wrangler@4.162.0','versions','upload','--config',$cfg,
    '--name',$worker,'--secrets-file',$tmp,'--keep-vars','--strict',
    '--message','Owner-approved STAGING-only hash + Stripe disabled; INACTIVE, NO DEPLOY')
  $uploadLog=(& npx @uploadArgs 2>&1 | Out-String)
  Require ($LASTEXITCODE -eq 0)
  $pattern='(?i)\bversion\s+id\s*:\s*([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\b'
  $matchesFound=[regex]::Matches($uploadLog,$pattern)
  Require ($matchesFound.Count -eq 1)
  $newVersion=$matchesFound[0].Groups[1].Value.ToLowerInvariant()
  Require ($newVersion -cne $servingVersion)
  VerifyServing
  $new=ApiGet ('/versions/'+$newVersion)
  Require ($new.id -ceq $newVersion)
  $bindings=@($new.resources.bindings)
  $newHash=@(SelectBinding $bindings 'FIRE_ADMIN_PASSWORD_HASH')
  $newMode=@(SelectBinding $bindings 'FIRE_STRIPE_MODE')
  $newSession=@(SelectBinding $bindings 'FIRE_SESSION_SECRET')
  $newDB=@(SelectBinding $bindings 'DB')
  Require (($newHash.Count -eq 1) -and ($newHash[0].type -ceq 'secret_text'))
  Require (($newMode.Count -eq 1) -and ($newMode[0].type -ceq 'plain_text') -and ($newMode[0].text -ceq 'disabled'))
  Require (($newSession.Count -eq 1) -and ($newSession[0].type -ceq 'secret_text'))
  Require (($newDB.Count -eq 1) -and ($newDB[0].type -ceq 'd1') -and ($newDB[0].database_id -ceq $db))
  $newPayment=@($bindings | Where-Object { $_.name -cne 'FIRE_STRIPE_MODE' -and $_.name -match '^(STRIPE_|PAYMENT_|FIRE_STRIPE_)' } | ForEach-Object {$_.name} | Sort-Object)
  Require (($newPayment -join '|') -ceq ($oldPayment -join '|'))
  Require (@($bindings | Where-Object {$_.type -match '^r2_bucket'}).Count -eq 0)
  [pscustomobject]@{
    result='FIRE_STAGING_NEW_INACTIVE_VERSION_PHYSICAL_PASS'
    inactiveVersionId=$newVersion
    inactiveTrafficPercent=0
    previousServingVersionId=$servingVersion
    previousServingTrafficPercent=100
    servingDeploymentUnchanged=$true
    adminPasswordHashSecretNamePresent=$true
    stripeModeExplicitlyDisabled=$true
    paymentCredentialNamesPreserved=$true
    createdDeployment=$false
    otherEnvironmentModified=$false
    gate4Accepted=$false
  } | ConvertTo-Json -Depth 5
} catch {
  if($attempted) { Write-Host 'STOP: ONE upload may have occurred. DO NOT RETRY. Read-only reconcile only.' }
  else { Write-Host 'STOP before upload: prerequisites not fulfilled. No remote version write attempted.' }
  exit 1
} finally {
  $hash=$null; $token=$null; $record=$null
  if($tmp -and (Test-Path -LiteralPath $tmp)) {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
  if($previousToken) { $env:CLOUDFLARE_API_TOKEN=$previousToken }
  else { Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue }
}