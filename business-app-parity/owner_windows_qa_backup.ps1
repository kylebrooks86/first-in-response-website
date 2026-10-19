# FIRE QA D1 PRIVATE backup helper for owner-controlled Windows machines.
# DRY RUN BY DEFAULT. Explicit -Export plus typed full UUID are required.
# Does not deploy, execute SQL, apply migrations or restore a remote database.
# Export may temporarily interrupt hosted queries; choose a safe window.
[CmdletBinding()]
param(
  [switch]$Export,
  [string]$PrivateFolder = (Join-Path $env:USERPROFILE 'FIRE-Private-Backups')
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$target = 'fire-fullapp-qa-db-20261016'
$uuid = '8ccfb1f8-1657-4074-b1b2-47de78f95003'
$repoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$verifier = Join-Path $repoDir 'verify_qa_d1_export.py'
if (-not (Test-Path -LiteralPath $verifier -PathType Leaf)) {
  throw 'FIRE private verification scripts were not found. Open the current development repository first.'
}
Write-Host 'FIRE QA private D1 backup — no hosted writes or deployment.'
Write-Host ('Expected database: ' + $target)
Write-Host ('Expected D1 UUID: ' + $uuid)
Write-Host ('Owner-held backup folder: ' + $PrivateFolder)
Write-Warning 'The SQL backup will contain private customer/payment records. Keep it on an encrypted, access-controlled drive. Never upload it to GitHub, this chat or a public site.'
if (-not $Export) {
  Write-Host 'DRY RUN ONLY — no Cloudflare login, export or local file was created.'
  Write-Host 'Later, after reviewing the backup window, run this script with -Export to require full-UUID confirmation.'
  return
}
$consent = Read-Host ('Remote export can temporarily interrupt D1 queries. To approve export ONLY, type EXPORT ' + $uuid)
if ($consent -cne ('EXPORT ' + $uuid)) {
  throw 'Full database UUID confirmation was not supplied. No remote export attempted.'
}
$wrangler = Get-Command 'wrangler.cmd' -ErrorAction SilentlyContinue
$python = Get-Command 'python.exe' -ErrorAction SilentlyContinue
if ($null -eq $wrangler -or $null -eq $python) {
  throw 'Installed Wrangler CLI (wrangler.cmd) and Python (python.exe) are required. Nothing was exported. Install only after reviewing your setup.'
}
# Read-only inventory must confirm NAME AND UUID in the currently authenticated
# Cloudflare account. If parsing/identity fails, stop without exporting.
$raw = @(& $wrangler.Source d1 list --json 2>&1)
if ($LASTEXITCODE -ne 0) {
  throw 'Cloudflare read-only D1 inventory failed. Confirm Wrangler login and retry later.'
}
try {
  $parsedList = ConvertFrom-Json -InputObject ($raw -join [Environment]::NewLine)
  $list = @($parsedList)
} catch {
  throw 'Cloudflare D1 inventory format was unexpected. No export attempted.'
}
if ($list.Count -lt 1) {
  throw 'Cloudflare D1 inventory returned no database entries. No export attempted.'
}
$identityHelper = Join-Path $repoDir 'qa_d1_identity_from_list.ps1'
if (-not (Test-Path -LiteralPath $identityHelper -PathType Leaf)) { throw 'Strict QA identity helper missing.' }
$identity = & $identityHelper -Json ($raw -join [Environment]::NewLine)
if ($identity.qaName -cne $target -or $identity.qaUuid -cne $uuid) { throw 'Exact QA identity refused.' }
$worker = 'fire-fullapp-qa-20261016'
$activeVersion = '58a467fa-9dbc-45a3-971e-b5a4e478f54d'
function Confirm-QAVersion {
  $statusRaw = @(& $wrangler.Source deployments status --name $worker --json 2>&1)
  if ($LASTEXITCODE -ne 0) { throw 'Read-only QA Worker status failed.' }
  try { $status = ConvertFrom-Json -InputObject ($statusRaw -join [Environment]::NewLine) }
  catch { throw 'QA Worker metadata is not JSON.' }
  $versions = @($status.versions)
  if ($versions.Count -ne 1 -or $versions[0].version_id -cne $activeVersion -or $versions[0].percentage -ne 100 -or ($versions[0].percentage -isnot [int] -and $versions[0].percentage -isnot [long] -and $versions[0].percentage -isnot [double] -and $versions[0].percentage -isnot [decimal])) { throw 'QA Worker version/traffic changed. Stop.' }
}
Confirm-QAVersion
$folder = [System.IO.Path]::GetFullPath($PrivateFolder)
if (-not (Test-Path -LiteralPath $folder -PathType Container)) {
  New-Item -ItemType Directory -Path $folder -Force | Out-Null
}
# Never write export into the Git checkout; only an independently kept private
# folder. Fail closed on a preexisting backup filename instead of overwriting.
$repoFull = [System.IO.Path]::GetFullPath((Split-Path -Parent $repoDir))
if ($folder.TrimEnd('\') -eq $repoFull.TrimEnd('\') -or $folder.StartsWith(($repoFull.TrimEnd('\') + '\'),[StringComparison]::OrdinalIgnoreCase)) {
  throw 'Refusing to write a private SQL backup inside the Git repository.'
}
# Reject linked parent directories, including Windows junctions.
$walk = Get-Item -LiteralPath $folder
while ($null -ne $walk) {
  if ($walk.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked private folder refused.' }
  $walk = $walk.Parent
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$path = Join-Path $folder ('FIRE-QA-PRE0023-' + $stamp + '.sql')
if (Test-Path -LiteralPath $path) { throw 'Backup filename already exists; refusing overwrite.' }
# An explicit temporary configuration pins the exact owner-confirmed D1 UUID.
# It has no routes, secrets, bindings to LIVE, or publish capability.
$config = Join-Path $folder ('fire-private-export-' + $stamp + '.json')
$configJson = @{
  name='fire-d1-private-export-only'
  compatibility_date='2026-10-15'
  d1_databases=@(@{binding='DB';database_name=$target;database_id=$uuid})
} | ConvertTo-Json -Depth 6
if (Test-Path -LiteralPath $config) { throw 'Existing private export configuration refused.' }
[System.IO.File]::WriteAllText($config,$configJson,[System.Text.UTF8Encoding]::new($false))
Write-Warning 'Cloudflare may temporarily pause queries during export. Respond to Wranglers own confirmation only if the target shown is correct.'
try {
  & $wrangler.Source d1 export $target --remote "--config=$config" "--output=$path"
  $exportExit = $LASTEXITCODE
} finally {
  Remove-Item -LiteralPath $config -Force
}
Confirm-QAVersion
if ($exportExit -ne 0 -or -not (Test-Path -LiteralPath $path -PathType Leaf)) {
  throw 'Export was not confirmed. Do not treat any partial file as a backup.'
}
$file = Get-Item -LiteralPath $path
if ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked export refused.' }
if ($file.Length -le 0) { throw 'Export file is empty. Refusing backup acceptance.' }
$checksum = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host ('Private export created: ' + $file.FullName)
Write-Host ('Export bytes: ' + $file.Length)
Write-Host ('SHA-256: ' + $checksum)
Write-Host 'Running offline integrity/restore check. The SQL contents will never be displayed.'
$receipt = $path + '.restore-review.json'
if (Test-Path -LiteralPath $receipt) { throw 'Existing restore receipt refused.' }
& $python.Source $verifier $path --expected-sha256 $checksum | Tee-Object -FilePath $receipt
if ($LASTEXITCODE -ne 0) {
  throw 'Offline backup validation did NOT pass; keep the original SQL for owner review but do not use it to authorize a migration.'
}
Write-Host 'Private QA restore and exact 23-to-25 LOCAL rehearsal passed. No hosted migration or publication authorized.'
Write-Host 'Retain the SQL and hash privately on encrypted storage; independent source custody, remote schema capture and owner release approval remain required.'
