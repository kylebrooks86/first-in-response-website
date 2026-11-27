# FIRE STAGING owner workstation: prepare the separately pinned upload CLI.
# This is local tooling only. No Cloudflare login, account access, secret read,
# Worker upload, deployment, payment, D1, or attempt-lock creation/reset.
# The app build's pinned Wrangler 4.92.0 is intentionally not replaced.
[CmdletBinding()]
param([switch]$Prepare)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$stage='LOCAL_PREREQUISITES'
$prefix=Join-Path $env:LOCALAPPDATA 'FIRE-STAGING-Tools\wrangler-4.162.0'
$package=Join-Path $prefix 'node_modules\wrangler\package.json'
$cli=Join-Path $prefix 'node_modules\wrangler\bin\wrangler.js'
$priorLock=Join-Path $env:LOCALAPPDATA 'FIRE-STAGING-Private\g404-one-inactive-version-attempt-20261122.lock'
function Need([bool]$pass) { if(-not $pass){throw 'Local preparation safety prerequisite failed'} }
function ConfirmCli {
  Need (Test-Path -LiteralPath $package -PathType Leaf)
  Need (Test-Path -LiteralPath $cli -PathType Leaf)
  $meta=Get-Content -LiteralPath $package -Raw | ConvertFrom-Json
  Need (($meta.name -ceq 'wrangler') -and ($meta.version -ceq '4.162.0'))
  $savedPreference=$ErrorActionPreference
  try {
    $ErrorActionPreference='Continue'
    $result=(& $node.Source $cli --version 2>&1 | Out-String).Trim()
    $code=$LASTEXITCODE
  } finally {$ErrorActionPreference=$savedPreference}
  Need (($code -eq 0) -and ($result -ceq '4.162.0'))
}
$oldOffline=$env:npm_config_offline
$oldMetrics=$env:WRANGLER_SEND_METRICS
$oldFetch=$env:CLOUDFLARE_CF_FETCH_ENABLED
try {
  Need (($env:OS -ceq 'Windows_NT') -and (-not $env:CI) -and (-not $env:GITHUB_ACTIONS))
  Need (Test-Path -LiteralPath $priorLock -PathType Leaf)
  $node=Get-Command node.exe -ErrorAction SilentlyContinue
  $npm=Get-Command npm.cmd -ErrorAction SilentlyContinue
  Need ($null -ne $node -and $null -ne $npm)
  $env:WRANGLER_SEND_METRICS='false'
  $env:CLOUDFLARE_CF_FETCH_ENABLED='false'
  if(Test-Path -LiteralPath $prefix) {
    $stage='VERIFY_EXISTING_PINNED_CLI'
    ConfirmCli
  } elseif(-not $Prepare) {
    Write-Host 'FIRE_STAGING_UPLOAD_CLI_NOT_PREPARED: -Prepare installs only the separately pinned local npm tool.'
    Write-Host 'Old attempt lock preserved. No Cloudflare contacted.'
    return
  } else {
    $stage='INSTALL_PINNED_LOCAL_CLI'
    # Explicit -Prepare allows npm registry access, not Cloudflare API access.
    # The isolated prefix must not exist; never overwrite a partial install.
    $null=New-Item -ItemType Directory -Path $prefix
    $env:npm_config_offline='false'
    $savedPreference=$ErrorActionPreference
    try {
      $ErrorActionPreference='Continue'
      $install=(& $npm.Source install --prefix $prefix --save-exact --no-audit --no-fund wrangler@4.162.0 2>&1 | Out-String)
      $code=$LASTEXITCODE
    } finally {$ErrorActionPreference=$savedPreference}
    Need ($code -eq 0)
    $stage='VERIFY_NEW_PINNED_CLI'
    ConfirmCli
  }
  Need (Test-Path -LiteralPath $priorLock -PathType Leaf)
  Write-Host 'FIRE_STAGING_UPLOAD_CLI_READY: isolated direct Node Wrangler 4.162.0 verified.'
  Write-Host 'App build dependencies and original spent attempt lock preserved.'
  Write-Host 'No provider upload or activation. Fresh exact approval and separately reviewed upload helper required.'
} catch {
  Write-Host ('FIRE_STAGING_UPLOAD_CLI_STOP ['+$stage+']: no upload performed; preserve existing files.')
  exit 1
} finally {
  foreach($item in @(
    @{key='npm_config_offline';value=$oldOffline},
    @{key='WRANGLER_SEND_METRICS';value=$oldMetrics},
    @{key='CLOUDFLARE_CF_FETCH_ENABLED';value=$oldFetch}
  )){
    if($null -ne $item.value){Set-Item -Path ('Env:'+$item.key) -Value $item.value}
    else{Remove-Item ('Env:'+$item.key) -ErrorAction SilentlyContinue}
  }
}
