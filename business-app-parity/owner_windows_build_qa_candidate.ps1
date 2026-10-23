# Build a separate FULL FIRE Business App QA candidate on the owner's Acer.
# DRY RUN ONLY BY DEFAULT. -Build installs pinned packages and compiles LOCAL
# synthetic QA source; it NEVER creates, publishes or connects to a Worker.
# No production database, existing vault, Stripe, R2, DNS or Cloudflare write.
[CmdletBinding()]
param(
    [switch]$Build,
    [string]$CandidateBranch = 'work/fire-business-app-parity-2026-10-08',
    [string]$ExpectedCommit = ''
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$branch = $CandidateBranch
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$builder = Join-Path $PSScriptRoot 'materialize.py'
$verifier = Join-Path $PSScriptRoot 'verify_materialized_candidate.py'
$runtimeGuard = Join-Path $PSScriptRoot 'check_qa_runtime_config.mjs'
function Assert-True([bool]$OK, [string]$Message) {
    if (-not $OK) { throw ('FIRE QA STOP: ' + $Message) }
}
function Check-Exit([string]$Stage) {
    Assert-True ($LASTEXITCODE -eq 0) ($Stage + ' did not pass. No deploy or remote writes occurred.')
}
Assert-True ($branch -cmatch '^work/fire-[a-z0-9][a-z0-9-]{1,110}$') 'Only a named FIRE development branch may be built.'
Assert-True ([string]::IsNullOrEmpty($ExpectedCommit) -or $ExpectedCommit -cmatch '^[0-9a-f]{40}$') 'ExpectedCommit must be a full lowercase Git SHA.'
if ($branch -cne 'work/fire-business-app-parity-2026-10-08') {
    Assert-True ($ExpectedCommit -cmatch '^[0-9a-f]{40}$') 'A nonstandard candidate branch requires an explicitly reviewed exact commit.'
}
Write-Host 'FIRE isolated full-app QA builder: LOCAL ONLY'
Write-Host 'No database migrations, remote commands, Worker publication, credential upload or device vault changes.'
Assert-True ($env:OS -eq 'Windows_NT' -and -not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) 'Windows local account required.'
foreach ($p in @($builder, $verifier, $runtimeGuard)) {
    Assert-True (Test-Path -LiteralPath $p -PathType Leaf) 'Required reviewed QA build script missing.'
}
$git = Get-Command 'git.exe' -ErrorAction SilentlyContinue
Assert-True ($null -ne $git) 'Git required.'
$actualBranch = (& $git.Source -C $repo branch --show-current).Trim()
Check-Exit 'Read-only Git branch check'
Assert-True ($actualBranch -ceq $branch) 'Refusing wrong Git branch.'
$head = (& $git.Source -C $repo rev-parse HEAD).Trim()
Check-Exit 'Read-only Git HEAD check'
$originHead = (& $git.Source -C $repo rev-parse "refs/remotes/origin/$branch").Trim()
Check-Exit 'Read-only Git origin branch check'
Assert-True ($head -cmatch '^[0-9a-f]{40}$' -and $head -ceq $originHead) 'Git checkout must match last locally fetched working-branch commit. Run safe pull first if needed.'
if (-not [string]::IsNullOrEmpty($ExpectedCommit)) {
    Assert-True ($head -ceq $ExpectedCommit) 'Checked out Git commit differs from the explicitly reviewed candidate. Refusing an unreviewed build.'
}
$dirty = @(& $git.Source -C $repo status --porcelain --untracked-files=no)
Check-Exit 'Read-only Git tracked-file check'
Assert-True ($dirty.Count -eq 0) 'Tracked source files have local edits. Preserve them and stop.'
$node = Get-Command 'node.exe' -ErrorAction SilentlyContinue
$python = Get-Command 'python.exe' -ErrorAction SilentlyContinue
$pnpm = Get-Command 'pnpm.cmd' -ErrorAction SilentlyContinue
$corepack = Get-Command 'corepack.cmd' -ErrorAction SilentlyContinue
Assert-True ($null -ne $node) 'Node.js 22.13+ is needed for an exact QA candidate build.'
Assert-True ($null -ne $python) 'Python 3 is needed to materialize and fingerprint the isolated QA source.'
# Read the committed packageManager pin; never install or activate global tools
# on a dry run. Corepack is an allowed local invocation of the exact pnpm pin.
$sharedPackage = Join-Path $PSScriptRoot 'shared\package.json'
Assert-True (Test-Path -LiteralPath $sharedPackage -PathType Leaf) 'Shared candidate package.json missing.'
$packageSpec = (Get-Content -LiteralPath $sharedPackage -Raw | ConvertFrom-Json).packageManager
Assert-True ($packageSpec -ceq 'pnpm@11.25.0') 'QA package manager pin differs from the tested lockfile.'
$packageTool = $null
$packageArgs = @()
$nodeVersion = (& $node.Source -p 'process.versions.node').Trim()
Check-Exit 'Read-only Node version check'
Assert-True ([Version]$nodeVersion -ge [Version]'22.13.0') 'Node.js must be version 22.13.0 or newer.'
$pythonVersion = @(& $python.Source --version)
Check-Exit 'Read-only Python version check'
Assert-True (($pythonVersion -join '') -match '^Python 3\.') 'Python 3 required.'
if ($null -ne $pnpm) {
    $pnpmVersion = (& $pnpm.Source --version).Trim()
    Check-Exit 'Read-only pnpm version check'
    if ($pnpmVersion -ceq '11.25.0') {
        $packageTool = $pnpm
        Write-Host 'PASS: Exact pinned pnpm 11.25.0 already available.'
    }
}
if ($null -eq $packageTool) {
    Assert-True ($null -ne $corepack) 'No pinned pnpm or Corepack found; stop without installing tools automatically.'
    $corepackVersion = (& $corepack.Source --version).Trim()
    Check-Exit 'Read-only Corepack availability check'
    Assert-True ($corepackVersion -match '^\d+\.\d+\.\d+') 'Installed Corepack cannot report a valid version.'
    $packageTool = $corepack
    $packageArgs = @('pnpm')
    Write-Host 'PASS: Corepack available. Exact pnpm 11.25.0 is resolved only with -Build.'
}
$buildRoot = Join-Path $env:LOCALAPPDATA 'FIRE-QA-Builds'
$destination = Join-Path $buildRoot ('qa-' + $head)
Write-Host ('Reviewed Git branch: ' + $branch)
Write-Host ('Reviewed Git source: ' + $head)
Write-Host ('Candidate-only directory: ' + $destination)
if (-not $Build) {
    Write-Host 'DRY RUN PASS. Add -Build only if you want the local QA full-app candidate compiled.'
    Write-Host 'No files installed/copied; no remote actions.'
    return
}
Assert-True (-not (Test-Path -LiteralPath $destination)) 'Existing QA candidate directory must be preserved; refusing overwrite.'
# Only an explicit -Build may ask Corepack to acquire the pinned pnpm version.
# Run Corepack from the reviewed shared package root, not the unrelated repo root.
if ($packageArgs.Count -gt 0) {
    Push-Location (Join-Path $PSScriptRoot 'shared')
    try {
        $resolvedVersion = (& $packageTool.Source @packageArgs --version).Trim()
        Check-Exit 'Pinned Corepack pnpm resolution'
        Assert-True ($resolvedVersion -ceq '11.25.0') 'Corepack did not resolve required pnpm 11.25.0.'
    } finally { Pop-Location }
}
# This new source/build directory is separate from FIRE-QA-Private and the real
# Home Screen vault. It contains only cloned/verified synthetic candidate code.
if (-not (Test-Path -LiteralPath $buildRoot)) {
    $null = New-Item -ItemType Directory -Path $buildRoot -Force
}
& $python.Source $builder qa $destination
Check-Exit 'QA source materialization'
& $python.Source $verifier qa $destination
Check-Exit 'Exact source and adapter fingerprint'
Push-Location $destination
$oldFetch = $env:CLOUDFLARE_CF_FETCH_ENABLED
$oldMetrics = $env:WRANGLER_SEND_METRICS
try {
    $env:CLOUDFLARE_CF_FETCH_ENABLED = 'false'
    $env:WRANGLER_SEND_METRICS = 'false'
    & $packageTool.Source @packageArgs install --frozen-lockfile
    Check-Exit 'Pinned frozen package installation'
    & $packageTool.Source @packageArgs exec tsc --noEmit
    Check-Exit 'Full QA TypeScript check'
    & $packageTool.Source @packageArgs run build
    Check-Exit 'Full QA Worker build'
} finally {
    $env:CLOUDFLARE_CF_FETCH_ENABLED = $oldFetch
    $env:WRANGLER_SEND_METRICS = $oldMetrics
    Pop-Location
}
$manifest = Join-Path $destination 'dist\server\wrangler.json'
Assert-True (Test-Path -LiteralPath $manifest -PathType Leaf) 'Built QA Worker configuration missing.'
& $node.Source $runtimeGuard $manifest
Check-Exit 'Pinned Worker, isolated D1 and no-R2/no-Stripe manifest verification'
Write-Host 'PASS: Entire isolated QA Business App built, typechecked and pinned to its own D1.'
Write-Host ('Local candidate (NOT deployed): ' + $destination)
Write-Host 'NO secrets were read, generated or sent. No Worker was published.'
Write-Host 'Next release action requires separate owner approval, deployment safety review and secret provisioning.'
