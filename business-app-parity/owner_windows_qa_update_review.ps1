# Review an UPDATED QA Business App after the first successful hosted deployment.
# READ ONLY: never deploys, uploads secrets, touches D1 data, or changes device vaults.
# The first-publish script MUST NOT be reused on an existing Worker.
[CmdletBinding()]
param(
    [string]$CandidateBranch = 'work/fire-business-app-parity-2026-10-08',
    [string]$ExpectedCommit = ''
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$branch = $CandidateBranch
$workerName = 'fire-fullapp-qa-20261016'
$qaDatabase = 'fire-fullapp-qa-db-20261016'
$qaId = '8ccfb1f8-1657-4074-b1b2-47de78f95003'
# Cloud photo R2 is intentionally not provisioned. The device-local photo vault and
# independently saved ZIP backups must remain usable without billing.
# Pin the latest QA version owner confirmed at 100% traffic after the authenticated October 29 QA read-only inspection with authenticated
# Wrangler deployments status: sole active version at 100% traffic.
# Reject a different active version, split traffic, or changed D1 identity.
# Reject older, split, changed or ambiguous versions before any upload.
$expectedActiveVersion = 'f959bea7-c6bc-45b8-98ab-7f96f3ce46a8'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
function Require([bool]$ok, [string]$reason) {
    if (-not $ok) { throw ('FIRE QA UPDATE STOP: ' + $reason) }
}
function Require-Exit([string]$stage) {
    Require ($LASTEXITCODE -eq 0) ($stage + ' failed. No remote changes were attempted.')
}
Require ($branch -cmatch '^work/fire-[a-z0-9][a-z0-9-]{1,110}$') 'Only an expressly selected FIRE development branch is permitted.'
Require ([string]::IsNullOrEmpty($ExpectedCommit) -or $ExpectedCommit -cmatch '^[0-9a-f]{40}$') 'ExpectedCommit must be an exact 40-character lowercase SHA.'
if ($branch -cne 'work/fire-business-app-parity-2026-10-08') {
    Require ($ExpectedCommit -cmatch '^[0-9a-f]{40}$') 'An alternate FIRE development branch MUST provide a reviewed exact commit.'
}
Write-Host 'FIRE QA FULL-APP UPDATE REVIEW: NO PUBLISH, NO DATABASE WRITES'
Require ($env:OS -eq 'Windows_NT' -and -not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) 'Owner Acer Windows profile required.'
$git = Get-Command 'git.exe' -ErrorAction SilentlyContinue
$python = Get-Command 'python.exe' -ErrorAction SilentlyContinue
$node = Get-Command 'node.exe' -ErrorAction SilentlyContinue
$wrangler = Get-Command 'wrangler.cmd' -ErrorAction SilentlyContinue
Require ($null -ne $git -and $null -ne $python -and $null -ne $node -and $null -ne $wrangler) 'Existing Git, Python, Node and authenticated global Wrangler are required.'
$actualBranch = (& $git.Source -C $repo branch --show-current).Trim()
Require-Exit 'Git branch'
Require ($actualBranch -ceq $branch) 'Working branch does not match FIRE QA branch.'
$head = (& $git.Source -C $repo rev-parse HEAD).Trim()
Require-Exit 'Git HEAD'
$originHead = (& $git.Source -C $repo rev-parse ('refs/remotes/origin/' + $branch)).Trim()
Require-Exit 'Fetched origin HEAD'
Require ($head -cmatch '^[a-f0-9]{40}$' -and $head -ceq $originHead) 'Run a safe fast-forward Git pull first.'
if (-not [string]::IsNullOrEmpty($ExpectedCommit)) {
    Require ($head -ceq $ExpectedCommit) 'The checked out code differs from the explicitly reviewed commit. No remote checks performed.'
}
$dirty = @(& $git.Source -C $repo status --porcelain --untracked-files=no)
Require-Exit 'Tracked Git changes'
Require ($dirty.Count -eq 0) 'Keep local changes; stop before review.'
$candidate = Join-Path $env:LOCALAPPDATA ('FIRE-QA-Builds\qa-' + $head)
$manifest = Join-Path $candidate 'dist\server\wrangler.json'
$sourceCheck = Join-Path $PSScriptRoot 'verify_materialized_candidate.py'
$runtimeCheck = Join-Path $PSScriptRoot 'check_qa_runtime_config.mjs'
$prepare = Join-Path $PSScriptRoot 'prepare_qa_deploy_config.mjs'
$pinnedReview = Join-Path $PSScriptRoot 'review_qa_update_schema.py'
$qaD1Config = Join-Path $PSScriptRoot 'wrangler.qa-migrations.json'
foreach ($path in @($candidate, $manifest, $sourceCheck, $runtimeCheck, $prepare, $pinnedReview, $qaD1Config)) {
    Require (Test-Path -LiteralPath $path) 'Missing latest isolated QA build or source verifier. Build the new candidate locally first.'
}
Require (-not ((Get-Item -LiteralPath $candidate).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'Refusing symbolic-link QA build directory.'
# An update must not quietly change schema expectations while keeping the
# pre-existing D1 contents. Compare every local SQL migration with the exact
# candidate that first published this QA Worker, including file names/order.
$firstSource = 'f650d25b18d23bc9f71a4d55c9322bfd5870ef75'
$original = Join-Path $env:LOCALAPPDATA ('FIRE-QA-Builds\qa-' + $firstSource)
Require (Test-Path -LiteralPath (Join-Path $original 'drizzle') -PathType Container) 'The preserved first-release QA migration baseline is missing.'
Require (-not ((Get-Item -LiteralPath $original).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'First-release QA candidate must not be a symbolic link.'
$previousSQL = @(Get-ChildItem -LiteralPath (Join-Path $original 'drizzle') -Filter '*.sql' -File)
$nextSQL = @(Get-ChildItem -LiteralPath (Join-Path $candidate 'drizzle') -Filter '*.sql' -File)
Require ($previousSQL.Count -eq 23 -and $nextSQL.Count -eq 25) 'QA upgrade must preserve 23 original migrations and append exactly 2 reviewed additive migrations.'
$baseline = @{}
foreach ($file in $previousSQL) { $baseline[$file.Name] = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash }
foreach ($file in $previousSQL) {
    $currentFile = Join-Path (Join-Path $candidate 'drizzle') $file.Name
    Require ((Test-Path -LiteralPath $currentFile -PathType Leaf) -and
        $baseline[$file.Name] -ceq (Get-FileHash -Algorithm SHA256 -LiteralPath $currentFile).Hash) 'QA migration bytes differ from original published app. Stop without touching D1.'
}
# Historical and 0023/0024 SQL must also match their immutable Git-blob pins;
# merely counting or matching the old 23 would admit unreviewed new SQL.
& $python.Source $pinnedReview --baseline (Join-Path $original 'drizzle') --candidate (Join-Path $candidate 'drizzle') --checkpoint $head | Out-Null
Require-Exit 'Exact 23 historical plus two append-only SQL Git blob identity review'
Write-Host 'PASS: All 23 first-hosted QA migrations remain unchanged; exactly 2 pinned additive migrations verified locally. No migrations run.'
& $python.Source $sourceCheck qa $candidate --built
Require-Exit 'Latest full-app QA compiled source verification'
& $node.Source $runtimeCheck $manifest
Require-Exit 'Exactly isolated QA Worker/D1 bindings'
# Read-only Wrangler D1 LIST works with the owner's current token even when
# d1 info returns API code 10000. Check BOTH QA and protected staging identities,
# fail closed on collisions, and never infer schema from num_tables metadata.
$identityHelper = Join-Path $PSScriptRoot 'qa_d1_identity_from_list.ps1'
Require (Test-Path -LiteralPath $identityHelper -PathType Leaf) 'Strict read-only D1 identity validator is missing.'
$databaseRaw = @(& $wrangler.Source d1 list --json)
Require-Exit 'Read-only existing QA/staging D1 list'
$databaseInfo = & $identityHelper -Json ($databaseRaw -join [Environment]::NewLine)
Require ($databaseInfo.qaName -ceq $qaDatabase -and $databaseInfo.qaUuid -ceq $qaId) 'Isolated QA D1 identity differs. No publish.'
# Do not rely on Cloudflare stale num_tables metadata. Read only schema and
# migration journal names (no customer rows, names, payment amounts or photos).
$orderedSQL = @(Get-ChildItem -LiteralPath (Join-Path $candidate 'drizzle') -File -Filter '*.sql' | Sort-Object Name | ForEach-Object { $_.Name })
Require ($orderedSQL.Count -eq 25) 'Full QA candidate must contain exactly 25 reviewed migrations.'
$sql = "SELECT (SELECT GROUP_CONCAT(name,'|') FROM (SELECT name FROM d1_migrations ORDER BY id)) AS journal_names, " +
    "(SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('customers','customer_photos','estimates','invoices','payments','payment_refunds','deposit_policy_events','deposit_agreement_snapshots')) AS required_tables, " +
    "(SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_payments_stripe_provider_unique' AND tbl_name='payments') AS provider_index, " +
    "(SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name IN ('deposit_agreement_snapshots_no_update','deposit_agreement_snapshots_no_delete')) AS signed_agreement_triggers"
$rawSchema = @(& $wrangler.Source d1 execute $qaDatabase --remote "--config=$qaD1Config" "--command=$sql" --json)
Require-Exit 'Read-only QA D1 exact ordered 25-schema verification'
try { $schemaResults = @(ConvertFrom-Json -InputObject ($rawSchema -join [Environment]::NewLine)) }
catch { throw 'FIRE QA UPDATE STOP: QA migration metadata query is not valid JSON.' }
Require ($schemaResults.Count -eq 1 -and $schemaResults[0].success -eq $true -and
    @($schemaResults[0].results).Count -eq 1) 'QA D1 schema evidence missing or ambiguous.'
$row = @($schemaResults[0].results)[0]
Require ([string]$row.journal_names -ceq ($orderedSQL -join '|') -and
    [int]$row.required_tables -eq 8 -and [int]$row.provider_index -eq 1 -and
    [int]$row.signed_agreement_triggers -eq 2) 'Hosted QA MUST have all 25 exact ordered migrations, refund/photo/deposit tables, provider index and immutable agreement triggers before code update.'
Write-Host 'PASS: Remote QA-only D1 journal, 8 required tables, provider index and signed agreement triggers match full current code.'
# The disposable deployment manifest removes R2 entirely; no account call or
# billable bucket is needed. Hosted/server photo endpoints stay unavailable,
# while the existing per-device photo vault and ZIP backup UI remain intact.
Write-Host 'PASS: QA update requires no R2 billing, bucket or photo cloud sync.'
# Verify exactly the sole ACTIVE version, not arbitrary historical status text.
$deploymentRaw = @(& $wrangler.Source deployments status --name $workerName --json)
Require-Exit 'Read-only current QA Worker status'
try { $deploymentInfo = ConvertFrom-Json -InputObject ($deploymentRaw -join [Environment]::NewLine) }
catch { throw 'FIRE QA UPDATE STOP: Cloudflare deployment status is not valid JSON.' }
Require ($null -ne $deploymentInfo -and $null -ne $deploymentInfo.versions) 'Current QA deployment does not identify versions. Stop.'
$activeVersions = @($deploymentInfo.versions)
Require ($activeVersions.Count -eq 1) 'QA Worker traffic is split or ambiguous. Stop.'
Require ([double]$activeVersions[0].percentage -eq 100) 'Exactly one QA Worker version must serve 100 percent of requests.'
$activeVersion = [string]$activeVersions[0].version_id
Require ($activeVersion -ceq $expectedActiveVersion) 'Active QA Worker differs from authenticated owner October 29 QA preflight. STOP; do not re-pin or deploy. Stop.'
Write-Host ('PASS: Active QA Worker is exactly one 100-percent deployment: ' + $activeVersion)
Write-Host ('PASS: Existing QA database name and UUID match: ' + $qaDatabase)
# Dry-run requires ONLY a disposable normalized manifest, outside any app data.
$temporaryManifest = Join-Path (Split-Path -Parent $manifest) (
    'wrangler.fire-qa-firstpublish-' + [Guid]::NewGuid().ToString('D') + '.json')
try {
    & $node.Source $prepare $manifest $temporaryManifest
    Require-Exit 'QA-only Wrangler config compatibility'
    Push-Location $candidate
    try {
        & $wrangler.Source deploy --dry-run --config $temporaryManifest --name $workerName
        Require-Exit 'No-upload QA update dry run'
    } finally { Pop-Location }
} finally {
    if (Test-Path -LiteralPath $temporaryManifest -PathType Leaf) {
        Remove-Item -LiteralPath $temporaryManifest -Force
    }
}
Write-Host ('REVIEW PASS: New QA candidate Git source ' + $head)
Write-Host 'NO PUBLISH. Existing QA Worker, credentials, D1 rows and on-device photos are untouched.'
Write-Host 'Further steps require owner approval of a distinct UPDATE release and retained rollback version.'
