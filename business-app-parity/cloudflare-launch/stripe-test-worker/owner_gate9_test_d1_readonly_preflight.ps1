# Owner Acer only. Existing D1 Read token, no Wrangler/browser login.
# Only GET exact TEST database metadata and fixed SELECTs over the D1 query API.
# No customer records or credentials printed. No migrations, provider mutations or payments.
$ErrorActionPreference = 'Stop'
& {
  $ErrorActionPreference = 'Stop'
  $stage = 'PRIVATE_TOKEN'
  $secure = $null
  $ptr = [IntPtr]::Zero
  $headers = $null
  try {
    $account = 'bfc00939cfb2f8dfd8581a7a7f5f1307'
    $db = 'dba421ba-fc66-4cf8-9c31-51616f8249ba'
    $name = 'fire-stripe-test-db-20261101'
    $root = "https://api.cloudflare.com/client/v4/accounts/$account/d1/database/$db"
    $secure = Read-Host 'Enter existing Cloudflare D1 Read token (hidden)' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    if ($token.Length -lt 20 -or $token.Length -gt 4096 -or $token -match '\s') { throw 'STOP' }
    $headers = @{ Authorization = "Bearer $token" }
    $token = $null
    function Confirm-Identity {
      $m = Invoke-RestMethod -Uri $root -Headers $headers -Method Get -TimeoutSec 30 -MaximumRedirection 0
      if ($m.success -ne $true -or @($m.errors).Count -ne 0 -or $m.result.uuid -cne $db -or $m.result.name -cne $name) { throw 'STOP' }
    }
    function Read-OnlyQuery([string]$sql) {
      if ($sql -cnotmatch '^SELECT ' -or $sql.Contains(';')) { throw 'STOP' }
      $response = Invoke-RestMethod -Uri "$root/query" -Headers $headers -Method Post -ContentType 'application/json' -Body (@{sql=$sql} | ConvertTo-Json -Compress) -TimeoutSec 30 -MaximumRedirection 0
      $items = @($response.result)
      if ($response.success -ne $true -or @($response.errors).Count -ne 0 -or $items.Count -ne 1 -or $items[0].success -ne $true) { throw 'STOP' }
      $meta = $items[0].meta
      if ($null -eq $meta -or $null -eq $meta.rows_written -or $null -eq $meta.changes -or $null -eq $meta.changed_db -or $meta.rows_written -ne 0 -or $meta.changes -ne 0 -or $meta.changed_db -ne $false) { throw 'STOP' }
      return $items[0].results
    }
    $stage = 'IDENTITY'
    Confirm-Identity
    $stage = 'JOURNAL'
    $expected = @(
      '0000_wise_namora.sql','0001_elite_cammi.sql','0002_tearful_ink.sql',
      '0003_absent_dracula.sql','0004_volatile_fenris.sql','0005_unknown_king_cobra.sql',
      '0006_open_solo.sql','0007_open_bloodaxe.sql','0008_typical_tomorrow_man.sql',
      '0009_spicy_micromax.sql','0010_discount_mode.sql','0011_editable_invoices.sql',
      '0012_invoice_revisions.sql','0013_checkout_sessions.sql','0014_notification_resolution.sql',
      '0015_single_open_checkout.sql','0016_notification_resolution_note.sql',
      '0017_one_invoice_per_estimate.sql','0018_payment_refunds.sql',
      '0019_refund_ledger_unique.sql','0020_notification_lifecycle_unique.sql',
      '0021_manual_processing_fees.sql','0022_stripe_provider_uniqueness.sql',
      '0023_deposit_policy_events.sql','0024_deposit_agreement_snapshots.sql'
    )
    $journal = @(Read-OnlyQuery 'SELECT id, name FROM d1_migrations ORDER BY id')
    if ($journal.Count -ne $expected.Count) { Write-Host "Journal entries: $($journal.Count) / 25"; throw 'STOP' }
    $last = 0
    for ($i=0; $i -lt $expected.Count; $i++) {
      if ($journal[$i].name -cne $expected[$i] -or [long]$journal[$i].id -le $last) { throw 'STOP' }
      $last = [long]$journal[$i].id
    }
    $stage = 'SCHEMA'
    $schema = @(Read-OnlyQuery "SELECT type, name FROM sqlite_master WHERE (type='table' AND name IN ('customers','estimates','invoices','payments','payment_refunds','payment_checkout_sessions','deposit_policy_events','deposit_agreement_snapshots')) OR (type='index' AND name='idx_payments_stripe_provider_unique') ORDER BY type,name")
    if ($schema.Count -ne 9 -or @($schema | Where-Object {$_.type -ceq 'table'}).Count -ne 8 -or @($schema | Where-Object {$_.type -ceq 'index' -and $_.name -ceq 'idx_payments_stripe_provider_unique'}).Count -ne 1) { throw 'STOP' }
    $stage = 'LEDGER_BASELINE'
    $counts = @(Read-OnlyQuery "SELECT (SELECT COUNT(*) FROM customers) AS customers, (SELECT COUNT(*) FROM estimates) AS estimates, (SELECT COUNT(*) FROM invoices) AS invoices, (SELECT COUNT(*) FROM payments) AS payments, (SELECT COUNT(*) FROM payment_refunds) AS refunds, (SELECT COUNT(*) FROM payment_checkout_sessions) AS checkout_sessions")
    if ($counts.Count -ne 1) { throw 'STOP' }
    $row = $counts[0]
    foreach ($field in @('customers','estimates','invoices','payments','refunds','checkout_sessions')) {
      if ($null -eq $row.$field -or [long]$row.$field -lt 0) { throw 'STOP' }
    }
    $stage = 'IDENTITY_AFTER'
    Confirm-Identity
    Write-Host 'FIRE TEST D1 READ-ONLY PREFLIGHT PASS' -ForegroundColor Green
    Write-Host "Database: $name ($db)"
    Write-Host 'Ordered migration journal: 25/25 exact'
    Write-Host 'Required tables: 8/8; Stripe provider uniqueness index: present'
    Write-Host "Counts only: customers=$($row.customers) estimates=$($row.estimates) invoices=$($row.invoices) payments=$($row.payments) refunds=$($row.refunds) checkout_sessions=$($row.checkout_sessions)"
    Write-Host 'No customer rows displayed; no SQL writes, Stripe actions or activation.'
    Write-Host 'G9-05 remains open pending remaining approvals and hosted proof.'
  } catch {
    $status = $null
    try { $status = [int]$_.Exception.Response.StatusCode } catch {}
    Write-Host "FIRE TEST D1 READ-ONLY STOP [$stage] HTTP=$status" -ForegroundColor Yellow
    Write-Host 'No retry, migration, upload or payment authorized. Share only this verdict.'
  } finally {
    if ($headers) { $headers.Clear() }
    if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    if ($secure) { $secure.Dispose() }
    Remove-Variable token,headers,secure -ErrorAction SilentlyContinue
  }
}
