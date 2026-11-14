# FIRE QA private credential preparation for the isolated synthetic-only app.
# DRY RUN BY DEFAULT. Does NOT contact Cloudflare, deploy, migrate, log in, or
# provision a Worker. On Windows, Export-Clixml protects SecureString via
# Windows DPAPI bound to this user's login. Keep the original QA phrase private.
[CmdletBinding()]
param([switch]$Prepare)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$worker = 'fire-fullapp-qa-20261016'
$origin = 'https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev'
$db = 'fire-fullapp-qa-db-20261016'
$uuid = '8ccfb1f8-1657-4074-b1b2-47de78f95003'
Write-Host 'FIRE synthetic QA — separate private login preparation'
Write-Host "Worker: $worker"
Write-Host "QA D1 only: $db"
Write-Host "QA UUID: $uuid"
Write-Host "Exact planned QA origin (not yet deployed): $origin"
Write-Host 'Existing FIRE credentials, PINs and backups are NOT used here.'
if (-not $Prepare) {
    Write-Host 'DRY RUN ONLY. No passwords were requested or files created.'
    return
}
if ($env:OS -ne 'Windows_NT' -or -not $env:LOCALAPPDATA) {
    throw 'Private Windows user-bound DPAPI storage is required. Nothing created.'
}
$directory = Join-Path $env:LOCALAPPDATA 'FIRE-QA-Private'
$target = Join-Path $directory 'qa-owner-secrets.xml'
if (Test-Path -LiteralPath $target) {
    throw 'QA secret record already exists. Refusing to overwrite or rotate any credential.'
}
Write-Warning 'Choose a NEW unique 24-128 character QA-only passphrase you can remember or keep in a private password manager. DO NOT enter your real FIRE PIN, Stripe password or database key. Never screenshot or paste it in ChatGPT.'
$securePhrase = Read-Host 'Enter a NEW synthetic QA passphrase (input hidden)' -AsSecureString
if (-not $securePhrase) { throw 'A hidden QA passphrase is required.' }
$pointer = [IntPtr]::Zero
$clear = $null
try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePhrase)
    $clear = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if (-not $clear -or $clear.Length -lt 24 -or $clear.Length -gt 128) {
        throw 'QA passphrase must contain 24-128 characters. Nothing saved.'
    }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($clear)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = [System.BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()
    } finally { $sha.Dispose(); [Array]::Clear($bytes,0,$bytes.Length) }
} finally {
    $clear = $null
    if ($pointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}
$seed = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($seed) } finally { $rng.Dispose() }
$sessionString = [Convert]::ToBase64String($seed)
[Array]::Clear($seed,0,$seed.Length)
$session = ConvertTo-SecureString -String $sessionString -AsPlainText -Force
$sessionString = $null
$record = [pscustomobject]@{
    workerName = $worker
    origin = $origin
    databaseName = $db
    databaseId = $uuid
    passwordSha256 = $hash
    sessionSigningSecret = $session
    preparedUtc = [DateTime]::UtcNow.ToString('o')
}
if (-not (Test-Path -LiteralPath $directory)) {
    $null = New-Item -Path $directory -ItemType Directory -Force
}
# Export-Clixml serializes SecureString encrypted using Windows DPAPI.
# It never stores the plaintext QA passphrase; SHA256 is included because the
# app requires that verifier at deployment-time.
$record | Export-Clixml -LiteralPath $target -NoClobber
if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw 'Credential storage not confirmed.'
}
Write-Host 'QA-only credential preparation succeeded.'
Write-Host "Protected owner-only record: $target"
Write-Host 'No Cloudflare Worker created, no secrets uploaded, no D1 writes or migrations.'
Write-Host 'Your passphrase remains private. DO NOT share its text, hash, or the protected file here.'
Write-Host 'Next step requires a separately reviewed deployment/provisioning procedure.'
