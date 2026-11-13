# OFFLINE test: exact real owner script's local legacy_env removal function.
# No Wrangler, Cloudflare, Stripe, DB, network or hosted mutation calls.
$ErrorActionPreference='Stop'
$src=Join-Path $PSScriptRoot 'owner_gate9_inactive_version_upload.ps1'
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($src,[ref]$tokens,[ref]$errors)
if(@($errors).Count -ne 0){throw 'Gate9 owner uploader PowerShell parse failed'}
$definitions=@($ast.FindAll({param($x) $x -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $x.Name -eq 'Remove-LegacyEnvFromTempReview'},$true))
if($definitions.Count -ne 1){throw 'Exactly one local review manifest helper required'}
. ([scriptblock]::Create($definitions[0].Extent.Text))
function Assert([bool]$ok,[string]$why){if(-not $ok){throw ('TEST BLOCKED: '+$why)}}
function Check([bool]$ok,[string]$why){if(-not $ok){throw ('OFFLINE TEST FAIL: '+$why)}}
$tmp=Join-Path ([System.IO.Path]::GetTempPath()) ('fire-test-legacyenv-'+[Guid]::NewGuid().ToString('N')+'.json')
try{
  $sample=[ordered]@{
    name='fire-stripe-test-20261101'; topLevelName='fire-stripe-test-20261101'
    main='index.js'; legacy_env=$true
    d1_databases=@(@{binding='DB';database_name='fire-stripe-test-db-20261101';database_id='dba421ba-fc66-4cf8-9c31-51616f8249ba'})
    vars=@{FIRE_STRIPE_MODE='disabled';FIRE_ACCESS_REQUIRED='enabled'}
    routes=@(); workers_dev=$true;preview_urls=$false
    observability=@{enabled=$true;redact_query_string=$false;logs=@{enabled=$true;invocation_logs=$true}}
  }
  $original=ConvertTo-Json -InputObject $sample -Depth 100
  [System.IO.File]::WriteAllText($tmp,$original)
  Check ([bool](Remove-LegacyEnvFromTempReview $tmp)) 'Known default legacy_env true removes cleanly'
  $after=Get-Content -LiteralPath $tmp -Raw|ConvertFrom-Json
  $originalObj=ConvertFrom-Json -InputObject $original
  $originalObj.PSObject.Properties.Remove('legacy_env')
  Check (-not ($after.PSObject.Properties.Name -contains 'legacy_env')) 'Deprecated field absent'
  Check ((ConvertTo-Json -InputObject $after -Depth 100 -Compress) -ceq
         (ConvertTo-Json -InputObject $originalObj -Depth 100 -Compress)) 'All nondeprecated bindings, worker name, mode, routes and observability unchanged'
  foreach($variant in @('false','"true"','null','ABSENT')){
    if($variant -eq 'ABSENT'){$payload=$original -replace '"legacy_env"\s*:\s*true\s*,?', ''}
    else{$payload=$original -replace '"legacy_env"\s*:\s*true',('"legacy_env": '+$variant)}
    [System.IO.File]::WriteAllText($tmp,$payload)
    $beforeText=Get-Content -LiteralPath $tmp -Raw
    $blocked=$false
    try{$null=Remove-LegacyEnvFromTempReview $tmp}catch{$blocked=$true}
    Check $blocked ('Must refuse legacy_env variant '+$variant)
    Check ((Get-Content -LiteralPath $tmp -Raw) -ceq $beforeText) ('Must not rewrite unsafe input '+$variant)
  }
  $script=Get-Content -LiteralPath $src -Raw
  $normal=$script.IndexOf('Remove-LegacyEnvFromTempReview $review')
  $localDry=$script.IndexOf("Pnpm @('exec','wrangler','deploy','--config',"+'$review')
  $globalDry=$script.IndexOf('& $Wrangler deploy --config $review --dry-run')
  $ownerPrompt=$script.IndexOf("Read-Host 'Exact owner inactive-upload approval'")
  $upload=$script.IndexOf('& $Wrangler versions upload --config $review --keep-vars --strict')
  Check ($normal -ge 0 -and $localDry -gt $normal -and $globalDry -gt $localDry -and
    $ownerPrompt -gt $globalDry -and $upload -gt $ownerPrompt) 'Actual Wrangler 4.151 dry-run must precede owner prompt and the single upload'
  Check (([regex]::Matches($script,'& \$Wrangler versions upload --config \$review --keep-vars --strict')).Count -eq 1) 'Exactly one permitted inactive upload'
  Write-Host 'PASS: Removed ONLY legacy_env=true from temp TEST review; 4 unsafe variants rejected; real Wrangler 4.151 dry-run is BEFORE approval, one upload only. No cloud.'
}
finally{
  Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
}
