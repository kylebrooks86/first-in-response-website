# Gate 9 signature-first WEBHOOK GUARD code-only UPDATE on existing isolated FIRE Stripe TEST Worker ONLY.
# Default is read-only review. -Publish requires exact typed approval after checks.
# No Stripe mode enabling, webhook endpoint/Access changes, database, migration, R2, LIVE, QA or DR writes.
# Stop on uncertainty: NEVER retry automatically after a deploy attempt.
[CmdletBinding()]
param(
  [switch]$Publish,
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$')]
  [string]$ExpectedPreviousVersion
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
# Offline-only validated handler for actual Cloudflare plain_text .text schema.
$bindingGuard=Join-Path $PSScriptRoot 'assert_stripe_disabled_binding.ps1'
if (-not (Test-Path -LiteralPath $bindingGuard -PathType Leaf)) {
  throw 'STOP: Exact Stripe-disabled Worker binding validator missing; no deploy.'
}
. $bindingGuard
# Fixed accepted QA-parity TEST code; script cannot publish a different commit.
$ExpectedCommit='99acdbf910ba2095f1f37ff5cfed5522488c9594'
$Worker='fire-stripe-test-20261101'
$Database='fire-stripe-test-db-20261101'
$DatabaseId='dba421ba-fc66-4cf8-9c31-51616f8249ba'
$Origin='https://fire-stripe-test-20261101.kyle-bfc.workers.dev'
$PriorVersion=$ExpectedPreviousVersion.ToLowerInvariant()
$ExpectedSecrets='FIRE_ACCESS_AUD,FIRE_ACCESS_OWNER_EMAIL,FIRE_ACCESS_TEAM_DOMAIN,STRIPE_WEBHOOK_SECRET'
$GitRepo='https://github.com/kylebrooks86/first-in-response-website.git'
$Scratch=Join-Path $env:TEMP ('FIRE-StripeTEST-Gate9-Signature-'+[Guid]::NewGuid().ToString('N'))
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
function VerifyVersion([string]$id){
  $raw=(& $script:Wrangler versions view $id --name $script:Worker --json | Out-String).Trim()
  ExitCheck 'Immutable Worker version bindings'
  try{$obj=ConvertFrom-Json -InputObject $raw -ErrorAction Stop}
  catch{throw 'STOP: Cannot parse immutable version bindings.'}
  Assert ([string]$obj.id -ceq $id -and $null -ne $obj.resources.bindings) 'Missing immutable Worker version details'
  $bindings=@($obj.resources.bindings)
  $d1=@($bindings | Where-Object {$null -ne $_ -and $_.type -ceq 'd1'})
  $r2=@($bindings | Where-Object {$null -ne $_ -and $_.type -in @('r2','r2_bucket')})
  Assert ($d1.Count -eq 1 -and [string]$d1[0].name -ceq 'DB' -and [string]$d1[0].id -ceq $script:DatabaseId) 'Wrong isolated TEST D1 physical UUID'
  Assert ($r2.Count -eq 0) 'Unexpected R2 storage'
  # Cloudflare returns {name, type:'plain_text', text:'disabled'}; .value is NOT a binding field.
  # The isolated helper rejects missing, secret-typed, duplicate or enabled modes.
  Assert ([bool](Assert-FireStripeTestModeDisabled -Bindings $bindings)) 'TEST Stripe-disabled version binding could not be established'
  Write-Host ('PASS: Active version '+$id+' physically bound to isolated TEST DB; no R2, Stripe disabled.')
}
function Pnpm([string[]]$argsToRun){
  $tool=$script:PkgCommand
  $prefix=$script:PkgPrefix
  & $tool @prefix @argsToRun
  ExitCheck ('pnpm '+($argsToRun -join ' '))
}
try{
  Write-Host 'STEP 1/5: Gate9 existing TEST Worker, predecessor, FOUR encrypted secrets, Access, isolated D1'
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
  # Avoid fragile account-wide D1 JSON array handling; verify the actual
  # serving Worker version's physical D1 UUID instead (stronger evidence).
  $status=(& $Wrangler deployments status --name $Worker --json | Out-String).Trim()
  ExitCheck 'Existing Worker version status'
  $deployment=ConvertFrom-Json -InputObject $status
  $activeVersions=@($deployment.versions)
  Assert ($activeVersions.Count -eq 1) 'TEST Worker must have exactly one active version'
  Assert ($activeVersions[0].version_id -ceq $PriorVersion -and [int]$activeVersions[0].percentage -eq 100) 'Active TEST version differs from pinned predecessor'
  VerifyVersion $PriorVersion
  $h=(& curl.exe --silent --show-error --max-time 20 --dump-header - --output NUL $Origin | Out-String)
  ExitCheck 'Unauthenticated Access probe'
  Assert ($h -match '(?im)^location:\s*https://restless-unit-ad5b\.cloudflareaccess\.com/') 'Owner-only Cloudflare Access redirect not verified'
  Write-Host 'PASS: Isolated TEST predecessor, Access, physical D1 and FOUR encrypted secrets incl. webhook'

  Write-Host 'STEP 2/5: Save rollback record and fetch exact approved source'
  $backupFolder=Join-Path $HOME 'FIRE-Backups'
  New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
  $backup=Join-Path $backupFolder ('stripe-test-before-gate9-hmac-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.json')
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


  # Verify reviewed HMAC-first generator, no hosted action.
  $materializerSource=Get-Content -LiteralPath (Join-Path $Source 'business-app-parity\cloudflare-launch\materialize-stripe-test.py') -Raw
  Assert ($materializerSource.Contains('webhook_guard + webhook_anchor') -and
    $materializerSource.Contains('required_signature = "verifyStripeSignature(rawBody, signature, runtime.STRIPE_WEBHOOK_SECRET)"') -and
    $materializerSource.Contains('Stripe TEST is intentionally disabled.') -and
    -not $materializerSource.Contains('"app/api/payments/webhook/route.ts": "export async function POST')) 'Wrong TEST-only HMAC-first generator source'

  Write-Host 'STEP 3/5: Build exact Gate9 HMAC-first TEST code with Stripe money operations DISABLED'
  $materializer=Join-Path $Source 'business-app-parity\cloudflare-launch\materialize-stripe-test.py'
  if($python.Name -eq 'py.exe') { & $python.Source -3 $materializer $App }
  else { & $python.Source $materializer $App }
  ExitCheck 'TEST-only source materialization'
  Assert (-not (Test-Path -LiteralPath (Join-Path $App 'app\access-public-keys.mjs'))) 'Generated TEST app still contains public-key snapshot module'
  # Verify actual generated route, not merely the generator's source.
  $generatedHook=Get-Content -LiteralPath (Join-Path $App 'app\api\payments\webhook\route.ts') -Raw
  $sigAt=$generatedHook.IndexOf('if (!await verifyStripeSignature(')
  $gateAt=$generatedHook.IndexOf('  // TEST-only: validate Stripe HMAC before refusing disabled-mode delivery.')
  $parseAt=$generatedHook.IndexOf('  let event:StripeEvent;')
  Assert ($sigAt -ge 0 -and $gateAt -gt $sigAt -and $parseAt -gt $gateAt) 'Generated TEST webhook signature-before-kill-switch order changed'
  Assert ($generatedHook.Contains('FIRE_STRIPE_MODE !== "test"') -and $generatedHook.Contains('Stripe TEST is intentionally disabled.')) 'Generated TEST webhook must reject signed deliveries while disabled'
  foreach($route in @('checkout','refund','checkout\reconcile','connection')){
    $p=Join-Path $App ('app\api\payments\'+$route+'\route.ts')
    $t=Get-Content -LiteralPath $p -Raw
    Assert ($t.Contains('FIRE_STRIPE_MODE !== "test"') -and $t.Contains('Stripe TEST is intentionally disabled.')) ('Missing disabled-mode early guard for '+$route)
  }
  Write-Host 'PASS: TEST webhook HMAC then 503; four other Stripe routes still disabled.'
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
  Assert ($null -ne $cfg.observability -and $cfg.observability.PSObject.Properties.Name -contains 'redact_query_string' -and $cfg.observability.redact_query_string -ceq $false) 'Original TEST observability redact_query_string:false missing; STOP before remote config overwrite'
  Assert ($cfg.compatibility_flags -contains 'global_fetch_strictly_public' -and $cfg.compatibility_flags -contains 'nodejs_compat') 'Reviewed public Worker fetch flag is absent'

  foreach($forbidden in @('r2_buckets','kv_namespaces','durable_objects','services','queues','env','account_id','zone_id')){
    Assert (-not ($cfg.PSObject.Properties.Name -contains $forbidden)) ('Forbidden paid or cross-environment binding '+$forbidden)
  }
  $dry=Join-Path $Scratch 'dry-run'
  Pnpm @('exec','wrangler','deploy','--config',$review,'--dry-run','--outdir',$dry)
  Write-Host 'PASS: Gate9 HMAC-first TEST build/dry-run; existing observability redaction preserved; no routes, R2 or Stripe activation.'
  if(-not $Publish){
    Write-Host ('REVIEW PASS ONLY. No Cloudflare/Stripe writes. Pinned candidate '+$ExpectedCommit)
    Write-Host ('Pinned active version '+$PriorVersion)
    return
  }
  $approval='UPDATE STRIPE TEST CODE ONLY '+$Worker+' '+$DatabaseId+' '+$ExpectedCommit+' FROM '+$PriorVersion
  Write-Warning 'Code/assets change ONLY on existing isolated TEST Worker; preserve FOUR encrypted secrets (incl webhook), Access, D1, Stripe disabled.'
  Write-Host ('To authorize this exact code-only update, type: '+$approval)
  $typed=Read-Host 'Exact owner approval'
  Assert ($typed -ceq $approval) 'Exact owner approval absent; no deployment.'

  Write-Host 'STEP 5/5: Revalidate exact version before one separately authorized TEST-only deployment'
  $lastStatus=(& $Wrangler deployments status --name $Worker --json | Out-String).Trim()
  ExitCheck 'Final read-only predecessor recheck'
  $lastDeployment=ConvertFrom-Json -InputObject $lastStatus
  $lastVersions=@($lastDeployment.versions)
  Assert ($lastVersions.Count -eq 1 -and $lastVersions[0].version_id -eq $PriorVersion -and [int]$lastVersions[0].percentage -eq 100) 'TEST Worker changed during build; do not overwrite'
  VerifyVersion $PriorVersion
  $secretsAgain=@(WranglerJson @('secret','list','--name',$Worker))
  $namesAgain=(@($secretsAgain | ForEach-Object {$_.name} | Sort-Object) -join ',')
  Assert ($namesAgain -eq $ExpectedSecrets) 'Access secret inventory changed after approval'
  $DeployStarted=$true
  Write-Warning 'If Wrangler unexpectedly prompts about remote configuration differences, answer NO to both prompts. The attempted deployment must be treated as NOT ACCEPTED; never retry automatically.'
  Pnpm @('exec','wrangler','deploy','--config',$review,'--keep-vars','--strict')
  Write-Host 'Worker deploy returned success. Verifying NEW 100-percent version now.' -ForegroundColor Cyan
  $newRaw=(& $Wrangler deployments status --name $Worker --json | Out-String).Trim()
  ExitCheck 'Post-deploy serving version'
  try{$newDeployment=ConvertFrom-Json -InputObject $newRaw -ErrorAction Stop}
  catch{throw 'STOP: Post-deploy version unknown. DEPLOY MAY HAVE OCCURRED; do not retry.'}
  $newVersions=@($newDeployment.versions)
  Assert ($newVersions.Count -eq 1 -and [int]$newVersions[0].percentage -eq 100) 'New active version not uniquely serving 100%'
  $newId=[string]$newVersions[0].version_id
  Assert ($newId -match '^[0-9a-f-]{36}
  VerifyVersion $newId
  Write-Host ('PASS: NEW 100% active TEST version '+$newId+' with original D1 and Stripe disabled.') -ForegroundColor Green
  $post=@(WranglerJson @('secret','list','--name',$Worker))
  $postNames=(@($post | ForEach-Object {$_.name} | Sort-Object) -join ',')
  Assert ($postNames -eq $ExpectedSecrets) 'Secret inventory changed: stop, do not rerun'
  $after=(& curl.exe --silent --show-error --max-time 20 --dump-header - --output NUL $Origin | Out-String)
  ExitCheck 'Postdeploy Access probe'
  Assert ($after -match '(?im)^location:\s*https://restless-unit-ad5b\.cloudflareaccess\.com/') 'Owner-only Access redirect missing; review immediately'
  Write-Host 'PASS: Owner-only TEST Worker Access redirect preserved; four encrypted secret names retained.' -ForegroundColor Green
  Write-Host "Verified previous version: $PriorVersion"
  Write-Host "Rollback metadata: $backup"
  Write-Host "TEST URL: $Origin"
  Write-Warning 'Worker version metadata does NOT prove compiled assets match Git bytes; source-to-binary attestation remains open.'
  Write-Host 'No Stripe, customer messages, database writes/migrations or QA/LIVE/DR changes authorized here.'
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
 -and $newId -cne $PriorVersion) 'Post-deploy version unchanged (possible declined Wrangler config warning) or invalid; NO new active version proven. Do not retry'
  VerifyVersion $newId
  Write-Host ('PASS: NEW 100% active TEST version '+$newId+' with original D1 and Stripe disabled.') -ForegroundColor Green
  $post=@(WranglerJson @('secret','list','--name',$Worker))
  $postNames=(@($post | ForEach-Object {$_.name} | Sort-Object) -join ',')
  Assert ($postNames -eq $ExpectedSecrets) 'Secret inventory changed: stop, do not rerun'
  $after=(& curl.exe --silent --show-error --max-time 20 --dump-header - --output NUL $Origin | Out-String)
  ExitCheck 'Postdeploy Access probe'
  Assert ($after -match '(?im)^location:\s*https://restless-unit-ad5b\.cloudflareaccess\.com/') 'Owner-only Access redirect missing; review immediately'
  Write-Host 'PASS: Owner-only TEST Worker Access redirect preserved; four encrypted secret names retained.' -ForegroundColor Green
  Write-Host "Verified previous version: $PriorVersion"
  Write-Host "Rollback metadata: $backup"
  Write-Host "TEST URL: $Origin"
  Write-Warning 'Worker version metadata does NOT prove compiled assets match Git bytes; source-to-binary attestation remains open.'
  Write-Host 'No Stripe, customer messages, database writes/migrations or QA/LIVE/DR changes authorized here.'
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
