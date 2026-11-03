# PowerShell offline guard. Parse, inspect allowlisted Cloudflare GET and mock
# the network command, never call the owner main script or any real API.
$ErrorActionPreference='Stop'
$p=Join-Path $PSScriptRoot 'owner_gate9_remote_settings_read_only.ps1'
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($p,[ref]$tokens,[ref]$errors)
if(@($errors).Count -ne 0){$errors|ForEach-Object{Write-Error $_.Message};throw 'Invalid PowerShell script syntax'}
$source=Get-Content -LiteralPath $p -Raw
function Req($ok,$reason){if(-not $ok){throw ('TEST FAILED: '+$reason)}}
foreach($needle in @(
  'fire-stripe-test-20261101','96e32262-fa33-4f04-a161-bee11f0353e2',
  'dba421ba-fc66-4cf8-9c31-51616f8249ba',
  'FIRE_ACCESS_OWNER_EMAIL','STRIPE_WEBHOOK_SECRET',
  "WranglerJson @('deployments','status'",
  "WranglerJson @('versions','view'",
  'PrettySecretNames',
  "WranglerJson @('whoami','--json')",
  "WranglerJson @('auth','token','--json')",
  'Invoke-RestMethod -Method Get',
  '($suffix -in @(''settings'',''script-settings''))',
  '(@($expectedSecrets|Sort-Object) -join '','')',
  'SCRIPT_REDACT_QUERY_STRING:',
  'REMOTE_WRITES=ZERO'
)){Req ($source.Contains($needle)) ('Missing guard: '+$needle)}
Req (([regex]::Matches($source,'Invoke-RestMethod -Method Get')).Count -eq 1) 'Exactly one HTTP GET invocation'
Req (-not ($source -match '(?i)\bInvoke-WebRequest\b|(?i)\bStart-Process\b')) 'Unreviewed execution or download call'
Req (-not ($source -match 'Invoke-RestMethod -Method (?:Post|Put|Patch|Delete)')) 'Unexpected HTTP mutation'
Req (-not $source.Contains('CLOUDFLARE_API_TOKEN=')) 'Cannot override auth token'
Req (-not $source.Contains('Write-Host $raw')) 'Cannot log unsanitized JSON'
Req (-not $source.Contains('Write-Host $auth')) 'Cannot log bearer token'
Req (-not $source.Contains('wrangler.cmd deploy')) 'No deploy'
Req (-not $source.Contains('secret put')) 'No secret mutation'
Req (-not $source.Contains('d1 execute')) 'No D1 mutation'

$functions=@('Need','GetCloudflare','Parse-PrettySecretNames')
foreach($name in $functions){
  $list=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true))
  Req ($list.Count -eq 1) ('Require one function: '+$name)
  . ([scriptblock]::Create($list[0].Extent.Text))
}
$script:worker='fire-stripe-test-20261101'
$script:authorization=@{Authorization='Bearer fake-test-value'}
$script:requests=0
function Invoke-RestMethod {
  param($Method,$Uri,$Headers,$TimeoutSec,$MaximumRedirection,$ErrorAction)
  $script:requests++
  Req ($Method -eq 'Get') 'HTTP must be GET'
  Req ($MaximumRedirection -eq 0) 'Redirects must be disabled'
  Req ($Headers.Authorization -eq 'Bearer fake-test-value') 'Authorization must stay memory-only'
  return [pscustomobject]@{uri=$Uri;method=$Method}
}
$account='a'*32
$a=GetCloudflare $account 'settings'
Req ($a.uri -ceq "https://api.cloudflare.com/client/v4/accounts/$account/workers/scripts/fire-stripe-test-20261101/settings") 'Exact version settings URL'
$b=GetCloudflare $account 'script-settings'
Req ($b.uri -ceq "https://api.cloudflare.com/client/v4/accounts/$account/workers/scripts/fire-stripe-test-20261101/script-settings") 'Exact script settings URL'
Req ($script:requests -eq 2) 'Exactly two allowlisted calls'
$blocked=$false
try{$null=GetCloudflare $account 'secret-values'}catch{$blocked=$true}
Req $blocked 'Unknown endpoint fails before any request'
$blocked=$false
try{$null=GetCloudflare 'not-an-account' 'settings'}catch{$blocked=$true}
Req $blocked 'Invalid account fails before any request'
Req ($script:requests -eq 2) 'Rejected calls must not reach HTTP'
Write-Host 'PASS: Offline PowerShell parse, 2 exact GET URLs, 2 blocked unsafe inputs, no hosted requests/mutations.'


# Actual Wrangler 4.151.0 output as independently shown in owner Acer screenshot.
$pretty=@'
⛅ wrangler 4.151.0
Secret Name: FIRE_ACCESS_AUD
Secret Name: FIRE_ACCESS_OWNER_EMAIL
Secret Name: FIRE_ACCESS_TEAM_DOMAIN
Secret Name: STRIPE_WEBHOOK_SECRET
'@
$names=@(Parse-PrettySecretNames $pretty)
$wanted=@('FIRE_ACCESS_AUD','FIRE_ACCESS_OWNER_EMAIL','FIRE_ACCESS_TEAM_DOMAIN','STRIPE_WEBHOOK_SECRET')
Req ($names.Count -eq 4 -and ($names -join ',') -ceq ($wanted -join ',')) 'Correct real four-name output'
$reverse=@(Parse-PrettySecretNames ((@($pretty -split '\r?\n'|Where-Object{$_ -match '^Secret Name:'})|Sort-Object -Descending) -join [Environment]::NewLine))
Req (($reverse -join ',') -ceq ($wanted -join ',')) 'Order insensitive pretty output'
$samples=@(
  [pscustomobject]@{name='duplicate';raw=$pretty+[Environment]::NewLine+'Secret Name: STRIPE_WEBHOOK_SECRET'},
  [pscustomobject]@{name='missing';raw=$pretty.Replace('Secret Name: STRIPE_WEBHOOK_SECRET','')},
  [pscustomobject]@{name='renamed';raw=$pretty.Replace('FIRE_ACCESS_AUD','OTHER_ACCESS_AUD')},
  [pscustomobject]@{name='bad-line';raw=$pretty.Replace('FIRE_ACCESS_AUD','bad name with spaces')},
  [pscustomobject]@{name='empty';raw='wrangler 4.151.0'},
  [pscustomobject]@{name='extra';raw=$pretty+[Environment]::NewLine+'Secret Name: SURPRISE_SECRET'}
)
foreach($c in $samples){
  $fails=$false
  try{$got=@(Parse-PrettySecretNames ([string]$c.raw));if($got.Count -ne 4 -or ($got -join ',') -cne ($wanted -join ',')){$fails=$true}}
  catch{$fails=$true}
  Req $fails ('Must block '+$c.name+' inventory')
}
Write-Host 'PASS: Wrangler 4.151.0 pretty name parser and six invalid-inventory scenarios.'
