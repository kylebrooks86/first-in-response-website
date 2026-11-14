# FIRE — DR-only initial D1 migration: exact owner-approved handoff

Owner approval: November 13, 2026 CST. The owner said APPROVE twice for the specific action of installing the 26 reviewed SQL migrations into the EXISTING DR D1 only IF a fresh physical read-only schema check proves it empty. This does not authorize NEW LIVE, QA, STAGING, Stripe, R2, payments, Worker creation/deployment, migrations elsewhere, source merge, public website changes, or legacy retirement.

Existing physical DR database: fire-fullapp-dr-db, UUID 5e55c5b7-cd67-4c8f-a52e-40f71b5d3145.
Existing separate NEW LIVE database (never touch): fire-fullapp-new-live-db, UUID 0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662.

Exact frozen source for this execution: main-based DRAFT PR #264 commit 44fbefe6c1308cba54a591471247c978884a0b0f.
New runner source: business-app-parity/owner_approved_dr_d1_migration.mjs.
Exact independent DR/LIVE local migration and new runner safeguards: GitHub Actions run 43539145899 SUCCESS, Earlier DR source run logged 135/135 safety PASS at prior exact source SHA. The new exact source additionally refuses stale sqlite_sequence history; check its newly triggered focused CI result before execution. None of this is Cloudflare physical proof.

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
