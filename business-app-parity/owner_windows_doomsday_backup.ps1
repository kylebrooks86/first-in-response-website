# FIRE Doomsday D1 PRIVATE backup helper for owner-controlled Windows machines.
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
$target = 'fire-app-staging-db'
$uuid = 'afb2c05a-d794-4a9a-b580-924ce01c26ad'
$repoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$verifier = Join-Path $repoDir 'verify_doomsday_d1_export.py'
$rehearsal = Join-Path $repoDir 'rehearse_doomsday_0022_export.py'
if (-not (Test-Path -LiteralPath $verifier -PathType Leaf) -or -not (Test-Path -LiteralPath $rehearsal -PathType Leaf)) {
  throw 'FIRE private verification scripts were not found. Open the current development repository first.'
}
Write-Host 'FIRE Doomsday private D1 backup — no hosted writes or deployment.'
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
$python = Get-Command 'py.exe' -ErrorAction SilentlyContinue
if ($null -eq $wrangler -or $null -eq $python) {
  throw 'Installed Wrangler CLI (wrangler.cmd) and Python launcher (py.exe) are required. Nothing was exported. Install only after reviewing your setup.'
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
$foundDb = @($list | Where-Object { $_.name -ceq $target -and $_.uuid -ceq $uuid })
if ($foundDb.Count -ne 1) {
  throw 'Cloudflare account did not report exactly one matching Doomsday D1 name AND full UUID. No export attempted.'
}
$folder = [System.IO.Path]::GetFullPath($PrivateFolder)
if (-not (Test-Path -LiteralPath $folder -PathType Container)) {
  New-Item -ItemType Directory -Path $folder -Force | Out-Null
}
# Never write export into the Git checkout; only an independently kept private
# folder. Fail closed on a preexisting backup filename instead of overwriting.
$repoFull = [System.IO.Path]::GetFullPath($repoDir)
if ($folder.TrimEnd('\') -eq $repoFull.TrimEnd('\') -or $folder.StartsWith(($repoFull.TrimEnd('\') + '\'),[StringComparison]::OrdinalIgnoreCase)) {
  throw 'Refusing to write a private SQL backup inside the Git repository.'
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$path = Join-Path $folder ('FIRE-DOOMSDAY-PRE0022-' + $stamp + '.sql')
if (Test-Path -LiteralPath $path) { throw 'Backup filename already exists; refusing overwrite.' }
# An explicit temporary configuration pins the exact owner-confirmed D1 UUID.
# It has no routes, secrets, bindings to LIVE, or publish capability.
$config = Join-Path $folder ('fire-private-export-' + $stamp + '.json')
$configJson = @{
  name='fire-d1-private-export-only'
  compatibility_date='2026-10-15'
  d1_databases=@(@{binding='DB';database_name=$target;database_id=$uuid})
} | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($config,$configJson,[System.Text.UTF8Encoding]::new($false))
Write-Warning 'Cloudflare may temporarily pause queries during export. Respond to Wranglers own confirmation only if the target shown is correct.'
& $wrangler.Source d1 export $target --remote "--config=$config" "--output=$path"
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $path -PathType Leaf)) {
  throw 'Export was not confirmed. Do not treat any partial file as a backup.'
}
$file = Get-Item -LiteralPath $path
if ($file.Length -le 0) { throw 'Export file is empty. Refusing backup acceptance.' }
$checksum = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host ('Private export created: ' + $file.FullName)
Write-Host ('Export bytes: ' + $file.Length)
Write-Host ('SHA-256: ' + $checksum)
Write-Host 'Running offline integrity/restore check. The SQL contents will never be displayed.'
& $python.Source -3 $verifier $path --expected-sha256 $checksum
if ($LASTEXITCODE -ne 0) {
  throw 'Offline backup validation did NOT pass; keep the original SQL for owner review but do not use it to authorize a migration.'
}
& $python.Source -3 $rehearsal $path --expected-sha256 $checksum
if ($LASTEXITCODE -ne 0) {
  throw 'In-memory 0022 rehearsal did NOT pass; no hosted migration was run. Retain private export for owner review.'
}
Write-Host 'LOCAL backup/restore/index rehearsal passed. This is NOT hosted migration approval, writer quiescence, Gate 5 acceptance or a tested remote rollback.'
Write-Host 'Keep the file private, verify independent secure retention, and obtain separate owner authorization before ANY actual migration.'
