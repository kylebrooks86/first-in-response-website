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
$qaPhotoBucket = 'fire-fullapp-qa-photos-20261023'
$protectedName = 'fire-app-staging-db'
$protectedUuid = 'afb2c05a-d794-4a9a-b580-924ce01c26ad'
$origin = 'https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev'
$configPath = Join-Path $PSScriptRoot 'wrangler.qa-migrations.json'
$migrationDir = Join-Path $PSScriptRoot 'adapters\doomsday\drizzle'
$identityHelper = Join-Path $PSScriptRoot 'qa_d1_identity_from_list.ps1'
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
Assert-True (Test-Path -LiteralPath $migrationDir -PathType Container) 'Expected full 25-migration QA schema source missing.'
Assert-True (Test-Path -LiteralPath $identityHelper -PathType Leaf) 'Strict QA D1 list identity validator missing.'
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
# Use the authenticated D1 list with the SAME fail-closed pure identity
# validator as the guarded QA update workflow. Do not trust num_tables:
# the provider's cached count may show 0 for a populated D1.
$rawList = @(& $wrangler.Source d1 list --json)
$inventory = Read-Json $rawList 'Cloudflare read-only D1 identity list'
Assert-True ($null -ne $inventory) 'QA and protected staging D1 list missing.'
$identities = & $identityHelper -Json ($rawList -join [Environment]::NewLine)
Assert-True ($identities.qaName -ceq $qaName -and $identities.qaUuid -ceq $qaUuid -and
    $identities.stagingName -ceq $protectedName -and $identities.stagingUuid -ceq $protectedUuid) 'QA/staging identity validation failed.'
$orderedSQL = @(Get-ChildItem -LiteralPath $migrationDir -File -Filter '*.sql' | Sort-Object Name | ForEach-Object { $_.Name })
Assert-True ($orderedSQL.Count -eq 25 -and $orderedSQL[22] -ceq '0022_stripe_provider_uniqueness.sql' -and
    $orderedSQL[23] -ceq '0023_deposit_policy_events.sql' -and
    $orderedSQL[24] -ceq '0024_deposit_agreement_snapshots.sql') 'The current QA migration sequence must have exactly 25 reviewed names.'

# One SELECT statement: only schema/journal metadata, never any customer rows,
# financial amounts, secrets, receipts or photo bytes. A 23-schema QA database
# is NOT compatible with the newer 25-migration Worker; stop before publication.
$sql = "SELECT (SELECT GROUP_CONCAT(name,'|') FROM (SELECT name FROM d1_migrations ORDER BY id)) AS journal_names, " +
    "(SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('customers','customer_photos','estimates','invoices','payments','payment_refunds','deposit_policy_events','deposit_agreement_snapshots')) AS required_tables, " +
    "(SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_payments_stripe_provider_unique' AND tbl_name='payments') AS provider_index, " +
    "(SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name IN ('deposit_agreement_snapshots_no_update','deposit_agreement_snapshots_no_delete')) AS signed_agreement_triggers"
$rawQuery = @(& $wrangler.Source d1 execute $qaName --remote "--config=$configPath" "--command=$sql" --json)
$envelopes = @(Read-Json $rawQuery 'Cloudflare read-only QA schema query')
Assert-True ($envelopes.Count -eq 1 -and $envelopes[0].success -eq $true) 'Unexpected or unsuccessful QA-only query result.'
$rows = @($envelopes[0].results)
Assert-True ($rows.Count -eq 1) 'QA schema query returned unexpected row count.'
$row = $rows[0]
Assert-True ([string]$row.journal_names -ceq ($orderedSQL -join '|')) 'The hosted QA migration journal must match all 25 local migrations IN ORDER.'
Assert-True ([int]$row.required_tables -eq 8 -and [int]$row.provider_index -eq 1 -and
    [int]$row.signed_agreement_triggers -eq 2) 'Complete QA refund/photo/deposit tables, payment index or immutability triggers missing.'

# Photos are a real full-app workflow, not a code-only mock. Confirm exactly
# the newly reserved QA bucket; never reuse a LIVE or unrelated R2 bucket.
$rawPhoto = @(& $wrangler.Source r2 bucket info $qaPhotoBucket --json)
$photoInfo = Read-Json $rawPhoto 'Cloudflare read-only QA R2 identity'
Assert-True ($photoInfo.name -ceq $qaPhotoBucket) 'Dedicated QA-only R2 photo bucket identity missing/mismatched.'
Write-Host 'PASS: Full QA D1 has exactly 25 ordered migrations, eight required tables, provider index and immutable signed agreements.'
Write-Host 'PASS: Separate QA R2 photo bucket identified without reading photo bytes.'
Write-Host 'PASS: All checks are read-only; LIVE, staging and Doomsday database rows untouched.'
Write-Host 'STOP BEFORE PUBLISH: Worker name collision, secret provisioning and exact deployment approval are separate pending steps.'
