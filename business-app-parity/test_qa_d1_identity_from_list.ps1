# Synthetic, offline behavior tests of FIRE QA's read-only D1-list verifier.
# No Wrangler, remote D1 calls, payments, or secrets are touched.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$helper = Join-Path $PSScriptRoot 'qa_d1_identity_from_list.ps1'
function Record([string]$name,[string]$uuid) {
    [PSCustomObject]@{name=$name;uuid=$uuid;num_tables=0}
}
$qa = Record 'fire-fullapp-qa-db-20261016' '8ccfb1f8-1657-4074-b1b2-47de78f95003'
$staging = Record 'fire-app-staging-db' 'afb2c05a-d794-4a9a-b580-924ce01c26ad'
function Check([object[]]$records,[bool]$valid,[string]$label) {
    $json = ConvertTo-Json -InputObject $records -Depth 6 -Compress
    $passed = $false
    try {
        $result = & $helper -Json $json
        if ($valid) {
            if ($result.qaUuid -ne $qa.uuid -or $result.stagingUuid -ne $staging.uuid) {
                throw 'Validator returned wrong identities.'
            }
            $passed = $true
        }
    } catch {
        if (-not $valid) { $passed = $true }
        else { throw ('FIRE TEST FAILURE (' + $label + '): ' + $_.Exception.Message) }
    }
    if (-not $passed) { throw ('FIRE TEST FAILURE: ' + $label) }
}
Check @($qa,$staging) $true 'Exactly correct QA and protected staging, even with num_tables=0'
Check @($staging,$qa,(Record 'other-db' 'eabb4567-d7cc-48e9-9999-cfaf6f479589')) $true 'Order independent and unrelated additional D1'
Check @($qa) $false 'Missing protected staging'
Check @($staging) $false 'Missing isolated QA'
Check @($qa,$qa,$staging) $false 'Duplicate QA matches'
Check @($qa,$staging,$staging) $false 'Duplicate staging matches'
Check @((Record $qa.name '11111111-1111-4111-8111-111111111111'),$staging) $false 'Same QA name with wrong UUID'
Check @((Record 'attacker-db' $qa.uuid),$staging) $false 'Same QA UUID with wrong name'
Check @($qa,(Record $staging.name '22222222-2222-4222-8222-222222222222')) $false 'Protected staging UUID changed'
Check @($qa,(Record 'wrong-name' $staging.uuid)) $false 'Protected staging name changed'
Check @($qa,(Record $staging.name $qa.uuid)) $false 'QA/staging UUID collision'
Check @($qa,([PSCustomObject]@{name='fire-app-staging-db'})) $false 'Missing UUID field'
Check @($qa,([PSCustomObject]@{uuid=$staging.uuid})) $false 'Missing name field'
foreach ($malformed in @('{', '{"name":"fire-fullapp-qa-db-20261016"}', 'null')) {
    $rejected = $false
    try { $null = & $helper -Json $malformed } catch { $rejected = $true }
    if (-not $rejected) { throw ('FIRE TEST FAILURE: Non-array/malformed JSON accepted: ' + $malformed) }
}
Write-Host 'PASS: D1 list strict exact QA/staging name+UUID, collision/missing/malformed rejection, zero table-count metadata tolerated, no remote calls.'
