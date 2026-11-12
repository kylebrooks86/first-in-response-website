# FIRE Gate 9 — STRICT READ-ONLY Cloudflare Access inventory, TEST Worker ONLY.
# No Access policy PUT/PATCH/POST/DELETE, no Stripe/D1/Worker writes, no deploy.
# Safe to run before seeking a separately scoped webhook-path mutation approval.
# Requires a short-lived Cloudflare API token authorized to READ Access apps.
# DO NOT paste any token, owner identity, raw policy, or screenshots of secrets in chat.
& {
  $ErrorActionPreference='Stop'
  $stage='startup'
  $ptr=[IntPtr]::Zero
  $secure=$null; $secret=$null; $headers=$null; $result=$null
  $account='bfc00939cfb2f8dfd8581a7a7f5f1307'
  $appId='09dbb414-997f-494f-85a5-a3a65a5a92ef'
  $workerId='72f9cab371974bc8811da05f44976fa9'
  $appName='fire-stripe-test-20261101 - Cloudflare Workers'
  $uri="https://api.cloudflare.com/client/v4/accounts/$account/access/apps/$appId"
  $seven=@('/estimate/*','/invoice/*','/pay/*','/_next/static/*',
           '/assets/*','/fire-app-logo.png','/favicon.ico')
  $webhook='/api/payments/webhook'
  try {
    $stage='private read-only API token'
    $secure=Read-Host 'Paste short-lived Cloudflare Access READ token' -AsSecureString
    $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $secret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    if ([string]::IsNullOrWhiteSpace($secret)) {throw 'no token'}
    $headers=@{Authorization="Bearer $secret"}
    $stage='one authenticated GET for pinned TEST Access app'
    $response=Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -TimeoutSec 20 -ErrorAction Stop
    if (-not $response.success -or $null -eq $response.result) {throw 'read not confirmed'}
    $result=$response.result
    $stage='pinned app/worker/policy identity'
    if ($result.id -cne $appId -or $result.type -cne 'self_hosted' -or
        $result.name -cne $appName) {throw 'app mismatch'}
    $destinations=@($result.destinations | Where-Object { $null -ne $_ })
    if ($destinations.Count -ne 1 -or $destinations[0].type -cne 'worker' -or
        $destinations[0].worker_id -cne $workerId) {throw 'worker mismatch'}
    $unknownDest=@($destinations[0].PSObject.Properties | Where-Object {
      $_.Name -notin @('type','worker_id','overrides')
    })
    if ($unknownDest.Count -ne 0) {throw 'unknown destination config'}
    $policies=@($result.policies | Where-Object { $null -ne $_ })
    if ($policies.Count -ne 1 -or $policies[0].reusable -ne $true -or
        $policies[0].decision -cne 'allow' -or -not $policies[0].id) {
      throw 'owner Allow policy missing or modified'
    }
    $inc=@($policies[0].include | Where-Object { $null -ne $_ })
    if ($inc.Count -ne 1 -or
        @($inc[0].PSObject.Properties).Count -ne 1 -or
        @($inc[0].PSObject.Properties)[0].Name -cne 'email' -or
        @($policies[0].exclude | Where-Object { $null -ne $_ }).Count -ne 0 -or
        @($policies[0].require | Where-Object { $null -ne $_ }).Count -ne 0) {
      throw 'Allow policy identity constraint changed'
    }
    $stage='exact public-path inventory'
    $overrides=@($destinations[0].overrides | Where-Object { $null -ne $_ })
    if ($overrides.Count -ne 7 -and $overrides.Count -ne 8) {
      throw 'unknown public path count'
    }
    $paths=@()
    foreach($rule in $overrides) {
      if ($rule.behavior -cne 'public' -or
          $rule.path_pattern -cnotin (@($seven)+@($webhook))) {
        throw 'non-approved public exception'
      }
      if (@($rule.PSObject.Properties | Where-Object {
        $_.Name -notin @('behavior','path_pattern')
      }).Count -ne 0) {throw 'unreviewed override property'}
      $paths+= [string]$rule.path_pattern
    }
    if (@($paths | Sort-Object -Unique).Count -ne $overrides.Count) {
      throw 'duplicate public paths'
    }
    foreach($path in $seven) {
      if ($path -cnotin $paths) {throw 'one of original seven paths missing'}
    }
    if ($overrides.Count -eq 7 -and $webhook -cin $paths) {
      throw 'webhook present with seven total paths'
    }
    if ($overrides.Count -eq 8 -and $webhook -cnotin $paths) {
      throw 'webhook absent with eight total paths'
    }
    Write-Host 'PASS: Correct isolated FIRE TEST Worker Access application and single reusable Allow policy.'
    if ($overrides.Count -eq 7) {
      Write-Host 'READ_ONLY: EXACT_SEVEN — webhook still behind Access; no policy write attempted.'
    } else {
      Write-Host 'READ_ONLY: EXACT_EIGHT — exact webhook path public, other seven unchanged; separately test HMAC and private routes.'
    }
    Write-Host 'NO cloud change, Stripe event, TEST activation, backup or LIVE modification performed.'
  } catch {
    Write-Host "STOP at $stage — Access state was NOT accepted. No cloud change attempted."
    Write-Host 'Inspect the Access app independently; do not auto-repair or run the ADD helper.'
  } finally {
    if($ptr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
    $secret=$null; $secure=$null; $headers=$null; $result=$null
  }
}
