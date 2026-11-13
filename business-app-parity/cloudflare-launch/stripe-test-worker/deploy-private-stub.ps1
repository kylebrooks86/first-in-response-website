# FIRE TEST-ONLY initial Worker publication. Owner-approved Nov 1, 2026.
# Deploy ONLY a deny-all Worker with NO public routes/previews and ONLY new empty TEST D1.
# No FIRE App, Stripe actions, schema migrations, existing environment changes or secrets.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$workerName = 'fire-stripe-test-20261101'
$dbName = 'fire-stripe-test-db-20261101'
$dbId = 'dba421ba-fc66-4cf8-9c31-51616f8249ba'
$sourceCommit = 'f577d62d2e8a864cc780384064ce8398f27592b7'
$base = "https://raw.githubusercontent.com/kylebrooks86/first-in-response-website/$sourceCommit/business-app-parity/cloudflare-launch/stripe-test-worker"
$dir = Join-Path $HOME 'FIRE-Stripe-Test-Worker-20261101'
if (Test-Path -LiteralPath $dir) {
    throw "STOP: isolated test directory already exists. Do not overwrite or redeploy."
}
$wrangler = Get-Command 'wrangler.cmd' -ErrorAction Stop
New-Item -ItemType Directory -Path $dir -ErrorAction Stop | Out-Null
$workerFile = Join-Path $dir 'index.mjs'
$configFile = Join-Path $dir 'wrangler.json'
Invoke-WebRequest -Uri "$base/index.mjs" -OutFile $workerFile -UseBasicParsing -ErrorAction Stop
Invoke-WebRequest -Uri "$base/wrangler.json" -OutFile $configFile -UseBasicParsing -ErrorAction Stop
$rawWorker = Get-Content -LiteralPath $workerFile -Raw -ErrorAction Stop
$config = Get-Content -LiteralPath $configFile -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
if ($config.name -cne $workerName -or $config.main -cne './index.mjs' -or
    $config.workers_dev -ne $false -or $config.preview_urls -ne $false -or
    @($config.routes).Count -ne 0 -or @($config.d1_databases).Count -ne 1 -or
    $config.d1_databases[0].binding -cne 'DB' -or
    $config.d1_databases[0].database_name -cne $dbName -or
    $config.d1_databases[0].database_id -cne $dbId -or
    @($config.PSObject.Properties.Name | Where-Object { $_ -in @('secrets','vars','r2_buckets','kv_namespaces','services','assets','triggers','zone_id','account_id') }).Count -ne 0 -or
    $rawWorker -notmatch 'FIRE Stripe test Worker disabled pending Access verification' -or
    $rawWorker -notmatch 'status: 403') {
    throw "STOP: source, public route, or physical D1 mapping failed. Nothing deployed."
}
Write-Host 'PREFLIGHT PASS: deny-all Worker, NO workers.dev/preview/routes, exact NEW isolated D1.'
Push-Location -LiteralPath $dir
try {
    & $wrangler.Source deploy --config $configFile
    if ($LASTEXITCODE -ne 0) { throw 'STOP: Worker publication was not confirmed.' }
} finally {
    Pop-Location
}
Write-Host 'DEPLOY COMMAND RETURNED SUCCESS: verify actual Worker version, exact D1 binding, and NO routes next.'
Write-Host 'Never enable public workers.dev until exact owner-only Access is installed and verified.'
