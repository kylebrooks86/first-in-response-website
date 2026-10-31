# FIRE active QA Worker-to-physical-D1 binding check.
# Input: JSON from authenticated `wrangler.cmd versions view <id> --name <worker> --json`.
# This program NEVER contacts Cloudflare, prints raw binding values, or writes resources.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Json,
  [Parameter(Mandatory=$true)][string]$ExpectedVersion,
  [Parameter(Mandatory=$true)][string]$ExpectedDatabaseId
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

function Stop-QA([string]$reason) { throw ('FIRE QA WORKER BINDING STOP: ' + $reason) }
if ($ExpectedVersion -cnotmatch '^[0-9a-f]{8}-[0-9a-f-]{27,}$' -or
    $ExpectedDatabaseId -cnotmatch '^[0-9a-f]{8}-[0-9a-f-]{27,}$') {
  Stop-QA 'Exact reviewed Worker and database identifiers required.'
}
try { $version = ConvertFrom-Json -InputObject $Json -ErrorAction Stop }
catch { Stop-QA 'Worker version metadata was not valid JSON.' }
if ($null -eq $version -or $version -is [array]) { Stop-QA 'Ambiguous Worker version metadata.' }
if ($null -eq $version.id -or [string]$version.id -cne $ExpectedVersion) {
  Stop-QA 'Detailed version identity differs from active 100-percent deployment.'
}
if ($null -eq $version.number -or -not ([string]$version.number -match '^[1-9][0-9]*$')) {
  Stop-QA 'Detailed Worker version number is absent or invalid.'
}
if ($null -eq $version.resources -or $null -eq $version.resources.bindings) {
  Stop-QA 'Deployed Worker has no inspectable resource binding list.'
}
$allBindings = @($version.resources.bindings)
if ($allBindings.Count -lt 1) { Stop-QA 'Empty deployed Worker binding list.' }
$d1 = @($allBindings | Where-Object { $null -ne $_ -and $_.type -ceq 'd1' })
$r2 = @($allBindings | Where-Object { $null -ne $_ -and $_.type -in @('r2_bucket','r2') })
if ($d1.Count -ne 1) { Stop-QA 'QA Worker must have exactly one physical D1 resource.' }
if ([string]$d1[0].name -cne 'DB' -or [string]$d1[0].id -cne $ExpectedDatabaseId) {
  Stop-QA 'QA Worker DB binding does not match its isolated physical D1 UUID.'
}
if ($r2.Count -ne 0) { Stop-QA 'Synthetic QA Worker unexpectedly has cloud photo storage.' }
# A fresh read of deployments status must be made separately before remote publication.
# A version view alone does not attest current traffic or sign a source/build digest.
[pscustomobject]@{bindingVerified=$true;version=$ExpectedVersion;databaseId=$ExpectedDatabaseId;d1Binding='DB';remoteWrites=$false}
