# FIRE read-only Cloudflare QA launch inventory. This is NOT a deployment script.
# Safe to run on the ORIGINAL authenticated owner Windows profile. It contacts
# only the exact pinned synthetic QA D1/R2/Worker and protected staging D1 INFO.
# No customer records, SQL exports, secrets, token values or account identifiers.
# No --Apply, -Publish, migrations, CREATE, deployments or remote mutations.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$qaName = 'fire-fullapp-qa-db-20261016'
$qaUuid = '8ccfb1f8-1657-4074-b1b2-47de78f95003'
$stagingName = 'fire-app-staging-db'
$stagingUuid = 'afb2c05a-d794-4a9a-b580-924ce01c26ad'
$workerName = 'fire-fullapp-qa-20261016'
$photoBucket = 'fire-fullapp-qa-photos-20261023'
$config = Join-Path $PSScriptRoot 'wrangler.qa-migrations.json'
$sqlRoot = Join-Path $PSScriptRoot 'adapters\doomsday\drizzle'

function Require([bool]$condition, [string]$reason) {
    if (-not $condition) { throw ('FIRE QA INVENTORY STOP: ' + $reason) }
}
function Read-JsonResult([object[]]$result, [string]$label) {
    try { return ConvertFrom-Json -InputObject ($result -join [Environment]::NewLine) }
    catch { throw ('FIRE QA INVENTORY STOP: Invalid JSON for read-only ' + $label) }
}
function Read-Remote([string[]]$arguments, [string]$label) {
    # Native CLI stderr often includes harmless telemetry notices in Windows
    # PowerShell 5.1. Suppress it; never display raw provider responses.
    $previous = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $result = @(& $wrangler.Source @arguments 2>$null)
        $exitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previous }
    Require ($exitCode -eq 0) ('Authenticated read-only ' + $label + ' failed. Check the original Cloudflare login; do not recreate resources.')
    return $result
}
function Read-Rows([string]$sql, [string]$label) {
    Require ($sql -cmatch '^SELECT ' -and $sql -notmatch ';') 'Only one pinned metadata SELECT is allowed.'
    $raw = @(Read-Remote -arguments @('d1','execute',$qaName,'--remote',("--config=" + $config),("--command=" + $sql),'--json') -label $label)
    $envelopes = @(Read-JsonResult $raw $label)
    Require ($envelopes.Count -eq 1 -and $envelopes[0].success -eq $true) ('Unexpected query result for ' + $label)
    return @($envelopes[0].results)
}

Require ($env:OS -eq 'Windows_NT') 'Use the original authenticated Windows computer.'
Require (Test-Path -LiteralPath $config -PathType Leaf) 'QA config missing.'
Require (Test-Path -LiteralPath $sqlRoot -PathType Container) 'Full 25-migration source missing.'
$wrangler = Get-Command 'wrangler.cmd' -ErrorAction SilentlyContinue
Require ($null -ne $wrangler) 'Authenticated Wrangler CLI is not installed or not on PATH.'
$cfg = Get-Content -LiteralPath $config -Raw | ConvertFrom-Json
Require ($cfg.name -ceq $workerName -and @($cfg.d1_databases).Count -eq 1) 'Wrong QA configuration.'
Require ($cfg.d1_databases[0].database_name -ceq $qaName -and
    $cfg.d1_databases[0].database_id -ceq $qaUuid -and
    $cfg.d1_databases[0].binding -ceq 'DB') 'Unexpected QA D1 identity in config.'
$migrations = @(Get-ChildItem -LiteralPath $sqlRoot -File -Filter '*.sql' | Sort-Object Name | ForEach-Object { $_.Name })
Require ($migrations.Count -eq 25 -and $migrations[22] -ceq '0022_stripe_provider_uniqueness.sql' -and
    $migrations[23] -ceq '0023_deposit_policy_events.sql' -and
    $migrations[24] -ceq '0024_deposit_agreement_snapshots.sql') 'Current full-app migration source differs.'
for ($i=0; $i -lt 25; $i++) {
    Require ($migrations[$i] -cmatch ('^' + $i.ToString('0000') + '_[a-z0-9_]+\.sql$')) 'Migration order changed.'
}

$qaInfo = Read-JsonResult @(Read-Remote -arguments @('d1','info',$qaName,'--json') -label 'QA D1 info') 'QA D1 info'
$stagingInfo = Read-JsonResult @(Read-Remote -arguments @('d1','info',$stagingName,'--json') -label 'protected staging D1 info') 'protected staging D1 info'
Require ($qaInfo.name -ceq $qaName -and $qaInfo.uuid -ceq $qaUuid -and
    $stagingInfo.name -ceq $stagingName -and $stagingInfo.uuid -ceq $stagingUuid -and
    $qaInfo.uuid -cne $stagingInfo.uuid) 'QA and protected staging D1 identifiers mismatch. No resource action is safe.'

$tableRows = @(Read-Rows "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name" 'table-name metadata')
$tableNames = @($tableRows | ForEach-Object { [string]$_.name })
$hasJournal = @($tableNames | Where-Object { $_ -ceq 'd1_migrations' }).Count -eq 1
$status = 'BLOCKED_UNKNOWN_SCHEMA'
$journalCount = 0
if (-not $hasJournal) {
    # Cloudflare may expose an internal _cf_KV table even in an unused D1.
    $nonInternal = @($tableNames | Where-Object { $_ -cne '_cf_KV' })
    if ($nonInternal.Count -eq 0) { $status = 'EMPTY_QA_DB' }
} else {
    $journalRows = @(Read-Rows 'SELECT name FROM d1_migrations ORDER BY id' 'ordered migration journal')
    $journalNames = @($journalRows | ForEach-Object { [string]$_.name })
    $journalCount = $journalNames.Count
    $matchesFull = $journalCount -eq 25
    $matchesOriginal = $journalCount -eq 23
    for ($i=0; $i -lt [Math]::Min($journalCount,25); $i++) {
        if ($journalNames[$i] -cne $migrations[$i]) {
            $matchesFull = $false
            $matchesOriginal = $false
        }
    }
    $missingCore = @(@('customers','customer_photos','estimates','payments','payment_refunds') |
        Where-Object { $tableNames -cnotcontains $_ })
    $missingCurrent = @(@('deposit_policy_events','deposit_agreement_snapshots') |
        Where-Object { $tableNames -cnotcontains $_ })
    if ($missingCore.Count -eq 0) {
        if ($matchesOriginal) { $status = 'EXISTING_QA_23_NEEDS_REVIEWED_UPGRADE' }
        elseif ($matchesFull -and $missingCurrent.Count -eq 0) {
            $status = 'FULL_QA_25_SCHEMA_PRESENT_UNVERIFIED'
        }
    }
}

# An unavailable bucket is NOT proof it does not exist: wrong account, denied
# permissions, disabled R2, or transient errors may be indistinguishable.
$r2Status = 'NOT_VERIFIED'
$oldPreference = $ErrorActionPreference
try {
    $ErrorActionPreference = 'Continue'
    $r2Raw = @(& $wrangler.Source r2 bucket info $photoBucket --json 2>$null)
    $r2Exit = $LASTEXITCODE
} finally { $ErrorActionPreference = $oldPreference }
if ($r2Exit -eq 0) {
    $r2 = Read-JsonResult $r2Raw 'QA R2 info'
    Require ($r2.name -ceq $photoBucket) 'R2 response was not from the exact QA-only photo bucket.'
    $r2Status = 'EXACT_QA_BUCKET_VERIFIED'
}
# This is intentionally not a deployed Worker inspection: versions and
# bindings need their separate owner-approved source and runtime review.
Write-Host 'FIRE QA HOSTING READ-ONLY INVENTORY'
Write-Host ('QA_D1_SCHEMA_STATUS=' + $status)
Write-Host ('QA_MIGRATION_COUNT=' + $journalCount)
Write-Host ('QA_R2_STATUS=' + $r2Status)
Write-Host 'WORKER_SERVING_VERSION=NOT_VERIFIED'
Write-Host 'REMOTE_WRITES=NONE'
Write-Host 'PERSONAL_CUSTOMER_RECORDS_READ=NONE'
Write-Host 'APP_RELEASE_APPROVED=NO'
if ($status -ceq 'EMPTY_QA_DB') {
    Write-Host 'NEXT=Separate owner approval required for guarded first initialization of this exact EMPTY QA D1.'
} elseif ($status -ceq 'EXISTING_QA_23_NEEDS_REVIEWED_UPGRADE') {
    Write-Host 'NEXT=Existing QA already contains schema. NEVER run first-time initializer. Review append-only 0023 and 0024 upgrade and existing Worker binding before any approved write.'
} elseif ($status -ceq 'FULL_QA_25_SCHEMA_PRESENT_UNVERIFIED') {
    Write-Host 'NEXT=Run strict 25-schema read-only reviewer and confirm deployed Worker binding and separate R2 before requesting publication approval.'
} else {
    Write-Host 'NEXT=STOP: Unknown QA schema. Do not initialize, migrate, redeploy or overwrite. Inspect source and hosted identity privately.'
}
if ($r2Status -cne 'EXACT_QA_BUCKET_VERIFIED') {
    Write-Host 'PHOTO_NEXT=Cloudflare QA R2 existence/permissions are NOT verified. Do not bind any existing LIVE bucket.'
}
