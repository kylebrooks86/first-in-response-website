# Pure, offline regression tests of Cloudflare immutable Worker version binding shape.
# No Wrangler, secrets, remote calls, app tests or deploys.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'assert_stripe_disabled_binding.ps1')
function Entry([string]$type,[string]$name,[string]$field,[object]$value) {
    $o=[pscustomobject]@{name=$name;type=$type}
    if ($field) {$o | Add-Member -NotePropertyName $field -NotePropertyValue $value}
    return $o
}
function MustReject([object[]]$bindings,[string]$caseName) {
    $blocked=$false
    try {$null=Assert-FireStripeTestModeDisabled -Bindings $bindings}
    catch { $blocked=$_.Exception.Message -like 'STOP:*' }
    if (-not $blocked) {throw ('UNSAFE STRIPE BINDING ACCEPTED: '+$caseName)}
}
$db=Entry 'd1' 'DB' 'id' 'synthetic-uuid'
$valid=Entry 'plain_text' 'FIRE_STRIPE_MODE' 'text' 'disabled'
if (-not (Assert-FireStripeTestModeDisabled -Bindings @($db,$valid))) {
    throw 'Valid real Cloudflare plain_text shape rejected'
}
if (-not (Assert-FireStripeTestModeDisabled -Bindings @($valid))) {
    throw 'Valid single explicit disabled mode rejected'
}
MustReject @($db) 'missing mode'
MustReject @() 'empty bindings'
MustReject @($db,(Entry 'plain_text' 'FIRE_STRIPE_MODE' 'value' 'disabled')) 'obsolete value property'
MustReject @($db,(Entry 'plain_text' 'FIRE_STRIPE_MODE' '' $null)) 'missing text property'
MustReject @($db,(Entry 'plain_text' 'FIRE_STRIPE_MODE' 'text' $null)) 'null text value'
MustReject @($db,(Entry 'plain_text' 'FIRE_STRIPE_MODE' 'text' 'test')) 'test enabled'
MustReject @($db,(Entry 'plain_text' 'FIRE_STRIPE_MODE' 'text' 'live')) 'live enabled'
MustReject @($db,(Entry 'plain_text' 'FIRE_STRIPE_MODE' 'text' 'Disabled')) 'case mismatch'
MustReject @($db,(Entry 'plain_text' 'FIRE_STRIPE_MODE' 'text' 'disabled ')) 'whitespace mismatch'
MustReject @($db,(Entry 'secret_text' 'FIRE_STRIPE_MODE' 'text' 'disabled')) 'secret type'
MustReject @($db,$valid,$valid) 'duplicate binding'
MustReject @($db,$valid,(Entry 'plain_text' 'FIRE_STRIPE_MODE' 'text' 'test')) 'conflicting duplicate binding'
Write-Host 'PASS: Cloudflare plain_text.text release guard accepts only one explicit disabled binding; 12 negative cases rejected; zero remote calls.'
