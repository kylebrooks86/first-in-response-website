# Gate 9 OFFLINE unit tests: only extract the pure version-ID parser from
# the owner script. Never execute its top-level Cloudflare/Stripe operations.
$ErrorActionPreference='Stop'
$src=Join-Path $PSScriptRoot 'owner_gate9_inactive_version_upload.ps1'
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($src,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw 'Test input PowerShell parse failed'}
$fn=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-StrictVersionIds'},$true))
if($fn.Count -ne 1){throw 'Require exactly one version ID parser'}
# Run the isolated, inspected PURE function definition, not the deployment script.
. ([scriptblock]::Create($fn[0].Extent.Text))
function Check([bool]$pass,[string]$why){if(-not $pass){throw ('FAIL: '+$why)}}
function MustReject($payload,[string]$why){
  $rejected=$false
  try{$null=Get-StrictVersionIds $payload}catch{$rejected=$true}
  Check $rejected $why
}
$a='96e32262-fa33-4f04-a161-bee11f0353e2'
$b='11111111-2222-4333-8444-555555555555'
$x=@([pscustomobject]@{id=$a},[pscustomobject]@{version_id=$b})
$one=@(Get-StrictVersionIds $x)
Check ($one.Count -eq 2 -and $one[0] -eq $a -and $one[1] -eq $b) 'provider flat array'
$two=@(Get-StrictVersionIds ([pscustomobject]@{versions=$x}))
Check ($two.Count -eq 2 -and $two[1] -eq $b) 'versions envelope'
$three=@(Get-StrictVersionIds ([pscustomobject]@{result=[pscustomobject]@{versions=$x}}))
Check ($three.Count -eq 2 -and $three[0] -eq $a) 'result versions envelope'
$four=@(Get-StrictVersionIds ([pscustomobject]@{result=$x}))
Check ($four.Count -eq 2 -and $four[1] -eq $b) 'result array envelope'
MustReject ([pscustomobject]@{other=$x}) 'unknown list envelope must fail'
MustReject @([pscustomobject]@{id=$a},[pscustomobject]@{id=$a}) 'duplicate version IDs must fail'
MustReject @([pscustomobject]@{id='not-a-version'}) 'malformed version ID must fail'
MustReject @() 'empty version list must fail'
Write-Host 'PASS: Eight OFFLINE version ID parser cases. No network, no hosted write.'
# Cloudflare versions list is a recent window (10 most recent in the CLI docs).
# An old *active* version can validly be absent from this window. The
# upload script separately verifies the 100%-active predecessor through
# deployments status and immutable versions view. Do not fail merely because
# that old version has rolled off the recent-list response.
$window=@(1..10|ForEach-Object {
  [pscustomobject]@{id=('11111111-2222-4333-8444-'+('{0:d12}' -f $_))}
})
$oldWindow=@(Get-StrictVersionIds $window)
Check ($oldWindow.Count -eq 10 -and $a -notin $oldWindow) 'Old serving predecessor legitimately absent from most-recent window'
$newUuid='22222222-3333-4444-8555-666666666666'
$newWindow=@([pscustomobject]@{id=$newUuid})+@($window|Select-Object -First 9)
$afterWindow=@(Get-StrictVersionIds $newWindow)
$added=@($afterWindow|Where-Object{$_ -notin $oldWindow})
Check ($added.Count -eq 1 -and $added[0] -eq $newUuid) 'One new inactive version detected across rotating ten-entry window'
# Static cross-check: retain serving predecessor's independently verified
# identity even when versions list has rotated it out.
$scriptText=Get-Content -LiteralPath $src -Raw
Check ($scriptText.Contains('$lv[0].version_id -ceq $PriorVersion') -and
       $scriptText.Contains('$served[0].version_id -ceq $PriorVersion')) '100%-serving predecessor separately verified'
Check (-not $scriptText.Contains('$beforeIds -contains $PriorVersion')) 'Do not demand serving predecessor in recent version window'
Write-Host 'PASS: Recent 10-version window rotates without falsely rejecting old active predecessor; one added inactive version detected.'
# The real upload helper also consumes JSON from a native CLI pipeline.
# Only extract its isolated function definitions and supply synthetic text.
# Never load/execute the owner script's top-level code.
foreach($name in @('Assert','ExitCheck','WranglerJson')){
  $matched=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true))
  Check ($matched.Count -eq 1) ('One expected pure/offline helper '+$name)
  . ([scriptblock]::Create($matched[0].Extent.Text))
}
function MockWrangler { $script:mockJson }
$script:Wrangler='MockWrangler'
$global:LASTEXITCODE=0
$script:mockJson='[{"id":"'+$a+'"}]'
$fromOne=WranglerJson @('versions','list','--json')
Check ($fromOne -is [array] -and $fromOne.Count -eq 1) 'Upload preflight preserves one-version CLI JSON array'
Check ((@(Get-StrictVersionIds $fromOne) -join ',') -ceq $a) 'Upload preflight reads exact single version UUID'
$script:mockJson='[{"id":"'+$a+'"},{"id":"'+$b+'"}]'
$fromTwo=WranglerJson @('versions','list','--json')
Check ($fromTwo -is [array] -and $fromTwo.Count -eq 2) 'Upload preflight preserves two-version CLI JSON array'
Check ((@(Get-StrictVersionIds $fromTwo) -join ',') -ceq ($a+','+$b)) 'Upload preflight reads exact two UUIDs'
$script:mockJson='{"versions":[{"id":"'+$a+'"}]}'
$fromWrapped=WranglerJson @('versions','list','--json')
Check ((@(Get-StrictVersionIds $fromWrapped) -join ',') -ceq $a) 'Wrapped one-version JSON remains supported'
$script:mockJson='not-json'
$blocked=$false
try{$null=WranglerJson @('versions','list','--json')}catch{$blocked=$true}
Check $blocked 'Malformed version JSON fails closed, without any provider call'
Write-Host 'PASS: Synthetic Wrangler JSON CLI 1-item/2-item/wrapped shapes and malformed refusal; no provider activity.'


