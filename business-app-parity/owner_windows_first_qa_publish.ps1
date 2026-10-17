# First FULL FIRE Business App synthetic QA publication, never LIVE/staging/DR.
# No remote mutation by default. -Publish requires a fresh typed exact approval.
# Never paste the local DPAPI owner record, a secret or a verifier into ChatGPT.
[CmdletBinding()]
param([switch]$Publish)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$workerName = 'fire-fullapp-qa-20261016'
$qaName = 'fire-fullapp-qa-db-20261016'
$qaUuid = '8ccfb1f8-1657-4074-b1b2-47de78f95003'
$stagingName = 'fire-app-staging-db'
$stagingUuid = 'afb2c05a-d794-4a9a-b580-924ce01c26ad'
$qaOrigin = 'https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev'
$reviewedCandidateCommit = 'f650d25b18d23bc9f71a4d55c9322bfd5870ef75'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$candidate = Join-Path $env:LOCALAPPDATA ('FIRE-QA-Builds\qa-' + $reviewedCandidateCommit)
$manifest = Join-Path $candidate 'dist\server\wrangler.json'
$privateDir = Join-Path $env:LOCALAPPDATA 'FIRE-QA-Private'
$privateFile = Join-Path $privateDir 'qa-owner-secrets.xml'
$builtWrangler = Join-Path $candidate 'node_modules\.bin\wrangler.cmd'
# The pinned build Wrangler differs from the authenticated global CLI that
# successfully inspected the QA D1 on Acer. Use the working global CLI for
# BOTH read-only remote checks and any separately approved first publication.
$remoteWrangler = Get-Command 'wrangler.cmd' -ErrorAction SilentlyContinue
$verifySource = Join-Path $PSScriptRoot 'verify_materialized_candidate.py'
$verifyRuntime = Join-Path $PSScriptRoot 'check_qa_runtime_config.mjs'
$prepareDeploy = Join-Path $PSScriptRoot 'prepare_qa_deploy_config.mjs'
function Require([bool]$ok, [string]$message) {
    if (-not $ok) { throw ('FIRE QA STOP: ' + $message) }
}
function Require-Exit([string]$name) { Require ($LASTEXITCODE -eq 0) ($name + ' failed. STOP without publishing.') }
function Read-CheckedD1([string]$name, [string]$expectedUuid) {
    # Read-only individual database lookup; deliberately avoids the broken D1 list API.
    $raw = @(& $remoteWrangler.Source d1 info $name --json)
    Require-Exit ('Read-only D1 identity lookup for ' + $name)
    try { $info = ConvertFrom-Json -InputObject ($raw -join [Environment]::NewLine) }
    catch { throw 'FIRE QA STOP: Invalid read-only D1 response.' }
    Require ($info.name -ceq $name -and $info.uuid -ceq $expectedUuid) 'Cloudflare database UUID/name mismatch.'
}
Write-Host 'FIRE FULL-APP QA: first-Worker release review (NO WRITES by default)'
Require ($env:OS -eq 'Windows_NT' -and -not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) 'Owner Windows user profile required.'
$git = Get-Command 'git.exe' -ErrorAction SilentlyContinue
$node = Get-Command 'node.exe' -ErrorAction SilentlyContinue
$python = Get-Command 'python.exe' -ErrorAction SilentlyContinue
Require ($null -ne $git -and $null -ne $node -and $null -ne $python) 'Existing Git, Node and Python are required.'
$currentBranch = (& $git.Source -C $repo branch --show-current).Trim()
Require-Exit 'Read-only Git branch check'
Require ($currentBranch -ceq 'work/fire-business-app-parity-2026-10-08') 'Wrong working branch.'
$changes = @(& $git.Source -C $repo status --porcelain --untracked-files=no)
Require-Exit 'Read-only Git tracked files'
Require ($changes.Count -eq 0) 'Preserve uncommitted source changes and stop.'
Require ($null -ne $remoteWrangler) 'Authenticated global Wrangler CLI missing. No remote operation attempted.'
foreach ($path in @($candidate, $manifest, $privateFile, $verifySource, $verifyRuntime, $prepareDeploy, $builtWrangler)) {
    Require (Test-Path -LiteralPath $path) 'Expected pinned candidate, credential record, or verifier missing.'
}
Require ([IO.Path]::GetFullPath($remoteWrangler.Source) -cne
    [IO.Path]::GetFullPath($builtWrangler)) 'A separately installed global Wrangler is required for authenticated remote requests.'
Require (-not ((Get-Item -LiteralPath $candidate).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'QA candidate directory cannot be a symlink.'
& $python.Source $verifySource qa $candidate --built
Require-Exit 'Reverified exact full-app shared/QA adapter sources'
& $node.Source $verifyRuntime $manifest
Require-Exit 'Reverified compiled Worker identity, both required secrets, and isolated database'
$rawHelp = @(& $remoteWrangler.Source deploy --help)
Require-Exit 'Read-only Wrangler deploy help'
Require (($rawHelp -join [Environment]::NewLine) -match '--secrets-file') 'Pinned Wrangler must support one-step code+secret deployment.'
try { $record = Import-Clixml -LiteralPath $privateFile }
catch { throw 'FIRE QA STOP: Previously protected QA credentials are inaccessible. Do not regenerate them.' }
Require ($record.workerName -ceq $workerName -and $record.origin -ceq $qaOrigin -and
    $record.databaseName -ceq $qaName -and $record.databaseId -ceq $qaUuid) 'Original private QA metadata does not match the exact new Worker.'
Require ($record.passwordSha256 -cmatch '^[a-f0-9]{64}$' -and
    $record.sessionSigningSecret -is [Security.SecureString] -and
    $record.sessionSigningSecret.Length -ge 32) 'Previously prepared private login credentials are malformed.'
Read-CheckedD1 $qaName $qaUuid
Read-CheckedD1 $stagingName $stagingUuid
Write-Host ('PASS: Full QA source/compiled config verified, QA Worker ' + $workerName)
Write-Host ('PASS: Separate QA database ' + $qaUuid + '; older staging database identified read-only.')
Write-Host 'PASS: Existing private QA credentials checked in Windows profile (values hidden).'
if (-not $Publish) {
    Write-Host 'REVIEW ONLY PASS. No secrets uploaded; no Worker created or deployed.'
    Write-Host 'Publishing needs explicit separate approval of this exact synthetic-only Worker and two QA secrets.'
    $record = $null
    return
}

# The compiled manifest contains an obsolete legacy_env=true field rejected
# by global Wrangler 4.151. Preserve the original compiled manifest and create
# a disposable QA-only manifest BESIDE it, keeping entry/asset paths unchanged.
# Refuse legacy_env=false since that could change routing semantics.
$deployManifest = Join-Path (Split-Path -Parent $manifest) (
    'wrangler.fire-qa-firstpublish-' + [Guid]::NewGuid().ToString('D') + '.json')
try {
    & $node.Source $prepareDeploy $manifest $deployManifest
    Require-Exit 'QA-only Wrangler v4 manifest normalization'
    # Validate the exact config and compiled Worker LOCALLY before unpacking
    # credentials, probing Worker names, or asking for another approval.
    Push-Location $candidate
    try {
        & $remoteWrangler.Source deploy --dry-run --config $deployManifest --name $workerName
        Require-Exit 'Wrangler no-upload QA first-release dry run'
    } finally { Pop-Location }
    Write-Host 'PASS: Global Wrangler accepts disposable QA manifest in dry-run mode. No upload.'

# Cloudflare deployment changes a remote resource. Protect it with a fresh
# exact Worker-name collision check AND typed owner consent after all preflights.
# Windows PowerShell 5.1 converts native stderr into an ErrorRecord. With
# ErrorActionPreference=Stop, even Cloudflare's EXPECTED "does not exist" 10007
# may throw before the response is captured. Temporarily continue ONLY for
# this read-only probe, capturing the exact native exit code + all output.
# Never interpret other errors, network failures, or success as "available".
$oldErrorActionPreference = $ErrorActionPreference
$probeText = ''
$probeExitCode = $null
try {
    $ErrorActionPreference = 'Continue'
    $probe = @(& $remoteWrangler.Source deployments list --name $workerName 2>&1)
    $probeExitCode = $LASTEXITCODE
    $probeText = ($probe | Out-String)
} finally {
    $ErrorActionPreference = $oldErrorActionPreference
}
Require ($probeExitCode -is [int] -and $probeExitCode -ne 0 -and
    $probeText -match 'This Worker does not exist on your account' -and
    $probeText -match '\[code:\s*10007\]') 'Worker name is occupied or Cloudflare result ambiguous. Never overwrite.'
$approval = 'PUBLISH QA ' + $workerName + ' ' + $qaUuid + ' ' + $reviewedCandidateCommit
Write-Warning 'THIS WILL CREATE a NEW synthetic-only Cloudflare QA Worker and upload ONLY its two owner login secrets. NO existing Worker, D1 migration, Stripe, R2, DNS, or LIVE path.'
$typed = Read-Host ('To authorize this exact QA-only first publication, type ' + $approval)
Require ($typed -ceq $approval) 'Exact owner publication approval not provided; no Cloudflare write.'
# Save both private values in ONE access-restricted, temporary JSON secrets file
# under the owner's private Windows directory, never inside Git/the build.
# Wrangler --secrets-file uploads code + both secret values in the same deployment.
# Never replace or silently delete an earlier temporary secrets file. If a
# previous run left one behind, stop and investigate locally before proceeding.
$leftovers = @(Get-ChildItem -LiteralPath $privateDir -Filter 'qa-firstpublish-*.json' -File)
Require ($leftovers.Count -eq 0) 'An earlier QA temporary secrets file is still present. Stop and inspect locally before publishing.'
$secretFile = Join-Path $privateDir ('qa-firstpublish-' + [Guid]::NewGuid().ToString('N') + '.json')
$pointer = [IntPtr]::Zero
$secretClear = $null
$json = $null
$bytes = $null
$stream = $null
try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($record.sessionSigningSecret)
    $secretClear = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    Require (-not [string]::IsNullOrWhiteSpace($secretClear) -and $secretClear.Length -ge 32) 'Unable to decode existing protected QA session secret.'
    $json = ConvertTo-Json -Compress -InputObject ([ordered]@{
        FIRE_QA_PASSWORD_HASH = $record.passwordSha256
        FIRE_QA_SESSION_SECRET = $secretClear
    })
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes($json)
    # Do not create an unprotected file and attempt SetAccessControl on the
    # already-open stream: Windows denied that operation on the owner's Acer.
    # .NET Framework's 7-argument constructor applies the owner-only DACL
    # AT FILE CREATION. Do not write a single secret byte until read-back passes.
    $security = [Security.AccessControl.FileSecurity]::new()
    $security.SetAccessRuleProtection($true, $false)
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $rule = [Security.AccessControl.FileSystemAccessRule]::new($identity,
        [Security.AccessControl.FileSystemRights]::FullControl,
        [Security.AccessControl.AccessControlType]::Allow)
    $security.AddAccessRule($rule)
    $stream = [IO.FileStream]::new($secretFile,
        [IO.FileMode]::CreateNew,
        [Security.AccessControl.FileSystemRights]::Write,
        [IO.FileShare]::None, 4096, [IO.FileOptions]::None, $security)
    $stream.Dispose()
    $stream = $null
    $effective = [IO.File]::GetAccessControl($secretFile,
        [Security.AccessControl.AccessControlSections]::Access)
    Require ($effective.AreAccessRulesProtected) 'Temporary secrets file inherits permissions. Refusing to write any secrets.'
    $permissions = @($effective.GetAccessRules($true, $false,
        [Security.Principal.SecurityIdentifier]))
    Require ($permissions.Count -eq 1 -and
        $permissions[0].IdentityReference.Value -eq $identity.Value -and
        $permissions[0].AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and
        ($permissions[0].FileSystemRights -band [Security.AccessControl.FileSystemRights]::WriteData)) 'Temporary secrets file ACL is not owner-only. Refusing to write any secrets.'
    $stream = [IO.FileStream]::new($secretFile, [IO.FileMode]::Open,
        [IO.FileAccess]::Write, [IO.FileShare]::None)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
    $stream.Dispose()
    $stream = $null
    $record = $null
    $secretClear = $null
    $json = $null
    [Array]::Clear($bytes, 0, $bytes.Length)
    $bytes = $null
    Push-Location $candidate
    try {
        & $remoteWrangler.Source deploy --config $deployManifest --secrets-file $secretFile --name $workerName
        Require-Exit 'Isolated QA-only first Worker publication'
    } finally { Pop-Location }
    Write-Host ('PASS: QA Worker publication command succeeded: ' + $workerName)
    Write-Host 'Verify remote login and no-real-payments acceptance before advancing release gates.'
} finally {
    if ($null -ne $stream) { $stream.Dispose() }
    if ($null -ne $bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
    $record = $null
    $secretClear = $null
    $json = $null
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    if (Test-Path -LiteralPath $secretFile) {
        Remove-Item -LiteralPath $secretFile -Force
    }
}
} finally {
    if (Test-Path -LiteralPath $deployManifest -PathType Leaf) {
        Remove-Item -LiteralPath $deployManifest -Force
    }
}
