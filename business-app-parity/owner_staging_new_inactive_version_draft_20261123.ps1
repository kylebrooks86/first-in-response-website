# DRAFT successor for a NEW specifically authorized STAGING inactive upload.
# Original Nov22 helper and lock remain immutable; never use this as a retry.
# Default offline review; no execution without new exact owner consent.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$CandidateDirectory,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$ExpectedCommit,
  [switch]$Execute)
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
$originalLock=Join-Path $private 'g404-one-inactive-version-attempt-20261122.lock'
$lockFile=Join-Path $private 'g404-new-inactive-version-attempt-20261123.lock'
$cliPrefix=Join-Path $env:LOCALAPPDATA 'FIRE-STAGING-Tools\wrangler-4.162.0'
$cli=Join-Path $cliPrefix 'node_modules\wrangler\bin\wrangler.js'
$cliPackage=Join-Path $cliPrefix 'node_modules\wrangler\package.json'
$tmp=$null; $hash=$null; $token=$null; $attempted=$false
$previousToken=$env:CLOUDFLARE_API_TOKEN
$previousAccount=$env:CLOUDFLARE_ACCOUNT_ID
$previousWranglerEnv=$env:CLOUDFLARE_ENV
$workingDirectoryChanged=$false
$oldOffline=$env:npm_config_offline
$oldYes=$env:npm_config_yes
$oldMetrics=$env:WRANGLER_SEND_METRICS
$oldFetch=$env:CLOUDFLARE_CF_FETCH_ENABLED
$stage='OFFLINE_REVIEW'
function Require([bool]$condition) { if(-not $condition) {throw 'STOP: safety prerequisite failed'} }
function InvokePinnedCli([string[]]$arguments) {
  $savedPreference=$ErrorActionPreference
  try {
    $ErrorActionPreference='Continue'
    $out=(& $node.Source $cli @arguments 2>&1 | Out-String)
    $exitCode=$LASTEXITCODE
    return [pscustomobject]@{output=[string]$out;exitCode=$exitCode}
  } finally {$ErrorActionPreference=$savedPreference}
}
function ApiGet([string]$suffix) {
  Require ($suffix -match '^/(deployments\?page=1&per_page=1|versions\?page=[1-3]&per_page=100|versions/[a-f0-9-]{36})$')
  $reply=Invoke-RestMethod -Method Get -Uri ($base+$suffix) -Headers @{Authorization=('Bearer '+$token)} -TimeoutSec 20
  $errors=@()
  if($null -ne $reply.errors){$errors=@($reply.errors)}
  Require (($reply.success -eq $true) -and ($errors.Count -eq 0) -and ($null -ne $reply.result))
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
  $node=Get-Command node.exe -ErrorAction SilentlyContinue
  Require ($null -ne $node)
  Require (Test-Path -LiteralPath $originalLock -PathType Leaf)
  Require (Test-Path -LiteralPath $cli -PathType Leaf)
  Require (Test-Path -LiteralPath $cliPackage -PathType Leaf)
  $meta=Get-Content -LiteralPath $cliPackage -Raw | ConvertFrom-Json
  Require (($meta.name -ceq 'wrangler') -and ($meta.version -ceq '4.162.0'))
  $env:WRANGLER_SEND_METRICS='false'
  $env:CLOUDFLARE_CF_FETCH_ENABLED='false'
  $v=InvokePinnedCli @('--version')
  Require (($v.exitCode -eq 0) -and ($v.output.Trim() -ceq '4.162.0'))
  $repo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
  $head=(& git -C $repo rev-parse HEAD | Out-String).Trim()
  Require (($LASTEXITCODE -eq 0) -and ($head -ceq $ExpectedCommit))
  $dirty=@(& git -C $repo status --porcelain --untracked-files=no)
  Require (($LASTEXITCODE -eq 0) -and ($dirty.Count -eq 0))
  $candidate=(Resolve-Path -LiteralPath $CandidateDirectory).Path
  $expectedDirectory=Join-Path $env:LOCALAPPDATA ('FIRE-STAGING-Candidates\independent-staging-'+$ExpectedCommit)
  Require ($candidate -ieq $expectedDirectory)
  $cfg=Join-Path $candidate 'dist\server\wrangler.json'
  Require (Test-Path -LiteralPath $cfg -PathType Leaf)
  $manifest=Get-Content -LiteralPath $cfg -Raw | ConvertFrom-Json
  Require (-not ($manifest.PSObject.Properties.Name -ccontains 'legacy_env'))
  $checker=Join-Path $PSScriptRoot 'check_independent_staging_runtime_config.mjs'
  Require (Test-Path -LiteralPath $checker -PathType Leaf)
  $guardOut=(& node $checker $cfg 2>&1 | Out-String)
  Require ($LASTEXITCODE -eq 0)
  $guard=$guardOut | ConvertFrom-Json
  Require (($guard.candidateBuildIdentityVerified -eq $true) -and ($guard.worker -ceq $worker))
  # The compiled manifest alone cannot attest the bundled code. Compare all
  # built source bytes to this reviewed shared+independent-staging overlay.
  $sourceVerifier=Join-Path $PSScriptRoot 'verify_materialized_candidate.py'
  Require (Test-Path -LiteralPath $sourceVerifier -PathType Leaf)
  $python=Get-Command python.exe -ErrorAction SilentlyContinue
  Require ($null -ne $python)
  $fingerprintOutput=(& $python.Source $sourceVerifier independent-staging $candidate --built 2>&1 | Out-String)
  Require ($LASTEXITCODE -eq 0)
  $sourceProof=$fingerprintOutput | ConvertFrom-Json
  Require (($sourceProof.candidate -ceq 'independent-staging') -and
    ($sourceProof.identicalToSharedPlusAuthorizedAdapter -eq $true) -and
    ($sourceProof.deployed -eq $false) -and
    ($sourceProof.exactSourceFiles -gt 100) -and
    ($sourceProof.sourceFingerprint -match '^[a-f0-9]{64}$'))
  # The single approved inactive version cannot activate unrelated modes.
  Require (($guard.sourceJobNumberModeRequested -eq $false) -and
    ($guard.sourceQuickAuthModeRequested -eq $false))
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
  # DRAFT LOCK: an independently reviewed subsequent source commit is required
  # before this draft can perform any provider operation, even with -Execute.
  throw 'DRAFT: execution is disabled until new exact owner approval and source review'
  $consent=Read-Host 'Type I AUTHORIZE ONE NEW INACTIVE STAGING UPLOAD ONLY to reserve a NEW one-time attempt; no activation'
  Require ($consent -ceq 'I AUTHORIZE ONE NEW INACTIVE STAGING UPLOAD ONLY')
  $stage='CACHED_AUTH_NO_LOGIN'
  # No login, browser, token printing or subscription action. Cached session ONLY.
  # Do not let a different account/environment or inherited legacy API key
  # override the owner-verified existing STAGING Worker and cached identity.
  Require (-not $env:CLOUDFLARE_API_KEY -and -not $env:CLOUDFLARE_EMAIL)
  $env:CLOUDFLARE_ACCOUNT_ID=$account
  Remove-Item Env:CLOUDFLARE_ENV -ErrorAction SilentlyContinue
  Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
  # Keep candidate as cwd for asset/module resolution; invoke the separate
  # exact CLI by absolute Node entrypoint, never via candidate-local npx.
  Push-Location -LiteralPath $candidate
  $workingDirectoryChanged=$true
  $env:npm_config_offline='true'
  $env:npm_config_yes='false'
  $env:WRANGLER_SEND_METRICS='false'
  $env:CLOUDFLARE_CF_FETCH_ENABLED='false'
  $authRun=InvokePinnedCli @('auth','token','--json')
  Require ($authRun.exitCode -eq 0)
  $authRecord=$authRun.output | ConvertFrom-Json
  $authRun=$null
  Require ((@('oauth','api_token') -ccontains $authRecord.type) -and ($authRecord.token -is [string]))
  Require (($authRecord.token.Length -ge 20) -and ($authRecord.token.Length -le 4096) -and ($authRecord.token -notmatch '\s'))
  $token=$authRecord.token
  $authRecord=$null
  $stage='READ_ONLY_PREDECESSOR_CHECK'
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

  # Check for any configured version created since the original consumed attempt.
  # A fresh provider read is required only because another write is contemplated.
  $stage='READ_ONLY_RECENT_VERSION_CHECK'
  $cutoff=[datetimeoffset]'2026-11-22T23:00:00Z'
  $covered=$false
  $last=[datetimeoffset]::MaxValue
  $recentCount=0
  for($page=1;$page -le 3;$page++){
    $list=ApiGet ('/versions?page='+$page+'&per_page=100')
    Require ($null -ne $list.items)
    $items=@($list.items)
    Require ($items.Count -le 100)
    foreach($item in $items) {
      Require ($item.id -match '^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$')
      $created=[datetimeoffset]::MinValue
      Require ([datetimeoffset]::TryParse([string]$item.metadata.created_on,[ref]$created))
      Require ($created -le $last)
      $last=$created
      if($created -ge $cutoff -and $item.id -cne $servingVersion) {
        $recentCount++
        Require ($recentCount -le 10)
        $existing=ApiGet ('/versions/'+$item.id)
        Require ($existing.id -ceq $item.id)
        # Any newly configured admin hash or explicit Stripe-disabled mode is
        # sufficient to stop rather than risk a duplicate version.
        $existingBindings=@($existing.resources.bindings)
        Require (@(SelectBinding $existingBindings 'FIRE_ADMIN_PASSWORD_HASH').Count -eq 0)
        Require (@(SelectBinding $existingBindings 'FIRE_STRIPE_MODE').Count -eq 0)
      }
    }
    if($items.Count -lt 100 -or $last -lt $cutoff){$covered=$true;break}
  }
  Require ($covered)
  VerifyServing
  $stage='PRIVATE_HASH_AND_NEW_ATTEMPT_RESERVATION'
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
  $stage='ONE_NEW_INACTIVE_VERSION_UPLOAD'
  $uploadArgs=@('versions','upload','--config',$cfg,
    '--name',$worker,'--secrets-file',$tmp,'--keep-vars','--strict',
    '--message','Owner-approved STAGING-only hash + Stripe disabled; INACTIVE, NO DEPLOY')
  $uploadResult=InvokePinnedCli $uploadArgs
  Require ($uploadResult.exitCode -eq 0)
  $uploadLog=$uploadResult.output
  $uploadResult=$null
  $pattern='(?i)\bversion\s+id\s*:\s*([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\b'
  $matchesFound=[regex]::Matches($uploadLog,$pattern)
  Require ($matchesFound.Count -eq 1)
  $newVersion=$matchesFound[0].Groups[1].Value.ToLowerInvariant()
  Require ($newVersion -cne $servingVersion)
  $stage='READ_ONLY_NEW_VERSION_METADATA'
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
  else { Write-Host ('STOP before upload: prerequisites not fulfilled at '+$stage+'. No remote version write attempted.') }
  exit 1
} finally {
  $hash=$null; $token=$null; $record=$null
  if($tmp -and (Test-Path -LiteralPath $tmp)) {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
  if($workingDirectoryChanged) { Pop-Location }
  foreach($item in @(@{key='npm_config_offline';value=$oldOffline},@{key='npm_config_yes';value=$oldYes},@{key='WRANGLER_SEND_METRICS';value=$oldMetrics},@{key='CLOUDFLARE_CF_FETCH_ENABLED';value=$oldFetch})) {
    if($null -ne $item.value){Set-Item -Path ('Env:'+$item.key) -Value $item.value}
    else{Remove-Item ('Env:'+$item.key) -ErrorAction SilentlyContinue}
  }
  if($previousToken) { $env:CLOUDFLARE_API_TOKEN=$previousToken }
  else { Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue }
  if($previousAccount) { $env:CLOUDFLARE_ACCOUNT_ID=$previousAccount }
  else { Remove-Item Env:CLOUDFLARE_ACCOUNT_ID -ErrorAction SilentlyContinue }
  if($previousWranglerEnv) { $env:CLOUDFLARE_ENV=$previousWranglerEnv }
  else { Remove-Item Env:CLOUDFLARE_ENV -ErrorAction SilentlyContinue }
}