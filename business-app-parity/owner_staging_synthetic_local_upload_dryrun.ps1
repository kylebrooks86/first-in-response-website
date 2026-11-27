# FIRE STAGING: LOCAL-ONLY Wrangler upload dry run AFTER consumed G4-04 attempt.
# Never invoke this as a real upload. No real private hash, DPAPI read, login,
# deployment, route, D1, payment or credential change is performed here.
# Wrangler --dry-run compiles/checks locally and does not upload a version.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$CandidateDirectory)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$stage = 'LOCAL_PREREQUISITES'
$root = $PSScriptRoot
$entered = $false
$tmp = $null
$oldOffline = $env:npm_config_offline
$oldYes = $env:npm_config_yes
$oldMetrics = $env:WRANGLER_SEND_METRICS
$oldCfFetch = $env:CLOUDFLARE_CF_FETCH_ENABLED
$oldAccount = $env:CLOUDFLARE_ACCOUNT_ID
$oldEnv = $env:CLOUDFLARE_ENV
function Require([bool]$pass) {
  if (-not $pass) { throw 'offline preflight did not pass' }
}
# Windows PowerShell 5.1 promotes redirected native stderr to a catchable
# NativeCommandError when ErrorActionPreference is Stop. Capture the CLI exit
# code instead, without displaying raw stderr or weakening other fail-closed
# checks. This helper is LOCAL ONLY and cannot alter Cloudflare resources.
function InvokeLocalNpx([string[]]$Arguments) {
  $savedPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $captured = (& npx @Arguments 2>&1 | Out-String)
    $exitCode = $LASTEXITCODE
    return [pscustomobject]@{ output = [string]$captured; exitCode = $exitCode }
  } finally {
    $ErrorActionPreference = $savedPreference
  }
}
try {
  Require (($env:OS -ceq 'Windows_NT') -and (-not $env:CI) -and (-not $env:GITHUB_ACTIONS))
  $lock = Join-Path $env:LOCALAPPDATA 'FIRE-STAGING-Private\g404-one-inactive-version-attempt-20261122.lock'
  Require (Test-Path -LiteralPath $lock -PathType Leaf)
  Require (-not $env:CLOUDFLARE_API_KEY -and -not $env:CLOUDFLARE_EMAIL -and -not $env:CLOUDFLARE_API_TOKEN)
  $candidate = (Resolve-Path -LiteralPath $CandidateDirectory).Path
  $cfg = Join-Path $candidate 'dist\server\wrangler.json'
  Require (Test-Path -LiteralPath $cfg -PathType Leaf)
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  $python = Get-Command python.exe -ErrorAction SilentlyContinue
  Require ($null -ne $node -and $null -ne $python)
  Require ($null -ne (Get-Command npx -ErrorAction SilentlyContinue))
  $guardFile = Join-Path $root 'check_independent_staging_runtime_config.mjs'
  $sourceFile = Join-Path $root 'verify_materialized_candidate.py'
  Require (Test-Path -LiteralPath $guardFile -PathType Leaf)
  Require (Test-Path -LiteralPath $sourceFile -PathType Leaf)

  $stage = 'CHECK_COMPILED_STAGING_MANIFEST'
  $output = (& $node.Source $guardFile $cfg 2>&1 | Out-String)
  Require ($LASTEXITCODE -eq 0)
  $guard = $output | ConvertFrom-Json
  Require ($guard.candidateBuildIdentityVerified -eq $true)
  Require (($guard.worker -ceq 'fire-app-independent-staging') -and
    ($guard.sourceJobNumberModeRequested -eq $false) -and
    ($guard.sourceQuickAuthModeRequested -eq $false))
  $stage = 'CHECK_REVIEWED_SOURCE_FINGERPRINT'
  $output = (& $python.Source $sourceFile independent-staging $candidate --built 2>&1 | Out-String)
  Require ($LASTEXITCODE -eq 0)
  $identity = $output | ConvertFrom-Json
  Require (($identity.identicalToSharedPlusAuthorizedAdapter -eq $true) -and
    ($identity.deployed -eq $false) -and ($identity.sourceFingerprint -match '^[a-f0-9]{64}$'))

  $stage = 'LOCAL_WRANGLER_DRY_RUN'
  Push-Location -LiteralPath $candidate
  $entered = $true
  $env:npm_config_offline = 'true'
  $env:npm_config_yes = 'false'
  $env:WRANGLER_SEND_METRICS = 'false'
  $env:CLOUDFLARE_CF_FETCH_ENABLED = 'false'
  Remove-Item Env:CLOUDFLARE_ENV -ErrorAction SilentlyContinue
  Remove-Item Env:CLOUDFLARE_ACCOUNT_ID -ErrorAction SilentlyContinue
  $versionRun = InvokeLocalNpx @('--no-install','wrangler@4.162.0','--version')
  Require (($versionRun.exitCode -eq 0) -and ($versionRun.output.Trim() -ceq '4.162.0'))
  # A NONSECRET placeholder proves the command's file/parser path without
  # reading the Windows-bound FIRE_ADMIN_PASSWORD_HASH DPAPI record.
  $tmp = Join-Path $env:TEMP ('fire-staging-dry-run-placeholder-' + [guid]::NewGuid().ToString('n') + '.json')
  [IO.File]::WriteAllText($tmp,('{"FIRE_ADMIN_PASSWORD_HASH":"' + ('0' * 64) + '"}'),
    (New-Object System.Text.UTF8Encoding($false)))
  $arguments = @('--no-install','wrangler@4.162.0','versions','upload',
    '--config',$cfg,'--name','fire-app-independent-staging',
    '--secrets-file',$tmp,'--keep-vars','--strict',
    '--message','FIRE local-only synthetic STAGING DRY RUN','--dry-run')
  $dryRun = InvokeLocalNpx $arguments
  $result = $dryRun.output
  $status = $dryRun.exitCode
  if ($status -ne 0) {
    # Never print raw logs, absolute paths, tokens or exception text.
    # Return ONLY a reviewed fixed diagnostic label. NEVER print raw CLI output:
    # it may contain absolute paths, account identifiers, or provider responses.
    $category = 'LOCAL_BUILD_OR_WRANGLER_OTHER'
    if ($result -match '(?i)unknown (argument|option|flag)|unrecognized (argument|option)|invalid (option|flag)') {
      $category = 'LOCAL_CLI_OPTION_REJECTED'
    } elseif ($result -match '(?i)could not resolve|cannot find module|module not found|missing (file|entry|module)|ENOENT') {
      $category = 'LOCAL_INPUT_OR_MODULE_MISSING'
    } elseif ($result -match '(?i)API error|HTTP (400|401|403|404|409|429|500|502|503|504)|remote settings|cloudflare API') {
      $category = 'REMOTE_PREFLIGHT_OR_PROVIDER_CHECK'
    } elseif ($result -match '(?i)invalid (configuration|wrangler)|configuration (error|validation)|invalid config|failed to parse (config|wrangler)|missing required (binding|field)') {
      $category = 'LOCAL_WRANGLER_CONFIG_INVALID'
    } elseif ($result -match '(?i)esbuild|failed to (bundle|build|compile)|build failed|bundle failed|syntax error|unexpected token') {
      $category = 'LOCAL_WORKER_BUNDLE_FAILURE'
    } elseif ($result -match '(?i)asset manifest|static assets|assets directory|failed to read assets|asset.*size limit') {
      $category = 'LOCAL_STATIC_ASSETS_FAILURE'
    } elseif ($result -match '(?i)SyntaxError|TypeError|ReferenceError|uncaught exception|ERR_[A-Z_]+') {
      $category = 'LOCAL_WRANGLER_RUNTIME_EXCEPTION'
    } elseif ($result -match '(?i)not logged in|authentication required|need to login|network (error|unreachable)|fetch failed|ENOTFOUND|ETIMEDOUT') {
      $category = 'LOCAL_AUTH_OR_NETWORK_DEPENDENCY'
    } elseif ([string]::IsNullOrWhiteSpace($result)) {
      $category = 'LOCAL_WRANGLER_EXIT_WITHOUT_OUTPUT'
    }
    Write-Host ('FIRE_STAGING_DRY_RUN_NOT_PASSED [' + $category + ']')
    Write-Host 'No upload attempted by this diagnostic. Old one-shot attempt remains consumed.'
    exit 1
  }
  Write-Host 'FIRE_STAGING_SYNTHETIC_LOCAL_UPLOAD_DRY_RUN_PASS'
  Write-Host 'Pinned source, manifest and local Wrangler packaging checked with a placeholder hash.'
  Write-Host 'No real owner password, version creation, deployment, activation or Stripe change.'
  Write-Host 'Does NOT prove provider upload, old payment-secret preservation, hosted login or G4 acceptance.'
  Write-Host 'DO NOT rerun the spent STAGING -Execute helper; fresh specific approval required for a new upload.'
} catch {
  Write-Host ('FIRE_STAGING_SYNTHETIC_DRY_RUN_STOP [' + $stage + ']')
  Write-Host 'No real secret used. No upload authorized or performed. Do not retry the spent attempt.'
  exit 1
} finally {
  if ($tmp -and (Test-Path -LiteralPath $tmp -PathType Leaf)) {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
  if ($entered) { Pop-Location }
  foreach ($item in @(
    @{name='npm_config_offline';value=$oldOffline},
    @{name='npm_config_yes';value=$oldYes},
    @{name='WRANGLER_SEND_METRICS';value=$oldMetrics},
    @{name='CLOUDFLARE_CF_FETCH_ENABLED';value=$oldCfFetch},
    @{name='CLOUDFLARE_ACCOUNT_ID';value=$oldAccount},
    @{name='CLOUDFLARE_ENV';value=$oldEnv}
  )) {
    if ($null -ne $item.value) { Set-Item -Path ('Env:' + $item.name) -Value $item.value }
    else { Remove-Item ('Env:' + $item.name) -ErrorAction SilentlyContinue }
  }
}
