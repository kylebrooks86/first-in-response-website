# Offline immutable secret binding safety: DO NOT execute top-level owner upload script.
$ErrorActionPreference='Stop'
$path=Join-Path $PSScriptRoot 'owner_gate9_inactive_version_upload.ps1'
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors)
if(@($errors).Count -ne 0){throw 'PowerShell uploader parse failed'}
$fn=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-VersionSecretBindings'},$true))
if($fn.Count -ne 1){throw 'Require a single immutable-version secret binding verifier'}
. ([scriptblock]::Create($fn[0].Extent.Text))
function Assert([bool]$ok,[string]$message){if(-not $ok){throw $message}}
function Check([bool]$ok,[string]$message){if(-not $ok){throw ('OFFLINE FAILURE: '+$message)}}
$script:ExpectedSecrets='FIRE_ACCESS_AUD,FIRE_ACCESS_OWNER_EMAIL,FIRE_ACCESS_TEAM_DOMAIN,STRIPE_WEBHOOK_SECRET'
$good=@(
 [pscustomobject]@{type='secret_text';name='STRIPE_WEBHOOK_SECRET'},
 [pscustomobject]@{type='secret_text';name='FIRE_ACCESS_TEAM_DOMAIN'},
 [pscustomobject]@{type='secret_text';name='FIRE_ACCESS_OWNER_EMAIL'},
 [pscustomobject]@{type='secret_text';name='FIRE_ACCESS_AUD'}
)
Check ([bool](Assert-VersionSecretBindings -bindings $good)) 'Four required names in any order'
$withExtra=@($good)+@([pscustomobject]@{type='d1';name='DB';id='dba421ba-fc66-4cf8-9c31-51616f8249ba'},[pscustomobject]@{type='plain_text';name='FIRE_STRIPE_MODE';text='disabled'})
Check ([bool](Assert-VersionSecretBindings -bindings $withExtra)) 'Nonsecret bindings must not pollute secret inventory'
$bad=@(
 [pscustomobject]@{what='empty';bindings=@()},
 [pscustomobject]@{what='missing';bindings=@($good|Select-Object -First 3)},
 [pscustomobject]@{what='duplicate';bindings=@($good|Select-Object -First 3)+@($good[0])},
 [pscustomobject]@{what='unexpected';bindings=@($good[0],$good[1],$good[2],[pscustomobject]@{type='secret_text';name='OTHER_SECRET'})},
 [pscustomobject]@{what='wrong type';bindings=@($good[0],$good[1],$good[2],[pscustomobject]@{type='plain_text';name='FIRE_ACCESS_AUD'})},
 [pscustomobject]@{what='missing name';bindings=@($good[0],$good[1],$good[2],[pscustomobject]@{type='secret_text'})}
)
foreach($case in $bad){
  $blocked=$false
  try{$null=Assert-VersionSecretBindings -bindings $case.bindings}catch{$blocked=$true}
  Check $blocked ('Refuse immutable version secret violation: '+$case.what)
}
$source=Get-Content -LiteralPath $path -Raw
Check ($source.Contains('Assert-VersionSecretBindings -bindings $bindings')) 'Both old and newly uploaded versions must check names through VerifyVersion'
Check ($source.Contains('VerifyVersion $PriorVersion') -and $source.Contains('VerifyVersion $newId')) 'Before and after immutable verification calls must both exist'
Write-Host 'PASS: Immutable TEST Worker secret binding verification; 2 success cases, 6 fail-closed cases, no Cloudflare access.'
