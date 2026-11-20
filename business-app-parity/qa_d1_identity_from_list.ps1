# FIRE QA: Pure validation of Wrangler's read-only D1 LIST JSON.
# No Cloudflare commands, SQL queries, writes or credential access occur here.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Json)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$qaName = 'fire-fullapp-qa-db-20261016'
$qaUuid = '8ccfb1f8-1657-4074-b1b2-47de78f95003'
$stagingName = 'fire-app-staging-db'
$stagingUuid = 'afb2c05a-d794-4a9a-b580-924ce01c26ad'

function Require-Identity([bool]$ok,[string]$reason) {
    if (-not $ok) { throw ('FIRE QA IDENTITY STOP: ' + $reason) }
}
try { $parsed = ConvertFrom-Json -InputObject $Json -ErrorAction Stop }
catch { throw 'FIRE QA IDENTITY STOP: Cloudflare D1 list did not return valid JSON.' }
# Wrangler d1 list must return a JSON array. No schema/table-count inference:
# Cloudflare's list metadata can display num_tables=0 for a populated D1.
Require-Identity ($Json.TrimStart().StartsWith('[')) 'D1 list must be a JSON array, not an individual database info object.'
$entries = @($parsed)
Require-Identity ($entries.Count -ge 2) 'Expected the isolated QA and protected older staging databases.'
foreach ($entry in $entries) {
    Require-Identity ($null -ne $entry) 'Malformed null D1 database entry.'
    Require-Identity (($entry.PSObject.Properties.Name -contains 'name') -and
        ($entry.PSObject.Properties.Name -contains 'uuid') -and
        ($entry.name -is [string]) -and ($entry.uuid -is [string])) 'D1 listing entry is missing a valid name or UUID.'
}
# A name OR UUID collision is an error. The known protected staging DB is
# checked only for identity, never selected as the QA deployment target.
$qaMatches = @($entries | Where-Object { $_.name -ceq $qaName -or $_.uuid -ceq $qaUuid })
$stagingMatches = @($entries | Where-Object { $_.name -ceq $stagingName -or $_.uuid -ceq $stagingUuid })
Require-Identity ($qaMatches.Count -eq 1 -and $qaMatches[0].name -ceq $qaName -and
    $qaMatches[0].uuid -ceq $qaUuid) 'Isolated QA database name/UUID is missing, duplicated, or mismatched.'
Require-Identity ($stagingMatches.Count -eq 1 -and $stagingMatches[0].name -ceq $stagingName -and
    $stagingMatches[0].uuid -ceq $stagingUuid) 'Protected staging database name/UUID is missing, duplicated, or mismatched.'
Require-Identity ($qaMatches[0].uuid -cne $stagingMatches[0].uuid) 'QA and protected staging databases must be distinct.'
# Return only verified identities. Do not expose customer data or stale list
# metadata; migration and functional evidence are checked separately.
[PSCustomObject]@{
    qaName = $qaName
    qaUuid = $qaUuid
    stagingName = $stagingName
    stagingUuid = $stagingUuid
}
