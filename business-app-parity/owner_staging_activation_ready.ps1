# Owner only. Never switches traffic. No admin hash is decrypted.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$PackageDirectory,[switch]$Execute)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$cli=Join-Path $PSScriptRoot 'owner_staging_activation_ready.mjs'
$private=Join-Path $env:LOCALAPPDATA 'FIRE-STAGING-Private'
$consent='I AUTHORIZE ONE INACTIVE ACTIVATION-READY STAGING VERSION ONLY'
function Require([bool]$ok,[string]$code){if(-not $ok){throw ('STAGING_ACTIVATION_PS_STOP_'+$code)}}
Require ($env:OS -eq 'Windows_NT' -and -not $env:CI -and -not $env:GITHUB_ACTIONS) 'OWNER_WINDOWS'
$node=Get-Command node.exe
$folder=(Resolve-Path -LiteralPath $PackageDirectory).Path
Require ((Get-FileHash -LiteralPath (Join-Path $folder 'staging-noassets-dark-source-receipt.json') -Algorithm SHA256).Hash -ceq 'F811CC2D7E4B1C37E21D7D28D6ABA31215897AC89F5A2E756FBF9E258C1D525A') 'PACKAGE'
foreach($name in @('g404-one-inactive-version-attempt-20261122.lock','g404-new-inactive-version-attempt-20261123.lock','g404-new-inactive-version-attempt-20261125-reviewed.lock','g404-new-inactive-version-attempt-20261126-dedicated-token.lock')){
 $p=Join-Path $private $name
 Require (Test-Path -LiteralPath $p -PathType Leaf) 'HISTORY'
 Require (-not ((Get-Item -LiteralPath $p -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'HISTORY_LINK'
}
Require (-not (Test-Path -LiteralPath (Join-Path $private 'g404-activation-ready-version-20261126.lock'))) 'SPENT_NO_RETRY'
if(-not $Execute){Write-Output 'STAGING_ACTIVATION_READY_OPERATOR_LOCAL_PREFLIGHT_PASS';return}
Require (-not $env:CLOUDFLARE_API_KEY -and -not $env:CLOUDFLARE_EMAIL) 'LEGACY_AUTH'
$answer=Read-Host ('Type exactly: '+$consent)
Require ($answer -ceq $consent) 'CONSENT'
$secure=Read-Host 'Paste dedicated FIRE-STAGING-WORKER-UPLOAD token' -AsSecureString
$token=$null;$payload=$null
try{
 $token=[System.Net.NetworkCredential]::new('', $secure).Password
 Require ($token.Length -ge 20 -and $token.Length -le 4096 -and $token -notmatch '\s') 'TOKEN'
 $payload=[pscustomobject]@{token=$token;consent=$answer}
 $payload | ConvertTo-Json -Compress | & $node.Source $cli --execute $folder
 Require ($LASTEXITCODE -eq 0) 'STOP_NO_RETRY'
}finally{$token=$null;$payload=$null;$secure.Dispose()}
