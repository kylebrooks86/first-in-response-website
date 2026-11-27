# FIRE STAGING owner-only credential preparation — OFFLINE, Windows only.
# DRY RUN by default. Creates no Cloudflare token, Worker version, route,
# database migration, payment event or deployment.
# Never share the passphrase, SHA-256 digest or protected file with ChatGPT.
[CmdletBinding()]
param([switch]$Prepare)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$worker = 'fire-app-independent-staging'
$db = 'afb2c05a-d794-4a9a-b580-924ce01c26ad'
$secretName = 'FIRE_ADMIN_PASSWORD_HASH'
Write-Host 'FIRE independent STAGING private admin credential'
Write-Host "Target Worker: $worker"
Write-Host "Target D1 identity is pinned: $db"
Write-Host "Secret NAME only: $secretName"
Write-Host 'This tool does not access Cloudflare, Stripe, or your database.'
if (-not $Prepare) {
  Write-Host 'DRY RUN ONLY: no credential prompt, storage, Worker change or deployment.'
  return
}
if ($env:OS -ne 'Windows_NT' -or -not $env:LOCALAPPDATA) {
  throw 'STOP: Windows user-bound DPAPI protection is required.'
}
$folder = Join-Path $env:LOCALAPPDATA 'FIRE-STAGING-Private'
$file = Join-Path $folder 'staging-admin-hash-dpapi.xml'
if (Test-Path -LiteralPath $file) {
  throw 'STOP: existing staging credential record; refusing overwrite or rotation.'
}
Write-Warning 'Enter a NEW unique 24–128-character STAGING-only passphrase. Never reuse your existing FIRE PIN, QA passphrase, Cloudflare password or Stripe password.'
Write-Warning 'No plaintext, hash, or screenshot of the secret should be shared in chat.'
$first = Read-Host 'New STAGING-only private passphrase' -AsSecureString
$second = Read-Host 'Confirm STAGING-only private passphrase' -AsSecureString
if (-not $first -or -not $second) { throw 'STOP: credential not supplied.' }

$one = [IntPtr]::Zero
$two = [IntPtr]::Zero
$plain = $null
$confirm = $null
$hash = $null
$protectedHash = $null
try {
  $one = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
  $two = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($one)
  $confirm = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($two)
  if (-not $plain -or $plain.Length -lt 24 -or $plain.Length -gt 128) {
    throw 'STOP: STAGING passphrase must contain 24–128 characters.'
  }
  if (-not [string]::Equals($plain,$confirm,[StringComparison]::Ordinal)) {
    throw 'STOP: passphrase confirmation mismatch; nothing written.'
  }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($plain)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hash = [System.BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()
  } finally {
    $sha.Dispose()
    [Array]::Clear($bytes,0,$bytes.Length)
  }
  # The application verifies the SHA256 hex string itself. Store ONLY that
  # verifier encrypted with owner-user DPAPI; never persist the plaintext.
  $protectedHash = ConvertTo-SecureString -String $hash -AsPlainText -Force
  $record = [pscustomobject]@{
    targetWorker = $worker
    expectedDatabaseId = $db
    secretName = $secretName
    hashVerifier = $protectedHash
    preparedUtc = [DateTime]::UtcNow.ToString('o')
    uploadedToProvider = $false
    deploymentAuthorized = $false
  }
  if (-not (Test-Path -LiteralPath $folder)) {
    $null = New-Item -ItemType Directory -Path $folder -Force -ErrorAction Stop
  }
  $record | Export-Clixml -LiteralPath $file -NoClobber -ErrorAction Stop
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    throw 'STOP: local DPAPI record could not be verified.'
  }
  Write-Host 'PASS: STAGING-only admin verifier prepared in owner-bound encrypted local record.'
  Write-Host 'No Cloudflare API calls, new Worker version, deployment, migration or payment change.'
  Write-Host 'An exact, separately authorized inactive-version procedure is needed to install it.'
} finally {
  if ($one -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($one) }
  if ($two -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($two) }
  $plain = $null
  $confirm = $null
  $hash = $null
  $protectedHash = $null
  Remove-Variable first,second,record -ErrorAction SilentlyContinue
}
