# Offline-only unit test for the actual FIRE Acer launcher function.
# Evaluate ONLY its PowerShell AST-extracted helper, never the deployment script.
# Windows PowerShell 5.1 + a fake local npx.cmd reproduces Cloudflare 10007 stderr.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'owner_dr_dark_first_create_once_approved.ps1'
$raw = [IO.File]::ReadAllText($launcher)
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
  $launcher,[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count -gt 0) {
  throw ('FIRE DR launcher PowerShell syntax errors: '+($parseErrors | Out-String))
}
$fn = $ast.Find({
  param($a)
  $a -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
  $a.Name -eq 'Invoke-FireWrangler'
},$true)
if($null -eq $fn) { throw 'FIRE native command helper is missing' }
foreach($guard in @('FIRE-DR-FIRST-CREATE-PR270-9bbd3026-V3',
                   'REMOTE-FIRST-CREATE-ATTEMPT-LOCK.json',
                   'FIRST-CREATE-CLI-SUCCESS-READBACK.json',
                   'FIRE_DR_AUTH_ENABLED',
                   'preview_urls',
                   '10007',
                   'if($versions.Code -eq 0)')) {
  if(-not $raw.Contains($guard)) { throw ('FIRE launcher guard missing: '+$guard) }
}
if(([regex]::Matches($raw,'wrangler@4\.162\.0.*deploy --no-bundle')).Count -ne 1) {
  throw 'reviewed launcher must retain only one actual provider first-create command'
}
# Only the extracted output-capture helper is defined. NEVER dot-source
# the actual owner launcher or provide real Cloudflare credentials.
Invoke-Expression $fn.Extent.Text
$temp = Join-Path $env:TEMP ('fire-native-10007-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null
$script:npxCmd = Join-Path $temp 'npx.cmd'
$mock = @'
@echo off
if /I "%~3"=="missing" (
  >&2 echo This Worker does not exist on your account. [code: 10007]
  exit /b 1
)
if /I "%~3"=="unrelated" (
  >&2 echo The request failed for another reason. [code: 9109]
  exit /b 1
)
if /I "%~3"=="exists" (
  echo Exact Worker exists
  exit /b 0
)
exit /b 42
'@
[IO.File]::WriteAllText($script:npxCmd,$mock,[Text.Encoding]::ASCII)
function Assert-Fire([bool]$ok,[string]$reason) {
  if(-not $ok) { throw ('FIRE DR 10007 offline test FAILED: '+$reason) }
}
function Accept-OnlyMissing($response) {
  if($response.Code -eq 0) { return $false }
  return ($response.Text -match '10007' -and
          $response.Text -match '(?i)(does not exist|not found)')
}
try {
  Assert-Fire ($ErrorActionPreference -eq 'Stop') 'parent preference not strict'
  $missing = Invoke-FireWrangler -wranglerArgs @('missing')
  Assert-Fire ($missing.Code -eq 1) 'nonzero 10007 exit was lost'
  Assert-Fire ($missing.Text -match '10007') 'native stderr code was swallowed'
  Assert-Fire (Accept-OnlyMissing $missing) 'expected absent Worker not recognized'
  Assert-Fire ($ErrorActionPreference -eq 'Stop') 'strict parent preference was not restored'
  $unrelated = Invoke-FireWrangler -wranglerArgs @('unrelated')
  Assert-Fire ($unrelated.Code -eq 1) 'unrelated nonzero exit lost'
  Assert-Fire (-not (Accept-OnlyMissing $unrelated)) 'unrelated Cloudflare error was accepted as absent'
  $exists = Invoke-FireWrangler -wranglerArgs @('exists')
  Assert-Fire ($exists.Code -eq 0) 'existing-worker exit lost'
  Assert-Fire (-not (Accept-OnlyMissing $exists)) 'existing Worker should block first creation'
  Assert-Fire ($ErrorActionPreference -eq 'Stop') 'error preference was not restored after all cases'
  Write-Host 'PASS FIRE DR offline native Windows PowerShell 5.1 stderr 10007, non-10007, existing-Worker, strict preference and deploy lock guard. ZERO provider connections or writes.'
} finally {
  Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}
