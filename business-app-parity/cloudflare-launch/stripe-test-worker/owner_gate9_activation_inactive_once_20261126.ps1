# FIRE G9 exact authorized ONE inactive TEST Worker version upload.
# Requires local sealed review package + Cloudflare write token and dedicated rk_test key.
# Reads secrets in hidden prompts only. No activation, traffic, payment or LIVE changes.
# Owner authorization recorded in Issue #19 #issuecomment-7199064695.
[CmdletBinding()]
param([string]$PackageRoot)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$script=Join-Path $PSScriptRoot 'owner_gate9_activation_inactive_once_20261126.mjs'
if(-not (Test-Path -LiteralPath $script -PathType Leaf)){throw 'STOP: Owner one-shot JS runner not present.'}
$node=Get-Command node -ErrorAction Stop
if(-not $PackageRoot){
    $choices=@(Get-ChildItem -LiteralPath $env:TEMP -Directory -Filter 'FIRE-G9-FINAL-REVIEW-*' -ErrorAction SilentlyContinue |
        Where-Object {Test-Path -LiteralPath (Join-Path $_.FullName 'activation-review-receipt.json') -PathType Leaf})
    if($choices.Count -ne 1){
        Write-Host ('Found '+$choices.Count+' sealed candidate directories directly in TEMP.')
        foreach($candidate in $choices){Write-Host ('REVIEW_FOLDER='+$candidate.FullName)}
        throw 'STOP: Pass -PackageRoot with the previously sealed FIRE-G9-FINAL-REVIEW directory; no upload attempted.'
    }
    $PackageRoot=$choices[0].FullName
}
$PackageRoot=[IO.Path]::GetFullPath($PackageRoot)
if(-not (Test-Path -LiteralPath (Join-Path $PackageRoot 'activation-review-receipt.json') -PathType Leaf)){
    throw 'STOP: No sealed receipt at specified review folder.'
}
if(-not (Test-Path -LiteralPath (Join-Path $PackageRoot 'gate9-one-inactive-provider-attempt-consumed-20261125.json') -PathType Leaf)){throw 'STOP: Historical lock required.'}
if(Test-Path -LiteralPath (Join-Path $PackageRoot 'gate9-one-inactive-provider-attempt-consumed-20261126.json')){
    throw 'STOP: One-shot upload already attempted. Never repeat. Reconcile existing versions read-only.'
}
function ConvertHidden([Security.SecureString]$secret){
    $ptr=[IntPtr]::Zero
    try{$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}
    finally{if($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}}
}
$cfSecret=$null
$stripeSecret=$null
try{
    Write-Host 'TARGET: fire-stripe-test-20261101 | upload ONE INACTIVE version only.'
    Write-Host 'Protected: predecessor 96e32262-fa33-4f04-a161-bee11f0353e2 at 100%; NO deployment/activation.'
    Write-Host 'Secret entry is HIDDEN. Never paste keys into ChatGPT, screenshots, or GitHub.'
    $cfSecret=Read-Host 'Cloudflare API token with exact TEST Worker version write permission' -AsSecureString
    $stripeSecret=Read-Host 'Verified dedicated rk_test secret key (not sk_test, not LIVE)' -AsSecureString
    $env:CLOUDFLARE_API_TOKEN=ConvertHidden $cfSecret
    $env:FIRE_G9_RESTRICTED_TEST_KEY=ConvertHidden $stripeSecret
    & $node.Source --check $script
    if($LASTEXITCODE -ne 0){throw 'STOP: Owner runner JavaScript syntax check failed; no upload.'}
    & $node.Source $script $PackageRoot --execute-authorized-7199064695
    if($LASTEXITCODE -ne 0){throw 'STOP: One-shot runner blocked. Do not retry; capture only sanitized STOP code.'}
    Write-Host 'ONE_INACTIVE_UPLOAD_COMPLETE_IF_VERSION_READBACK_PASS'
}finally{
    Remove-Item Env:\CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
    Remove-Item Env:\FIRE_G9_RESTRICTED_TEST_KEY -ErrorAction SilentlyContinue
    $cfSecret=$null; $stripeSecret=$null
    [GC]::Collect()
}
