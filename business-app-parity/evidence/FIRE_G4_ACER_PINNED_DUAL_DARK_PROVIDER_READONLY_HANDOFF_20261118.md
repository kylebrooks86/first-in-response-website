# FIRE Gate 4 — exact owner Acer dual DARK route-inventory handoff (November 18, 2026)

**Purpose:** Capture *new* physically authenticated account-wide zones, Worker routes, custom domain assignments, workers.dev production+preview state for existing DARK DR and NEW LIVE in one read-only owner session. This is the **missing** G4-05 provider readback. Already accepted individual Worker Domains/Preview/Access screenshots, QA tests, D1 identities, three-photo recovery and all owner Chrome/Cloudflare login attempts must **never** be repeated.

## Existing owner Acer state, no reconstruction of history

- Existing owner Acer checkout path from earlier real PowerShell workflow: `%USERPROFILE%\FIRE-PR270-SAFE-20261118`.
- Do **not** change its tracked files, branch, local edits, private QA/D1 backups or working tests.
- Approved source-only helper: `business-app-parity/owner_current_dark_exposure_existing_session.mjs`, tested executable+synthetic-negative commit `add11fb5993e176f87570f3e14f770486fc8d58a`.
- Already observed exact-code GitHub [Gate4 offline run #44447932733](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44447932733): 2/2 jobs SUCCESS, 18/18 Wrangler owner-session safeguards PASS, two-target isolation and incomplete-zone stop checks PASS. **Not provider-proof**.

## Single paste block in Acer Windows PowerShell (ONLY when owner is ready)

```powershell
$repo = Join-Path $env:USERPROFILE 'FIRE-PR270-SAFE-20261118'
$review = Join-Path $env:USERPROFILE 'FIRE-G4-DARK-GET-ONLY-20261118'
$testedSha = 'add11fb5993e176f87570f3e14f770486fc8d58a'
if (-not (Test-Path -LiteralPath $repo)) { throw 'Existing FIRE repo folder not found; STOP, do not reclone.' }
if (Test-Path -LiteralPath $review) { throw 'Isolated review folder already exists; STOP, no overwrites.' }
git -C $repo fetch --no-tags origin work/fire-main-qa-dr-live-unified-source-20261114
if ($LASTEXITCODE -ne 0) { throw 'Git fetch failed; STOP.' }
git -C $repo cat-file -e "$testedSha^{commit}"
if ($LASTEXITCODE -ne 0) { throw 'Exact tested commit unavailable; STOP.' }
git -C $repo worktree add --detach $review $testedSha
if ($LASTEXITCODE -ne 0) { throw 'Isolated worktree creation failed; STOP.' }
Push-Location $review
try {
  node .\business-app-parity\owner_current_dark_exposure_existing_session.mjs --capture both
} finally { Pop-Location }
```

**Action classification:** the Git fetch only downloads repository history and the temporary **detached** worktree is new private local files. The final Node process uses the **previously authenticated** Wrangler session; it never launches Cloudflare browser login or creates an API token, and calls only read-only Cloudflare inventory GET endpoints. It does **not** deploy, migrate, SQL-write, purchase, change Access, route, DNS, Stripe or Worker, merge, or touch the old owner checkout. The existing session may refresh its token without a browser; if no session, cached Wrangler, access scope or API support is available, it emits `FIRE EXISTING WRANGLER READ-ONLY STOP` and **must not be retried or newly logged in** without a different owner decision.

## Evidence interpretation

- Screenshot/copy **only sanitized JSON** printed by the wrapper, not the underlying Wrangler token command, local credential files or cookies. No private database/customer/photo records or raw API JSON are needed.
- Each target must show its exact name, `workersDevEnabled:false`, `workersDevPreviewEnabled:false`, `targetCustomDomains:0`, `targetZoneRoutes:0`, `completeInventoryFromSuppliedEvidence:true`, `providerReadbackVerified:true`. Combined must show `publicEndpointsAbsentInSuppliedEvidence:true`.
- A partial inventory, stop, exposed target, route/domain discrepancy, or API scope failure means **not verified**. Do not infer safety or change configuration to make it pass.
- Even genuine clean physical account route results would resolve only the missing specific ingress portion of **G4-05**; account-wide Access is visibly OFF and per-Worker Access protection G4-06, nonowner denial, exact served code bytes, other environment parity and final Gate4 remain OPEN until independently proven.

**Authoritative counts before physical capture:** 50/95 checked, 45 OPEN, formal gates 4/10 (G1/G2/G3/G8). DR/NEW LIVE DARK, NEW LIVE NO-GO, first genuine Job #0001 untouched. User has not authorized any deployment, paid R2, Access policy edit, Git merge, live payments, or production change.
