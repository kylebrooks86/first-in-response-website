# FIRE historical DR/NEW LIVE original ZIP custody — HTTP 410 recovered from owner-private Drive
Date: 2026-11-17 CST. **Source/private custody only; no Cloudflare access/deploy/SQL, payment/Stripe, R2 subscription, Git merge, user authentication or release authorization.**

## Actual new investigation caused by GitHub Actions archive retention failure

At exact changed test-only source `240f337bce8a5afc854f12855a86fa9b3dc156ab`, existing DR offline prehost workflow [44028504172](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44028504172) and NEW LIVE prehost workflow [44028504176](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44028504176) **FAILED** at a literal GitHub original-artifact ZIP fetch with HTTP **410**. The workflow source explicitly pins original artifact IDs and ZIP SHA256; existing original GitHub Actions artifacts are no longer obtainable through those IDs. Source CI **25 SUCCESS / 2 FAILED** across 27 runs on that test-only revision; the failing jobs are not equivalent to tested source code defects.

The private Google Drive folder `FIRE Business App Backups`, already recorded in existing evidence, still contains the **exact ORIGINAL** previously accepted immutable ZIP files. We re-read the original SAVED bytes, not a newly rebuilt/similar-name substitute:

| Target | Original GitHub artifact ID (now 410) | Actual **owner-private saved original filename** | Byte length | Independently recalculated ZIP SHA-256 |
| --- | --- | --- | ---: | --- |
| DR | `14101337096` | `FIRE-DR-WORKER-ONLY-NO-ASSETS-37d94452772459334466e37010067395acafc696.zip` | 3,084,259 | `f61b28b6b0f8e669f9863be995cf7d56d527a51d012ee9e77083fb260c059719` |
| NEW LIVE | `14101058770` | `FIRE-NEW-LIVE-WORKER-ONLY-NO-ASSETS-3ee92374dca6322955fdd5f920a95e0864a9654f.zip` | 3,086,564 | `7c701cc6401e3eba06f684db2dd5a770b4c137401224ef8aeb812d18faabaec3` |

**Both lengths and both SHA256 digests match the exact original assertions in their failing workflow YAML**, and prior Issue #19 owner-custody receipts. Python independently reopened each of the actual saved ZIP files, verified their complete central-directory/CRC (**zero corrupt members**), and counted **242 members** in each. No owner customer data, recovery passphrases, live SQL or secrets were accessed or posted to GitHub.

### Exact unchanged source/module comparison against the separately saved D1 prehost archives

Also independently examined two already private saved **source-only physical D1 prehost ZIPs**, not to mistake them for the originals:

| Target | Separately saved prehost SHA256 / member count | Original-versus-prehost member comparison |
| --- | --- | --- |
| DR | `ae3f0078b15376ed861d7c0c47e4943f88b700f528e5c65c2e8f5ae9de7761d4`; 242 entries | Of **241 same-named entries**, **240 identical file bytes**, exactly **1 changed: `server/wrangler.json`** for D1/owner-device mode. Original `alternative-receipt.json` was replaced by `dr-physical-prehost-source-receipt.json`. |
| NEW LIVE | `b075dcf21e445c842b808f0ac560a24e36219f118fe20bb3d679d35f00003b30`; 242 entries | Of **241 same-named entries**, **240 identical file bytes**, exactly **1 changed: `server/wrangler.json`** for target D1/photo/dark flags. Original `alternative-receipt.json` was replaced by `new-live-physical-prehost-source-receipt.json`. |

**Important caution:** These older physical-D1 **prehost** ZIPs are **never-deploy source-review intermediates**, not approved latest release packages. The old DR prehost manifest retained `workers_dev:true` and did not set `preview_urls:false`; its earlier adapter is also not the final target-locked runtime. This is **not acceptable as the DARK DR release manifest**. Later approved review source and separately retained current QA-master first-create ZIPs contain explicit `workers_dev:false`, `preview_urls:false` and locked auth, but must still be evaluated as their own immutable source history, not used to relabel this predecessor. Do not publish the older prehost archive or treat it as hosted/protected, even though its module hashes match.

## What this physically resolves and what it does not

**RESOLVED: original private source-byte custody question.** The two original immutable original SHA/size/CRC identities and the unchanged payload ancestry versus separately saved historical D1-binding intermediates were verified. The full original binaries exist off-GitHub and off-Acer without asking the owner to repeat authentication/screenshots or making any new subscription.

**STILL OPEN: automated CI re-download of expired GitHub artifact IDs.** Both workflows' old hardcoded GitHub artifact URLs **still return HTTP 410**; an external private Drive archive is not available to an unauthenticated GitHub Actions runner by magic. Never replace original SHA pins with hashes of a freshly rebuilt or merely similarly named ZIP; never claim 27/27 workflows SUCCESS at `240f337b`. A safe next path needs newly reviewed immutable current candidate packages with exact digest + owner-approved, secure artifact transfer/retention where necessary, or explicit retirement of genuinely historical tests from active PR gating after proving replacement coverage. **Do not weaken fail-closed guards, create a public Drive link, or expose owner-private binaries/credentials in GitHub.**

**RELEASE:** None of G4/G5/G6/G7/G9/G10 accepted. No production/Stripe/payment/Cloudflare/SQL/Git merge. Previous accepted QA master tests and the original immutable source/rollback archives remain accepted. One live checklist count **34/95**, 61 open, formal gates accepted **4/10**, NEW LIVE DARK / NO-GO.
