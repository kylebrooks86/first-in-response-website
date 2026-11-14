# FIRE — DR-only initial D1 migration: exact owner-approved handoff

Owner approval: November 13, 2026 CST. The owner said APPROVE twice for the specific action of installing the 26 reviewed SQL migrations into the EXISTING DR D1 only IF a fresh physical read-only schema check proves it empty. This does not authorize NEW LIVE, QA, STAGING, Stripe, R2, payments, Worker creation/deployment, migrations elsewhere, source merge, public website changes, or legacy retirement.

Existing physical DR database: fire-fullapp-dr-db, UUID 5e55c5b7-cd67-4c8f-a52e-40f71b5d3145.
Existing separate NEW LIVE database (never touch): fire-fullapp-new-live-db, UUID 0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662.

Exact frozen source for this execution: main-based DRAFT PR #264 commit 44fbefe6c1308cba54a591471247c978884a0b0f.
New runner source: business-app-parity/owner_approved_dr_d1_migration.mjs.
Exact independent DR/LIVE local migration and new runner safeguards: GitHub Actions run 43539145899 SUCCESS, FINAL exact-source [independent DR + NEW LIVE workflow 43539544095](https://github.com/kylebrooks86/first-in-response-website/actions/runs/43539544095) BOTH jobs SUCCESS at pinned source. Decoded DR log: PASS 136/136 reviewed migration workspaces plus one-shot UUID/empty schema/SQLite-sequence/read-only guards, PASS 26/26 saved SQL integrity and PASS 32/32 remote-identity safety fixtures. These are local/synthetic CI proofs, NOT a Cloudflare physical migration.

## Owner Acer PowerShell command (one time; do not repeat after a remote attempt)

    $ErrorActionPreference = 'Stop'
    $repo = Join-Path $env:USERPROFILE 'FIREQA-PR172'
    $sha = '44fbefe6c1308cba54a591471247c978884a0b0f'
    $work = Join-Path $env:USERPROFILE 'FIRE-DR-GATE5-44fbefe6'
    if (!(Test-Path $repo)) { throw 'Existing FIRE Git repo not found. STOP, no cloud writes.' }
    if (Test-Path $work) { throw 'Detached DR worktree already exists. STOP; do not repeat this command.' }
    git -C $repo fetch origin work/fire-app-main-candidate-unified-20261113
    if ($LASTEXITCODE -ne 0) { throw 'Git fetch failed; STOP' }
    $fetched = (git -C $repo rev-parse FETCH_HEAD).Trim()
    if ($fetched -ne $sha) { throw "Reviewed exact source moved ($fetched). STOP; DO NOT MIGRATE." }
    git -C $repo worktree add --detach $work $sha
    if ($LASTEXITCODE -ne 0) { throw 'Detached source staging failed; STOP' }
    $choices = @(
      (Join-Path $repo 'business-app-parity\shared\node_modules\wrangler\bin\wrangler.js'),
      (Join-Path $env:APPDATA 'npm\node_modules\wrangler\bin\wrangler.js'),
      (Join-Path $work 'business-app-parity\shared\node_modules\wrangler\bin\wrangler.js')
    )
    $wrangler = $choices | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (!$wrangler) { throw 'Pinned Wrangler JS not installed in existing paths. STOP; no cloud writes.' }
    $runner = Join-Path $work 'business-app-parity\owner_approved_dr_d1_migration.mjs'
    node $runner $wrangler --execute-approved-dr-only
    if ($LASTEXITCODE -ne 0) { throw 'DR one-shot STOPPED or uncertain. DO NOT RETRY.' }

The downloaded source is pinned to the actual reviewed SHA. A changed branch fails BEFORE cloud writes. The detached worktree does not modify the owner's current FIREQA-PR172 worktree. If the known Acer repository is in a different folder, only replace the $repo assignment.

## Exactly what the guarded runner does

- Requires existing pinned Wrangler 4.92.0, never installs a package, signs in to Cloudflare Work or requests billing.
- Generates exact 26 reviewed Git-blob-pinned SQL migrations and a single D1 DR-only config in a new private local folder. Independently verifies every saved SQL file and D1 UUID before any remote operation.
- Authenticated read-only Wrangler D1 list verifies the DR UUID AND the separate NEW LIVE UUID; wrong account, swapped resource or missing database STOP.
- Authenticated read-only remote SQLite schema inventory verifies no application table, prior sqlite_sequence high-water history, migration journal, unexpected index, trigger or view; only exact approved provider metadata can exist. Any nonempty/unexpected schema STOP without any remote SQL write.
- Saves an owner-only unique local one-shot attempt marker BEFORE any remote migration command. It will never automatically retry uncertain or interrupted writes.
- Runs Wrangler migrations apply --remote against fire-fullapp-dr-db ONLY, using the single-target pinned config. Wrangler may prompt the owner to confirm. Confirm only if displayed target is exactly fire-fullapp-dr-db.
- After command SUCCESS, independently queries physical DR D1 read-only: 26 named and ordered migrations, permanent Customer # and Job # and immutability triggers, deposit agreement safeguards, refund/payment/notification exact SQL indexes, all application records and permanent serials empty. The NEW LIVE source schema inspector is reused as an SQL contract only; the code queries DR exclusively.
- Saves final local physical readback receipt only when every condition passed. No Worker binding/deploy, payment action, source merge, R2 or other database changes.

Owner-only local attempt marker: %USERPROFILE%\FIRE-DR-APPROVED-MIGRATION-20261113\remote-one-shot-attempt.json.
Owner-only confirmed schema receipt: %USERPROFILE%\FIRE-DR-APPROVED-MIGRATION-20261113\dr-physical-schema-receipt.json.
Confirmed success marker: FIRE DR PHYSICAL 26-MIGRATION READBACK: CONFIRMED.

If stopped, failed, timed out, or uncertain: DO NOT rerun the command. It may have applied some SQL already. Inspect the actual physical DR migration journal READ-ONLY in a separately reviewed step before considering anything else. Do not paste API tokens, cookies, private customer records or secrets.

## Honest progress boundary

At document creation, GitHub code/tests are completed and approval recorded, but no actual physical Cloudflare DR migration has been run by ChatGPT. The owner's Acer has to execute this exact command once. Even a successful DR schema installation is only part of Gate 5; hosting and rollback, provider-bound Worker identities, Gate6 nonowner denial, Gate7 future-data recovery, Gate9 Stripe TEST and Gate10 cutover are not accepted. Gates 1/2/3/8 are still accepted (4/10), remaining G4/5/6/7/9/10 OPEN, NEW LIVE NO-GO.


## Owner Acer screenshot, Nov 13 — expected local STOP before any Cloudflare call

The owner executed the previously pinned detached worktree and observed exactly:

    HEAD is now at 44fbefe6
    FIRE DR Gate5 STOP: Wrangler version differs from reviewed 4.92.0; no remote operation

Screenshot also shows a generic PowerShell wrapper raising "DR migration stopped or is uncertain. DO NOT RETRY." The code checks Wrangler version BEFORE any D1 provider call and BEFORE writing a local remote attempt lock. Thus this particular run is proven to have STOPPED locally; NO DR D1 read/write/migration was attempted. The worktree is ALREADY created. Do not repeat any Git fetch/worktree, owner screenshots, Cloudflare Work login or accepted QA tests. Keep the original first attempt error as accepted evidence.

### Corrected self-contained Acer PowerShell, local pinned Wrangler install + same approved one-shot DR

Run the following in PowerShell. Earlier lines only read local files and install exact free Wrangler npm CLI (no Cloudflare billing/R2/Worker/D1 changes). The final node command is the previously owner-approved DR-only action and still refuses incorrect physical identity, nonempty schema, prior attempt markers or uncertain writes.

    $ErrorActionPreference = 'Stop'
    $work = Join-Path $env:USERPROFILE 'FIRE-DR-GATE5-44fbefe6'
    $tool = Join-Path $env:USERPROFILE 'FIRE-DR-WRANGLER-4.92.0'
    $attempt = Join-Path $env:USERPROFILE 'FIRE-DR-APPROVED-MIGRATION-20261113\remote-one-shot-attempt.json'
    $runner = Join-Path $work 'business-app-parity\owner_approved_dr_d1_migration.mjs'
    if (!(Test-Path $runner)) { throw 'Pinned FIRE DR worktree missing. STOP.' }
    if (Test-Path $attempt) { throw 'Prior remote attempt marker exists. STOP; read-only diagnosis required.' }
    npm install --prefix $tool --no-save --no-audit --no-fund wrangler@4.92.0
    if ($LASTEXITCODE -ne 0) { throw 'Exact local Wrangler installation failed. STOP.' }
    $wrangler = Join-Path $tool 'node_modules\wrangler\bin\wrangler.js'
    if (!(Test-Path $wrangler)) { throw 'Installed pinned Wrangler missing. STOP.' }
    $ver = node $wrangler --version
    if ($LASTEXITCODE -ne 0 -or ($ver -notmatch '4\.92\.0')) { throw 'Wrong pinned Wrangler version. STOP.' }
    node $runner $wrangler --execute-approved-dr-only
    if ($LASTEXITCODE -ne 0) { Write-Host 'DR STOPPED. Do NOT repeat migration. Share safe error text.' }

If local npm installation fails, the remote DR command has not been reached. If the runner reaches remote D1 but fails physical UUID or empty-schema checks, no write has occurred. A failed/uncertain remote migrations apply must NOT be retried: the runner writes a unique local attempt marker before it. Never run the old first-command wrapper again. This refinement makes NO source code change, no paid service and no broader permission request.

## Second Acer screenshot (Nov 13) — supersedes immediate remote-retry instructions

The owner ran the prior isolated Wrangler command and supplied another screenshot: MODULE_NOT_FOUND / Node v24.22.0 / empty requireStack; the version check threw `Wrong Wrangler version. STOP.`. As a separately pasted PowerShell line continued into the runner, the runner immediately threw `FIRE DR Gate5 STOP: pinned local Wrangler installation missing; no network installation authorized`. BOTH are local guards BEFORE any D1 call or migration attempt marker. No Cloudflare D1 was contacted or altered. The screenshot crop omits the exact missing module path and npm installation output: do not invent the root cause. Both Acer screenshots are accepted evidence; no repeated git worktree, Cloudflare Work sign-in or old QA.

CURRENT NEXT STEP IS LOCAL-ONLY FILE/PACKAGE DIAGNOSIS, NO MIGRATION:

    $tool = Join-Path $env:USERPROFILE 'FIRE-DR-WRANGLER-4.92.0'
    $package = Join-Path $tool 'node_modules\wrangler\package.json'
    $script = Join-Path $tool 'node_modules\wrangler\bin\wrangler.js'
    Write-Host "Tool directory exists: $(Test-Path -LiteralPath $tool)"
    Write-Host "Package JSON exists: $(Test-Path -LiteralPath $package)"
    Write-Host "Wrangler script exists: $(Test-Path -LiteralPath $script)"
    if (Test-Path -LiteralPath $package) {
        Write-Host "Installed version: $((Get-Content -LiteralPath $package -Raw | ConvertFrom-Json).version)"
    }
    npm ls --prefix $tool wrangler --depth=0

These commands only read local npm/package state; they cannot reach Cloudflare D1. DO NOT run the old combined npm+remote migration command until we identify the actual missing path/package and fix it. Owner DR-only approval remains valid because no remote migration attempt was made; Gate5 physical DR remains pending.

## Third accepted Acer screenshot: root cause CONFIRMED — PowerShell blocked npm.ps1

Latest owner screenshot shows local Tool folder=False, Package=False, Wrangler script=False. The attempted `npm ls` prints the precise PowerShell SecurityError: `C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system`, `PSSecurityException`, `UnauthorizedAccess`. This explains why the preceding `npm install` did NOT install a package; the expected Wrangler entrypoint never existed, and both earlier `MODULE_NOT_FOUND` and missing-pinned-local-Wrangler errors were expected local fails. The root cause is **Windows PowerShell execution policy blocking npm.ps1**, not Cloudflare/D1, npm registry, or the app. NO Cloudflare provider call or remote migration had been reached.

Do NOT change any execution policy, use bypass, administrator commands, or reinstall Node. Use the installed Windows `npm.cmd` executable instead of the blocked `npm` PowerShell shim. This is still FREE npm package tooling and no paid Cloudflare/R2. Leave already-created detached Git worktree alone; do NOT rerun previous Git commands. No prior owner evidence/screenshot needs repeating.

Corrected, self-contained owner PowerShell. This single scriptblock aborts BEFORE remote execution if any local install/version/path/one-shot marker condition is wrong. The only possible hosted action is already approved physical-empty DR migration invoked by the pinned runner.

    & {
      $ErrorActionPreference = 'Stop'
      $work = Join-Path $env:USERPROFILE 'FIRE-DR-GATE5-44fbefe6'
      $tool = Join-Path $env:USERPROFILE 'FIRE-DR-WRANGLER-4.92.0'
      $attempt = Join-Path $env:USERPROFILE 'FIRE-DR-APPROVED-MIGRATION-20261113\remote-one-shot-attempt.json'
      $runner = Join-Path $work 'business-app-parity\owner_approved_dr_d1_migration.mjs'
      if (!(Test-Path -LiteralPath $runner)) { throw 'Pinned DR source absent: STOP.' }
      if (Test-Path -LiteralPath $attempt) { throw 'Physical DR remote attempt already marked: STOP, read-only investigation only.' }
      if (!(Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm.cmd missing: STOP.' }
      & npm.cmd install --prefix $tool --no-save --no-audit --no-fund wrangler@4.92.0
      if ($LASTEXITCODE -ne 0) { throw 'Exact local Wrangler installation FAILED: no remote operation.' }
      $wrangler = Join-Path $tool 'node_modules\wrangler\bin\wrangler.js'
      if (!(Test-Path -LiteralPath $wrangler)) { throw 'Pinned Wrangler script missing: STOP, no remote operation.' }
      $ver = & node $wrangler --version
      if ($LASTEXITCODE -ne 0 -or ($ver -notmatch '4\.92\.0')) { throw 'Pinned Wrangler 4.92.0 version check failed: STOP.' }
      Write-Host 'Pinned Wrangler 4.92.0 confirmed locally. Entering DR-only guarded runner.'
      & node $runner $wrangler --execute-approved-dr-only
      if ($LASTEXITCODE -ne 0) { throw 'Guarded DR command STOPPED or uncertain; NEVER repeat the remote migration.' }
    }

CRITICAL: Even if some lines are pasted separately, the enclosing `& { ... }` forces fail-fast execution as one PowerShell statement. The runner independently checks the existing physical DR UUID, separate NEW LIVE UUID, truly empty DR schema, 26 reviewed SQL blob IDs, and one-shot attempt receipt. A physical D1 schema mutation is *not* authorized on any other target. If the runner reaches migration apply and returns an uncertain result, do not rerun this block. Report the safe error line without secrets.

State: physical DR 26 migration still PENDING as of third screenshot. No Git source edits, no accepted QA retests, no hosted Worker/Stripe/R2/paid Cloudflare actions. 4/10 gates accepted, NEW LIVE NO-GO.
