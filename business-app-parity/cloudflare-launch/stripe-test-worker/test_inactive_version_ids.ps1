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
