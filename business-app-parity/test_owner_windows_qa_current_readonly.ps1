# Offline-only contract test. Intercepts Wrangler locally; NEVER calls Cloudflare.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$target = Join-Path $PSScriptRoot 'owner_windows_qa_current_readonly.ps1'
$root = Join-Path $env:RUNNER_TEMP ('fire-qa-readonly-fixtures-' + [guid]::NewGuid().ToString('N'))
New-Item -Path $root -ItemType Directory -ErrorAction Stop | Out-Null
$mock = Join-Path $root 'fixture-wrangler.ps1'
$journal = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'adapters/doomsday/drizzle') -Filter '*.sql' -File | Sort-Object Name | ForEach-Object { $_.Name })
if ($journal.Count -ne 25) { throw 'Fixture requires exactly 25 checked-in migrations.' }

$fake = @'
# No outbound network or provider access. Returned JSON contains only synthetic identities and metadata.
$ErrorActionPreference = 'Stop'
$arguments = @($args)
$kind = if ($arguments.Count -ge 2) { "$($arguments[0]) $($arguments[1])" } else { 'invalid' }
$prior = if (Test-Path -LiteralPath $env:FIRE_FAKE_CALL_LOG) { @(Get-Content -LiteralPath $env:FIRE_FAKE_CALL_LOG) } else { @() }
$priorStatus = @($prior | Where-Object { $_ -eq 'deployments status' }).Count
[System.IO.File]::AppendAllText($env:FIRE_FAKE_CALL_LOG, "$kind`n")
$global:LASTEXITCODE = 0
$scenario = $env:FIRE_FAKE_SCENARIO
if ($scenario -eq 'provider-failed' -and $kind -eq 'd1 list') { $global:LASTEXITCODE = 7; Write-Output '{}'; return }
if ($scenario -eq 'malformed-json' -and $kind -eq 'd1 list') { Write-Output '{not-valid-json'; return }
switch ($kind) {
  'd1 list' {
    $qa = @{name='fire-fullapp-qa-db-20261016';uuid='8ccfb1f8-1657-4074-b1b2-47de78f95003'}
    $staging = @{name='fire-app-staging-db';uuid='afb2c05a-d794-4a9a-b580-924ce01c26ad'}
    if ($scenario -eq 'wrong-db') { $qa.uuid = 'ffffffff-ffff-4fff-8fff-ffffffffffff' }
    Write-Output (ConvertTo-Json -InputObject @($qa,$staging) -Compress -Depth 6)
  }
  'deployments status' {
    $version = '1783ded7-43db-4769-8708-fa86c47b002d'
    if ($scenario -eq 'stale-previous-version') { $version = 'db6ef897-edd3-439e-8679-b6f6620f18af' }
    if ($scenario -eq 'wrong-version' -or ($scenario -eq 'version-changed-during-check' -and $priorStatus -ge 1)) {
      $version = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    }
    $versions = @(@{version_id=$version;percentage=100})
    if ($scenario -eq 'split-traffic') {
      $versions=@(@{version_id=$version;percentage=50},@{version_id='ffffffff-ffff-4fff-8fff-ffffffffffff';percentage=50})
    }
    Write-Output (ConvertTo-Json -InputObject @{versions=$versions} -Compress -Depth 6)
  }
  'versions view' {
    $version='1783ded7-43db-4769-8708-fa86c47b002d'
    $physicalDb='8ccfb1f8-1657-4074-b1b2-47de78f95003'
    $binding=@{type='d1';name='DB';id=$physicalDb}
    if ($scenario -eq 'wrong-physical-db' -or ($scenario -eq 'changed-physical-db-during-check' -and $priorStatus -ge 2)) { $binding.id='ffffffff-ffff-4fff-8fff-ffffffffffff' }
    if ($scenario -eq 'wrong-detailed-version') { $version='ffffffff-ffff-4fff-8fff-ffffffffffff' }
    $bindings=@($binding)
    if ($scenario -eq 'duplicate-physical-db') { $bindings+=@{type='d1';name='ADDITIONAL';id='ffffffff-ffff-4fff-8fff-ffffffffffff'} }
    if ($scenario -eq 'unexpected-r2') { $bindings+=@{type='r2_bucket';name='BUCKET'} }
    if ($scenario -eq 'missing-binding') { $bindings=@() }
    Write-Output (ConvertTo-Json -InputObject @{id=$version;number=17;resources=@{bindings=$bindings}} -Compress -Depth 8)
  }
  'd1 execute' {
    $commands=@($arguments | Where-Object { $_.StartsWith('--command=') })
    if ($arguments.Count -ne 7 -or $arguments[2] -cne 'fire-fullapp-qa-db-20261016' -or
        $arguments[3] -cne '--remote' -or $commands.Count -ne 1 -or
        -not $commands[0].Substring(10).StartsWith('SELECT ') -or
        $commands[0].Contains(';')) { throw 'Mock refuses any non-pinned or writable SQL request.' }
    $row = @{journal_names=$env:FIRE_FAKE_JOURNAL;required_tables=8;provider_index=1;agreement_triggers=2}
    if ($scenario -eq 'journal-short') { $row.journal_names = (@($row.journal_names.Split('|') | Select-Object -SkipLast 1) -join '|') }
    if ($scenario -eq 'missing-table') { $row.required_tables = 7 }
    if ($scenario -eq 'missing-index') { $row.provider_index = 0 }
    if ($scenario -eq 'missing-trigger') { $row.agreement_triggers = 1 }
    Write-Output (ConvertTo-Json -InputObject @(@{success=$true;results=@($row)}) -Compress -Depth 6)
  }
  default { throw "Mock refuses unreviewed operation: $kind" }
}
'@
Set-Content -LiteralPath $mock -Value $fake -Encoding UTF8
$env:FIRE_FAKE_JOURNAL = $journal -join '|'
$env:FIRE_FAKE_CALL_LOG = Join-Path $root 'commands.txt'
$mockSource = $mock

# Shadow only Get-Command wrangler.cmd. All provider requests go to local PowerShell fixture.
function global:Get-Command {
    [CmdletBinding()]
    param([Parameter(Position=0)][string]$Name)
    if ($Name -ceq 'wrangler.cmd') { return [pscustomobject]@{Source=$mockSource} }
    throw 'Offline test blocks all other external command resolution.'
}
$cases = @(
  @{name='healthy';pass=$true;calls=7},
  @{name='wrong-db';pass=$false;calls=1},
  @{name='wrong-version';pass=$false;calls=2},
  @{name='stale-previous-version';pass=$false;calls=2},
  @{name='split-traffic';pass=$false;calls=2},
  @{name='wrong-physical-db';pass=$false;calls=3},
  @{name='changed-physical-db-during-check';pass=$false;calls=7},
  @{name='wrong-detailed-version';pass=$false;calls=3},
  @{name='duplicate-physical-db';pass=$false;calls=3},
  @{name='unexpected-r2';pass=$false;calls=3},
  @{name='missing-binding';pass=$false;calls=3},
  @{name='journal-short';pass=$false;calls=4},
  @{name='missing-table';pass=$false;calls=4},
  @{name='missing-index';pass=$false;calls=4},
  @{name='missing-trigger';pass=$false;calls=4},
  @{name='version-changed-during-check';pass=$false;calls=6},
  @{name='provider-failed';pass=$false;calls=1},
  @{name='malformed-json';pass=$false;calls=1}
)
$checks = 0
try {
    foreach ($c in $cases) {
        $env:FIRE_FAKE_SCENARIO = $c.name
        Set-Content -LiteralPath $env:FIRE_FAKE_CALL_LOG -Value '' -NoNewline
        $failed = $false
        $messages = ''
        try { $messages = (& $target 2>&1 6>&1 | Out-String) }
        catch { $failed = $true; $messages += $_.Exception.Message }
        $expected = -not $c.pass
        if ($failed -ne $expected) { throw "Scenario $($c.name): expected failure=$expected; observed=$failed; output=$messages" }
        if ($c.pass -and ($messages -notmatch 'PASS: All 25 migration names' -or $messages -notmatch 'PASS: Active Worker version physical DB binding')) { throw 'Healthy test lacks schema and physical-binding PASS.' }
        if (-not $c.pass -and $messages -match 'REMOTE_WRITES=NONE; DEPLOYED=NO') { throw "Failure $($c.name) improperly claimed PASS." }
        $actual = @(Get-Content -LiteralPath $env:FIRE_FAKE_CALL_LOG | Where-Object { $_.Trim() }).Count
        if ($actual -ne $c.calls) { throw "Scenario $($c.name) invoked $actual provider read commands, expected $($c.calls)." }
        $commands = @(Get-Content -LiteralPath $env:FIRE_FAKE_CALL_LOG | Where-Object { $_.Trim() })
        foreach ($cmd in $commands) {
            if ($cmd -cnotin @('d1 list','deployments status','versions view','d1 execute')) { throw 'Unexpected provider command in read-only test.' }
        }
        $checks++
        Write-Host ("PASS: " + $c.name + " (mock read calls " + $actual + ")")
    }
    Write-Host ("PASS " + $checks + "/" + $cases.Count + " safe QA current-readonly scenarios; no real Wrangler or network used.")
}
finally {
    Remove-Item -Path Function:\Get-Command -ErrorAction SilentlyContinue
    Remove-Item Env:\FIRE_FAKE_JOURNAL,Env:\FIRE_FAKE_CALL_LOG,Env:\FIRE_FAKE_SCENARIO -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}
