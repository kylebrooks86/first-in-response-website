# FIRE Business App QA ONLY — existing 23-to-25 schema transition.
# DEFAULT: READ ONLY. No Cloudflare resources are created or changed.
# -Apply requires a separate exact Git SHA and typed owner approval.
# NEVER run this against LIVE, staging, Doomsday, or a fresh/unknown QA D1.
[CmdletBinding()]
param(
    [switch]$Apply,
    [Parameter(Mandatory=$true)][string]$ExpectedCommit
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$qaWorker = 'fire-fullapp-qa-20261016'
$qaName = 'fire-fullapp-qa-db-20261016'
$qaUuid = '8ccfb1f8-1657-4074-b1b2-47de78f95003'
$protectedName = 'fire-app-staging-db'
$protectedUuid = 'afb2c05a-d794-4a9a-b580-924ce01c26ad'
$config = Join-Path $PSScriptRoot 'wrangler.qa-migrations.json'
$drizzle = Join-Path $PSScriptRoot 'adapters\doomsday\drizzle'
$pinReview = Join-Path $PSScriptRoot 'verify_qa_23_to_25_sql.py'
$identityCheck = Join-Path $PSScriptRoot 'qa_d1_identity_from_list.ps1'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
function Require([bool]$ok, [string]$reason) {
    if (-not $ok) { throw ('FIRE QA SCHEMA UPGRADE STOP: ' + $reason) }
}
function CheckExit([string]$step) {
    Require ($LASTEXITCODE -eq 0) ($step + ' failed. Do not automatically retry migration.')
}
Require ($env:OS -eq 'Windows_NT') 'Run only on the original owner Windows account.'
Require ($ExpectedCommit -cmatch '^[a-f0-9]{40}$') 'An owner-reviewed exact 40-character Git commit is required even for a dry run.'
foreach ($path in @($config,$drizzle,$pinReview,$identityCheck)) {
    Require (Test-Path -LiteralPath $path) 'Required pinned QA configuration or SQL review missing.'
}
$git = Get-Command 'git.exe' -ErrorAction SilentlyContinue
$python = Get-Command 'python.exe' -ErrorAction SilentlyContinue
$wrangler = Get-Command 'wrangler.cmd' -ErrorAction SilentlyContinue
Require ($null -ne $git -and $null -ne $python -and $null -ne $wrangler) 'Git, Python and authenticated Wrangler are required.'
$branch = (& $git.Source -C $repo branch --show-current).Trim()
CheckExit 'Current Git branch'
Require ($branch -cmatch '^work/fire-[a-z0-9][a-z0-9-]{1,110}$') 'Only a reviewed FIRE development branch is permitted.'
$head = (& $git.Source -C $repo rev-parse HEAD).Trim()
CheckExit 'Exact source commit'
Require ($head -ceq $ExpectedCommit) 'Local source does not match the exact owner-reviewed commit.'
$origin = (& $git.Source -C $repo rev-parse ('refs/remotes/origin/' + $branch)).Trim()
CheckExit 'Origin source commit'
Require ($head -ceq $origin) 'Remote tracked branch differs; fetch and review safely first.'
$dirty = @(& $git.Source -C $repo status --porcelain --untracked-files=no)
CheckExit 'Working source cleanliness'
Require ($dirty.Count -eq 0) 'Tracked local source edits found. Do not run migrations from a modified workspace.'

$cfg = Get-Content -LiteralPath $config -Raw | ConvertFrom-Json
Require ($cfg.name -ceq $qaWorker -and @($cfg.d1_databases).Count -eq 1) 'QA-only config Worker/binding count mismatch.'
$db = @($cfg.d1_databases)[0]
Require ($db.binding -ceq 'DB' -and $db.database_name -ceq $qaName -and
    $db.database_id -ceq $qaUuid -and $db.migrations_dir -ceq 'adapters/doomsday/drizzle' -and
    $db.migrations_table -ceq 'd1_migrations') 'Config is not bound to exact independent QA D1.'
Require (@($cfg.PSObject.Properties.Name | Where-Object { $_ -notin @('name','compatibility_date','d1_databases') }).Count -eq 0) 'Unreviewed QA config bindings.'
& $python.Source $pinReview --candidate $drizzle | Out-Null
CheckExit 'Exact immutable SQL content pin review'
Write-Host 'PASS: Source branch, exact SHA, unchanged 23 original migrations and approved 0023/0024 SQL verified.'

$rawList = @(& $wrangler.Source d1 list --json)
CheckExit 'Read-only Cloudflare database inventory'
$identity = & $identityCheck -Json ($rawList -join [Environment]::NewLine)
Require ($identity.qaName -ceq $qaName -and $identity.qaUuid -ceq $qaUuid -and
    $identity.stagingName -ceq $protectedName -and $identity.stagingUuid -ceq $protectedUuid) 'QA or protected staging identities not independently verified.'

$ordered = @(Get-ChildItem -LiteralPath $drizzle -File -Filter '*.sql' | Sort-Object Name | ForEach-Object { $_.Name })
Require ($ordered.Count -eq 25) 'Candidate must have exactly 25 SQL migrations.'
# ONE read-only metadata SELECT. This does not read customer rows, balances,
# photo bytes, payment credentials, or unrelated tenant data.
$sql = "SELECT (SELECT GROUP_CONCAT(name,'|') FROM (SELECT name FROM d1_migrations ORDER BY id)) AS names, " +
    "(SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('customers','customer_photos','estimates','invoices','payments','payment_refunds')) AS core_tables, " +
    "(SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('deposit_policy_events','deposit_agreement_snapshots')) AS new_tables, " +
    "(SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_payments_stripe_provider_unique') AS provider_index, " +
    "(SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name IN ('deposit_policy_events_no_update','deposit_policy_events_no_delete','deposit_agreement_snapshots_no_update','deposit_agreement_snapshots_no_delete')) AS new_triggers"
function ReadSchema {
    $response = @(& $wrangler.Source d1 execute $qaName --remote "--config=$config" "--command=$sql" --json)
    CheckExit 'Read-only exact QA D1 migration journal and schema metadata'
    try { $envs = @(ConvertFrom-Json -InputObject ($response -join [Environment]::NewLine)) }
    catch { throw 'FIRE QA SCHEMA UPGRADE STOP: Could not parse QA schema metadata.' }
    Require ($envs.Count -eq 1 -and $envs[0].success -eq $true -and
        @($envs[0].results).Count -eq 1) 'QA D1 schema evidence missing or ambiguous.'
    return @($envs[0].results)[0]
}
$before = ReadSchema
$oldNames = @($ordered | Select-Object -First 23)
Require ([string]$before.names -ceq ($oldNames -join '|') -and
    [int]$before.core_tables -eq 6 -and [int]$before.new_tables -eq 0 -and
    [int]$before.provider_index -eq 1 -and [int]$before.new_triggers -eq 0) 'Remote QA database is not the EXACT original 23-schema. An empty, partly upgraded, or already 25-schema D1 is NOT eligible.'
Write-Host 'PASS: Exact separate QA D1 has all 23 original journal entries, six core tables and no deposit policy/agreement objects.'
if (-not $Apply) {
    Write-Host 'READ ONLY PASS: 23-to-25 QA schema is locally and remotely eligible for a SEPARATELY APPROVED transition.'
    Write-Host 'NO SQL migrations, Worker updates, storage, Stripe, LIVE website or customer records were changed.'
    return
}
# Never infer permission from -Apply. Owner must separately approve exact
# UUID and SHA, and should review the 23-state capture and rollback options.
$typed = 'UPGRADE QA 23 TO 25 ' + $qaUuid + ' COMMIT ' + $head
Write-Warning 'This changes ONLY the existing synthetic QA D1 schema. It appends 0023/0024 and does NOT deploy the app. Review rollback and schema evidence before approving.'
$approval = Read-Host ('To authorize this exact QA-only schema migration, type ' + $typed)
Require ($approval -ceq $typed) 'Owner did not authorize this exact isolated D1 migration.'
# Recheck after consent; another session might have upgraded the D1.
$again = ReadSchema
Require ([string]$again.names -ceq ($oldNames -join '|') -and
    [int]$again.core_tables -eq 6 -and [int]$again.new_tables -eq 0 -and
    [int]$again.provider_index -eq 1 -and [int]$again.new_triggers -eq 0) 'QA D1 changed after approval. Refuse write.'
Push-Location $PSScriptRoot
try {
    & $wrangler.Source d1 migrations apply $qaName --remote "--config=$config"
    CheckExit 'Approved QA-only append-only 0023/0024 migration'
} finally { Pop-Location }
$after = ReadSchema
Require ([string]$after.names -ceq ($ordered -join '|') -and
    [int]$after.core_tables -eq 6 -and [int]$after.new_tables -eq 2 -and
    [int]$after.provider_index -eq 1 -and [int]$after.new_triggers -eq 4) 'Migration journal/full schema not confirmed. STOP: inspect manually; DO NOT rerun migrations automatically.'
Write-Host 'PASS: Owner-approved QA-only migration now has exact 25 ordered journal entries and all four immutable deposit audit and agreement triggers.'
Write-Host 'NO WORKER PUBLISHED. Standalone photo R2 identity and hosted iPhone workflows still need owner-verified release approval.'
