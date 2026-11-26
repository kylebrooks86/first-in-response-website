# Owner-only DPAPI credential adapter. Never print or persist plaintext.
# Review mode validates metadata only; real credential release remains disabled.
[CmdletBinding()]
param([switch]$Execute)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if($Execute){throw 'STOP: real upload and private hash release not yet authorized or enabled'}
if($env:OS -ne 'Windows_NT' -or $env:CI -or $env:GITHUB_ACTIONS){throw 'STOP: owner Windows only'}
$private=Join-Path $env:LOCALAPPDATA 'FIRE-STAGING-Private'
$recordPath=Join-Path $private 'staging-admin-hash-dpapi.xml'
$record=Import-Clixml -LiteralPath $recordPath
if($record.targetWorker -cne 'fire-app-independent-staging' -or
   $record.expectedDatabaseId -cne 'afb2c05a-d794-4a9a-b580-924ce01c26ad' -or
   $record.secretName -cne 'FIRE_ADMIN_PASSWORD_HASH' -or
   $record.hashVerifier -isnot [securestring] -or
   $record.uploadedToProvider -ne $false -or
   $record.deploymentAuthorized -ne $false){throw 'STOP: private record mismatch'}
$record=$null
[pscustomobject]@{result='STAGING_PRIVATE_RECORD_METADATA_READY';plaintextRead=$false;providerContacted=$false;uploadAuthorized=$false} | ConvertTo-Json
