# Fully offline regression for QA Worker binding verification. No Wrangler calls.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$target=Join-Path $PSScriptRoot 'verify_qa_worker_version_bindings.ps1'
$version='1783ded7-43db-4769-8708-fa86c47b002d'
$database='8ccfb1f8-1657-4074-b1b2-47de78f95003'
function Fixture {
  return @{ id=$version;number=17;resources=@{bindings=@(
    @{type='d1';name='DB';id=$database},
    @{type='secret_text';name='FIRE_QA_SESSION_SECRET'}
  )}}
}
$checks=0
function Test-Case([string]$name,[object]$body,[bool]$success) {
  $json=if($body -is [string]){$body}else{ConvertTo-Json -InputObject $body -Depth 12 -Compress}
  $threw=$false
  try {
    $result=& $target -Json $json -ExpectedVersion $version -ExpectedDatabaseId $database
    if($null -eq $result -or $result.bindingVerified -ne $true -or $result.d1Binding -cne 'DB' -or $result.remoteWrites -ne $false) {
      throw 'Validator did not return a bounded read-only PASS receipt.'
    }
  }catch{$threw=$true}
  if($threw -eq $success){throw ('QA binding fixture '+$name+' expected success='+$success)}
  $script:checks++
  Write-Host ('PASS: '+$name)
}
Test-Case 'healthy version with exact QA D1' (Fixture) $true
$t=Fixture;$t.resources.bindings[0].id='ffffffff-ffff-4fff-8fff-ffffffffffff'
Test-Case 'reject wrong physical D1 UUID' $t $false
$t=Fixture;$t.id='ffffffff-ffff-4fff-8fff-ffffffffffff'
Test-Case 'reject version mismatch' $t $false
$t=Fixture;$t.number=$null
Test-Case 'reject absent version number' $t $false
$t=Fixture;$t.Remove('resources')
Test-Case 'reject missing resources section' $t $false
$t=Fixture;$t.resources.bindings=@()
Test-Case 'reject empty binding list' $t $false
$t=Fixture;$t.resources.bindings+=@{type='d1';name='EXTRA';id='ffffffff-ffff-4fff-8fff-ffffffffffff'}
Test-Case 'reject second D1 even if QA UUID otherwise valid' $t $false
$t=Fixture;$t.resources.bindings+=@{type='r2_bucket';name='BUCKET'}
Test-Case 'reject unexpected R2 photo storage' $t $false
$t=Fixture;$t.resources.bindings[0].name='OTHER_DB'
Test-Case 'reject nonstandard binding name' $t $false
$t=Fixture;$t.resources.bindings[0].type='kv_namespace'
Test-Case 'reject missing D1 binding' $t $false
$t=Fixture;$t.resources.bindings[0].Remove('id')
Test-Case 'reject missing physical database identifier' $t $false
Test-Case 'reject invalid provider JSON' '{not-json' $false
Test-Case 'reject array rather than one version' @((Fixture),(Fixture)) $false
Write-Host ('PASS '+$checks+' offline QA exact-version/physical-D1 binding checks; ZERO provider calls or writes.')
