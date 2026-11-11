# FIRE GATE 9: add EXACT /api/payments/webhook Access exception, TEST ONLY.
# PREPARED ONLY — NOT APPROVED TO RUN. Obtain NEW explicit owner authorization
# for the one TEST Worker Access policy PUT, including any later rollback.
# No other Access rules, customer actions, Stripe/webhook changes, secrets,
# D1, R2, QA, LIVE, DR or deployments are approved. Stripe remains disabled.
# ADAPTED from previously successfully used guarded Gate 6 OPEN/CLOSE script.
# Use a NEW short-lived account-scoped Access: Apps and Policies EDIT token.
# NEVER paste token into chat, GitHub, screenshots or PowerShell command line.
# REQUIRE seven prior customer-view/asset exceptions and owner reusable policy.
# Require exact private same-user DPAPI backup and readback before any PUT.
# On ambiguous outcome, do NOT re-run. Independently inspect final Access state.

& {
  $ErrorActionPreference='Stop'
  $stage='local startup'
  $attempted=$false
  $verified=$false
  $ptr=[IntPtr]::Zero
  $secret=$null; $secure=$null; $plain=$null; $beforeBytes=$null
  $headers=$null; $saved=$null; $current=$null; $fresh=$null; $reply=$null
  $account='bfc00939cfb2f8dfd8581a7a7f5f1307'
  $appId='09dbb414-997f-494f-85a5-a3a65a5a92ef'
  $workerId='72f9cab371974bc8811da05f44976fa9'
  $appName='fire-stripe-test-20261101 - Cloudflare Workers'
  $uri="https://api.cloudflare.com/client/v4/accounts/$account/access/apps/$appId"
  $seven=@('/estimate/*','/invoice/*','/pay/*','/_next/static/*',
           '/assets/*','/fire-app-logo.png','/favicon.ico')
  # EXACT machine-only callback path. Never add a wildcard or customer POST.
  # Public means Access edge skips interactive login on ONLY this route;
  # the application must still verify a fresh signed Stripe POST itself.
  $single='/api/payments/webhook'
  $eight=@($seven)+@($single)

  function Assert-FireIdentity($app) {
    if ($null -eq $app -or $app.id -cne $appId -or
        $app.type -cne 'self_hosted' -or $app.name -cne $appName) {
      throw 'unexpected Access application'
    }
    $d=@($app.destinations | Where-Object { $null -ne $_ })
    if ($d.Count -ne 1 -or $d[0].type -cne 'worker' -or
        $d[0].worker_id -cne $workerId) {throw 'wrong Worker destination'}
    $extra=@($d[0].PSObject.Properties | Where-Object {
      $_.Name -notin @('type','worker_id','overrides')
    })
    if ($extra.Count -ne 0) {throw 'unknown destination fields'}
    $p=@($app.policies | Where-Object { $null -ne $_ })
    if ($p.Count -ne 1 -or $p[0].reusable -ne $true -or
        $p[0].decision -cne 'allow' -or -not $p[0].id) {
      throw 'owner policy mismatch'
    }
    $inc=@($p[0].include | Where-Object { $null -ne $_ })
    if ($inc.Count -ne 1) {throw 'owner identity rules changed'}
    $names=@($inc[0].PSObject.Properties | ForEach-Object { $_.Name })
    if ($names.Count -ne 1 -or $names[0] -cne 'email' -or
        @($p[0].exclude | Where-Object { $null -ne $_ }).Count -ne 0 -or
        @($p[0].require | Where-Object { $null -ne $_ }).Count -ne 0) {
      throw 'owner email rules changed'
    }
  }

  function Assert-ExactPaths($app,[string[]]$expected) {
    Assert-FireIdentity $app
    $actual=@($app.destinations[0].overrides | Where-Object { $null -ne $_ })
    if ($actual.Count -ne $expected.Count) {throw 'wrong override count'}
    $got=@()
    foreach($rule in $actual) {
      if ($rule.behavior -cne 'public' -or
          $rule.path_pattern -cnotin $expected) {
        throw 'unapproved override present'
      }
      $extra=@($rule.PSObject.Properties | Where-Object {
        $_.Name -notin @('behavior','path_pattern')
      })
      if ($extra.Count -ne 0) {throw 'unreviewed override property'}
      $got+= [string]$rule.path_pattern
    }
    if (@($got | Sort-Object -Unique).Count -ne $expected.Count) {
      throw 'duplicate or missing path'
    }
    foreach($path in $expected) {
      if ($path -cnotin $got) {throw 'missing approved path'}
    }
  }

  function Get-FireFingerprint($app) {
    $obj=[ordered]@{}
    foreach($p in $app.PSObject.Properties) {
      if ($p.Name -notin @('destinations','created_at','updated_at')) {
        $obj[$p.Name]=$p.Value
      }
    }
    ConvertTo-Json -InputObject $obj -Depth 80 -Compress
  }

  function New-FirePayload($app,[string[]]$paths) {
    $ro=@('id','uid','aud','created_at','updated_at')
    $writable=@(
      'name','type','destinations','policies','allowed_idps',
      'app_launcher_visible','auto_redirect_to_identity',
      'eager_redirect_cookie_setting','enable_binding_cookie',
      'http_only_cookie_attribute','options_preflight_bypass',
      'session_duration','tags','domain','logo_url','allow_iframe',
      'allow_authenticate_via_warp','cors_headers','custom_pages',
      'custom_deny_message','custom_deny_url',
      'custom_non_identity_deny_url','skip_interstitial',
      'service_auth_401_redirect','same_site_cookie_attribute',
      'self_hosted_domains','mfa_config'
    )
    $obj=[ordered]@{}
    foreach($prop in $app.PSObject.Properties) {
      if ($prop.Name -in $ro) {continue}
      if ($prop.Name -notin $writable) {
        if ($null -ne $prop.Value) {throw 'unreviewed application property'}
        continue
      }
      if ($null -ne $prop.Value -and $prop.Name -notin @('destinations','policies')) {
        $obj[$prop.Name]=$prop.Value
      }
    }
    $p=@($app.policies | Where-Object { $null -ne $_ })
    $obj['policies']=@([string]$p[0].id)
    $overrides=@($paths | ForEach-Object {
      @{behavior='public';path_pattern=$_}
    })
    $obj['destinations']=@(@{type='worker';worker_id=$workerId;overrides=$overrides})
    if($obj['name'] -cne $appName -or $obj['type'] -cne 'self_hosted') {
      throw 'unsafe request identity'
    }
    ConvertTo-Json -InputObject $obj -Depth 80 -Compress
  }

  try {
    Add-Type -AssemblyName System.Security -ErrorAction Stop
    # This OWNER-APPROVED script supports ADD only, never broadening or
    # removing unrelated rules; rollback to seven only if change fails.
    $mode='ADD'
    $beforePaths=$seven
    $afterPaths=$eight
    if ($single.Contains('*') -or $single -cne '/api/payments/webhook') {
      throw 'unreviewed webhook path'
    }

    $stage='private short-lived API token'
    $secure=Read-Host 'Paste temporary Cloudflare Access TEST edit token' -AsSecureString
    $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $secret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    if ([string]::IsNullOrWhiteSpace($secret)) {throw 'empty token'}
    $headers=@{Authorization="Bearer $secret"}

    $stage='fresh TEST-only Access GET'
    $get=Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -TimeoutSec 20 -ErrorAction Stop
    if (-not $get.success) {throw 'Cloudflare GET refused'}
    $current=$get.result
    $stage='exact original SEVEN Access paths and original owner policy guard'
    Assert-ExactPaths $current $beforePaths
    $finger=Get-FireFingerprint $current
    $bodyAfter=New-FirePayload $current $afterPaths
    Write-Host 'PASS: Exact isolated FIRE TEST Worker and owner policy verified'
    Write-Host "PASS: Current allowed public paths = $($beforePaths.Count)"
    Write-Host 'PASS: Other private/finance routes remain outside approved list'

    $stage='NEW local encrypted rollback snapshot'
    $folder=Join-Path $HOME 'FIRE-Backups'
    [IO.Directory]::CreateDirectory($folder) | Out-Null
    $backup=Join-Path $folder ("FIRE-Access-TEST-before-Gate9-webhook-"+(Get-Date -Format 'yyyyMMdd-HHmmss-fff')+'.dpapi')
    $json=ConvertTo-Json -InputObject $current -Depth 80 -Compress
    $beforeBytes=[Text.Encoding]::UTF8.GetBytes($json)
    $cipher=[Security.Cryptography.ProtectedData]::Protect(
      $beforeBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    [IO.File]::WriteAllBytes($backup,$cipher)
    $plain=[Security.Cryptography.ProtectedData]::Unprotect(
      [IO.File]::ReadAllBytes($backup),$null,
      [Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    if ([Convert]::ToBase64String($plain) -cne
        [Convert]::ToBase64String($beforeBytes)) {
      throw 'encrypted backup did not round-trip'
    }
    $saved=[Text.Encoding]::UTF8.GetString($plain) | ConvertFrom-Json
    Assert-ExactPaths $saved $beforePaths
    if ((Get-FireFingerprint $saved) -cne $finger) {throw 'snapshot contents mismatch'}
    Write-Host 'PASS: NEW encrypted rollback snapshot saved/verified in FIRE-Backups'

    $stage='operator consent'
    Write-Host 'EXACT CHANGE: 7 original TEST public paths -> 8 including /api/payments/webhook ONLY.'
    Write-Host 'Owner reusable Access allow policy, all other private endpoints, Stripe TEST disabled mode, and the old Sites webhook remain unchanged.'
    Write-Host 'NO customer signing/payment action, Worker deploy, database, API secret, Stripe endpoint, QA, LIVE, or DR changes.'
    $confirm=Read-Host 'Type ADD WEBHOOK TEST ONLY to authorize this single TEST Access change'
    if ($confirm -cne 'ADD WEBHOOK TEST ONLY') {throw 'operator declined; no cloud write'}
    $stage='last-second fresh read and unchanged source preflight'
    $last=Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -TimeoutSec 20 -ErrorAction Stop
    if (-not $last.success) {throw 'last-second Cloudflare GET refused'}
    Assert-ExactPaths $last.result $beforePaths
    if ((Get-FireFingerprint $last.result) -cne $finger) {
      throw 'TEST Access application changed during preparation; abort without write'
    }
    Write-Host 'PASS: Fresh original seven-path Access state and owner policy still unchanged; one PUT authorized.'

    $stage='Cloudflare TEST Access PUT'
    $attempted=$true
    $reply=Invoke-RestMethod -Method Put -Uri $uri -Headers $headers `
      -ContentType 'application/json; charset=utf-8' `
      -Body ([Text.Encoding]::UTF8.GetBytes($bodyAfter)) `
      -TimeoutSec 25 -ErrorAction Stop
    if (-not $reply.success) {throw 'Cloudflare PUT not confirmed'}

    $stage='post-update readback'
    $freshGet=Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -TimeoutSec 20 -ErrorAction Stop
    if (-not $freshGet.success) {throw 'fresh GET unavailable'}
    $fresh=$freshGet.result
    Assert-ExactPaths $fresh $afterPaths
    if ((Get-FireFingerprint $fresh) -cne $finger) {
      throw 'non-destination Access settings changed unexpectedly'
    }
    $verified=$true
    Write-Host 'PASS: FIRE Gate 9 TEST Access public exception verified: exact webhook path, original 7 unchanged.'
    Write-Host 'PASS: Exactly 8 approved public paths; reusable owner policy/other Access settings unchanged.'
    Write-Host 'PASS: Verified pre-change DPAPI encrypted snapshot retained in FIRE-Backups.'
    Write-Host 'NEXT: Revoke temporary Cloudflare Access edit token.'
    Write-Host 'NEXT: Separate Stripe TEST webhook endpoint and signing secret need NEW approval; payments still disabled.'
  } catch {
    Write-Host "STOP at $stage. Gate 9 TEST Access operation is NOT accepted."
    if ($attempted -and -not $verified) {
      # A timeout or unexpected response after a PUT is an UNKNOWN outcome.
      # A compensating PUT would be a SECOND provider mutation and could
      # clobber a concurrent owner change. Never automatically roll back.
      Write-Host 'ONE TEST Access PUT may have reached Cloudflare; NO automatic retry or rollback.'
      $observed='UNKNOWN'
      try {
        $probe=Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -TimeoutSec 15 -ErrorAction Stop
        if (-not $probe.success) {throw 'readback unsuccessful'}
        if ((Get-FireFingerprint $probe.result) -cne $finger) {
          throw 'non-destination policy changed'
        }
        try {
          Assert-ExactPaths $probe.result $beforePaths
          $observed='ORIGINAL_SEVEN'
        } catch {
          Assert-ExactPaths $probe.result $afterPaths
          $observed='PROPOSED_EIGHT'
        }
      } catch {
        $observed='UNKNOWN'
      }
      if ($observed -ceq 'ORIGINAL_SEVEN') {
        Write-Host 'READBACK: Original seven public paths still present; do not replay the PUT.'
      } elseif ($observed -ceq 'PROPOSED_EIGHT') {
        Write-Host 'READBACK: Eight exact intended public paths present, but operation remains STOP pending independent owner verification.'
      } else {
        Write-Host 'READBACK UNKNOWN / DRIFT: Inspect Cloudflare Access independently before ANY further mutation.'
      }
      Write-Host 'A rollback requires a NEW separately reviewed and approved action using the encrypted before-state snapshot.'
      Write-Host 'Do NOT run this ADD helper again, even if the observed state is original.'
    } else {
      Write-Host 'No Access PUT was attempted, or a verified post-update success was already shown.'
    }
  }
  } finally {
    if ($null -ne $plain) {[Array]::Clear($plain,0,$plain.Length)}
    if ($null -ne $beforeBytes) {[Array]::Clear($beforeBytes,0,$beforeBytes.Length)}
    if ($ptr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
    $secret=$null; $secure=$null; $headers=$null
    $saved=$null; $current=$null; $fresh=$null; $reply=$null
  }
}