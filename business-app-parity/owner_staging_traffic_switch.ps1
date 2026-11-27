# Owner-only exact-version STAGING deployment. No uploads or credential changes.
[CmdletBinding()]
param([switch]$Execute)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$cli=Join-Path $PSScriptRoot 'owner_staging_traffic_switch.mjs'
$private=Join-Path $env:LOCALAPPDATA 'FIRE-STAGING-Private'
$consent='I AUTHORIZE STAGING C5B8DFE1 AT 100 PERCENT TRAFFIC ONLY'
function Require([bool]$ok,[string]$code){if(-not $ok){throw ('STAGING_TRAFFIC_PS_STOP_'+$code)}}
Require ($env:OS -eq 'Windows_NT' -and -not $env:CI -and -not $env:GITHUB_ACTIONS) 'OWNER_WINDOWS'
$node=Get-Command node.exe
foreach($name in @('g404-one-inactive-version-attempt-20261122.lock','g404-new-inactive-version-attempt-20261123.lock','g404-new-inactive-version-attempt-20261125-reviewed.lock','g404-new-inactive-version-attempt-20261126-dedicated-token.lock','g404-activation-ready-version-20261126.lock')){
 $p=Join-Path $private $name
 Require (Test-Path -LiteralPath $p -PathType Leaf) 'HISTORY'
 Require (-not ((Get-Item -LiteralPath $p -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'HISTORY_LINK'
}
Require (-not (Test-Path -LiteralPath (Join-Path $private 'g407-staging-traffic-switch-c5b8dfe1.lock'))) 'SPENT_NO_RETRY'
if(-not $Execute){Write-Output 'STAGING_TRAFFIC_SWITCH_LOCAL_PREFLIGHT_PASS';return}
Require (-not $env:CLOUDFLARE_API_KEY -and -not $env:CLOUDFLARE_EMAIL) 'LEGACY_AUTH'
$answer=Read-Host ('Type exactly: '+$consent)
Require ($answer -ceq $consent) 'CONSENT'
$secure=Read-Host 'Paste dedicated FIRE-STAGING-WORKER-UPLOAD token' -AsSecureString
$token=$null;$payload=$null
try{
 $token=[System.Net.NetworkCredential]::new('', $secure).Password
 Require ($token.Length -ge 20 -and $token.Length -le 4096 -and $token -notmatch '\s') 'TOKEN'
 $payload=[pscustomobject]@{token=$token;consent=$answer}
 $payload | ConvertTo-Json -Compress | & $node.Source $cli --execute
 Require ($LASTEXITCODE -eq 0) 'STOP_NO_RETRY'
}finally{$token=$null;$payload=$null;$secure.Dispose()}
