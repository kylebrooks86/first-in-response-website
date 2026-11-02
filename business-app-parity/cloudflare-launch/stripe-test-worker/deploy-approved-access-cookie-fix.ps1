# ONE-TIME, OWNER-APPROVED Access cookie fix deployment to the existing
# isolated FIRE Stripe TEST Worker only. No changes to LIVE/QA/staging/DR.
# Do not re-run after any error, especially after deployment starts.
param(
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[a-fA-F0-9]{40}$')]
  [string]$ExpectedCommit
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Worker='fire-stripe-test-20261101'
$Database='fire-stripe-test-db-20261101'
$DatabaseId='dba421ba-fc66-4cf8-9c31-51616f8249ba'
$Origin='https://fire-stripe-test-20261101.kyle-bfc.workers.dev'
$PriorVersion='120f6239-1566-423f-a77c-d8c8e0691317'
$ExpectedSecrets='FIRE_ACCESS_AUD,FIRE_ACCESS_OWNER_EMAIL,FIRE_ACCESS_TEAM_DOMAIN'
$GitRepo='https://github.com/kylebrooks86/first-in-response-website.git'
$Scratch=Join-Path $env:TEMP ('FIRE-Access-Fix-'+[Guid]::NewGuid().ToString('N'))
$Source=Join-Path $Scratch 'source'
$App=Join-Path $Scratch 'app'
$InApp=$false
$DeployStarted=$false
function Assert([bool]$ok,[string]$reason){
  if(-not $ok){throw "STOP: $reason"}
}
function ExitCheck([string]$label){
  Assert ($LASTEXITCODE -eq 0) "$label failed. Do not rerun automatically."
}
function WranglerJson([string[]]$params){
  $raw=(& $script:Wrangler @params | Out-String).Trim()
  ExitCheck ('wrangler '+($params -join ' '))
  Assert ($raw.Length -gt 0) 'Unexpected empty Wrangler JSON'
  try{return ConvertFrom-Json -InputObject $raw}
  catch{throw "STOP: Cannot parse Wrangler response. No deploy."}
}
function Pnpm([string[]]$argsToRun){
  $tool=$script:PkgCommand
  $prefix=$script:PkgPrefix
  & $tool @prefix @argsToRun
  ExitCheck ('pnpm '+($argsToRun -join ' '))
}
try{
  Write-Host 'STEP 1/5: Isolated Worker, version, Access, secrets and D1 preflight'
  $Wrangler=(Get-Command wrangler.cmd -ErrorAction Stop).Source
  $null=Get-Command git.exe -ErrorAction Stop
  $null=Get-Command node.exe -ErrorAction Stop
  $python=Get-Command py.exe -ErrorAction SilentlyContinue
  if(-not $python){$python=Get-Command python.exe -ErrorAction Stop}
  $corepack=Get-Command corepack.cmd -ErrorAction SilentlyContinue
  $pnpm=Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  Assert ([bool]($corepack -or $pnpm)) 'Neither corepack nor pnpm is installed'
  if($corepack){$PkgCommand=$corepack.Source;$PkgPrefix=@('pnpm')}
  else{$PkgCommand=$pnpm.Source;$PkgPrefix=@()}
  $secretList=@(WranglerJson @('secret','list','--name',$Worker))
  $actualSecretNames=(@($secretList | ForEach-Object {$_.name} | Sort-Object) -join ',')
  Assert ($actualSecretNames -eq $ExpectedSecrets) 'Unexpected Worker secrets (no secret mutation authorized)'
  $dbs=@(WranglerJson @('d1','list','--json'))
  $matches=@($dbs | Where-Object {$_.name -eq $Database -and $_.uuid -eq $DatabaseId})
  Assert ($matches.Count -eq 1) 'Wrong physical database UUID or Cloudflare account'
  $status=(& $Wrangler deployments status --name $Worker --json | Out-String).Trim()
  ExitCheck 'Existing Worker version status'
  Assert ($status.Contains($PriorVersion)) 'Existing TEST Worker changed from approved predecessor; do not overwrite'
  $h=(& curl.exe --silent --show-error --max-time 20 --dump-header - --output NUL $Origin | Out-String)
  ExitCheck 'Unauthenticated Access probe'
  Assert ($h -match '(?im)^location:\s*https://restless-unit-ad5b\.cloudflareaccess\.com/') 'Owner-only Cloudflare Access redirect not verified'
  Write-Host 'PASS: Existing isolated Worker, predecessor version, Access, D1 and three secrets'

  Write-Host 'STEP 2/5: Record rollback version, fetch exact source'
  $backupFolder=Join-Path $HOME 'FIRE-Backups'
  New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
  $backup=Join-Path $backupFolder ('stripe-test-before-access-fix-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.json')
  [System.IO.File]::WriteAllText($backup,$status,[System.Text.UTF8Encoding]::new($false))
  New-Item -ItemType Directory -Path $Scratch | Out-Null
  & git clone --no-checkout $GitRepo $Source
  ExitCheck 'Source clone'
  & git -C $Source fetch --depth 1 origin $ExpectedCommit
  ExitCheck 'Pinned commit fetch'
  & git -C $Source checkout --detach FETCH_HEAD
  ExitCheck 'Pinned commit checkout'
  $actual=(& git -C $Source rev-parse HEAD | Out-String).Trim()
  Assert ($actual -eq $ExpectedCommit.ToLowerInvariant()) 'Wrong source SHA'
  $adapter=Get-Content -LiteralPath (Join-Path $Source 'business-app-parity\cloudflare-launch\app-auth.ts') -Raw
  $tokens=Get-Content -LiteralPath (Join-Path $Source 'business-app-parity\cloudflare-launch\access-token.mjs') -Raw
  Assert ($adapter.Contains('getFireAccessToken(h)') -and $tokens.Contains('CF_Authorization')) 'Signed-cookie remediation missing from exact source'
  Assert ($adapter.Contains('verifyFireAccessJWT(asserted,cfg)')) 'Cryptographic JWT owner verification must remain'

  Write-Host 'STEP 3/5: Compile exact TEST app without database migrations'
  $materializer=Join-Path $Source 'business-app-parity\cloudflare-launch\materialize-stripe-test.py'
  if($python.Name -eq 'py.exe') { & $python.Source -3 $materializer $App }
  else { & $python.Source $materializer $App }
  ExitCheck 'TEST-only source materialization'
  Push-Location $App
  $InApp=$true
  $v=(& $PkgCommand @PkgPrefix --version | Out-String).Trim()
  ExitCheck 'pnpm version'
  Assert ($v -eq '11.25.0') 'Wrong pnpm version'
  Pnpm @('install','--frozen-lockfile')
  Pnpm @('exec','tsc','--noEmit','--incremental','false')
  Pnpm @('run','build')

  Write-Host 'STEP 4/5: Exact D1, Stripe-off, no-R2 Wrangler dry run'
  $manifestScript=Join-Path $Source 'business-app-parity\cloudflare-launch\stripe-test-worker\prepare-stripe-test-manifest.mjs'
  $local=Join-Path $App 'dist\server\wrangler.json'
  $review=Join-Path $App 'dist\server\wrangler.FIRE_TEST_REVIEW_ONLY.json'
  & node $manifestScript $local $review
  ExitCheck 'Strict test manifest preparation'
  $cfg=Get-Content -LiteralPath $review -Raw | ConvertFrom-Json
  Assert ($cfg.name -eq $Worker -and $cfg.topLevelName -eq $Worker) 'Wrong Worker target in generated config'
  Assert ($cfg.d1_databases.Count -eq 1 -and $cfg.d1_databases[0].database_id -eq $DatabaseId -and $cfg.d1_databases[0].database_name -eq $Database) 'Wrong D1 binding'
  Assert ($cfg.vars.FIRE_ACCESS_REQUIRED -eq 'enabled' -and $cfg.vars.FIRE_STRIPE_MODE -eq 'disabled' -and $cfg.vars.FIRE_ENV -eq 'cloudflare-staging' -and $cfg.vars.SITE_ORIGIN -eq $Origin) 'Auth, origin, or Stripe mode mismatch'
  Assert ($cfg.workers_dev -eq $true -and $cfg.preview_urls -eq $false -and $cfg.routes.Count -eq 0) 'Public routing/preview mismatch'
  foreach($forbidden in @('r2_buckets','kv_namespaces','durable_objects','services','queues','env','account_id','zone_id')){
    Assert (-not ($cfg.PSObject.Properties.Name -contains $forbidden)) ('Forbidden paid or cross-environment binding '+$forbidden)
  }
  $dry=Join-Path $Scratch 'dry-run'
  Pnpm @('exec','wrangler','deploy','--config',$review,'--dry-run','--outdir',$dry)
  Write-Host 'PASS: Exact updated TEST app passes dry run; no extra routes/storage/Stripe'

  Write-Host 'STEP 5/5: Execute ONE approved hosted TEST-only deployment'
  $DeployStarted=$true
  Pnpm @('exec','wrangler','deploy','--config',$review,'--strict')
  Write-Host 'DEPLOY SUCCEEDED: isolated TEST Worker updated.' -ForegroundColor Green
  $post=@(WranglerJson @('secret','list','--name',$Worker))
  $postNames=(@($post | ForEach-Object {$_.name} | Sort-Object) -join ',')
  Assert ($postNames -eq $ExpectedSecrets) 'Secret inventory changed: stop, do not rerun'
  $after=(& curl.exe --silent --show-error --max-time 20 --dump-header - --output NUL $Origin | Out-String)
  ExitCheck 'Postdeploy Access probe'
  Assert ($after -match '(?im)^location:\s*https://restless-unit-ad5b\.cloudflareaccess\.com/') 'Owner-only Access redirect missing; review immediately'
  Write-Host 'PASS: Updated TEST Worker still enforces owner-only Cloudflare Access.' -ForegroundColor Green
  Write-Host "Previous version: $PriorVersion"
  Write-Host "Rollback metadata: $backup"
  Write-Host "TEST URL: $Origin"
}
catch{
  Write-Host $_.Exception.Message -ForegroundColor Red
  if($DeployStarted){
    Write-Host 'DEPLOY MAY HAVE OCCURRED. DO NOT RUN SCRIPT AGAIN. Inspect TEST Worker Deployments.' -ForegroundColor Yellow
  }else{
    Write-Host 'No deployment attempted. Do not rerun without reviewing the failure.' -ForegroundColor Yellow
  }
  exit 1
}
finally{
  if($InApp){Pop-Location}
  Write-Host "Local review copy: $Scratch"
}
