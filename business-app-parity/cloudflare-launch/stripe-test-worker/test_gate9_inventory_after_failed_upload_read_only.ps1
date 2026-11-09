# Synthetic no-network tests of the read-only owner inventory, never execute top level.
$ErrorActionPreference='Stop'
$path=Join-Path $PSScriptRoot 'owner_gate9_inventory_after_failed_upload_read_only.ps1'
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors)
if(@($errors).Count -ne 0){throw 'Owner inventory PowerShell parse error'}
$s=Get-Content -LiteralPath $path -Raw
function Check([bool]$ok,[string]$why){if(-not $ok){throw ('OFFLINE FAILURE: '+$why)}}
foreach($required in @(
 'fire-stripe-test-20261101',
 '96e32262-fa33-4f04-a161-bee11f0353e2',
 "ReadJson @('deployments','status'",
 "ReadJson @('versions','list'",
 'ACTIVE_TRAFFIC_PERCENT=',
 'PREVIOUS_KNOWN_VERSION_MATCH=',
 'RECENT_VERSION_ID=',
 'NO SAFE-TO-RETRY CONCLUSION',
 '& $wrangler versions upload --help'
)){Check ($s.Contains($required)) ('Missing read-only guard '+$required)}
# No hosted mutation, no credentials, no network calls other than authenticated Wrangler reads.
Check (-not ($s -match '(?i)\bInvoke-(RestMethod|WebRequest)\b|\bStart-Process\b|\bd1 execute\b|\bsecret put\b|wrangler deploy|wrangler versions deploy|--yes')) 'Forbidden hosted mutation/reference'
Check (-not ($s -match '& \$wrangler versions upload --(?!help)')) 'Upload may only run --help'
Check (([regex]::Matches($s,'ReadJson @\(')).Count -eq 2) 'Exactly two authenticated provider read calls'
$names=@('Require','GetVersionEntries','ReadJson')
foreach($name in $names){
  $def=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true))
  Check ($def.Count -eq 1) ('Exactly one safe helper '+$name)
  . ([scriptblock]::Create($def[0].Extent.Text))
}
$a='96e32262-fa33-4f04-a161-bee11f0353e2'
$b='11111111-2222-4333-8444-555555555555'
$list=@([pscustomobject]@{id=$a},[pscustomobject]@{version_id=$b})
$plain=@(GetVersionEntries $list)
Check ($plain.Count -eq 2 -and $plain[0] -eq $a -and $plain[1] -eq $b) 'Flat array'
Check ((@(GetVersionEntries ([pscustomobject]@{versions=$list})) -join ',') -eq ($plain -join ',')) 'Versions envelope'
Check ((@(GetVersionEntries ([pscustomobject]@{result=$list})) -join ',') -eq ($plain -join ',')) 'Result array envelope'
Check ((@(GetVersionEntries ([pscustomobject]@{result=[pscustomobject]@{versions=$list}})) -join ',') -eq ($plain -join ',')) 'Result versions envelope'
$win=@(1..10 | ForEach-Object{[pscustomobject]@{id=('11111111-2222-4333-8444-'+('{0:d12}' -f $_))}})
$recent=@(GetVersionEntries $win)
Check ($recent.Count -eq 10 -and $a -notin $recent) 'Old 100%-active version can be absent from recent window'
$bad=@(
  [pscustomobject]@{why='unknown shape';data=[pscustomobject]@{items=$list}},
  [pscustomobject]@{why='duplicate';data=@([pscustomobject]@{id=$a},[pscustomobject]@{id=$a})},
  [pscustomobject]@{why='malformed';data=@([pscustomobject]@{id='INVALID'})},
  [pscustomobject]@{why='empty';data=@()},
  [pscustomobject]@{why='missing field';data=@([pscustomobject]@{version=$a})}
)
foreach($case in $bad){
  $blocked=$false
  try{$null=GetVersionEntries $case.data}catch{$blocked=$true}
  Check $blocked ('Refuse '+$case.why)
}
# Exercise the ACTUAL PowerShell Wrangler JSON read wrapper, not merely the
# direct helper with already-materialized arrays. These are synthetic
# function outputs only: no Wrangler executable or Cloudflare network.
function MockWrangler { $script:syntheticOutput }
$script:wrangler='MockWrangler'
$global:LASTEXITCODE=0
$script:syntheticOutput='[{"id":"'+$a+'"}]'
$one=ReadJson @('versions','list','--json')
Check ($one -is [array] -and $one.Count -eq 1) 'One-version JSON remains a real array after ReadJson'
Check ((@(GetVersionEntries $one) -join ',') -ceq $a) 'One-version JSON parsed to exact immutable ID'
$script:syntheticOutput='[{"id":"'+$a+'"},{"id":"'+$b+'"}]'
$two=ReadJson @('versions','list','--json')
Check ($two -is [array] -and $two.Count -eq 2) 'Two-version JSON remains a flat array'
Check ((@(GetVersionEntries $two) -join ',') -ceq ($a+','+$b)) 'Two-version JSON parsed exactly'
$script:syntheticOutput='{"versions":[{"id":"'+$a+'"}]}'
$wrapped=ReadJson @('versions','list','--json')
Check ($wrapped -isnot [array]) 'Wrapped object shape preserved without false list nesting'
Check ((@(GetVersionEntries $wrapped) -join ',') -ceq $a) 'Single-version envelope parsed'
$script:syntheticOutput='{"versions":[{"version_id":"'+$a+'"},{"version_id":"'+$b+'"}]}'
$multiWrapped=ReadJson @('versions','list','--json')
Check ((@(GetVersionEntries $multiWrapped) -join ',') -ceq ($a+','+$b)) 'Two-version envelope parsed'
$script:syntheticOutput='not valid JSON'
$rejected=$false
try{$null=ReadJson @('versions','list','--json')}catch{$rejected=$true}
Check $rejected 'Malformed Wrangler JSON refused without printing raw data'
Write-Host 'PASS: One-shot TEST inventory PowerShell parsed; synthetic array 1/2, wrapper 1/2 and malformed JSON checks, zero hosted actions.'
