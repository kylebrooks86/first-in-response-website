# November 18 owner Cloudflare Access and safe dual-target Gate4 evidence

**Classification:** owner-dashboard negative setting evidence + actual draft-only GET collector source. Do not conflate either with formally accepted G4-05/G4-06 or a hosted nonowner authorization test. Canonical tracker: [Issue 19](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6997966750).

## Original owner screenshots (retained privately in conversation, not copied into repository)
At approximately 8:34–8:35 PM Central, Nov 18, the owner opened authenticated iPhone Safari Cloudflare Workers & Pages:
- `IMG_4471.png`, SHA256 `c086a056d77c7c06db49196b98c43e4c0fb69469662bab6b85af85c50efee37f`: account-wide **Cloudflare Access** control, "Apply one account-wide Access policy across your Workers", visually **OFF**. This is evidence of the setting, **not** proof of any individual application's auth or all other Access policies.
- `IMG_4472.png`, SHA256 `e0e49aa6427bed6387e4c963604e051c4ddb8d75d43a3aa11fded1f4938c1e2f`: Worker/Pages list includes new QA and separate STAGING. A list entry cannot certify active source, version, D1 or functionality parity.
- `IMG_4473.png`, SHA256 `1b4587ef0d4089ad3388e59cf606aa7315a0c74d4cb9218af4f2e3e6eeea0f2a`: distinct DR `fire-fullapp-dr` and NEW LIVE `fire-fullapp-new-live` entries say **No active routes**. Previously captured Worker-level production/preview OFF, domains and independent DB/version evidence remain accepted; **never request duplicate screenshots**.

Do not toggle account-wide Access, create a Worker policy, permit ingress, deploy, purchase R2 or paid products, alter D1, Stripe, DNS, or merge as an inference from those screenshots. G4-06 still needs a separately approved, protected/private ingress design and actual effect checks.

## Executable source work on same unmerged draft PR270
- `business-app-parity/owner_current_dark_exposure_existing_session.mjs` updated at [30740ece](https://github.com/kylebrooks86/first-in-response-website/commit/30740ece8ade675f13a923b9d671ac3093aedb3e) with optional **`--capture both`**, in addition to existing individual `dr` and `new-live` modes.
- One existing owner Wrangler token read, **no new login**, runs both existing read-only GET-only Cloudflare inventory checks; emits a bounded summary and two per-target records. A single target's public route/domain/preview result forces `REQUIRES_REVIEW`; any incomplete inventory fails closed, not a false PASS. Token is never emitted to stdout, file, CI, or GitHub.
- [Tests add11fb5](https://github.com/kylebrooks86/first-in-response-website/commit/add11fb5993e176f87570f3e14f770486fc8d58a) add synthetic clean-both, exposed-NEW-LIVE, incomplete-zone and noninteractive-CI refusals to existing owner-session safeguards.
- The provider-contacting path still requires interactive Windows owner terminal, pre-existing Wrangler auth/session, and explicit `--capture`. No generic Cloudflare browser login retry, no new token, no POST/PUT/DELETE, no deployment or provider write. If unavailable, **STOP without a retry**.
- At documentation time, new exact-head GitHub CI was queued/in progress; **do not assert new tests SUCCESS until checked**. Earlier G4 collector source CI #44441335168 SUCCESS is historical; not proof of the new dual-target mode.

### Optional single owner read-only command, after exact updated branch is present in a separate clean local worktree
```powershell
node .\business-app-parity\owner_current_dark_exposure_existing_session.mjs --capture both
```
Runs neither deployment nor migration. The prior Acer repo root and worktrees must be respected; never overwrite uncommitted local edits or reuse stale script versions. A clean screenshot of **sanitized JSON summary only** is sufficient; no token, local photo or personal records required.

## Acceptance boundary
**50/95 checklist accepted, 45 open; formal 4/10 (G1/G2/G3/G8), G4-05 and G4-06 remain [ ], G4/G5/G6/G7/G9/G10 OPEN.** NEW LIVE stays DARK/NO-GO with Job #0001 untouched. This is genuine source tool improvement + negative Access setting evidence, not an authenticated account-zone GET result or approved Access protection.
