# Owner-assisted FIRE synthetic QA D1 initialization. DRY RUN ONLY BY DEFAULT.
# Never runs an existing LIVE/staging/DR script or creates Workers/R2.
# -Apply requires the exact QA UUID, empty remote DB and owner typed approval.
[CmdletBinding()]
param([switch]$Apply)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$name = 'fire-fullapp-qa-db-20261016'
$uuid = '8ccfb1f8-1657-4074-b1b2-47de78f95003'
$worker = 'fire-fullapp-qa-20261016'
$oldName = 'fire-app-staging-db'
$oldUuid = 'afb2c05a-d794-4a9a-b580-924ce01c26ad'
$configPath = Join-Path $PSScriptRoot 'wrangler.qa-migrations.json'
$migrationDir = Join-Path $PSScriptRoot 'adapters\doomsday\drizzle'

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw ('FIRE QA STOP: ' + $Message) }
}
Assert-True (Test-Path -LiteralPath $configPath -PathType Leaf) 'Pinned QA D1 config missing.'
Assert-True (Test-Path -LiteralPath $migrationDir -PathType Container) 'QA migration source missing.'
$cfg = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
Assert-True ($cfg.name -ceq $worker) 'Pinned QA Worker name does not match.'
Assert-True (@($cfg.d1_databases).Count -eq 1) 'QA config must have exactly one D1 binding.'
$binding = @($cfg.d1_databases)[0]
Assert-True ($binding.binding -ceq 'DB' -and $binding.database_name -ceq $name -and
    $binding.database_id -ceq $uuid -and
    $binding.migrations_dir -ceq 'adapters/doomsday/drizzle' -and
    $binding.migrations_table -ceq 'd1_migrations') 'QA config D1 identity or migration source mismatch.'
Assert-True (-not $cfg.PSObject.Properties['r2_buckets'] -and
    -not $cfg.PSObject.Properties['routes'] -and
    -not $cfg.PSObject.Properties['kv_namespaces'] -and
    -not $cfg.PSObject.Properties['services']) 'Unapproved remote resource bindings in QA D1 config.'
$files = @(Get-ChildItem -LiteralPath $migrationDir -File -Filter '*.sql' | Sort-Object Name)
Assert-True ($files.Count -eq 25) 'Expected exactly 25 QA schema migrations.'
for ($i = 0; $i -lt 25; $i++) {
    Assert-True ($files[$i].Name -match ('^' + $i.ToString('0000') + '_[a-z0-9_]+\.sql$')) ('Migration file/order mismatch at ' + $i)
}
Assert-True ($files[22].Name -ceq '0022_stripe_provider_uniqueness.sql') 'QA migration 0022 is not the approved index migration.'
Assert-True ($files[23].Name -ceq '0023_deposit_policy_events.sql') 'QA migration 0023 is not the additive deposit audit migration.'
Assert-True ($files[24].Name -ceq '0024_deposit_agreement_snapshots.sql') 'QA migration 0024 is not the immutable signed agreement snapshot migration.'
$wrangler = Get-Command 'wrangler.cmd' -ErrorAction SilentlyContinue
Assert-True ($null -ne $wrangler) 'Installed Wrangler CLI is required.'
Write-Host 'FIRE synthetic QA D1 initialization preflight (read-only by default)'
Write-Host ('ONLY target: ' + $name)
Write-Host ('UUID: ' + $uuid)
Write-Host ('Owner-reviewed migration count: ' + $files.Count)
# Read-only actual Cloudflare identity checks; never inspect customer rows or secrets.
$rawList = @(& $wrangler.Source d1 list --json)
Assert-True ($LASTEXITCODE -eq 0) 'Read-only D1 inventory failed.'
try { $inventory = @(ConvertFrom-Json -InputObject ($rawList -join [Environment]::NewLine)) }
catch { throw 'FIRE QA STOP: Could not parse read-only D1 inventory.' }
$qaMatches = @($inventory | Where-Object { $_.name -ceq $name -and $_.uuid -ceq $uuid })
$oldMatches = @($inventory | Where-Object { $_.name -ceq $oldName -and $_.uuid -ceq $oldUuid })
Assert-True ($qaMatches.Count -eq 1 -and $oldMatches.Count -eq 1) 'New QA / protected staging D1 identities do not match this account.'
$rawInfo = @(& $wrangler.Source d1 info $name --json)
Assert-True ($LASTEXITCODE -eq 0) 'Read-only QA D1 info failed.'
try { $info = ConvertFrom-Json -InputObject ($rawInfo -join [Environment]::NewLine) }
catch { throw 'FIRE QA STOP: Could not parse QA D1 info.' }
Assert-True ($info.uuid -ceq $uuid -and $info.name -ceq $name) 'D1 info does not match the new QA database UUID.'
Assert-True ($null -ne $info.PSObject.Properties['num_tables'] -and
    $null -ne $info.num_tables -and [int]$info.num_tables -eq 0) 'QA D1 is not verifiably empty; refuse potentially destructive or repeat setup.'
Write-Host 'PASS: Separate Cloudflare QA D1 is empty and matches exact name plus UUID.'
if (-not $Apply) {
    Write-Host 'DRY RUN PASS. No SQL, migrations, Worker deployment, Stripe, R2 or billing changes.'
    Write-Host 'Actual initialization is NOT authorized by this run.'
    return
}
# Guard -Apply with explicit owner confirmation, even if invoked accidentally.
$expected = 'INITIALIZE QA ' + $uuid
Write-Warning 'This will WRITE ALL 24 reviewed candidate schema migrations to the EMPTY NEW QA D1 only. It does not publish an app.'
$choice = Read-Host ('If you have approved this exact remote QA-only action, type ' + $expected)
Assert-True ($choice -ceq $expected) 'Owner did not confirm exact QA-only UUID; no SQL executed.'
Push-Location $PSScriptRoot
try {
    & $wrangler.Source d1 migrations apply $name --remote "--config=$configPath"
    Assert-True ($LASTEXITCODE -eq 0) 'Cloudflare QA-only migration apply was not confirmed; stop and inspect without repeating.'
} finally { Pop-Location }
Write-Host 'Cloudflare reported QA migrations applied. Verify remote schema and journal separately before accepting any gate.'
