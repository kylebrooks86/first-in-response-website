# FIRE NEW LIVE — single new read-only journal DDL / autoindex / SQLite high-water evidence
Date: November 14, 2026. Source: main-based DRAFT PR #270. NO PROVIDER WRITE.

## Established history (DO NOT repeat)
- The owner already physically confirmed NEW LIVE D1 name fire-fullapp-new-live-db and UUID 0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662.
- Last physical read-only result: exactly ZERO rows recorded in d1_migrations; the ONLY non-journal/non-provider object was SQLite internal sqlite_sequence (not a FIRE customer/job/app table).
- Owner Acer has protected original 26-attempt lock; completion receipt absent. Keep it intact. The one-shot approval is spent. No migration retry, no deletion/renaming lock, no false success receipt.
- Previously accepted DR 26/26, DR dark Worker creation/version binding, iPhone QA, owner login/screenshots and prior Cloudflare sign-in are NOT to be rerun.

## New GitHub source, focused tests (no Cloudflare)
New business-app-parity/owner_new_live_initialized_journal_readonly.mjs and existing pure post-lock guard. The new helper:
- Defaults to OFFLINE with exactly zero provider requests.
- With explicit --capture, uses the already installed Wrangler 4.92.0 JS, verifies original LOCK + dedicated config and absence of completion receipt, and binds physical D1 by read-only d1 info.
- Performs only three NEW selected target-only read-only SQL statements: exact SQLite schema table/index/trigger/view DDL metadata, ordered d1_migrations IDs/names, and sqlite_sequence name/seq high-water history.
- Uses the pure source guard to fail closed unless the journal is empty, SQLite sequence history is empty, and exact journal table/index definition and metadata are source-approved. It deliberately prints no raw provider payload, SQL DDL, secrets, records or customer data. It records no result on disk and cannot reapply migrations or change Cloudflare. Multiple SQL requests are NOT an atomic snapshot.
- Even if PASS, it does NOT grant owner approval or authorize any migration retry, Worker deploy or Gate 5 acceptance. Exact source code commit (with new offline test and workflow-pinned site guard): 4342a4868735771424607e77e1a1ac9abbd39b5b.
- Focused GitHub offline source workflow FIRE NEW LIVE previous migration attempt — safe read-only reconciliation and protected public website/calculator source workflow both completed SUCCESS on that SHA. Do not repeat unrelated accepted owner tests.

### On existing authenticated Acer: only the missing target-specific read-only evidence

This ONE invocation uses a separate pinned detached Git worktree; it does not alter older source folders. It runs no installer, Cloudflare login, migrations, new Wrangler install, Stripe, R2 or deployment.

~~~powershell
$ErrorActionPreference = 'Stop'
$repo = Join-Path $HOME 'FIREQA-PR172'
$sha = '4342a4868735771424607e77e1a1ac9abbd39b5b'
$work = Join-Path $HOME 'Documents\FIRE-NEW-LIVE-JOURNAL-READ-4342'
$wrangler = Join-Path $HOME 'Documents\FIRE-WRANGLER-4-92-NEW-LIVE\node_modules\wrangler\bin\wrangler.js'
$root = Join-Path $HOME 'FIRE-NEW-LIVE-ONE-SHOT-SCHEMA-20261114'
$lock = Join-Path $root 'new-live-remote-attempt-lock.json'
$receipt = Join-Path $root 'new-live-physical-schema-receipt.json'

if (-not (Test-Path -LiteralPath $repo -PathType Container)) { throw 'STOP: existing original clone missing.' }
if (-not (Test-Path -LiteralPath $lock -PathType Leaf)) { throw 'STOP: preserve original one-shot attempt lock.' }
if (Test-Path -LiteralPath $receipt) { throw 'STOP: existing receipt appeared; inspect separately.' }
if (-not (Test-Path -LiteralPath $wrangler -PathType Leaf)) { throw 'STOP: reviewed Wrangler missing; do not reinstall.' }
if (Test-Path -LiteralPath $work) { throw 'STOP: separate read-only worktree already exists.' }

& git -C $repo fetch --no-tags origin 'refs/pull/270/head'
if ($LASTEXITCODE -ne 0) { throw 'STOP: Git fetch unsuccessful.' }
& git -C $repo merge-base --is-ancestor $sha 'FETCH_HEAD'
if ($LASTEXITCODE -ne 0) { throw 'STOP: exact tested source SHA not in PR270.' }
& git -C $repo worktree add --detach $work $sha
if ($LASTEXITCODE -ne 0) { throw 'STOP: isolated source checkout failed.' }

$probe = Join-Path $work 'business-app-parity\owner_new_live_initialized_journal_readonly.mjs'
if (-not (Test-Path -LiteralPath $probe -PathType Leaf)) { throw 'STOP: read-only source not found.' }
& node.exe $probe
if ($LASTEXITCODE -ne 0) { throw 'STOP: new probe offline check failed.' }
& node.exe $probe '--capture' $wrangler
if ($LASTEXITCODE -ne 0) { throw 'STOP: read-only provider evidence blocked; DO NOT RETRY migrations.' }
~~~

Send ONLY the sanitized final JSON or STOP line. Do not send raw provider response, original lock, credentials or personal data.

## Release boundary
Success is read-only structural evidence that may permit planning a separately owner-approved NEW one-shot recovery implementation after a reviewed design. It DOES NOT turn the consumed previous one-shot permission into permission to mutate D1. All provider D1/Worker/auth/Stripe/R2/paid Cloudflare, merge, DNS and legacy retirement changes remain outside authorization. G1/G2/G3/G8 accepted 4/10; G4/G5/G6/G7/G9/G10 open; NEW LIVE NO-GO; first Job #0001 NOT ACTIVATED.
