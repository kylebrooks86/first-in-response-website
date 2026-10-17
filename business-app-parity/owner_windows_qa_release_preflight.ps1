# FIRE full Business App: non-destructive QA launch preflight on the owner's Windows laptop.
# Run ONLY as a read-only check. No -Apply, deployment, migration, secret upload or
# alteration of DPAPI-protected owner credentials exists in this script.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$qaWorker = 'fire-fullapp-qa-20261016'
$qaName = 'fire-fullapp-qa-db-20261016'
$qaUuid = '8ccfb1f8-1657-4074-b1b2-47de78f95003'
$protectedName = 'fire-app-staging-db'
$protectedUuid = 'afb2c05a-d794-4a9a-b580-924ce01c26ad'
$origin = 'https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev'
$configPath = Join-Path $PSScriptRoot 'wrangler.qa-migrations.json'
$privatePath = Join-Path $env:LOCALAPPDATA 'FIRE-QA-Private\qa-owner-secrets.xml'

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw ('FIRE QA STOP: ' + $Message) }
}
function Read-Json([string[]]$Lines, [string]$Description) {
    Assert-True ($LASTEXITCODE -eq 0) ($Description + ' command failed.')
    try { return ConvertFrom-Json -InputObject ($Lines -join [Environment]::NewLine) }
    catch { throw ('FIRE QA STOP: ' + $Description + ' returned invalid JSON; do not continue.') }
}

Write-Host 'FIRE QA full-app launch preflight: READ ONLY'
Write-Host 'No database writes, schema migrations, Worker deployments or credential uploads.'
Assert-True ($env:OS -eq 'Windows_NT' -and -not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) 'Use the original Acer Windows account holding the protected credential record.'
Assert-True (Test-Path -LiteralPath $configPath -PathType Leaf) 'QA-only migration identity configuration missing.'
Assert-True (Test-Path -LiteralPath $privatePath -PathType Leaf) 'Previously prepared QA-only private credential record missing. Do not regenerate/overwrite it.'
$cfg = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
Assert-True ($cfg.name -ceq $qaWorker) 'QA Worker identity mismatch.'
Assert-True (@($cfg.d1_databases).Count -eq 1) 'Exactly one QA D1 binding required.'
Assert-True (@($cfg.PSObject.Properties.Name | Where-Object { $_ -notin @('name','compatibility_date','d1_databases') }).Count -eq 0) 'QA configuration contains unexpected fields.'
$binding = @($cfg.d1_databases)[0]
Assert-True ($binding.binding -ceq 'DB' -and $binding.database_name -ceq $qaName -and
    $binding.database_id -ceq $qaUuid -and
    $binding.migrations_dir -ceq 'adapters/doomsday/drizzle' -and
    $binding.migrations_table -ceq 'd1_migrations') 'Wrong database or unreviewed schema binding.'

# Importing local DPAPI metadata does NOT decrypt, display or transmit secrets.
# This also fails closed if the file cannot be opened under the original user.
try { $record = Import-Clixml -LiteralPath $privatePath }
catch { throw 'FIRE QA STOP: Credential record cannot be opened in this Windows profile; do not re-create it.' }
Assert-True ($record.workerName -ceq $qaWorker -and $record.origin -ceq $origin -and
    $record.databaseName -ceq $qaName -and $record.databaseId -ceq $qaUuid) 'Stored QA-only credential metadata does not match the new Worker/DB.'
Assert-True ($record.passwordSha256 -cmatch '^[a-f0-9]{64}$') 'Stored QA verifier metadata malformed.'
Assert-True ($record.sessionSigningSecret -is [System.Security.SecureString] -and
    $record.sessionSigningSecret.Length -ge 32) 'Stored session secret is missing or malformed.'
$record = $null
Write-Host 'PASS: Original owner-only QA credential metadata exists and is consistent (values hidden).'

$wrangler = Get-Command 'wrangler.cmd' -ErrorAction SilentlyContinue
Assert-True ($null -ne $wrangler) 'wrangler.cmd was not found. Nothing was changed.'
# The broad D1 list endpoint may return Cloudflare 10000 even when the
# authenticated account can read a database by its exact name. Verify BOTH
# named resource identities separately; never select the first listed DB.
$rawInfo = @(& $wrangler.Source d1 info $qaName --json)
$info = Read-Json $rawInfo 'Cloudflare read-only QA D1 info'
Assert-True ($info.uuid -ceq $qaUuid -and $info.name -ceq $qaName) 'Remote QA D1 name/UUID mismatch.'
$rawProtected = @(& $wrangler.Source d1 info $protectedName --json)
$protectedInfo = Read-Json $rawProtected 'Cloudflare read-only protected staging D1 info'
Assert-True ($protectedInfo.uuid -ceq $protectedUuid -and
    $protectedInfo.name -ceq $protectedName) 'Protected existing staging D1 identity differs; stop.'
Assert-True ($info.uuid -cne $protectedInfo.uuid) 'Isolated QA and protected staging D1 identities must differ.'
Assert-True ($null -ne $info.num_tables -and [int]$info.num_tables -gt 0) 'QA database is empty or table count unavailable; do NOT initialize/reapply migrations.'

# One SELECT statement. No customer rows, amounts, emails, secrets, payments or
# photo contents are requested. The existing QA database is the ONLY target.
$sql = "SELECT (SELECT COUNT(*) FROM d1_migrations) AS migration_count, " +
    "(SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN " +
    "('customers','customer_photos','estimates','invoices','payments','payment_refunds','d1_migrations')) AS required_tables, " +
    "(SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_payments_stripe_provider_unique' AND tbl_name='payments') AS provider_index"
$rawQuery = @(& $wrangler.Source d1 execute $qaName --remote "--config=$configPath" "--command=$sql" --json)
$envelopes = @(Read-Json $rawQuery 'Cloudflare read-only QA schema query')
Assert-True ($envelopes.Count -eq 1 -and $envelopes[0].success -eq $true) 'Unexpected or unsuccessful QA-only query result.'
$rows = @($envelopes[0].results)
Assert-True ($rows.Count -eq 1) 'QA schema query returned unexpected row count.'
$row = $rows[0]
Assert-True ([int]$row.migration_count -eq 23) 'Migration journal does not show all 23 reviewed QA migrations.'
Assert-True ([int]$row.required_tables -eq 7) 'Required full-app QA business tables are missing.'
Assert-True ([int]$row.provider_index -eq 1) 'Stripe payment provider uniqueness index missing.'
Write-Host 'PASS: Exact isolated QA database identity, 23 migrations, seven required tables and provider index.'
Write-Host 'PASS: All checks are read-only; existing LIVE, staging and Doomsday databases untouched.'
Write-Host 'STOP BEFORE PUBLISH: Worker name collision, secret provisioning and exact deployment approval are separate pending steps.'
