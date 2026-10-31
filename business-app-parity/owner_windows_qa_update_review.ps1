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
# Pin current QA-only Worker from the owner's Oct 31 authenticated read-only PASS.
# This script is READ ONLY; the separate publisher remains deliberately locked
# to an older version until owner-held 25-schema recovery is authenticated.
# Fresh authenticated Wrangler review must independently confirm the same sole 100% active version.
# Reject a different active version, split traffic, or changed D1 identity.
# Reject older, split, changed or ambiguous versions before any upload.
$expectedActiveVersion = '99fa8c27-df83-48d3-b953-9a84eb295334'
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
# Preserve raw SHA-256 checks to observe Windows CRLF/LF differences.
# Raw-byte differences MUST NOT automatically pass: the independent Python
# reviewer must verify every original and appended file against immutable
# Git blob pins after strictly CRLF -> LF normalization (nothing else).
$baseline = @{}
foreach ($file in $previousSQL) { $baseline[$file.Name] = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash }
$rawByteDifferences = @()
foreach ($file in $previousSQL) {
    $currentFile = Join-Path (Join-Path $candidate 'drizzle') $file.Name
    Require (Test-Path -LiteralPath $currentFile -PathType Leaf) 'QA migration file missing from current candidate. Stop without touching D1.'
    if ($baseline[$file.Name] -cne (Get-FileHash -Algorithm SHA256 -LiteralPath $currentFile).Hash) {
        $rawByteDifferences += $file.Name
    }
}
# Pinned history proof fails closed for any real content change, bare CR,
# unexpected/missing migration, invalid name, or changed 0023/0024 SQL.
# Keep this BEFORE all Cloudflare/provider calls and do not overwrite SQL.
$pinnedRaw = @(& $python.Source $pinnedReview --baseline (Join-Path $original 'drizzle') --candidate (Join-Path $candidate 'drizzle') --checkpoint $head)
Require-Exit 'Exact 23 historical plus two append-only SQL Git blob identity review'
try { $pinnedResult = ConvertFrom-Json -InputObject ($pinnedRaw -join [Environment]::NewLine) }
catch { throw 'FIRE QA UPDATE STOP: Pinned migration verification returned malformed JSON. No remote changes.' }
Require ($null -ne $pinnedResult -and
    $pinnedResult.result -ceq 'CODE_ONLY_QA_UPDATE_BLOCKED' -and
    $pinnedResult.candidateSourceCommit -ceq $head -and
    $pinnedResult.pinnedOriginalSource -ceq $firstSource -and
    [int]$pinnedResult.originalSqlCount -eq 23 -and
    [int]$pinnedResult.candidateSqlCount -eq 25 -and
    $pinnedResult.originalMigrationsLfEquivalent -eq $true -and
    $pinnedResult.migrationLineEndingPolicy -ceq 'CRLF-to-LF only, then exact pinned Git blob verification' -and
    @($pinnedResult.additionalMigrations).Count -eq 2 -and
    $pinnedResult.publicationAuthorized -eq $false -and
    $pinnedResult.migrationPermissionGranted -eq $false
) 'Pinned original and appended migrations not independently verified. Stop without touching D1.'
if ($rawByteDifferences.Count -gt 0) {
    Require ($pinnedResult.originalMigrationsByteIdentical -eq $false) 'Raw-byte difference report disagrees with pinned migration verifier.'
    Write-Host ('PASS: Original migrations differ only by verified CRLF/LF line endings (' + $rawByteDifferences.Count + ' files); no SQL rewrite permitted.')
} else {
    Require ($pinnedResult.originalMigrationsByteIdentical -eq $true) 'Raw migration identity report disagrees with pinned verifier.'
    Write-Host 'PASS: Original migration raw bytes also match exactly.'
}
Write-Host 'PASS: All 23 first-hosted migrations and two pinned additive migrations match immutable Git blobs; no migrations run.'
& $python.Source $sourceCheck qa $candidate --built
Require-Exit 'Latest full-app QA compiled source verification'
& $node.Source $runtimeCheck $manifest
Require-Exit 'Exactly isolated QA Worker/D1 bindings'
# Read-only Wrangler D1 LIST works with the owner's current token even when
# d1 info returns API code 10000. Check BOTH QA and protected staging identities,
# fail closed on collisions, and never infer schema from num_tables metadata.
$identityHelper = Join-Path $PSScriptRoot 'qa_d1_identity_from_list.ps1'
$individualInfoHelper = Join-Path $PSScriptRoot 'qa_d1_identity_from_info.ps1'
$bindingHelper = Join-Path $PSScriptRoot 'verify_qa_worker_version_bindings.ps1'
Require (Test-Path -LiteralPath $identityHelper -PathType Leaf) 'Strict read-only D1 list identity validator is missing.'
Require (Test-Path -LiteralPath $individualInfoHelper -PathType Leaf) 'Strict independently verified dual D1 info identity validator is missing.'
Require (Test-Path -LiteralPath $bindingHelper -PathType Leaf) 'Strict active QA physical D1 binding validator is missing.'
# Prefer the complete D1 LIST. On a nonzero exit ONLY, fetch both actual
# physical database identities independently from supported d1 info endpoints.
# A successful but malformed/changed list NEVER falls back; it must STOP.
# The fallback is NOT authorization to skip QA/staging separation or Worker binding.
$databaseRaw = @(& $wrangler.Source d1 list --json 2>$null)
$listExit = $LASTEXITCODE
if ($listExit -eq 0) {
    $databaseInfo = & $identityHelper -Json ($databaseRaw -join [Environment]::NewLine)
    Write-Host 'PASS: QA and protected staging D1 identities verified from full D1 listing.'
} else {
    Write-Host 'LIMIT: D1 LIST endpoint unavailable. Verifying BOTH individually queried database identities instead.'
    $qaInfoRaw = @(& $wrangler.Source d1 info $qaDatabase "--config=$qaD1Config" --json 2>$null)
    Require-Exit 'Read-only exact QA D1 INFO lookup'
    $stagingInfoRaw = @(& $wrangler.Source d1 info 'fire-app-staging-db' "--config=$qaD1Config" --json 2>$null)
    Require-Exit 'Read-only protected staging D1 INFO lookup'
    $databaseInfo = & $individualInfoHelper -QaJson ($qaInfoRaw -join [Environment]::NewLine) -StagingJson ($stagingInfoRaw -join [Environment]::NewLine)
    Write-Host 'PASS: Separate QA and protected staging identities verified from two exact D1 INFO responses.'
}
Require ($null -ne $databaseInfo -and
    $databaseInfo.qaName -ceq $qaDatabase -and $databaseInfo.qaUuid -ceq $qaId -and
    $databaseInfo.stagingName -ceq 'fire-app-staging-db' -and
    $databaseInfo.stagingUuid -ceq 'afb2c05a-d794-4a9a-b580-924ce01c26ad' -and
    $databaseInfo.qaUuid -cne $databaseInfo.stagingUuid
) 'Isolated QA and protected staging D1 identities must both match independent pinned physical resources. No publish.'
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
Require ($activeVersion -ceq $expectedActiveVersion) 'Active QA Worker differs from the owner-confirmed latest 100-percent serving version. STOP; do not deploy.'
$versionRaw = @(& $wrangler.Source versions view $activeVersion --name $workerName --json)
Require-Exit 'Authenticated read-only active QA Worker version metadata'
$bindingProof = & $bindingHelper -Json ($versionRaw -join [Environment]::NewLine) -ExpectedVersion $activeVersion -ExpectedDatabaseId $qaId
Require ($bindingProof.bindingVerified -eq $true -and $bindingProof.remoteWrites -eq $false) 'Active serving QA Worker does not prove exact physical DB binding.'
Write-Host ('PASS: Active QA Worker is exactly one 100-percent deployment: ' + $activeVersion)
Write-Host 'PASS: The serving version physically binds DB to the isolated QA D1 UUID; no R2 storage.'
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
