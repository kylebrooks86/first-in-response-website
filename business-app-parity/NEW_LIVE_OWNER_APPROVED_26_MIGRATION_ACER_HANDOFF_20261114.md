# FIRE — OWNER-APPROVED NEW LIVE 26-MIGRATION ONE-SHOT ACER HANDOFF — NOVEMBER 14, 2026

> **ARCHIVED HANDOFF — DO NOT EXECUTE.** The one approved NEW LIVE post-lock recovery **already physically applied 26/26 migrations** on Nov 14, 2026, verified by [actual owner provider success evidence](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6889484598). Both attempt locks and the success receipt were [encrypted and saved off-Acer](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6891448726). Historical PowerShell below was valid only for its prior incomplete stage and is **permanently spent**. Never rerun initial installer, separate recovery CLI, remote SQL, old lock analysis, or accepted owner screenshots. Latest [continuity register](FIRE_CONTINUITY_AND_LOGIN_EVIDENCE_20261113.md) and [AGENTS instructions](AGENTS.md) supersede this historical handoff. NEW LIVE Worker remains DARK; formal Gate5 and release remain OPEN.


**Status:** Owner consent recorded in [Issue #19](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6886050061). Physical NEW LIVE migration **NOT performed by this document**. This is an operator handoff, not a CI job or a new installer.

## EXACT authorized scope

Apply the **26 original source-reviewed SQL migrations** to one existing **empty** Cloudflare D1 only:

- Cloudflare database: `fire-fullapp-new-live-db`
- Physical D1 UUID: `0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662`
- Source: main-based DRAFT PR270, preserved **known-good exact source commit** `b0508df9698c79c7b0b1de75813bf030fb77de60`. Subsequent GitHub documentation commits are not execution sources. Script Git blob `07178c13323f66e50b4d0991541fa85cd74be7b3`.
- Actual worker/source test code preceding that doc-only commit: `e9986739547d7c8e5fe434e04673a6b87d317426`; existing **25/25** source CI workflow groups SUCCESS, no repeat.
- Expected future first job number: **#0001**, but do **not** create the first job, Worker, or owner login.

**Nothing else permitted:** Previously completed DR D1/Worker must not be touched; no QA/STAGING/Stripe database write, Worker deploy/create, route/Access/login activation, secrets/payment change, R2 subscription/paid Cloudflare, Git merge, website/DNS change or legacy retirement. THIS IS NOT A PRODUCTION CUTOVER.

## On the owner's already-authenticated Acer — paste the block into ordinary interactive Windows PowerShell

This deliberately uses the previously established local Git repository `$HOME\FIREQA-PR172`, fetches PR270, checks that the approved commit is present, creates a **new isolated detached worktree** without altering old source worktrees, and installs exact Wrangler 4.92.0 into a separate tooling folder. If any prerequisite fails, STOP and report the harmless prewrite error. The last command starts the reviewed owner-interactive source installer: it asks for the exact database UUID confirmation before querying Cloudflare or applying SQL.

```powershell
$ErrorActionPreference = 'Stop'
$repo = Join-Path $HOME 'FIREQA-PR172'
$sha = 'b0508df9698c79c7b0b1de75813bf030fb77de60'
$work = Join-Path $HOME 'Documents\FIRE-NEW-LIVE-ONCE-b0508df'
$tools = Join-Path $HOME 'Documents\FIRE-WRANGLER-4-92-NEW-LIVE'

if (-not (Test-Path $repo -PathType Container)) { throw 'STOP: existing FIREQA-PR172 clone not found; do not guess another repo.' }
if (Test-Path $work) { throw 'STOP: isolated NEW LIVE worktree already exists; do not overwrite/restart. Inspect prior attempt state.' }
if (Test-Path (Join-Path $HOME 'FIRE-NEW-LIVE-ONE-SHOT-SCHEMA-20261114\new-live-remote-attempt-lock.json')) {
  throw 'STOP: prior NEW LIVE remote attempt lock exists; DO NOT run migration again.'
}

& git -C $repo fetch --no-tags origin 'refs/pull/270/head'
if ($LASTEXITCODE -ne 0) { throw 'STOP: Git fetch failed; no Cloudflare write.' }
& git -C $repo merge-base --is-ancestor $sha 'FETCH_HEAD'
if ($LASTEXITCODE -ne 0) { throw 'STOP: pinned approved source not in PR270 history; no Cloudflare write.' }
& git -C $repo worktree add --detach $work $sha
if ($LASTEXITCODE -ne 0) { throw 'STOP: isolated pinned source checkout failed; no Cloudflare write.' }

if (-not (Test-Path $tools -PathType Container)) {
  New-Item -ItemType Directory -Path $tools | Out-Null
}
& npm.cmd install --prefix $tools --no-save --no-audit --no-fund 'wrangler@4.92.0'
if ($LASTEXITCODE -ne 0) { throw 'STOP: exact local Wrangler install failed; no Cloudflare write.' }
$wrangler = Join-Path $tools 'node_modules\wrangler\bin\wrangler.js'
if (-not (Test-Path $wrangler -PathType Leaf)) { throw 'STOP: pinned Wrangler CLI not found; no Cloudflare write.' }
$version = (& node.exe $wrangler --version 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $version -notmatch '4\.92\.0') { throw 'STOP: Wrangler is not reviewed 4.92.0; no Cloudflare write.' }

$installer = Join-Path $work 'business-app-parity\owner_new_live_initial_schema_one_shot.mjs'
if (-not (Test-Path $installer -PathType Leaf)) { throw 'STOP: reviewed NEW LIVE installer missing; no Cloudflare write.' }
Write-Host 'PINNED SOURCE CHECKOUT AND WRANGLER READY. Next is the already approved ONE-SHOT NEW LIVE-only guarded migration.'
& node.exe $installer $wrangler '--exact-new-live-26-migrations-separately-authorized'
if ($LASTEXITCODE -ne 0) {
  throw 'STOP: installer did not complete. Do NOT blindly rerun. Preserve all local files and report the sanitized error.'
}
Write-Host 'NEW LIVE initial 26-migration installer finished; preserve protected one-shot attempt lock and receipt.'
```

The owner-interactive installer **will demand this exact phrase** after its own first local safety checks; do not type it for a different database:

```text
FIRE NEW LIVE APPLY 26 0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662
```

When the migration is approved and proceeds, it:
1. Pins the same FIRE Cloudflare account and compares **specific** NEW LIVE and DR D1 physical UUIDs by read-only `d1 info` (not previously failed account-wide list);
2. Uses actual remote read-only SQLite inventory; rejects any nonempty application/journal, previous Job# sequence, unknown index/view/trigger or unapproved metadata;
3. Verifies all 26 saved original migration files against pinned original Git blob hashes;
4. Writes **`$HOME\FIRE-NEW-LIVE-ONE-SHOT-SCHEMA-20261114\new-live-remote-attempt-lock.json` BEFORE the one remote D1 migration write**;
5. Calls the Cloudflare `d1 migrations apply` for `fire-fullapp-new-live-db` **once**, with no automatic retry;
6. After a successful provider response, performs only remote SELECT checks of all 26 D1 journal entries, financial/refund/index/immutable-number schema and empty job/customer/financial/other records, and saves `new-live-physical-schema-receipt.json` in the same folder.

**Permanent no-retry rule:** A timeout/error after the attempt lock exists can mean some SQL actually applied. Do not delete the lock or rerun any migration command; use read-only investigation first. Even on success, do not rerun. Keep both local lock/receipt and preserve an off-Acer private backup later without publishing credentials.

**What to return to ChatGPT:** Just the last sanitized completion or STOP message, plus whether the receipt exists. Do not post tokens, secrets, Cloudflare raw JSON, personal data or passphrases. The current DR physical 26/26 and DR dark hosted binding have already been verified and must NOT be retested.

**Gate status until actual readback:** accepted G1/G2/G3/G8 = 4/10, G4/G5/G6/G7/G9/G10 OPEN, NEW LIVE NO-GO. Source CI is not remote provider proof.
