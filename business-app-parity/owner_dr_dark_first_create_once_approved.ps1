# FIRE: owner-approved ONE-SHOT first creation of the isolated DARK DR Worker.
# This is NOT a migration, merge, login setup, route/publication or Stripe change.
# Only use the exact sealed PR270 DR ZIP from the owner's private Drive.
# Run from interactive Windows PowerShell after downloading that ZIP to Downloads.
[CmdletBinding()]
param(
  [string]$PackageZip = (Join-Path $env:USERPROFILE 'Downloads\FIRE-DR-DARK-FIRST-CREATE-PR270-9bbd3026-SOURCE-ONLY.zip')
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$expectedPackageSha = '2390b88f75162d7115aad043e963ee23524f202bd751a725877e273f69e61760'
$expectedPackageBytes = 3118632
$sourceSha = '9bbd3026c9e636adad0d29cae6862694616308cb'
$account = 'bfc00939cfb2f8dfd8581a7a7f5f1307'
$worker = 'fire-fullapp-dr'
$dbName = 'fire-fullapp-dr-db'
$dbId = '5e55c5b7-cd67-4c8f-a52e-40f71b5d3145'
$root = Join-Path $env:USERPROFILE 'Documents\FIRE-DR-FIRST-CREATE-PR270-9bbd3026'
function Stop-Fire([string]$reason) { throw ("FIRE DR first-create STOP: " + $reason) }
function ShaFile([string]$path) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() }
function HasKey($obj,[string]$key) { $null -ne $obj.PSObject.Properties[$key] }
function IsInert($value) {
  if($null -eq $value) { return $true }
  if($value -is [string] -or $value -is [ValueType]) { return $false }
  if($value -is [System.Collections.IDictionary]) {
    foreach($v in $value.Values){ if(-not (IsInert $v)){ return $false } }
    return $true
  }
  if($value -is [pscustomobject]) {
    foreach($p in $value.PSObject.Properties){ if(-not (IsInert $p.Value)){ return $false } }
    return $true
  }
  if($value -is [System.Collections.IEnumerable]) {
    foreach($v in $value){ if(-not (IsInert $v)){ return $false } }
    return $true
  }
  return $false
}
function Invoke-FireWrangler([string[]]$wranglerArgs) {
  $output = (& $script:npxCmd --yes 'wrangler@4.162.0' @wranglerArgs 2>&1 | Out-String)
  return [pscustomobject]@{ Code = $LASTEXITCODE; Text = $output }
}
if([Environment]::UserInteractive -ne $true) { Stop-Fire 'interactive owner workstation required' }
if($env:CI -or $env:GITHUB_ACTIONS -or $env:TF_BUILD) { Stop-Fire 'CI or unattended execution refused' }
if(-not (Test-Path -LiteralPath $PackageZip -PathType Leaf)) {
  Stop-Fire ('exact private Drive ZIP must first be downloaded to: ' + $PackageZip)
}
$zip = (Get-Item -LiteralPath $PackageZip)
if($zip.Length -ne $expectedPackageBytes -or (ShaFile $zip.FullName) -ne $expectedPackageSha) {
  Stop-Fire 'DR ZIP bytes do not match the SHA256-verified private Drive/GitHub artifact'
}
if(Test-Path -LiteralPath $root) {
  Stop-Fire 'existing DR first-create workspace/attempt exists; do not delete it or retry automatically'
}
New-Item -ItemType Directory -Path $root | Out-Null
$source = Join-Path $root 'verified-original'
New-Item -ItemType Directory -Path $source | Out-Null
Expand-Archive -LiteralPath $zip.FullName -DestinationPath $source
$receiptPath = Join-Path $source 'current-dark-source-receipt.json'
$configPath = Join-Path $source 'server\wrangler.json'
if(-not (Test-Path -LiteralPath $receiptPath -PathType Leaf) -or -not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
  Stop-Fire 'wrong archive directory layout (missing current-source DR receipt/config)'
}
$receipt = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
$cfg = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
if($receipt.kind -ne 'FIRE_CURRENT_QA_MASTER_DARK_FIRST_CREATE_SOURCE_ONLY_V1' -or
   $receipt.target -ne 'dr' -or $receipt.worker -ne $worker -or
   $receipt.compiledSourceSha -ne $sourceSha -or
   $receipt.ownerRecordedPhysicalD1 -ne $dbId -or
   $receipt.actualClientAssetCount -ne 41 -or
   $receipt.providerContacted -ne $false -or
   $receipt.workerCreated -ne $false -or
   $receipt.workerDeployed -ne $false -or
   $receipt.firstCreateAuthorized -ne $false -or
   $receipt.ownerAuthenticationEnabled -ne $false) {
  Stop-Fire 'not the exact reviewed, still-unhosted QA-master DARK DR package'
}
$files = @(Get-ChildItem -LiteralPath $source -File -Recurse)
if($files.Count -ne ($receipt.packageFileInventory.Count + 1)) {
  Stop-Fire 'archive file count differs from signed-contents manifest'
}
foreach($entry in $receipt.packageFileInventory) {
  $rel = [string]$entry.path
  if($rel -notmatch '^[A-Za-z0-9._/-]+$' -or $rel.Contains('..') -or $rel.StartsWith('/')) {
    Stop-Fire 'unsafe or unknown archive entry path'
  }
  $file = Join-Path $source ($rel.Replace('/', '\'))
  if(-not (Test-Path -LiteralPath $file -PathType Leaf)) { Stop-Fire ('missing archived file ' + $rel) }
  $size = (Get-Item -LiteralPath $file).Length
  if($size -ne [int64]$entry.bytes -or (ShaFile $file) -ne [string]$entry.sha256) {
    Stop-Fire ('archived source integrity failure: ' + $rel)
  }
}
if($cfg.name -ne $worker -or $cfg.main -ne 'fire-noassets-entry.mjs' -or
   $cfg.no_bundle -ne $true -or $cfg.find_additional_modules -ne $true -or
   $cfg.preserve_file_names -ne $true -or
   $cfg.workers_dev -ne $false -or $cfg.preview_urls -ne $false -or
   $cfg.d1_databases.Count -ne 1 -or
   $cfg.d1_databases[0].binding -ne 'DB' -or
   $cfg.d1_databases[0].database_name -ne $dbName -or
   $cfg.d1_databases[0].database_id -ne $dbId -or
   $cfg.r2_buckets.Count -ne 0 -or
   $cfg.vars.FIRE_ENV -ne 'isolated-dr' -or
   $cfg.vars.FIRE_DR_AUTH_ENABLED -ne 'blocked' -or
   $cfg.vars.FIRE_PHOTO_STORAGE_MODE -ne 'owner-device-zip' -or
   $cfg.vars.SITE_ORIGIN -ne 'https://fire-fullapp-dr.kyle-bfc.workers.dev') {
  Stop-Fire 'wrong D1, routes, auth, storage, Worker runtime or original source config'
}
$expectedVars = @('FIRE_ENV','FIRE_DR_AUTH_ENABLED','FIRE_PHOTO_STORAGE_MODE','SITE_ORIGIN')
$actualVars = @($cfg.vars.PSObject.Properties.Name)
if(@(Compare-Object -ReferenceObject $expectedVars -DifferenceObject $actualVars).Count -ne 0) {
  Stop-Fire 'unreviewed runtime variable or potential Stripe/auth activation'
}
if(@(Compare-Object -ReferenceObject @('FIRE_DR_PASSWORD_HASH','FIRE_DR_SESSION_SECRET') -DifferenceObject @($cfg.secrets.required)).Count -ne 0) {
  Stop-Fire 'original future-only DR login secret names differ'
}
foreach($key in @('assets','route','routes','account_id','zone_id','legacy_env','env','migrations',
 'kv_namespaces','services','durable_objects','triggers','queues','workflows',
 'dispatch_namespaces','analytics_engine_datasets','hyperdrive','send_email',
 'tail_consumers','unsafe','vectorize','secrets_store_secrets')) {
  if(HasKey $cfg $key) {
    if($key -in @('assets','route','routes','account_id','zone_id','legacy_env','env') -or
       -not (IsInert $cfg.PSObject.Properties[$key].Value)) {
      Stop-Fire ('unapproved route, paid/binding, or other config field: ' + $key)
    }
  }
}
$entryPath = Join-Path $source 'server\fire-noassets-entry.mjs'
$entryText = [IO.File]::ReadAllText($entryPath)
if(-not $entryText.Contains('wrapInertDRWorker(server,manifest,"isolated-dr");')) {
  Stop-Fire 'Worker entry does not pin the locked isolated DR runtime'
}
# A brand-new dark Worker has no auth secrets yet. Cloudflare validates
# secrets.required even when every request is already locked HTTP 404.
# Do NOT create placeholder secrets or change any existing Worker. Prepare
# an out-of-place FIRST-CREATE config with only this future-only requirement omitted.
$deployRoot = Join-Path $root 'first-create-copy'
New-Item -ItemType Directory -Path $deployRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $source 'server') -Destination (Join-Path $deployRoot 'server') -Recurse
$liveConfig = Join-Path $deployRoot 'server\wrangler.json'
$createdCfg = Get-Content -LiteralPath $liveConfig -Raw | ConvertFrom-Json
$createdCfg.PSObject.Properties.Remove('secrets')
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($liveConfig,($createdCfg | ConvertTo-Json -Depth 75) + [Environment]::NewLine,$utf8)
$recheck = Get-Content -LiteralPath $liveConfig -Raw | ConvertFrom-Json
if((HasKey $recheck 'secrets') -or $recheck.workers_dev -ne $false -or
   $recheck.preview_urls -ne $false -or $recheck.vars.FIRE_DR_AUTH_ENABLED -ne 'blocked' -or
   $recheck.d1_databases[0].database_id -ne $dbId -or $recheck.name -ne $worker) {
  Stop-Fire 'first-create copy is not private, auth-blocked, physical-D1-bound Worker'
}
$overlayReceipt = [ordered]@{
  priorGitHubSource = $sourceSha
  originalOwnerDriveZipSha256 = $expectedPackageSha
  originalReviewedConfigSha256 = (ShaFile $configPath)
  oneTimeDarkFirstCreateConfigSha256 = (ShaFile $liveConfig)
  onlyChange = 'remove future-only required login-secret declaration from a NEW auth-blocked Worker'
  originalSourceUnchanged = $true
  noPaidR2 = $true
  noPublicRoutes = $true
  ownerAuthBlocked = $true
  stripeUnchanged = $true
  targetWorker = $worker
  targetD1 = $dbId
  remoteMutationAttempted = $false
}
$overlayPath = Join-Path $root 'owner-approved-first-create-overlay.json'
[IO.File]::WriteAllText($overlayPath,($overlayReceipt | ConvertTo-Json -Depth 30),$utf8)
$npx = Get-Command npx.cmd -ErrorAction SilentlyContinue
if($null -eq $npx) { Stop-Fire 'Node/npm npx.cmd is not available on Acer; no Cloudflare write attempted' }
$script:npxCmd = $npx.Source
$env:WRANGLER_SEND_METRICS = 'false'
if($env:CLOUDFLARE_ACCOUNT_ID -and $env:CLOUDFLARE_ACCOUNT_ID -ne $account) {
  Stop-Fire 'existing Cloudflare account override does not match owner-established account'
}
$version = Invoke-FireWrangler -wranglerArgs @('--version')
if($version.Code -ne 0 -or $version.Text -notmatch '4\.162\.0') {
  Stop-Fire 'Wrangler 4.162.0 not available; do not substitute an unreviewed version'
}
$who = Invoke-FireWrangler -wranglerArgs @('whoami','--json')
if($who.Code -ne 0 -or $who.Text -notmatch [regex]::Escape($account)) {
  Stop-Fire 'authenticated Wrangler membership in exact FIRE account not confirmed; no login loop or write'
}
$env:CLOUDFLARE_ACCOUNT_ID = $account
$info = Invoke-FireWrangler -wranglerArgs @('d1','info',$dbName,'--json')
if($info.Code -ne 0) { Stop-Fire 'existing target DR D1 identity not reachable read-only' }
try { $d1 = $info.Text | ConvertFrom-Json } catch { Stop-Fire 'D1 info JSON not readable' }
$foundId = $null
foreach($field in @('uuid','database_id','id')) {
  if(HasKey $d1 $field) { $foundId = [string]$d1.PSObject.Properties[$field].Value; break }
}
if($foundId -ne $dbId) { Stop-Fire 'remote DR D1 physical UUID differs from reviewed manifest; no write' }
$versions = Invoke-FireWrangler -wranglerArgs @('versions','list','--name',$worker,'--json')
if($versions.Code -eq 0) { Stop-Fire 'DR Worker already exists; creation-only approval cannot update an existing Worker' }
if($versions.Text -notmatch '10007' -or $versions.Text -notmatch '(?i)(does not exist|not found)') {
  Stop-Fire 'not an explicit Cloudflare Worker-absent 10007 result; do not guess or deploy'
}
$dryFolder = Join-Path $root 'offline-dry-run'
$dry = Invoke-FireWrangler -wranglerArgs @('deploy','--dry-run','--no-bundle','--config',$liveConfig,'--outdir',$dryFolder)
if($dry.Code -ne 0) {
  Stop-Fire ('offline no-bundle package validation failed. No Worker created. ' + $dry.Text)
}
Write-Host 'PASS: exact DR ZIP, 41 client assets, QA-master modules, physical DR D1, Cloudflare account, and dark first-create packaging.'
Write-Host 'Verified: worker absent; workers.dev OFF; version previews OFF; login BLOCKED; no Stripe/R2 or additional provider resources.'
$confirmation = Read-Host ("Type exactly: CREATE FIRE DR DARK " + $dbId)
if($confirmation -cne ("CREATE FIRE DR DARK " + $dbId)) {
  Stop-Fire 'operator declined exact authorized first-create command; no provider write'
}
# Save exclusive durable attempt lock BEFORE a possible Cloudflare write.
# Even network timeout/lost response must never trigger an automatic repeat.
$attempt = Join-Path $root 'REMOTE-FIRST-CREATE-ATTEMPT-LOCK.json'
$payload = [ordered]@{
  sourceSha=$sourceSha;originalZipSha256=$expectedPackageSha;worker=$worker
  physicalDrD1=$dbId;authorizedScope='FIRST CREATE ONLY, DARK, NO ROUTES/LOGIN/R2'
  utcStarted=[DateTime]::UtcNow.ToString('o')
  state='OUTCOME_UNCONFIRMED_NEVER_RETRY_AUTOMATICALLY'
}
$bytes = $utf8.GetBytes(($payload | ConvertTo-Json -Depth 12))
$fd = [IO.File]::Open($attempt,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try { $fd.Write($bytes,0,$bytes.Length); $fd.Flush($true) } finally { $fd.Dispose() }
Write-Host 'Attempt lock saved. Creating ONLY the brand-new dark DR Worker; do not run this command twice.'
& $script:npxCmd --yes 'wrangler@4.162.0' deploy --no-bundle --config $liveConfig
$deployExit = $LASTEXITCODE
if($deployExit -ne 0) {
  Stop-Fire ('Cloudflare first-create exit '+$deployExit+'. Whether a Worker was created is UNKNOWN. LOCK RETAINED: do not retry; inspect read-only.')
}
$after = Invoke-FireWrangler -wranglerArgs @('versions','list','--name',$worker,'--json')
if($after.Code -ne 0) {
  Stop-Fire 'write returned success but exact-hosted version is not yet confirmed; LOCK RETAINED, do not retry'
}
$completion = [ordered]@{
  result='ONE_APPROVED_DARK_DR_FIRST_CREATE_CLI_RETURNED_SUCCESS'
  sourceSha=$sourceSha;packageSha256=$expectedPackageSha;worker=$worker
  boundDRD1=$dbId;workersDevDisabledInSource=$true;previewUrlsDisabledInSource=$true
  authBlockedInSource=$true;secretsNotCreated=$true;r2NotEnabled=$true
  stripeUnchanged=$true;hostedVersionListReadbackSucceeded=$true
  liveReleaseAccepted=$false;gate4FullyAccepted=$false;gate10Accepted=$false
  utcCompleted=[DateTime]::UtcNow.ToString('o')
}
[IO.File]::WriteAllText((Join-Path $root 'FIRST-CREATE-CLI-SUCCESS-READBACK.json'),
  ($completion | ConvertTo-Json -Depth 15),$utf8)
Write-Host 'FIRE DR dark first-creation SUCCESS: first Worker exists; route/login disabled in reviewed config; no Gate 4 or LIVE acceptance claimed.'
Write-Host ('Keep the one-shot lock and receipt in: '+$root)
