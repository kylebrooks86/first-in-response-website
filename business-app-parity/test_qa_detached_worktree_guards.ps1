# Execute the actual builder/reviewer Git guards against disposable local Git.
# No provider executable, credentials, external network, user checkout or build.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$gitName = if ($env:OS -ceq 'Windows_NT') { 'git.exe' } else { 'git' }
$git = Get-Command $gitName -ErrorAction Stop
$fixtureRoot = Join-Path $env:RUNNER_TEMP ('fire-detached-guards-' + [guid]::NewGuid().ToString('N'))
$branch = 'work/fire-detached-synthetic-fixture'
$cases = @(
    @{name='attached-default';detached=$false;opt=$false;pin='head';pass=$true},
    @{name='detached-explicit';detached=$true;opt=$true;pin='head';pass=$true},
    @{name='detached-default-denied';detached=$true;opt=$false;pin='head';pass=$false},
    @{name='attached-opt-in-denied';detached=$false;opt=$true;pin='head';pass=$false},
    @{name='missing-pin-denied';detached=$true;opt=$true;pin='';pass=$false},
    @{name='wrong-pin-denied';detached=$true;opt=$true;pin='wrong';pass=$false},
    @{name='origin-mismatch-denied';detached=$true;opt=$true;pin='head';pass=$false},
    @{name='tracked-edit-denied';detached=$true;opt=$true;pin='head';pass=$false}
)
$checks = 0
function Require([bool]$ok,[string]$reason) { if (-not $ok) { throw $reason } }
function Assert-True([bool]$ok,[string]$reason) { Require $ok $reason }
function Require-Exit([string]$reason) { Require ($LASTEXITCODE -eq 0) $reason }
function Check-Exit([string]$reason) { Require-Exit $reason }
try {
    New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
    foreach ($script in @('owner_windows_build_qa_candidate.ps1','owner_windows_qa_update_review.ps1')) {
        $source = Get-Content -LiteralPath (Join-Path $PSScriptRoot $script) -Raw
        $start = $source.IndexOf('$actualBranch =')
        $endMarker = if ($script -like '*build*') { '$node = Get-Command' } else { '$candidate = Join-Path' }
        $end = $source.IndexOf($endMarker,$start)
        Require ($start -ge 0 -and $end -gt $start) 'Actual source guards not found.'
        $guard = [scriptblock]::Create($source.Substring($start,$end-$start))
        foreach ($case in $cases) {
            $repo = Join-Path $fixtureRoot ([guid]::NewGuid().ToString('N'))
            & $git.Source init --quiet -b $branch $repo
            Require-Exit 'Synthetic Git init'
            Set-Content -LiteralPath (Join-Path $repo 'synthetic.txt') -Value 'synthetic only'
            & $git.Source -C $repo add synthetic.txt
            & $git.Source -C $repo -c user.name=Fixture -c user.email=fixture@example.invalid commit --quiet -m synthetic
            Require-Exit 'Synthetic first commit'
            $parent = (& $git.Source -C $repo rev-parse HEAD).Trim()
            & $git.Source -C $repo -c user.name=Fixture -c user.email=fixture@example.invalid commit --quiet --allow-empty -m second
            Require-Exit 'Synthetic second commit'
            $fixtureHead = (& $git.Source -C $repo rev-parse HEAD).Trim()
            $remoteHead = if ($case.name -ceq 'origin-mismatch-denied') { $parent } else { $fixtureHead }
            & $git.Source -C $repo update-ref ('refs/remotes/origin/'+$branch) $remoteHead
            Require-Exit 'Synthetic local tracking ref'
            if ($case.detached) {
                & $git.Source -C $repo switch --quiet --detach $fixtureHead
                Require-Exit 'Synthetic detached HEAD'
            }
            if ($case.name -ceq 'tracked-edit-denied') { Add-Content -LiteralPath (Join-Path $repo 'synthetic.txt') -Value 'unsaved synthetic edit' }
            $ExpectedCommit = if ($case.pin -ceq 'head') { $fixtureHead } elseif ($case.pin -ceq 'wrong') { $parent } else { '' }
            $AllowDetachedWorktree = [bool]$case.opt
            $succeeded = $true
            try { & $guard } catch { $succeeded = $false }
            Require ($succeeded -eq $case.pass) ($script+': '+$case.name+' returned unexpected guard result')
            Require ((& $git.Source -C $repo rev-parse HEAD).Trim() -ceq $fixtureHead) 'Guard changed synthetic HEAD.'
            $checks++
            Write-Host ('PASS: '+$script+' '+$case.name)
        }
    }
    Write-Host ('PASS '+$checks+'/16 actual Git guard cases; local synthetic fixtures only.')
} finally {
    if (Test-Path -LiteralPath $fixtureRoot) { Remove-Item -LiteralPath $fixtureRoot -Recurse -Force }
}
