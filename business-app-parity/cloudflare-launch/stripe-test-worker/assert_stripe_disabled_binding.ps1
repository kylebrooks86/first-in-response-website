# Offline-only helper for immutable Cloudflare Worker version bindings.
# Cloudflare plain_text binding JSON uses .text (not .value); fail closed.
# Import with dot-source from owner_update_qa_parity_code_only.ps1.
function Assert-FireStripeTestModeDisabled {
    [CmdletBinding()]
    param([AllowEmptyCollection()][object[]]$Bindings)

    $modes = @($Bindings | Where-Object {
        $null -ne $_ -and
        $null -ne $_.PSObject.Properties['name'] -and
        [string]$_.name -ceq 'FIRE_STRIPE_MODE'
    })
    if ($modes.Count -ne 1) {
        throw 'STOP: Expected exactly one FIRE_STRIPE_MODE binding; no deploy.'
    }
    $mode = $modes[0]
    if ($null -eq $mode.PSObject.Properties['type'] -or [string]$mode.type -cne 'plain_text') {
        throw 'STOP: FIRE_STRIPE_MODE must be a plain_text binding; no deploy.'
    }
    if ($null -eq $mode.PSObject.Properties['text'] -or
        $mode.text -isnot [string] -or [string]$mode.text -cne 'disabled') {
        throw 'STOP: FIRE_STRIPE_MODE not explicitly disabled in version metadata; no deploy.'
    }
    return $true
}
