# Offline only: execute only the GitHub JSON-list normalization expression from V3.
# No Wrangler, no Cloudflare, no Stripe, no network.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$source = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'initialize-empty-test-d1-v3.ps1')
$startMarker = '$entries = New-Object'
$endMarker = 'if ($sqlFiles.Count -ne 25)'
$start = $source.IndexOf($startMarker)
$end = $source.IndexOf($endMarker)
if ($start -lt 0 -or $end -le $start) { throw 'STOP: migration parser markers missing' }
$snippet = $source.Substring($start, $end - $start)
$fake = @(0..24 | ForEach-Object {
  [pscustomobject]@{ name = ('{0:D4}_offline-test.sql' -f $_); type='file' }
})
$cases = @(
  [pscustomobject]@{ label='flat'; response=$fake },
  [pscustomobject]@{ label='wrapped'; response=(,$fake) }
)
foreach ($testCase in $cases) {
  $rawDirectory=$testCase.response
  Invoke-Expression $snippet
  if ($sqlFiles.Count -ne 25 -or $sqlFiles[0].name -ne '0000_offline-test.sql' -or $sqlFiles[24].name -ne '0024_offline-test.sql') {
    throw ('STOP: ' + $testCase.label + ' array normalization produced ' + $sqlFiles.Count)
  }
  Write-Host ('PASS: offline ' + $testCase.label + ' GitHub JSON list yields exactly 25 migration files.')
}
