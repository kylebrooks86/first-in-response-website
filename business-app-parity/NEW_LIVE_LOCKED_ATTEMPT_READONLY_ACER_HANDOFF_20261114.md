# FIRE — NEW LIVE uncertain 26-SQL attempt: READ-ONLY Acer handoff (Nov 14, 2026)

> **ARCHIVED HANDOFF — DO NOT EXECUTE.** The one approved NEW LIVE post-lock recovery **already physically applied 26/26 migrations** on Nov 14, 2026, verified by [actual owner provider success evidence](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6889484598). Both attempt locks and the success receipt were [encrypted and saved off-Acer](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6891448726). Historical PowerShell below was valid only for its prior incomplete stage and is **permanently spent**. Never rerun initial installer, separate recovery CLI, remote SQL, old lock analysis, or accepted owner screenshots. Latest [continuity register](FIRE_CONTINUITY_AND_LOGIN_EVIDENCE_20261113.md) and [AGENTS instructions](AGENTS.md) supersede this historical handoff. NEW LIVE Worker remains DARK; formal Gate5 and release remain OPEN.


The existing owner Acer evidence is final for this stage: NEW LIVE one-shot attempt lock exists, completion receipt does not. Physical migration state is UNKNOWN. DO NOT rerun original installer, remove any lock, or touch the accepted DR database/Worker.

Draft PR270 includes source-only new owner_new_live_attempt_readonly_reconcile.mjs, offline negative tests, and an isolated CI workflow. The helper has default OFFLINE mode and --capture mode that ONLY reads the pinned NEW LIVE D1. It first verifies the original attempt lock and target config, then physical NEW LIVE D1 UUID, SQLite object inventory, migration journal count. A 26-row journal triggers the existing comprehensive read-only source verifier: exact migration IDs/names, refund/financial indexes, immutable number/deposit triggers, zero operational records, and first expected Job #0001. Even a pass NEVER constitutes the lost remote command's completion receipt or authorization to retry migrations.

## One safe owner-Acer action — dedicated local read-only checkout

Run in ordinary PowerShell on the already-authenticated Acer. This does not log into Cloudflare or request new payments/billing or deploy. It does a Git source fetch, new isolated checkout, offline check, and ONLY pinned NEW LIVE metadata/schema SELECT reads.

~~~powershell
$ErrorActionPreference = 'Stop'
$repo = Join-Path $HOME 'FIREQA-PR172'
$sha = 'e5451b9535c295398eba1cee21776631353a3306'
$work = Join-Path $HOME 'Documents\FIRE-NEW-LIVE-READONLY-e5451b'
$wrangler = Join-Path $HOME 'Documents\FIRE-WRANGLER-4-92-NEW-LIVE\node_modules\wrangler\bin\wrangler.js'
$lock = Join-Path $HOME 'FIRE-NEW-LIVE-ONE-SHOT-SCHEMA-20261114\new-live-remote-attempt-lock.json'
$receipt = Join-Path $HOME 'FIRE-NEW-LIVE-ONE-SHOT-SCHEMA-20261114\new-live-physical-schema-receipt.json'

if (-not (Test-Path -LiteralPath $lock -PathType Leaf)) { throw 'STOP: missing protected attempt lock; preserve all prior files.' }
if (Test-Path -LiteralPath $receipt) { throw 'STOP: receipt appeared; inspect separately, no rewrite.' }
if (-not (Test-Path -LiteralPath $repo -PathType Container)) { throw 'STOP: known Git source clone absent.' }
if (-not (Test-Path -LiteralPath $wrangler -PathType Leaf)) { throw 'STOP: reviewed Wrangler is absent; no install or new login.' }
if (Test-Path -LiteralPath $work) { throw 'STOP: dedicated read-only worktree exists already; do not overwrite.' }

& git -C $repo fetch --no-tags origin 'refs/pull/270/head'
if ($LASTEXITCODE -ne 0) { throw 'STOP: Git fetch failed.' }
& git -C $repo merge-base --is-ancestor $sha 'FETCH_HEAD'
if ($LASTEXITCODE -ne 0) { throw 'STOP: pinned reviewed source not in PR270.' }
& git -C $repo worktree add --detach $work $sha
if ($LASTEXITCODE -ne 0) { throw 'STOP: separate local worktree creation failed.' }

$probe = Join-Path $work 'business-app-parity\owner_new_live_attempt_readonly_reconcile.mjs'
if (-not (Test-Path -LiteralPath $probe -PathType Leaf)) { throw 'STOP: read-only source absent.' }
& node.exe $probe
if ($LASTEXITCODE -ne 0) { throw 'STOP: offline lock/config failed. NEVER retry migration.' }
& node.exe $probe '--capture' $wrangler
if ($LASTEXITCODE -ne 0) { throw 'STOP: remote READ-ONLY capture refused. Preserve lock, no migration retry.' }
~~~

Only share the final sanitized --capture JSON result (or STOP message). Do not send original raw Cloudflare output, lock contents, private data, screenshots or credentials.

Status meanings: no migration journal = not proof of safely re-applying; incomplete journal = no retry; 26 journal rows = only a prerequisite; verified full schema + empty Job #0001 state = read-only physical source evidence, NOT a completed migration command receipt, owner login, worker deployment, G5 acceptance, or NEW LIVE authorization.

Accepted release gates remain 1, 2, 3, 8 = 4/10. G4/5/6/7/9/10 open. NEW LIVE NO-GO. No paid Cloudflare/R2, Stripe write, worker activation, Git merge, DNS or legacy retirement authorized.
