# FIRE QA current-release evidence review — READ ONLY, no publication or data mutation.
# Designed for the owner's existing authenticated Windows Wrangler session.
# Independent of the guarded update/release scripts; do not edit their pins.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$workerName = 'fire-fullapp-qa-20261016'
$qaName = 'fire-fullapp-qa-db-20261016'
$qaUuid = '8ccfb1f8-1657-4074-b1b2-47de78f95003'
$expectedVersion = 'f959bea7-c6bc-45b8-98ab-7f96f3ce46a8'
$config = Join-Path $PSScriptRoot 'wrangler.qa-migrations.json'
$migrationsRoot = Join-Path $PSScriptRoot 'adapters\doomsday\drizzle'
$identityHelper = Join-Path $PSScriptRoot 'qa_d1_identity_from_list.ps1'

function Require([bool]$ok, [string]$reason) {
    if (-not $ok) { throw ('FIRE QA CURRENT REVIEW STOP: ' + $reason) }
}
function Read-Provider([string[]]$arguments, [string]$stage) {
    $prior = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $raw = @(& $wrangler.Source @arguments 2>$null)
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $prior }
    Require ($code -eq 0) ('Authenticated read-only ' + $stage + ' failed. STOP; do not change resources.')
    try { return ConvertFrom-Json -InputObject ($raw -join [Environment]::NewLine) }
    catch { throw ('FIRE QA CURRENT REVIEW STOP: Malformed provider reply for ' + $stage) }
}
function Verify-Serving([object]$reply) {
    Require ($null -ne $reply -and $null -ne $reply.versions) 'Missing Worker routing data.'
    $versions = @($reply.versions)
    Require ($versions.Count -eq 1 -and $null -ne $versions[0]) 'Worker traffic is split or ambiguous.'
    Require ($null -ne $versions[0].percentage -and [double]$versions[0].percentage -eq 100) 'Worker is not serving 100 percent on one version.'
    Require ([string]$versions[0].version_id -ceq $expectedVersion) 'Active Worker version is not the owner-confirmed current QA release.'
}
function Verify-Identity([object]$databaseList) {
    $identity = & $identityHelper -Json (ConvertTo-Json -InputObject @($databaseList) -Compress -Depth 8)
    Require ($identity.qaName -ceq $qaName -and $identity.qaUuid -ceq $qaUuid) 'QA or protected staging D1 identity differs.'
}
Require ($env:OS -eq 'Windows_NT') 'Run only from the original authenticated Windows owner profile.'
foreach ($p in @($config, $migrationsRoot, $identityHelper)) {
    Require (Test-Path -LiteralPath $p) 'Missing protected review input. No remote requests made.'
}
$wrangler = Get-Command 'wrangler.cmd' -ErrorAction SilentlyContinue
Require ($null -ne $wrangler) 'Authenticated Wrangler CLI is required. Do not paste credentials.'
$cfg = Get-Content -LiteralPath $config -Raw | ConvertFrom-Json
Require ($cfg.name -ceq $workerName -and @($cfg.d1_databases).Count -eq 1) 'Unexpected QA config.'
Require ($cfg.d1_databases[0].database_name -ceq $qaName -and
    $cfg.d1_databases[0].database_id -ceq $qaUuid -and
    $cfg.d1_databases[0].binding -ceq 'DB') 'QA DB binding in checked source differs.'
$names = @(Get-ChildItem -LiteralPath $migrationsRoot -File -Filter '*.sql' | Sort-Object Name | ForEach-Object { $_.Name })
Require ($names.Count -eq 25) 'Current reviewed migration source is not the original 25-file history.'
for ($i=0; $i -lt 25; $i++) {
    Require ($names[$i] -cmatch ('^' + $i.ToString('0000') + '_[a-z0-9_]+\.sql$')) 'Migration names/order not reviewed.'
}
Require ($names[22] -ceq '0022_stripe_provider_uniqueness.sql' -and
    $names[23] -ceq '0023_deposit_policy_events.sql' -and
    $names[24] -ceq '0024_deposit_agreement_snapshots.sql') 'QA latest migrations differ.'

Write-Host 'FIRE QA CURRENT RELEASE: READ-ONLY VERIFICATION'
Verify-Identity (Read-Provider @('d1','list','--json') 'initial D1 identity')
Verify-Serving (Read-Provider @('deployments','status','--name',$workerName,'--json') 'initial Worker routing')

# ONE metadata-only SELECT. No customer names, amounts, photos or SQL mutations.
$sql = "SELECT (SELECT GROUP_CONCAT(name,'|') FROM (SELECT name FROM d1_migrations ORDER BY id)) AS journal_names, " +
    "(SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('customers','customer_photos','estimates','invoices','payments','payment_refunds','deposit_policy_events','deposit_agreement_snapshots')) AS required_tables, " +
    "(SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_payments_stripe_provider_unique' AND tbl_name='payments') AS provider_index, " +
    "(SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name IN ('deposit_agreement_snapshots_no_update','deposit_agreement_snapshots_no_delete')) AS agreement_triggers"
Require ($sql -cmatch '^SELECT ' -and $sql -notmatch ';') 'Only the pinned single SELECT is permitted.'
$result = @(Read-Provider @('d1','execute',$qaName,'--remote',("--config=" + $config),("--command=" + $sql),'--json') 'QA schema metadata')
Require ($result.Count -eq 1 -and $result[0].success -eq $true -and
    @($result[0].results).Count -eq 1) 'Unexpected or failed metadata query.'
$row = @($result[0].results)[0]
Require ([string]$row.journal_names -ceq ($names -join '|') -and
    [int]$row.required_tables -eq 8 -and [int]$row.provider_index -eq 1 -and
    [int]$row.agreement_triggers -eq 2) 'QA hosted migration journal or required schema differs.'

Verify-Identity (Read-Provider @('d1','list','--json') 'final D1 identity')
Verify-Serving (Read-Provider @('deployments','status','--name',$workerName,'--json') 'final Worker routing')
Write-Host 'PASS: Single current QA Worker version serves 100 percent.'
Write-Host 'PASS: QA and protected staging D1 account identities match pinned values.'
Write-Host 'PASS: All 25 migration names, 8 required tables, Stripe provider index, and 2 agreement triggers match.'
Write-Host 'LIMIT: Serving Worker to physically bound DB remains unverified; inspect Worker Settings separately.'
Write-Host 'LIMIT: No customer data, session security, Stripe integration, or LIVE/Doomsday release gate is attested.'
Write-Host 'REMOTE_WRITES=NONE; DEPLOYED=NO; CUSTOMER_ROWS_READ=NONE; RELEASE_APPROVED=NO'
