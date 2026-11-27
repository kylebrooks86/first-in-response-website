# Source-only offline proof: no owner consent for known remote Vite asset drift.
$ErrorActionPreference='Stop'
$path=Join-Path $PSScriptRoot 'owner_gate9_inactive_version_upload.ps1'
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors)
if(@($errors).Count -ne 0){throw 'Gate9 upload PowerShell syntax invalid'}
$fn=@($ast.FindAll({param($x) $x -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $x.Name -eq 'Assert-RemoteAssetsNotChanged'},$true))
if($fn.Count -ne 1){throw 'Exactly one authenticated preconsent remote-assets comparator required'}
. ([scriptblock]::Create($fn[0].Extent.Text))
function Assert([bool]$ok,[string]$message){if(-not $ok){throw ('STOP: '+$message)}}
function ExitCheck([string]$label){Assert ($LASTEXITCODE -eq 0) $label}
function MockWrangler { $script:mockJson }
$script:Wrangler='MockWrangler'
$script:Worker='fire-stripe-test-20261101'
$global:LASTEXITCODE=0
$prior='96e32262-fa33-4f04-a161-bee11f0353e2'
function Check([bool]$ok,[string]$label){if(-not $ok){throw ('OFFLINE TEST FAIL: '+$label)}}
function Json([object]$resources,[string]$id=$prior){
  ConvertTo-Json -InputObject @{id=$id;resources=$resources} -Depth 20 -Compress
}
$old=[ordered]@{script=@{};script_runtime=@{};bindings=@(@{name='DB';type='d1';id='dba421ba-fc66-4cf8-9c31-51616f8249ba'})}
$script:mockJson=Json $old
$minimal=[pscustomobject]@{name='fire-stripe-test-20261101'}
Check ([bool](Assert-RemoteAssetsNotChanged $prior $minimal)) 'Source-only candidate with no assets matches no-assets existing Worker'
$withAssets=[pscustomobject]@{name='fire-stripe-test-20261101';assets=[pscustomobject]@{directory='../client';binding='ASSETS'}}
$blocked=$false
try{$null=Assert-RemoteAssetsNotChanged $prior $withAssets}catch{$blocked=$_.Exception.Message -match 'STOP BEFORE CONSENT'}
Check $blocked 'Actual Vite +ASSETS candidate must STOP before owner approval'
foreach($bad in @(
  [pscustomobject]@{why='remote assets';payload=(Json ([ordered]@{script=@{};script_runtime=@{};bindings=@();assets=@{}}));candidate=$minimal},
  [pscustomobject]@{why='remote resources missing';payload=(Json ([ordered]@{script=@{};bindings=@()}));candidate=$minimal},
  [pscustomobject]@{why='unexpected source version';payload=(Json $old '11111111-2222-4333-8444-555555555555');candidate=$minimal},
  [pscustomobject]@{why='malformed response';payload='not-json';candidate=$minimal}
)){
  $script:mockJson=$bad.payload
  $refused=$false
  try{$null=Assert-RemoteAssetsNotChanged $prior $bad.candidate}catch{$refused=$true}
  Check $refused ('Refuse '+$bad.why)
}
$scriptSource=Get-Content -LiteralPath $path -Raw
$before=$scriptSource.IndexOf("& "+'$Wrangler deploy --config $review --dry-run --outdir $globalDry')
$check=$scriptSource.IndexOf('Assert-RemoteAssetsNotChanged $PriorVersion $cfg')
$consent=$scriptSource.IndexOf("Read-Host 'Exact owner inactive-upload approval'")
$upload=$scriptSource.IndexOf('& $Wrangler versions upload --config $review --keep-vars --strict')
Check ($before -ge 0 -and $check -gt $before -and $consent -gt $check -and $upload -gt $consent) 'Authenticated remote parity check MUST precede owner consent and actual write'
Check (($scriptSource -match 'if\(-not \$Upload\)') -and $scriptSource.Contains('--strict')) 'Inactive-only strict uploading remains owner opt-in'
Write-Host 'PASS: Two remote/code-only asset states and 5 unsafe drifts fail closed BEFORE owner prompt. No Cloudflare access, secret values or uploads.'
