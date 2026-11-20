# FIRE: NEW dark DR Worker post-creation provider identity receipt (READ ONLY).
# Exactly 3 read-only Wrangler commands, no deploy/SQL/auth setup/Access/route/R2.
# This never repeats the already SUCCESSFUL first Worker creation.
# Default: offline/no provider. Explicit -Capture reads metadata only.
[CmdletBinding()]
param(
  [switch]$Capture,
  # Tests only; unavailable for ordinary owner execution.
  [string]$MockNpxCommand = ''
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$worker = 'fire-fullapp-dr'
$version = 'b7c42773-5a93-4c6c-91d2-83cdb8e857d9'
$db = 'fire-fullapp-dr-db'
$dbUuid = '5e55c5b7-cd67-4c8f-a52e-40f71b5d3145'
$expected = @{
  FIRE_ENV = 'isolated-dr'
  FIRE_DR_AUTH_ENABLED = 'blocked'
  FIRE_PHOTO_STORAGE_MODE = 'owner-device-zip'
  SITE_ORIGIN = 'https://fire-fullapp-dr.kyle-bfc.workers.dev'
}
$versionIdRe = '^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$'
function Block-Fire([string]$reason) { throw ('FIRE DR READ-ONLY STOP: ' + $reason) }
function Has-Field($obj,[string]$key) {
  if($null -eq $obj -or $obj -isnot [pscustomobject]) { return $false }
  return $null -ne $obj.PSObject.Properties[$key]
}
function Exact-Id($value,[string]$want) {
  return ($value -is [string] -and $value -match $versionIdRe -and
          $value.ToLowerInvariant() -ceq $want)
}
if(-not $Capture) {
  Write-Host 'FIRE DR post-create DRY RUN. No provider requests. First creation already complete.'
  return
}
if($env:CI -and -not $MockNpxCommand) {
  Block-Fire 'owner-only capture refuses unattended CI provider access'
}
if($MockNpxCommand -and ($env:CI -ne 'true' -or
    -not [IO.Path]::IsPathRooted($MockNpxCommand) -or
    -not (Test-Path -LiteralPath $MockNpxCommand -PathType Leaf))) {
  Block-Fire 'only existing local fake npx is allowed in isolated offline CI'
}
$npx = if($MockNpxCommand) {
  $MockNpxCommand
} else {
  $which = Get-Command npx.cmd -ErrorAction SilentlyContinue
  if($null -eq $which) { Block-Fire 'npx.cmd missing; no new login requested' }
  $which.Source
}
$script:npxCmd = $npx
$previousAccount=$env:CLOUDFLARE_ACCOUNT_ID
$exactAccount='bfc00939cfb2f8dfd8581a7a7f5f1307'
if(-not $MockNpxCommand -and $previousAccount -and $previousAccount -cne $exactAccount) {
  Block-Fire 'wrong selected Cloudflare account override; no provider read'
}
# No account switching, no authentication loop. The existing owner session
# is selected by the same ID used during the verified first-create.
$allowed=@(
 'deployments|status|--name|fire-fullapp-dr|--json',
 ('versions|view|'+$version+'|--name|fire-fullapp-dr|--json'),
 'd1|list|--json'
)
function Read-FireProvider([string[]]$readArgs) {
  $key=$readArgs -join '|'
  if($key -cnotin $allowed) { Block-Fire 'command outside 3-item read-only allowlist' }
  $originalPreference=$ErrorActionPreference
  try {
    $ErrorActionPreference='Continue'
    $messages=(& $script:npxCmd --yes 'wrangler@4.162.0' @readArgs 2>&1 | Out-String)
    $status=$LASTEXITCODE
  } finally {
    $ErrorActionPreference=$originalPreference
  }
  if($status -ne 0) { Block-Fire 'metadata read failed; no version identity claimed' }
  if($messages.Length -gt 600000) { Block-Fire 'oversized metadata refused' }
  try { $value=ConvertFrom-Json -InputObject $messages }
  catch { Block-Fire 'unsupported provider JSON response (not guessed)' }
  return ,$value
}
$status=Read-FireProvider -readArgs @('deployments','status','--name',$worker,'--json')
if(-not (Has-Field $status 'versions') -or @($status.versions).Count -ne 1) {
  Block-Fire 'no single current deployment version'
}
$deployed=@($status.versions)[0]
if(-not (Has-Field $deployed 'percentage') -or
   ($deployed.percentage -isnot [int] -and $deployed.percentage -isnot [long] -and
    $deployed.percentage -isnot [double]) -or $deployed.percentage -ne 100) {
  Block-Fire 'current version is not exactly 100 percent'
}
$activeVersion=if(Has-Field $deployed 'version_id') { $deployed.version_id }
  elseif(Has-Field $deployed 'id') { $deployed.id } else { $null }
if(-not (Exact-Id $activeVersion $version)) {
  Block-Fire 'active version differs from one-time owner-confirmed first-created version'
}
$detail=Read-FireProvider -readArgs @('versions','view',$version,'--name',$worker,'--json')
$id=if(Has-Field $detail 'id') { $detail.id }
  elseif(Has-Field $detail 'version_id') { $detail.version_id } else { $null }
if(-not (Exact-Id $id $version)) { Block-Fire 'version detail ID mismatch' }
$rootPresent=Has-Field $detail 'bindings'
$nestedPresent=(Has-Field $detail 'resources') -and (Has-Field $detail.resources 'bindings')
if($rootPresent -eq $nestedPresent) {
  Block-Fire 'version bindings missing or ambiguous'
}
$bindings=if($rootPresent) { @($detail.bindings) } else { @($detail.resources.bindings) }
if($bindings.Count -ne 5) { Block-Fire 'unexpected binding count; cannot prove dark DR identity' }
$byName=@{}
foreach($binding in $bindings) {
  if(-not (Has-Field $binding 'name') -or
     $binding.name -isnot [string] -or $byName.ContainsKey($binding.name)) {
    Block-Fire 'missing/duplicate binding name'
  }
  $byName[$binding.name]=$binding
}
if(@($byName.Keys | Where-Object { $_ -notin @('DB') -and -not $expected.ContainsKey($_) }).Count -gt 0) {
  Block-Fire 'unapproved extra binding (possible auth/Stripe/R2 resource)'
}
if(-not $byName.ContainsKey('DB')) { Block-Fire 'hosted DB missing' }
$actualDb=$byName['DB']
if((Has-Field $actualDb 'type') -eq $false -or
   $actualDb.type -cnotin @('d1','d1_database')) { Block-Fire 'hosted DB is not Cloudflare D1' }
$hostDbId=if(Has-Field $actualDb 'id') {$actualDb.id}
  elseif(Has-Field $actualDb 'database_id') {$actualDb.database_id} else {$null}
if(-not (Exact-Id $hostDbId $dbUuid)) { Block-Fire 'actual hosted version DB UUID mismatch' }
foreach($key in $expected.Keys) {
  if(-not $byName.ContainsKey($key)) { Block-Fire 'dark runtime variable missing' }
  $b=$byName[$key]
  if(-not (Has-Field $b 'type') -or $b.type -cne 'plain_text' -or
     -not (Has-Field $b 'text') -or $b.text -cne $expected[$key]) {
    Block-Fire 'actual hosted variable does not retain exact blocked dark value'
  }
}
$inventory=Read-FireProvider -readArgs @('d1','list','--json')
if($inventory -isnot [array] -or $inventory.Count -gt 10000) {
  Block-Fire 'D1 inventory unavailable or unsupported'
}
$matched=@($inventory | Where-Object { (Has-Field $_ 'name') -and $_.name -ceq $db })
$byUuid=@($inventory | Where-Object { (Has-Field $_ 'uuid') -and $_.uuid -ceq $dbUuid })
if($matched.Count -ne 1 -or $byUuid.Count -ne 1 -or $matched[0].uuid -cne $dbUuid) {
  Block-Fire 'independent account D1 name/UUID cross-check failed'
}
$label=if($MockNpxCommand) {'OFFLINE_MOCK_ONLY_NO_PROVIDER'} else {'FIRE_NEW_DR_DARK_VERSION_DB_BINDING_READ_ONLY_MATCH'}
# Sanitize strictly: NEVER output provider raw payload, credential, customer rows,
# secret values, raw Access JWTs or additional account database inventory.
$receipt=[ordered]@{
  result=$label
  worker=$worker
  ownerObservedVersionIdMatched=$version
  actualHostedD1UuidMatched=$dbUuid
  hostedEnv='isolated-dr'
  ownerAuthBlockedInVersion=$true
  cloudPhotoStoreAbsentOwnerZipOnly=$true
  workerDeployedOrModifiedByThisCheck=$false
  d1DatabaseReadOrModifiedByThisCheck=$false
  publicRoutesProviderVerified=$false
  accessPolicyProviderVerified=$false
  hostedSourceShaVerified=$false
  gate4Accepted=$false
  productionReady=$false
  releaseGatesAccepted=4
  releaseGatesTotal=10
}
$receipt | ConvertTo-Json -Depth 4
