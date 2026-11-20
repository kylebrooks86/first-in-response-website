# Offline synthetic regression for individually validated QA/staging Cloudflare D1 info.
# Never connects to any account, exports SQL, deploys code, or writes data.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$validator = Join-Path $PSScriptRoot 'qa_d1_identity_from_info.ps1'
if (-not (Test-Path -LiteralPath $validator -PathType Leaf)) { throw 'Missing D1 INFO validator' }
$qa = '{"name":"fire-fullapp-qa-db-20261016","uuid":"8ccfb1f8-1657-4074-b1b2-47de78f95003","num_tables":0}'
$stage = '{"name":"fire-app-staging-db","uuid":"afb2c05a-d794-4a9a-b580-924ce01c26ad","num_tables":0}'
$r = & $validator -QaJson $qa -StagingJson $stage
if ($r.qaName -cne 'fire-fullapp-qa-db-20261016' -or
    $r.qaUuid -cne '8ccfb1f8-1657-4074-b1b2-47de78f95003' -or
    $r.stagingName -cne 'fire-app-staging-db' -or
    $r.stagingUuid -cne 'afb2c05a-d794-4a9a-b580-924ce01c26ad' -or
    $r.evidence -cne 'independently-queried-d1-info') { throw 'Exact individual D1 identities not validated' }
function Expect-Stop([string]$reason, [string]$q, [string]$s) {
  $stopped = $false
  try { $null = & $validator -QaJson $q -StagingJson $s }
  catch { $stopped = $true }
  if (-not $stopped) { throw ('Unexpectedly accepted unsafe D1 INFO response: ' + $reason) }
}
Expect-Stop 'QA name collision' ($qa.Replace('fire-fullapp-qa-db-20261016','fire-app-staging-db')) $stage
Expect-Stop 'QA wrong UUID' ($qa.Replace('8ccfb1f8-1657-4074-b1b2-47de78f95003','00000000-0000-0000-0000-000000000001')) $stage
Expect-Stop 'staging wrong UUID' $qa ($stage.Replace('afb2c05a-d794-4a9a-b580-924ce01c26ad','8ccfb1f8-1657-4074-b1b2-47de78f95003'))
Expect-Stop 'staging wrong name' $qa ($stage.Replace('fire-app-staging-db','fire-app-staging-mistake'))
Expect-Stop 'malformed QA info' '{not-json' $stage
Expect-Stop 'list substituted for QA object' ('[' + $qa + ']') $stage
Expect-Stop 'missing staging UUID' $qa '{"name":"fire-app-staging-db"}'
Expect-Stop 'missing QA name' '{"uuid":"8ccfb1f8-1657-4074-b1b2-47de78f95003"}' $stage
Expect-Stop 'empty QA info' ' ' $stage
Write-Host 'PASS: Strict individual D1 INFO identity and all negative controls (synthetic/offline only).'
