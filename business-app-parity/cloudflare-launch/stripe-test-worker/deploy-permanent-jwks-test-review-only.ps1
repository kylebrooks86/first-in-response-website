# SOURCE-ONLY REVIEW: proposed ONE-TIME permanent live-JWKS-only TEST deployment.
# NOT AUTHORIZED FOR HOSTED DEPLOYMENT until separately approved by owner.
# isolated FIRE Stripe TEST Worker only. No changes to LIVE/QA/staging/DR.
# Do not re-run after any error, especially after deployment starts.
param(
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[a-fA-F0-9]{40}$')]
  [string]$ExpectedCommit,
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$')]
  [string]$ExpectedPreviousVersion
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Worker='fire-stripe-test-20261101'
$Database='fire-stripe-test-db-20261101'
$DatabaseId='dba421ba-fc66-4cf8-9c31-51616f8249ba'
$Origin='https://fire-stripe-test-20261101.kyle-bfc.workers.dev'
$PriorVersion=$ExpectedPreviousVersion.ToLowerInvariant()
$ExpectedSecrets='FIRE_ACCESS_AUD,FIRE_ACCESS_OWNER_EMAIL,FIRE_ACCESS_TEAM_DOMAIN'
$GitRepo='https://github.com/kylebrooks86/first-in-response-website.git'
$Scratch=Join-Path $env:TEMP ('FIRE-Permanent-Live-JWKS-'+[Guid]::NewGuid().ToString('N'))
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
  $deployment=ConvertFrom-Json -InputObject $status
  $activeVersions=@($deployment.versions)
  Assert ($activeVersions.Count -eq 1) 'TEST Worker must have exactly one active version'
  Assert ($activeVersions[0].version_id -eq $PriorVersion -and [int]$activeVersions[0].percentage -eq 100) 'Existing TEST Worker version or traffic changed from approved predecessor; do not overwrite'
  $h=(& curl.exe --silent --show-error --max-time 20 --dump-header - --output NUL $Origin | Out-String)
  ExitCheck 'Unauthenticated Access probe'
  Assert ($h -match '(?im)^location:\s*https://restless-unit-ad5b\.cloudflareaccess\.com/') 'Owner-only Cloudflare Access redirect not verified'
  Write-Host 'PASS: Existing isolated Worker, predecessor version, Access, D1 and three secrets'

  Write-Host 'STEP 2/5: Save rollback record and fetch exact approved source'
  $backupFolder=Join-Path $HOME 'FIRE-Backups'
  New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
  $backup=Join-Path $backupFolder ('stripe-test-before-permanent-live-jwks-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.json')
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
  $diagnostic=Get-Content -LiteralPath (Join-Path $Source 'business-app-parity\cloudflare-launch\access-diagnostic.mjs') -Raw
  $page=Get-Content -LiteralPath (Join-Path $Source 'business-app-parity\cloudflare-launch\access-required-page.tsx') -Raw
  Assert ($adapter.Contains('getFireAccessDiagnostic()') -and $adapter.Contains('verifyFireAccessJWT(asserted,cfg)')) 'Owner JWT verifier or diagnostic missing'
  Assert ($diagnostic.Contains('FIRE-A04-TOKEN-ABSENT') -and $diagnostic.Contains('FIRE-A10-CRYPTO-OR-KEY')) 'Redacted diagnostic class missing'
  Assert ($page.Contains('Secure support code: {reason}') -and -not $page.Contains('claims.email')) 'Diagnostic page not redacted'
  $keyProbe=Get-Content -LiteralPath (Join-Path $Source 'business-app-parity\cloudflare-launch\access-key-probe.mjs') -Raw
  $verifier=Get-Content -LiteralPath (Join-Path $Source 'business-app-parity\cloudflare-launch\access-jwt.mjs') -Raw
  Assert ($verifier.Contains('subtle.verify("RSASSA-PKCS1-v1_5"') -and
    $verifier.Contains('redirect:"follow"') -and
    $verifier.Contains('forceRefresh=false')) 'Permanent live-JWKS signature verifier missing'
  foreach($forbiddenAuth in @('pinnedAccessPublicKeys','PINNED_MAX_AGE_MS','safePinnedKeys','allowPinned','pinnedSnapshot')){
    Assert (-not $verifier.Contains($forbiddenAuth)) ('Temporary JWT fallback remains: '+$forbiddenAuth)
  }
  Assert ($adapter.Contains('await probeFireAccessCrypto(token,cfg)')) 'Precise, non-authorizing Access probe missing'
  Assert ($adapter.Contains('getFireLiveJwksProof()') -and $adapter.Contains('forceRefresh:true') -and -not $adapter.Contains('allowPinned')) 'Live-only proof must have no snapshot fallback'
  Assert ($verifier.Contains('if(!forceRefresh') -and $verifier.Contains('const response=await fetcher(')) 'Live-only provider fetch/cache code missing'
  $healthRoute=Get-Content -LiteralPath (Join-Path $Source 'business-app-parity\cloudflare-launch\access-live-proof-route.ts') -Raw
  Assert ($healthRoute.Contains('getFireLiveJwksProof()') -and -not $healthRoute.Contains('headers()')) 'Redacted auth-health endpoint missing'

  foreach($check in @('FIRE-A11-CERTS-FETCH','FIRE-A12-CERTS-FORMAT','FIRE-A13-SIGNING-KEY','FIRE-A14-KEY-IMPORT','FIRE-A15-CRYPTO-ERROR','FIRE-A16-SIGNATURE','FIRE-A17-VERIFY-MISMATCH')) {
    Assert ($keyProbe.Contains($check)) ('Missing redacted crypto stage code: '+$check)
  }


  Write-Host 'STEP 3/5: Compile permanent live-only JWKS TEST build with no public key snapshot'
  $materializer=Join-Path $Source 'business-app-parity\cloudflare-launch\materialize-stripe-test.py'
  if($python.Name -eq 'py.exe') { & $python.Source -3 $materializer $App }
  else { & $python.Source $materializer $App }
  ExitCheck 'TEST-only source materialization'
  Assert (-not (Test-Path -LiteralPath (Join-Path $App 'app\access-public-keys.mjs'))) 'Generated TEST app still contains public-key snapshot module'
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
  Assert ($cfg.compatibility_flags -contains 'global_fetch_strictly_public' -and $cfg.compatibility_flags -contains 'nodejs_compat') 'Reviewed public Worker fetch flag is absent'

  foreach($forbidden in @('r2_buckets','kv_namespaces','durable_objects','services','queues','env','account_id','zone_id')){
    Assert (-not ($cfg.PSObject.Properties.Name -contains $forbidden)) ('Forbidden paid or cross-environment binding '+$forbidden)
  }
  $dry=Join-Path $Scratch 'dry-run'
  Pnpm @('exec','wrangler','deploy','--config',$review,'--dry-run','--outdir',$dry)
  Write-Host 'PASS: Exact updated TEST app passes dry run; no extra routes/storage/Stripe'

  Write-Host 'STEP 5/5: Revalidate exact version before one separately authorized TEST-only deployment'
  $lastStatus=(& $Wrangler deployments status --name $Worker --json | Out-String).Trim()
  ExitCheck 'Final read-only predecessor recheck'
  $lastDeployment=ConvertFrom-Json -InputObject $lastStatus
  $lastVersions=@($lastDeployment.versions)
  Assert ($lastVersions.Count -eq 1 -and $lastVersions[0].version_id -eq $PriorVersion -and [int]$lastVersions[0].percentage -eq 100) 'TEST Worker changed during build; do not overwrite'
  $DeployStarted=$true
  Pnpm @('exec','wrangler','deploy','--config',$review,'--strict')
  Write-Host 'DEPLOY SUCCEEDED: TEST-only permanent live-JWKS-only verification; NO 14-day fallback.' -ForegroundColor Green
  $post=@(WranglerJson @('secret','list','--name',$Worker))
  $postNames=(@($post | ForEach-Object {$_.name} | Sort-Object) -join ',')
  Assert ($postNames -eq $ExpectedSecrets) 'Secret inventory changed: stop, do not rerun'
  $after=(& curl.exe --silent --show-error --max-time 20 --dump-header - --output NUL $Origin | Out-String)
  ExitCheck 'Postdeploy Access probe'
  Assert ($after -match '(?im)^location:\s*https://restless-unit-ad5b\.cloudflareaccess\.com/') 'Owner-only Access redirect missing; review immediately'
  Write-Host 'PASS: Permanent-JWKS TEST Worker still enforces owner-only Cloudflare Access.' -ForegroundColor Green
  Write-Host "Verified previous version: $PriorVersion"
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
