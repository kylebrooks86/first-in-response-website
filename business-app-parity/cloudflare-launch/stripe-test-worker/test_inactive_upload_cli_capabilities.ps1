# Pure offline tests: extract the CLI capability predicate from the guarded
# inactive uploader. Do NOT invoke its main body or any actual Wrangler/Cloudflare.
$ErrorActionPreference='Stop'
$src=Join-Path $PSScriptRoot 'owner_gate9_inactive_version_upload.ps1'
$tokens=$null; $errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($src,[ref]$tokens,[ref]$errors)
if(@($errors).Count -ne 0){throw 'Uploader PowerShell syntax error'}
$defs=@($ast.FindAll({param($x) $x -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $x.Name -eq 'Assert-InactiveUploadCli'},$true))
if($defs.Count -ne 1){throw 'Require one immutable CLI version/capability guard'}
. ([scriptblock]::Create($defs[0].Extent.Text))
function Assert([bool]$value,[string]$errorText){if(-not $value){throw $errorText}}
function Check([bool]$ok,[string]$why){if(-not $ok){throw ('TEST: '+$why)}}
$help='Wrangler versions upload --config [string] --keep-vars [boolean] --strict [boolean]'
Check ([bool](Assert-InactiveUploadCli '4.151.0' $help)) 'Real Acer bare wrangler.cmd --version is supported'
Check ([bool](Assert-InactiveUploadCli ' 4.151.0 ' $help)) 'Whitespace-trimmed bare CLI version supported'
Check ([bool](Assert-InactiveUploadCli 'wrangler 4.151.0' $help)) 'Exact owner-confirmed global CLI supported'
Check ([bool](Assert-InactiveUploadCli '⛅ wrangler 4.151.0' $help)) 'Decorated version label supported'
$cases=@(
  [pscustomobject]@{v='4.92.0';h=$help;reason='project-local bare 4.92.0'},
  [pscustomobject]@{v='4.151.1';h=$help;reason='unapproved bare 4.151.1'},
  [pscustomobject]@{v='4.151.0-beta';h=$help;reason='version with suffix'},
  [pscustomobject]@{v='pre 4.151.0 post';h=$help;reason='unanchored embedded version'},
  [pscustomobject]@{v="4.151.0`nunauthorized";h=$help;reason='extra output after bare version'},
  [pscustomobject]@{v='4.151.0';h='--config --keep-vars';reason='bare version missing strict'},
  [pscustomobject]@{v='4.151.0';h='--config --strict';reason='bare version missing keep-vars'},
  [pscustomobject]@{v='4.151.0';h='--strict --keep-vars';reason='bare version missing config'},
  [pscustomobject]@{v='wrangler 4.92.0';h=$help;reason='project-local 4.92.0'},
  [pscustomobject]@{v='wrangler 4.151.1';h=$help;reason='unexpected global upgrade'},
  [pscustomobject]@{v='wrangler 4.151.0';h='--config --keep-vars';reason='missing strict'},
  [pscustomobject]@{v='wrangler 4.151.0';h='--config --strict';reason='missing keep-vars'},
  [pscustomobject]@{v='wrangler 4.151.0';h='--strict --keep-vars';reason='missing config'},
  [pscustomobject]@{v='not-wrangler';h=$help;reason='unrecognized version'},
  [pscustomobject]@{v='';h='';reason='empty output'}
)
foreach($c in $cases){
  $rejected=$false
  try{$null=Assert-InactiveUploadCli $c.v $c.h}catch{$rejected=$true}
  Check $rejected ('must refuse '+$c.reason)
}
Write-Host ('PASS: Bare owner Acer 4.151.0 plus labeled CLI supported; '+$cases.Count+' wrong-version/flag variants refused. No cloud.')
