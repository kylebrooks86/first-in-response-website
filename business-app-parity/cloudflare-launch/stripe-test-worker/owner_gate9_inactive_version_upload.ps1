# Gate 9 HMAC-first: stage an INACTIVE TEST Worker version; NEVER serve new traffic.
# Default is read-only review. -Upload needs separate explicit owner consent and never deploys traffic.
# No Stripe mode enabling, webhook endpoint/Access changes, database, migration, R2, LIVE, QA or DR writes.
# Stop on uncertainty: NEVER retry automatically after an inactive upload attempt.
# Prior approved upload attempt used project-local Wrangler 4.92.0 and failed on unsupported --strict.
# THIS REVISED SOURCE REQUIRES A NEW SEPARATE OWNER APPROVAL; the earlier one-upload approval is consumed.
[CmdletBinding()]
param(
  [switch]$Upload,
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
$ExpectedCommit='48c61a2e62df4857bc525c51b5f6f0717b5551d8'
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
$UploadStarted=$false
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
  try{
    $parsed=ConvertFrom-Json -InputObject $raw -ErrorAction Stop
    # Wrangler versions list may legitimately return ONE result. Preserve the
    # provider's top-level JSON array instead of letting PowerShell unwrap it
    # into a single PSCustomObject that looks like an unknown response schema.
    if($raw.TrimStart().StartsWith('[')){return ,@($parsed)}
    return $parsed
  }
  catch{throw "STOP: Cannot parse Wrangler response. No deploy."}
}
function Assert-VersionSecretBindings([object[]]$bindings){
  # Worker-level "secret list" alone is NOT evidence that a newly uploaded
  # INACTIVE version inherited the secrets. Check the immutable version itself.
  $names=@($bindings|Where-Object {
    $null -ne $_ -and $_.PSObject.Properties.Name -contains 'type' -and $_.type -ceq 'secret_text'
  }|ForEach-Object {
    Assert ($_.PSObject.Properties.Name -contains 'name') 'Version secret has no name'
    [string]$_.name
  }|Sort-Object)
  Assert ($names.Count -eq 4 -and ($names -join ',') -ceq $script:ExpectedSecrets) 'Immutable version missing or unexpectedly adding encrypted secret bindings'
  return $true
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
  Assert ([bool](Assert-VersionSecretBindings -bindings $bindings)) 'TEST Worker version secrets are not inherited correctly'
  Write-Host ('PASS: Immutable version '+$id+' uses isolated TEST DB, no R2, Stripe disabled and four encrypted secrets by NAME.')
}
function Get-StrictVersionIds($data){
  if($data -is [array]){$items=@($data)}
  elseif($null -ne $data -and @($data.PSObject.Properties.Name) -contains 'versions'){$items=@($data.versions)}
  elseif($null -ne $data -and @($data.PSObject.Properties.Name) -contains 'result'){
    if($data.result -is [array]){$items=@($data.result)}
    elseif($null -ne $data.result -and @($data.result.PSObject.Properties.Name) -contains 'versions'){$items=@($data.result.versions)}
    else{throw 'STOP: Unrecognized version-list result shape'}
  }else{throw 'STOP: Unrecognized version-list JSON shape'}
  $ids=@()
  foreach($item in $items){
    if($null -eq $item){throw 'STOP: Null version-list item'}
    if(@($item.PSObject.Properties.Name) -contains 'id'){$id=[string]$item.id}
    elseif(@($item.PSObject.Properties.Name) -contains 'version_id'){$id=[string]$item.version_id}
    else{throw 'STOP: Missing version identifier'}
    if($id -notmatch '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$'){throw 'STOP: Malformed version UUID'}
    $ids+=$id.ToLowerInvariant()
  }
  if($ids.Count -lt 1 -or $ids.Count -ne @($ids|Sort-Object -Unique).Count){throw 'STOP: Empty/duplicate version list'}
  return $ids
}
function SecretNamesPretty(){
  # Wrangler 4.151.0 owner-proven form, NO values: "Secret Name: NAME"
  # Exact equality below blocks missing, unexpected, or duplicate names.
  $raw=(& $script:Wrangler secret list --name $script:Worker --format pretty 2>$null | Out-String)
  ExitCheck 'Read-only Wrangler pretty secret inventory'
  $lines=@($raw -split '\r?\n'|Where-Object {$_ -match '^\s*Secret Name:'})
  $names=@()
  foreach($line in $lines){
    if($line -notmatch '^\s*Secret Name:\s*([A-Z][A-Z0-9_]*)\s*$'){
      throw 'STOP: Unexpected Wrangler pretty-format secret entry'
    }
    $names+= $Matches[1]
  }
  Assert ($names.Count -eq 4 -and @($names|Sort-Object -Unique).Count -eq 4) 'Wrong or duplicate TEST secret-name inventory'
  return (($names|Sort-Object) -join ',')
}
function Assert-InactiveUploadCli([string]$version,[string]$help){
  # Owner-confirmed standalone Wrangler v4.151.0 on Acer, separate from
  # project-local pnpm Wrangler 4.92.0 (which lacks versions upload --strict).
  # Standalone `wrangler.cmd --version` on the owner's Acer prints just
  # "4.151.0" (not "wrangler 4.151.0"). The previous label-required regex
  # caused a false STOP despite the independently verified CLI and flags.
  $reported=$version.Trim()
  $exactBare=$reported -ceq '4.151.0'
  $exactLabeled=$reported -match '(?i)\A(?:⛅\s*)?wrangler\s+4\.151\.0\z'
  Assert ($exactBare -or $exactLabeled) 'Global Wrangler 4.151.0 not verified. STOP before authorizing any upload.'
  foreach($flag in @('--strict','--keep-vars','--config')){
    Assert ($help.Contains($flag)) ('Global versions upload CLI does not support required '+$flag+' safety capability.')
  }
  return $true
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
  # Pure CLI help/version preflight BEFORE any owner write authorization.
  # These invocations perform NO remote writes and must use standalone
  # Wrangler, NOT the app-local pnpm wrangler locked at 4.92.0.
  $globalVersion=(& $Wrangler --version | Out-String).Trim()
  ExitCheck 'Standalone Wrangler version preflight'
  $globalHelp=(& $Wrangler versions upload --help | Out-String)
  ExitCheck 'Standalone Wrangler inactive-upload capabilities'
  Assert ([bool](Assert-InactiveUploadCli $globalVersion $globalHelp)) 'Unsupported standalone Wrangler for safe version staging'
  Write-Host 'PASS: Standalone Wrangler 4.151.0 supports --strict and --keep-vars (separate from app build CLI).'
  $null=Get-Command git.exe -ErrorAction Stop
  $null=Get-Command node.exe -ErrorAction Stop
  $python=Get-Command py.exe -ErrorAction SilentlyContinue
  if(-not $python){$python=Get-Command python.exe -ErrorAction Stop}
  $corepack=Get-Command corepack.cmd -ErrorAction SilentlyContinue
  $pnpm=Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  Assert ([bool]($corepack -or $pnpm)) 'Neither corepack nor pnpm is installed'
  if($corepack){$PkgCommand=$corepack.Source;$PkgPrefix=@('pnpm')}
  else{$PkgCommand=$pnpm.Source;$PkgPrefix=@()}
  $actualSecretNames=SecretNamesPretty
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
  # Wrangler 4.151.0 rejects the retired legacy_env field even when true.
  # The historical pinned generator only permits legacy_env=true (former
  # default); this independently SHA-verified local helper rejects anything
  # else, then deletes that ONE obsolete key in the isolated TEST review JSON.
  # No other config property or remote resource may be changed here.
  $finalizer=Join-Path $PSScriptRoot 'finalize-stripe-test-legacy-env.mjs'
  Assert (Test-Path -LiteralPath $finalizer -PathType Leaf) 'Audited local legacy_env compatibility finalizer missing; no upload'
  & node $finalizer $review
  ExitCheck 'Local-only Wrangler legacy_env compatibility finalization'
  $cfg=Get-Content -LiteralPath $review -Raw | ConvertFrom-Json
  Assert (-not ($cfg.PSObject.Properties.Name -contains 'legacy_env')) 'Removed legacy_env is still present: STOP before upload'
  Assert ($cfg.name -eq $Worker -and $cfg.topLevelName -eq $Worker) 'Wrong Worker target in generated config'
  Assert ($cfg.d1_databases.Count -eq 1 -and $cfg.d1_databases[0].database_id -eq $DatabaseId -and $cfg.d1_databases[0].database_name -eq $Database) 'Wrong D1 binding'
  Assert ($cfg.vars.FIRE_ACCESS_REQUIRED -eq 'enabled' -and $cfg.vars.FIRE_STRIPE_MODE -eq 'disabled' -and $cfg.vars.FIRE_ENV -eq 'cloudflare-staging' -and $cfg.vars.SITE_ORIGIN -eq $Origin) 'Auth, origin, or Stripe mode mismatch'
  Assert ($cfg.workers_dev -eq $true -and $cfg.preview_urls -eq $false -and $cfg.routes.Count -eq 0) 'Public routing/preview mismatch'
  Assert ($null -ne $cfg.observability -and $cfg.observability.PSObject.Properties.Name -contains 'redact_query_string' -and $cfg.observability.redact_query_string -ceq $false -and
    $cfg.observability.enabled -ceq $true -and $cfg.observability.logs.enabled -ceq $true -and
    $cfg.observability.logs.invocation_logs -ceq $true) 'TEST remote observability, logs or invocation logs settings mismatch; STOP before any upload'
  Assert ($cfg.compatibility_flags -contains 'global_fetch_strictly_public' -and $cfg.compatibility_flags -contains 'nodejs_compat') 'Reviewed public Worker fetch flag is absent'

  foreach($forbidden in @('r2_buckets','kv_namespaces','durable_objects','services','queues','env','account_id','zone_id')){
    Assert (-not ($cfg.PSObject.Properties.Name -contains $forbidden)) ('Forbidden paid or cross-environment binding '+$forbidden)
  }
  $dry=Join-Path $Scratch 'dry-run'
  Pnpm @('exec','wrangler','deploy','--config',$review,'--dry-run','--outdir',$dry)
  # Independently test this exact finalized manifest with the SAME new
  # standalone Wrangler that would perform the inactive upload. The pinned
  # app-local Wrangler 4.92.0 silently accepted legacy_env and previously
  # failed to detect this 4.151.0 incompatibility. Both dry runs are LOCAL.
  $standaloneDry=Join-Path $Scratch 'dry-run-standalone-wrangler-4.151'
  & $Wrangler deploy --config $review --dry-run --outdir $standaloneDry
  ExitCheck 'Standalone Wrangler 4.151.0 isolated TEST config dry-run (NO UPLOAD)'
  Write-Host 'PASS: Both pinned and standalone Wrangler TEST dry-runs; no routes, R2, Stripe activation or hosted upload.'
  if(-not $Upload){
    Write-Host ('REVIEW PASS ONLY. No Cloudflare/Stripe writes. Pinned candidate '+$ExpectedCommit)
    Write-Host ('Pinned active version '+$PriorVersion)
    return
  }
  $approval='UPLOAD INACTIVE FIRE STRIPE TEST ONLY '+$Worker+' '+$DatabaseId+' '+$ExpectedCommit+' FROM '+$PriorVersion
  Write-Warning 'One INACTIVE version upload; ZERO traffic change. Never deploy version, enable Stripe, modify D1, Access, secrets, LIVE, QA or DR.'
  Write-Host ('To authorize the INACTIVE upload, type: '+$approval)
  $typed=Read-Host 'Exact owner inactive-upload approval'
  Assert ($typed -ceq $approval) 'Owner declined inactive upload; NO hosted write'

  Write-Host 'STEP 5/5: Fresh host version, D1, Access, secrets and version inventory before one INACTIVE upload'
  $last=(& $Wrangler deployments status --name $Worker --json | Out-String).Trim()
  ExitCheck 'Fresh serving version status'
  $lv=@((ConvertFrom-Json -InputObject $last -ErrorAction Stop).versions)
  Assert ($lv.Count -eq 1 -and $lv[0].version_id -ceq $PriorVersion -and [int]$lv[0].percentage -eq 100) 'Serving version drifted. STOP'
  VerifyVersion $PriorVersion
  Assert ((SecretNamesPretty) -ceq $ExpectedSecrets) 'Existing four secrets changed. STOP'
  # Wrangler versions list is a RECENT-version window, not the complete
  # immutable history. A legitimate 100%-serving predecessor can be older
  # than the list window. Its identity was already authenticated above via
  # deployments status + versions view; never infer a missing deployed version.
  $beforeIds=@(Get-StrictVersionIds (WranglerJson @('versions','list','--name',$Worker,'--json')))
  Assert ($beforeIds.Count -gt 0) 'Cannot establish recent version inventory. STOP'

  # Wrangler strict noninteractive must reject conflicting dashboard configuration;
  # never accept a prompt, force overwrite or auto-shift traffic.
  $priorCI=[Environment]::GetEnvironmentVariable('CI','Process')
  $UploadStarted=$true
  try {
    [Environment]::SetEnvironmentVariable('CI','true','Process')
    # ONE upload on standalone v4.151.0; NEVER use pnpm-local v4.92.0.
    & $Wrangler versions upload --config $review --keep-vars --strict
    ExitCheck 'Standalone Wrangler one inactive-only upload (strict/no traffic)'
  }
  finally {
    [Environment]::SetEnvironmentVariable('CI',$priorCI,'Process')
  }
  # Cloudflare may return zero even after a declined prompt in older Wrangler;
  # require no traffic change and a new version listed, else STOP/NO RETRY.
  $after=(& $Wrangler deployments status --name $Worker --json | Out-String).Trim()
  ExitCheck 'Read-only serving version after inactive-only upload'
  $served=@((ConvertFrom-Json -InputObject $after -ErrorAction Stop).versions)
  Assert ($served.Count -eq 1 -and $served[0].version_id -ceq $PriorVersion -and [int]$served[0].percentage -eq 100) 'CRITICAL: Serving version changed after upload-only action!'
  $afterIds=@(Get-StrictVersionIds (WranglerJson @('versions','list','--name',$Worker,'--json')))
  $newIds=@($afterIds|Where-Object {$_ -notin $beforeIds})
  Assert ($newIds.Count -eq 1 -and $newIds[0] -cne $PriorVersion) 'No UNIQUE new inactive version found. DO NOT RETRY.'
  $newId=[string]$newIds[0]
  VerifyVersion $newId
  Assert ((SecretNamesPretty) -ceq $ExpectedSecrets) 'Secret names changed after inactive upload'
  $h=(& curl.exe --silent --show-error --max-time 20 --dump-header - --output NUL $Origin | Out-String)
  ExitCheck 'Owner-only Access after inactive upload'
  Assert ($h -match '(?im)^location:\s*https://restless-unit-ad5b\.cloudflareaccess\.com/') 'Owner Access redirect changed!'
  Write-Host ('PASS: Original TEST version still 100% active: '+$PriorVersion) -ForegroundColor Green
  Write-Host ('PASS: New INACTIVE version '+$newId+' verified with correct D1 and Stripe disabled; provenance and version-specific secrets need separate acceptance.')
  Write-Warning 'THIS SCRIPT DOES NOT ACTIVATE ANY VERSION. NEVER RERUN. New separate owner approval required for traffic rollout.'

}
catch{
  Write-Host $_.Exception.Message -ForegroundColor Red
  if($UploadStarted){
    Write-Host 'INACTIVE UPLOAD MAY HAVE OCCURRED. DO NOT RUN AGAIN. Inspect TEST versions and deployments READ-ONLY.' -ForegroundColor Yellow
  }else{
    Write-Host 'No inactive upload attempted. Stop and review error first.' -ForegroundColor Yellow
  }
  exit 1
}
finally{
  if($InApp){Pop-Location}
  Write-Host "Local review copy: $Scratch"
}
