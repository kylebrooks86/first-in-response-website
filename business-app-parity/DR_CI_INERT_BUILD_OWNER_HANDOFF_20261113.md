> **OBSOLETE AFTER NOV 13/14 OWNER ACER STOP — DO NOT RUN THE OLD COMMAND BELOW.** The previous authentic ZIP omitted three hidden compiled files; the verifier correctly refused it, though CI verified the pre-upload directory. Fixed draft PR264 code commit `be2166cbf5b3b20fb1a33fc8bbf53dfc7f555db3` now includes hidden files and independently downloads + verifies the uploaded artifact. Corrected 242/242 ZIP is already stored in the owner's private Google Drive. Use only [the NEW pinned handoff](DR_CORRECTED_ZIP_OWNER_ACER_OFFLINE_HANDOFF_20261114.md). Preserve old Acer source worktrees, old ZIP and permanent physical DR migration receipts. NO DR migration replay, Cloudflare login, hosted upload or paid subscription.\n\n# FIRE — verified inert independent DR Worker package / Acer handoff

## CURRENT: NEW VERIFIED RELEASE-BUILD DEVELOPMENT (NOVEMBER 13, 2026 CST)

Main-based DRAFT PR #264 exact source SHA: 4677b0ee366c4b4e8b6fefda44e7a11901b4c905.
Independent DR + NEW LIVE workflow: https://github.com/kylebrooks86/first-in-response-website/actions/runs/43553801413
Both independent DR and NEW LIVE source-only jobs COMPLETED SUCCESS at exact SHA.
Real retained GitHub artifact: FIRE-INERT-DR-4677b0ee366c4b4e8b6fefda44e7a11901b4c905
Artifact ID: 14097690973; size 3,098,722 bytes; GitHub archive SHA-256 3c4970cf160a18e0cae9c0a5b740e7f0d81e59c719fc03d15d14c4df10abf45f; expiry Nov 17, 2026 03:52:56 UTC.
Artifact available at the Actions run's Artifacts panel to authenticated owner. No Cloudflare account/Work browser login is needed to read it.

This is tangible source release progress: the otherwise-discarded exact compiled full QA-master DR Worker output now has a short-lived owner-downloadable, source-SHA-pinned artifact and internal per-file SHA-256 receipt. The new read-only checker business-app-parity/verify_inert_dr_ci_artifact.mjs verifies every compiled member and strict inert DR identity, rejecting changed/missing/extra files, switched DR/LIVE D1, R2, or owner auth enabled. Targeted synthetic negative tests and ACTUAL source-produced compiled bundle verification COMPLETED SUCCESS in the independent DR job before artifact retention. No additional owner iPhone/Acer/browser regression was repeated.

**Never confuse this with a hosted Worker release.** No Cloudflare Worker upload, access/owner enablement, database migration, Stripe, R2/subscription, paid product, Git merge, original Sites removal or NEW LIVE action was performed. G1/2/3/8 accepted 4/10; other six gates OPEN, NEW LIVE NO-GO. Existing owner Acer physically completed all 26 DR migrations and confirmed readback; never run that old command again.

## If owner chooses to make the offline DR handoff on Acer

This action uses only existing successful DR physical receipts and the new GitHub artifact. It does NOT publish or call any Cloudflare or Stripe endpoint. It is a NEW offline source→DR postinstall receipt handoff, not a redo of the previously accepted migration.

1. In authenticated GitHub, open the exact Actions run URL above. Download its exact artifact FIRE-INERT-DR-4677b0ee366c4b4e8b6fefda44e7a11901b4c905 to Acer Downloads. Keep it private. Do not select a different source SHA or another run.
2. On the Acer, execute the following single PowerShell block once. The script refuses preexisting output folders, missing original receipt, wrong source SHA, or a downloaded archive whose bytes differ from the independently recorded GitHub artifact SHA-256. It fetches reviewed GitHub code to a NEW source worktree and only reads the prior owner local receipt. It never invokes Wrangler or Cloudflare login.
3. If the artifact expires, STOP rather than blindly rerun unrelated workflows, migration, TEST provider uploads or owner evidence. A new exact source artifact needs to be purposefully reissued and re-verified first.

~~~powershell
& {
  $ErrorActionPreference = 'Stop'
  $sha = '4677b0ee366c4b4e8b6fefda44e7a11901b4c905'
  $repo = Join-Path $env:USERPROFILE 'FIREQA-PR172'
  $work = Join-Path $env:USERPROFILE 'FIRE-DR-REVIEW-4677b0e'
  $zip = Join-Path $env:USERPROFILE "Downloads\FIRE-INERT-DR-$sha.zip"
  $bundle = Join-Path $env:USERPROFILE 'FIRE-DR-BUNDLE-4677b0e'
  $receipts = Join-Path $env:USERPROFILE 'FIRE-DR-APPROVED-MIGRATION-20261113'
  $outDir = Join-Path $env:USERPROFILE 'FIRE-DR-INERT-REVIEW-4677b0e'
  $out = Join-Path $outDir 'dr-compiled-physical-postinstall-reviewed.json'
  foreach ($p in @($repo,$zip,$receipts)) {
    if (!(Test-Path -LiteralPath $p)) { throw "Required existing file/folder missing. STOP: $p" }
  }
  foreach ($p in @($work,$bundle,$outDir)) {
    if (Test-Path -LiteralPath $p) { throw "New output already exists; preserve it and STOP: $p" }
  }
  foreach ($n in @('remote-one-shot-attempt.json','dr-physical-schema-receipt.json')) {
    if (!(Test-Path -LiteralPath (Join-Path $receipts $n))) {
      throw "Original accepted DR migration evidence missing. STOP: $n"
    }
  }
  # GitHub's independently recorded archive SHA-256 must match BEFORE unpacking.
  # The seal JSON is inside the ZIP and is not an independent download trust anchor.
  $expectedArchiveHash = '3c4970cf160a18e0cae9c0a5b740e7f0d81e59c719fc03d15d14c4df10abf45f'
  $actualArchiveHash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualArchiveHash -ne $expectedArchiveHash) {
    throw 'GitHub DR artifact ZIP hash mismatch. STOP; do not extract or use this archive.'
  }
  & git -C $repo fetch --no-tags origin work/fire-app-main-candidate-unified-20261113
  if ($LASTEXITCODE -ne 0) { throw 'Source fetch stopped; no provider action.' }
  & git -C $repo cat-file -e "$sha^{commit}"
  if ($LASTEXITCODE -ne 0) { throw 'Exact pinned Git commit missing; STOP.' }
  & git -C $repo worktree add --detach $work $sha
  if ($LASTEXITCODE -ne 0) { throw 'Pinned separate worktree creation stopped.' }
  $actual = (& git -C $work rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $actual -ne $sha) { throw 'Pinned SHA mismatch; STOP.' }
  Expand-Archive -LiteralPath $zip -DestinationPath $bundle -ErrorAction Stop
  $dist = Join-Path $bundle 'fire-release-candidate\dist'
  $seal = Join-Path $bundle 'fire-dr-offline-seal.json'
  $compiled = Join-Path $dist 'server\wrangler.json'
  if (!(Test-Path -LiteralPath $compiled) -or !(Test-Path -LiteralPath $seal)) {
    throw 'Exact GitHub ZIP artifact layout is missing. STOP.'
  }
  & node (Join-Path $work 'business-app-parity\verify_inert_dr_ci_artifact.mjs') $dist $seal $sha
  if ($LASTEXITCODE -ne 0) { throw 'Actual compiled DR artifact failed per-file verification; STOP.' }
  New-Item -ItemType Directory -Path $outDir -ErrorAction Stop | Out-Null
  & node (Join-Path $work 'business-app-parity\review_owner_dr_postinstall_worker_candidate.mjs') $receipts $compiled $out
  if ($LASTEXITCODE -ne 0) { throw 'Existing DR receipt to inert Worker source review failed; STOP.' }
  Write-Host 'FIRE DR SOURCE-PINNED COMPILED ARTIFACT + ORIGINAL PHYSICAL RECEIPT: REVIEWED INERT.'
  Write-Host 'No Worker deployed, no D1 write, no login enabled, no Stripe, no paid Cloudflare.'
}
~~~

Result interpretation: the offline candidate is sealed against the exact source and previously successful physical DR D1 receipt. It is still not hosted or deployable without a distinct exact owner authorization. Its outputs are private; return only the final status lines, not original receipt JSON, logs, passwords, customer data or screenshots. The original owner one-shot marker and physical receipt must never be deleted or overwritten.

**Important:** This handoff only prepares a reviewed, auth-BLOCKED no-R2 DR Worker. Before any actual provider write, separately evaluate the Cloudflare asset registration prior failure and require explicit target, exact source, intended traffic/auth state, rollback scope and new owner authorization. Do not reuse the already-consumed 26-migration consent for Worker deployment.

## November 13 / 14 — independent downloaded-archive integrity hard stop

The approved GitHub Actions artifact is separately recorded as ZIP SHA-256 `3c4970cf160a18e0cae9c0a5b740e7f0d81e59c719fc03d15d14c4df10abf45f` (artifact ID `14097690973`, workflow `43553801413`). The original PowerShell handoff validated the internal file seal but did **not** compare the downloaded ZIP to the independently recorded GitHub archive digest. An archive carrying both substituted code and a correspondingly substituted internal seal is not independently authenticated by its own embedded seal. This handoff now verifies the external ZIP digest **before any extraction**, then continues the original exact-source/per-file/physical-receipt checks. On hash mismatch, STOP, do not delete receipts or guess a different artifact. No hosted operations, no new source build or user retest were conducted by this documentation fix.
