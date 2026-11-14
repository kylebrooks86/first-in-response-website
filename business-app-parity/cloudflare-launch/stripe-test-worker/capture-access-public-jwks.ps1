# Capture only Cloudflare Access PUBLIC signing keys into a NEW isolated
# generated TEST app before its build. NO accounts, passwords, tokens, AUD,
# emails, Cloudflare API writes or Workers deployments.
param([Parameter(Mandatory=$true)][string]$AppDirectory)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$expectedHost='restless-unit-ad5b.cloudflareaccess.com'
$uri='https://'+$expectedHost+'/cdn-cgi/access/certs'
$target=Join-Path $AppDirectory 'app\access-public-keys.mjs'
if(-not (Test-Path -LiteralPath $target -PathType Leaf)){
  throw 'STOP: Expected generated empty public key placeholder missing.'
}
$old=Get-Content -LiteralPath $target -Raw
if(-not $old.Contains('teamDomain: ""') -or -not $old.Contains('keys: []')){
  throw 'STOP: Public key placeholder modified or already captured.'
}
Write-Host 'READ-ONLY HTTPS: Fetching PUBLIC Cloudflare Access signing keys for isolated TEST build.'
$r=Invoke-WebRequest -Uri $uri -TimeoutSec 25 -MaximumRedirection 0 -UseBasicParsing
if($r.StatusCode -ne 200 -or $r.BaseResponse.ResponseUri.Host -ne $expectedHost){
  throw 'STOP: Public certs fetch status or origin changed.'
}
if($r.Content.Length -gt 48000){throw 'STOP: Unexpected public JWKS response length.'}
try{$obj=$r.Content | ConvertFrom-Json}
catch{throw 'STOP: Public JWKS was not JSON.'}
$keys=@($obj.keys)
if($keys.Count -lt 1 -or $keys.Count -gt 5){
  throw 'STOP: Unexpected public signing key count.'
}
$safeKeys=@()
$seen=@{}
foreach($k in $keys){
  $fields=@($k.PSObject.Properties.Name)
  foreach($field in $fields){
    if($field -notin @('kid','kty','alg','use','e','n')){
      throw "STOP: Unexpected field in public JWKS: $field"
    }
  }
  if($k.kty -ne 'RSA' -or $k.alg -ne 'RS256' -or $k.use -ne 'sig' -or
    $k.kid -notmatch '^[A-Za-z0-9_-]{8,159}$' -or
    $k.e -notmatch '^[A-Za-z0-9_-]{2,12}$' -or
    $k.n -notmatch '^[A-Za-z0-9_-]{256,1024}$' -or
    $seen.ContainsKey($k.kid)){
    throw 'STOP: Invalid or duplicate public RSA signing key.'
  }
  $seen[$k.kid]=$true
  $safeKeys+=@{kid=$k.kid;kty='RSA';alg='RS256';use='sig';e=$k.e;n=$k.n}
}
$snapshot=@{
  teamDomain=$expectedHost
  fetchedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  keys=$safeKeys
}
$json=ConvertTo-Json -InputObject $snapshot -Depth 8 -Compress
# JSON built exclusively from validated public fields; never contains
# private material. No source repository or hosted environment is modified.
$text='// Public Cloudflare Access signing keys captured via official HTTPS during the isolated TEST build.'+[Environment]::NewLine+
  'export const pinnedAccessPublicKeys = Object.freeze('+ $json +');'+[Environment]::NewLine
[System.IO.File]::WriteAllText($target,$text,[System.Text.UTF8Encoding]::new($false))
& node.exe --check $target
if($LASTEXITCODE -ne 0){throw 'STOP: Generated public-key module failed syntax verification.'}
Write-Host ("PASS: Captured "+$safeKeys.Count+" public signing keys only. 14-day fail-closed TEST fallback.")
