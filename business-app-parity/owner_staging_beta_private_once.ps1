# FIRE G4 owner-only one-shot inactive STAGING launcher (no browser login).
# Normal invocation is local/READ-ONLY. -Execute requires NEW exact owner approval.
# Never deploy/activate, mutate D1, switch traffic, enable Stripe/R2, or retry spent locks.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$PackageDirectory,[switch]$Execute)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$expectedReceipt='F811CC2D7E4B1C37E21D7D28D6ABA31215897AC89F5A2E756FBF9E258C1D525A'
$consent='I AUTHORIZE ONE NEW INACTIVE STAGING UPLOAD ONLY'
$private=Join-Path $env:LOCALAPPDATA 'FIRE-STAGING-Private'
$recordPath=Join-Path $private 'staging-admin-hash-dpapi.xml'
$cli=Join-Path $PSScriptRoot 'owner_staging_beta_private_once.mjs'
$oldLocks=@('g404-one-inactive-version-attempt-20261122.lock','g404-new-inactive-version-attempt-20261123.lock')
$newLock=Join-Path $private 'g404-new-inactive-version-attempt-20261125-reviewed.lock'
$adminHash=$null; $token=$null; $record=$null
function Require([bool]$ok,[string]$code) {
 if(-not $ok){throw ('STAGING_OWNER_POWERSHELL_STOP_'+$code)}
}
try{
 Require ($env:OS -eq 'Windows_NT' -and -not $env:CI -and -not $env:GITHUB_ACTIONS) 'OWNER_WINDOWS'
 $node=Get-Command node.exe -ErrorAction SilentlyContinue
 Require ($null -ne $node) 'NODE_MISSING'
 Require (Test-Path -LiteralPath $cli -PathType Leaf) 'CLI_MISSING'
 $folder=(Resolve-Path -LiteralPath $PackageDirectory).Path
 Require (Test-Path -LiteralPath $folder -PathType Container) 'PACKAGE_DIR'
 Require (-not ((Get-Item -LiteralPath $folder -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'PACKAGE_LINK'
 $receiptFile=Join-Path $folder 'staging-noassets-dark-source-receipt.json'
 Require (Test-Path -LiteralPath $receiptFile -PathType Leaf) 'RECEIPT'
 Require ((Get-FileHash -LiteralPath $receiptFile -Algorithm SHA256).Hash -ceq $expectedReceipt) 'RECEIPT_MISMATCH'
 Require (Test-Path -LiteralPath $private -PathType Container) 'PRIVATE_DIR'
 Require (-not ((Get-Item -LiteralPath $private -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'PRIVATE_LINK'
 foreach($name in $oldLocks){
  Require (Test-Path -LiteralPath (Join-Path $private $name) -PathType Leaf) 'HISTORY_MISSING'
 }
 Require (-not (Test-Path -LiteralPath $newLock)) 'NEW_ATTEMPT_ALREADY_CONSUMED_NO_RETRY'
 Require (Test-Path -LiteralPath $recordPath -PathType Leaf) 'DPAPI_RECORD_MISSING'
 $record=Import-Clixml -LiteralPath $recordPath
 Require ($record.targetWorker -ceq 'fire-app-independent-staging') 'WRONG_TARGET'
 Require ($record.expectedDatabaseId -ceq 'afb2c05a-d794-4a9a-b580-924ce01c26ad') 'WRONG_DATABASE'
 Require ($record.secretName -ceq 'FIRE_ADMIN_PASSWORD_HASH' -and $record.hashVerifier -is [securestring]) 'PRIVATE_HASH_SHAPE'
 Require ($record.uploadedToProvider -eq $false -and $record.deploymentAuthorized -eq $false) 'PRIVATE_UPLOAD_STATE'
 if(-not $Execute){
  [pscustomobject]@{
   result='STAGING_G4_NEW_OPERATOR_LOCALLY_READY'
   worker='fire-app-independent-staging'
   receiptVerified=$true
   priorLocksPreserved=$true
   nextAttemptUnspent=$true
   privateHashDecrypted=$false
   providerContacted=$false
   providerWriteAuthorized=$false
   servingVersionChanged=$false
  } | ConvertTo-Json
  return
 }
 # This switch must only be used after a separate exact owner authorization.
 # Consent here is an additional human verification, NOT a replacement for it.
 Require (-not $env:CLOUDFLARE_API_KEY -and -not $env:CLOUDFLARE_EMAIL) 'LEGACY_AUTH_PRESENT'
 $token=$env:CLOUDFLARE_API_TOKEN
 Require ($null -ne $token -and $token.Length -ge 20 -and
  $token.Length -le 4096 -and $token -notmatch '\s') 'EXISTING_TOKEN_MISSING'
 $answer=Read-Host ('Type exactly: '+$consent)
 Require ($answer -ceq $consent) 'FRESH_CONSENT_MISSING'
 $ptr=[IntPtr]::Zero
 try{
  $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($record.hashVerifier)
  $adminHash=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  Require ($adminHash -cmatch '^[a-f0-9]{64}$') 'PRIVATE_HASH_INVALID'
 }finally{
  if($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
 }
 # Send secrets only over the child's STDIN, never as CLI arguments or a file.
 # Node's one-use attempt lock is created immediately BEFORE its single POST.
 $payload=[pscustomobject]@{token=$token;adminHash=$adminHash;consent=$answer}
 $payload | ConvertTo-Json -Compress -Depth 2 | & $node.Source $cli --execute $folder
 $exit=$LASTEXITCODE
 $payload=$null
 $adminHash=$null
 $token=$null
 Require ($exit -eq 0) 'UPLOAD_STOP_CHECK_READONLY_NO_RETRY'
}finally{
 $adminHash=$null
 $token=$null
 $record=$null
}
