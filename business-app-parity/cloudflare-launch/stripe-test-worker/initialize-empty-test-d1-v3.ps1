# Owner authorized Nov 1, 2026: ONE TIME initialization of NEW empty Stripe TEST D1 only.
# Stop on any unknown database identity, nonempty app schema or missing migration.
# Does not deploy Workers, update Access, configure Stripe, touch other D1s or DNS.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$expectedName = 'fire-stripe-test-db-20261101'
$expectedId = 'dba421ba-fc66-4cf8-9c31-51616f8249ba'
$expectedWorker = 'fire-stripe-test-20261101'
$immutableSource = '2cea49338b9f3a85e150cb871d5517636c3e858f'
$folder = Join-Path $HOME 'FIRE-Stripe-Test-Schema-Init-20261101-V3'
function STOP($message) { throw ('STOP - TEST D1 NOT INITIALIZED: ' + $message) }
function Member($obj, [string]$key) {
    if ($null -eq $obj) { return $null }
    $p = $obj.PSObject.Properties[$key]
    if ($null -eq $p) { return $null }
    return $p.Value
}
$wrangler = Get-Command 'wrangler.cmd' -ErrorAction Stop
if (Test-Path -LiteralPath $folder) {
    STOP 'Dedicated schema-init folder already exists. Do not repeat this one-time operation.'
}
# Fix V1: Wrangler 4.151 passes positional info input directly to the D1 UUID API route; using a name returned a 404 before any schema write. Query the exact UUID and then independently require the returned name+UUID to match.
$infoOutput = & $wrangler.Source d1 info $expectedId --json 2>$null
if ($LASTEXITCODE -ne 0) { STOP 'Physical-UUID D1 info failed; database identity unknown. No migration was applied.' }
try {
    $info = ($infoOutput | Out-String) | ConvertFrom-Json -ErrorAction Stop
} catch { STOP 'Cannot parse Wrangler remote D1 info as JSON.' }
$actualName = Member $info 'name'
$actualId = Member $info 'uuid'
if (-not $actualId) { $actualId = Member $info 'id' }
if (-not $actualId) { $actualId = Member $info 'database_id' }
if ($actualName -cne $expectedName -or $actualId -cne $expectedId) {
    STOP ("Remote physical D1 mismatch. Expected {0} / {1}; got {2} / {3}" -f $expectedName,$expectedId,$actualName,$actualId)
}
Write-Host ('PASS: independently identified remote TEST database {0} ({1})' -f $actualName,$actualId)
# Create a NEW private working folder and materialize the exact approved 25 migrations
# from the commit whose source-only CI passed (not the moving branch HEAD).
New-Item -ItemType Directory -Path $folder | Out-Null
$migrationFolder = Join-Path $folder 'migrations'
New-Item -ItemType Directory -Path $migrationFolder | Out-Null
$configUrl = "https://raw.githubusercontent.com/kylebrooks86/first-in-response-website/$immutableSource/business-app-parity/cloudflare-launch/stripe-test-worker/wrangler.json"
$configPath = Join-Path $folder 'wrangler.json'
$workerPath = Join-Path $folder 'index.mjs'
Invoke-WebRequest -Uri $configUrl -OutFile $configPath -UseBasicParsing -ErrorAction Stop
Invoke-WebRequest -Uri ("https://raw.githubusercontent.com/kylebrooks86/first-in-response-website/$immutableSource/business-app-parity/cloudflare-launch/stripe-test-worker/index.mjs") -OutFile $workerPath -UseBasicParsing -ErrorAction Stop
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json -ErrorAction Stop
if ($config.name -cne $expectedWorker -or $config.workers_dev -ne $false -or
    $config.preview_urls -ne $false -or @($config.routes).Count -ne 0 -or
    @($config.d1_databases).Count -ne 1 -or
    $config.d1_databases[0].binding -cne 'DB' -or
    $config.d1_databases[0].database_name -cne $expectedName -or
    $config.d1_databases[0].database_id -cne $expectedId) {
    STOP 'Immutable source Wrangler config does not point EXCLUSIVELY to isolated TEST D1.'
}
$config.d1_databases[0] | Add-Member -NotePropertyName migrations_dir -NotePropertyValue './migrations' -Force
[System.IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json -Depth 15), (New-Object System.Text.UTF8Encoding($false)))
$api = "https://api.github.com/repos/kylebrooks86/first-in-response-website/contents/business-app-parity/adapters/doomsday/drizzle?ref=$immutableSource"
# V3 fixes PowerShell 5.1 Invoke-RestMethod's array-as-a-single-pipeline-object behavior.
# Assign the returned JSON array to a variable FIRST and explicitly flatten it.
$rawDirectory = Invoke-RestMethod -Uri $api -Headers @{ 'User-Agent' = 'FIRE-Stripe-Test-Schema-Init' } -ErrorAction Stop
$entries = New-Object 'System.Collections.Generic.List[object]'
foreach ($item in $rawDirectory) {
    if ($item -is [System.Array]) {
        foreach ($nested in $item) { [void]$entries.Add($nested) }
    } else {
        [void]$entries.Add($item)
    }
}
$sqlFiles = @($entries.ToArray() | Where-Object { $_.type -eq 'file' -and $_.name -match '^[0-9]{4}_.+\.sql$' } | Sort-Object -Property name)
if ($sqlFiles.Count -ne 25) { STOP ('Expected 25 pinned SQL migrations; found ' + $sqlFiles.Count) }
foreach ($n in 0..24) {
    $prefix = '{0:D4}_' -f $n
    $files = @($sqlFiles | Where-Object { $_.name.StartsWith($prefix) })
    if ($files.Count -ne 1) { STOP ('Missing/duplicate immutable migration ' + $prefix) }
}
foreach ($file in $sqlFiles) {
    $remote = "https://raw.githubusercontent.com/kylebrooks86/first-in-response-website/$immutableSource/business-app-parity/adapters/doomsday/drizzle/$($file.name)"
    $target = Join-Path $migrationFolder $file.name
    Invoke-WebRequest -Uri $remote -OutFile $target -UseBasicParsing -ErrorAction Stop
    if ((Get-Item -LiteralPath $target).Length -lt 20) { STOP ('Empty/suspicious migration ' + $file.name) }
}
Write-Host 'PASS: all 25 migrations fetched from immutable CI-verified source. No remote schema write yet.'
function QueryOne([string]$sql, [string]$column) {
    $output = & $wrangler.Source d1 execute $expectedName --remote --config $configPath --command $sql --json 2>$null
    if ($LASTEXITCODE -ne 0) { STOP ('Remote read-only D1 query failed: ' + $column) }
    try { $parsed = ($output | Out-String) | ConvertFrom-Json -ErrorAction Stop }
    catch { STOP ('Remote read-only D1 JSON parse failed: ' + $column) }
    $pages = @($parsed)
    if ($pages.Count -ne 1 -or (Member $pages[0] 'success') -ne $true) {
        STOP ('Remote D1 result not an unambiguous successful response: ' + $column)
    }
    $rows = @(Member $pages[0] 'results')
    if ($rows.Count -ne 1) { STOP ('Remote D1 did not return exactly one row: ' + $column) }
    $value = Member $rows[0] $column
    if ($null -eq $value) { STOP ('Missing remote D1 column: ' + $column) }
    return $value
}
$beforeTables = QueryOne "SELECT COUNT(*) AS app_tables FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_cf_KV'" 'app_tables'
$beforeSchema = QueryOne "SELECT COUNT(*) AS named_objects FROM sqlite_master WHERE type IN ('index','trigger','view') AND name NOT LIKE 'sqlite_%'" 'named_objects'
if ([int]$beforeTables -ne 0 -or [int]$beforeSchema -ne 0) {
    STOP ("Remote database is not pristine. App tables=$beforeTables other objects=$beforeSchema. No migration applied.")
}
Write-Host 'PASS: actual remote TEST D1 is pristine (0 application tables, 0 indexes/triggers/views).'
Push-Location -LiteralPath $folder
try {
    & $wrangler.Source d1 migrations list $expectedName --remote --config $configPath
    if ($LASTEXITCODE -ne 0) { STOP 'Remote migration preview failed.' }
    Write-Host 'Owner-approved isolated TEST schema initialization starting. No other D1 is targeted.'
    & $wrangler.Source d1 migrations apply $expectedName --remote --config $configPath
    if ($LASTEXITCODE -ne 0) { STOP 'Wrangler reported migration failure; STOP. Do not rerun automatically.' }
} finally {
    Pop-Location
}
$applied = QueryOne "SELECT COUNT(*) AS applied FROM d1_migrations" 'applied'
$tables = QueryOne "SELECT COUNT(*) AS required FROM sqlite_master WHERE type='table' AND name IN ('customers','estimates','invoices','payments','payment_refunds','payment_checkout_sessions','deposit_policy_events','deposit_agreement_snapshots')" 'required'
$idx = QueryOne "SELECT COUNT(*) AS unique_idx FROM sqlite_master WHERE type='index' AND name='idx_payments_stripe_provider_unique'" 'unique_idx'
$records = QueryOne "SELECT ((SELECT COUNT(*) FROM customers)+(SELECT COUNT(*) FROM estimates)+(SELECT COUNT(*) FROM invoices)+(SELECT COUNT(*) FROM payments)+(SELECT COUNT(*) FROM payment_refunds)) AS records" 'records'
if ([int]$applied -ne 25 -or [int]$tables -ne 8 -or [int]$idx -ne 1 -or [int]$records -ne 0) {
    STOP ("Remote postflight mismatch, STOP: migrations=$applied tables=$tables index=$idx records=$records. Do not repeat.")
}
Write-Host 'PASS: NEW remote Stripe TEST D1 initialized with 25 migrations; all required tables/index present, 0 customer/payment/refund records.'
Write-Host ('VERIFIED ONLY: {0} ({1}). No app deploy, no Stripe, no LIVE/QA/staging modifications.' -f $expectedName,$expectedId)
 } | Sort-Object -Property name)
if ($sqlFiles.Count -ne 25) { STOP ('Expected 25 pinned SQL migrations; found ' + $sqlFiles.Count) }
foreach ($n in 0..24) {
    $prefix = '{0:D4}_' -f $n
    $files = @($sqlFiles | Where-Object { $_.name.StartsWith($prefix) })
    if ($files.Count -ne 1) { STOP ('Missing/duplicate immutable migration ' + $prefix) }
}
foreach ($file in $sqlFiles) {
    $remote = "https://raw.githubusercontent.com/kylebrooks86/first-in-response-website/$immutableSource/business-app-parity/adapters/doomsday/drizzle/$($file.name)"
    $target = Join-Path $migrationFolder $file.name
    Invoke-WebRequest -Uri $remote -OutFile $target -UseBasicParsing -ErrorAction Stop
    if ((Get-Item -LiteralPath $target).Length -lt 20) { STOP ('Empty/suspicious migration ' + $file.name) }
}
Write-Host 'PASS: all 25 migrations fetched from immutable CI-verified source. No remote schema write yet.'
function QueryOne([string]$sql, [string]$column) {
    $output = & $wrangler.Source d1 execute $expectedName --remote --config $configPath --command $sql --json 2>$null
    if ($LASTEXITCODE -ne 0) { STOP ('Remote read-only D1 query failed: ' + $column) }
    try { $parsed = ($output | Out-String) | ConvertFrom-Json -ErrorAction Stop }
    catch { STOP ('Remote read-only D1 JSON parse failed: ' + $column) }
    $pages = @($parsed)
    if ($pages.Count -ne 1 -or (Member $pages[0] 'success') -ne $true) {
        STOP ('Remote D1 result not an unambiguous successful response: ' + $column)
    }
    $rows = @(Member $pages[0] 'results')
    if ($rows.Count -ne 1) { STOP ('Remote D1 did not return exactly one row: ' + $column) }
    $value = Member $rows[0] $column
    if ($null -eq $value) { STOP ('Missing remote D1 column: ' + $column) }
    return $value
}
$beforeTables = QueryOne "SELECT COUNT(*) AS app_tables FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_cf_KV'" 'app_tables'
$beforeSchema = QueryOne "SELECT COUNT(*) AS named_objects FROM sqlite_master WHERE type IN ('index','trigger','view') AND name NOT LIKE 'sqlite_%'" 'named_objects'
if ([int]$beforeTables -ne 0 -or [int]$beforeSchema -ne 0) {
    STOP ("Remote database is not pristine. App tables=$beforeTables other objects=$beforeSchema. No migration applied.")
}
Write-Host 'PASS: actual remote TEST D1 is pristine (0 application tables, 0 indexes/triggers/views).'
Push-Location -LiteralPath $folder
try {
    & $wrangler.Source d1 migrations list $expectedName --remote --config $configPath
    if ($LASTEXITCODE -ne 0) { STOP 'Remote migration preview failed.' }
    Write-Host 'Owner-approved isolated TEST schema initialization starting. No other D1 is targeted.'
    & $wrangler.Source d1 migrations apply $expectedName --remote --config $configPath
    if ($LASTEXITCODE -ne 0) { STOP 'Wrangler reported migration failure; STOP. Do not rerun automatically.' }
} finally {
    Pop-Location
}
$applied = QueryOne "SELECT COUNT(*) AS applied FROM d1_migrations" 'applied'
$tables = QueryOne "SELECT COUNT(*) AS required FROM sqlite_master WHERE type='table' AND name IN ('customers','estimates','invoices','payments','payment_refunds','payment_checkout_sessions','deposit_policy_events','deposit_agreement_snapshots')" 'required'
$idx = QueryOne "SELECT COUNT(*) AS unique_idx FROM sqlite_master WHERE type='index' AND name='idx_payments_stripe_provider_unique'" 'unique_idx'
$records = QueryOne "SELECT ((SELECT COUNT(*) FROM customers)+(SELECT COUNT(*) FROM estimates)+(SELECT COUNT(*) FROM invoices)+(SELECT COUNT(*) FROM payments)+(SELECT COUNT(*) FROM payment_refunds)) AS records" 'records'
if ([int]$applied -ne 25 -or [int]$tables -ne 8 -or [int]$idx -ne 1 -or [int]$records -ne 0) {
    STOP ("Remote postflight mismatch, STOP: migrations=$applied tables=$tables index=$idx records=$records. Do not repeat.")
}
Write-Host 'PASS: NEW remote Stripe TEST D1 initialized with 25 migrations; all required tables/index present, 0 customer/payment/refund records.'
Write-Host ('VERIFIED ONLY: {0} ({1}). No app deploy, no Stripe, no LIVE/QA/staging modifications.' -f $expectedName,$expectedId)
