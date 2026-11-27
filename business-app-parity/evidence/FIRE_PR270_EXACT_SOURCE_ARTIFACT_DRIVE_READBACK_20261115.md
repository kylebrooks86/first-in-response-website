# FIRE PR270 exact-build archive escrow — private Google Drive byte readback, Nov 15 2026 (CST)

**Scope: three SOURCE-ONLY GitHub Actions artifact ZIP archives for app/test review SHA `bafa7c3e42122f85719578b8a1d4e842578f0ccd`.** This is not an original customer records/photo backup, actual hosted Cloudflare source verification, deployment, permission activation, Stripe test transaction or release authorization.

The exact SHA has **26/26 GitHub workflow runs SUCCESS**, confirmed via commit-scoped run inventory. The current PR270 head can be newer because of documentation-only `[skip ci]` commits; never transfer these source tests to changed code or treat this archive as the frozen earlier FIRST-CREATE ZIP.

| Exact source artifact | GitHub Actions run/artifact | Original GitHub artifact ZIP byte size | Original and separately downloaded Google Drive SHA-256 | Private Drive ID |
|---|---|---:|---|---|
| QA built-source **review** | [run 43802442268](https://github.com/kylebrooks86/first-in-response-website/actions/runs/43802442268), artifact `14197690047` | 6,232,929 | `0f2304158b5daa7ffdd2ed387f7297dbb3feac62c84dcd58a5d7200890a9d5fe` | `1DBJU-GA7Grwi9rmOSmxJl4h1czMCJMx7` |
| Stripe TEST no-assets DARK **review**, never use as permission to rerun spent original upload | [run 43802442294](https://github.com/kylebrooks86/first-in-response-website/actions/runs/43802442294), artifact `14197341165` | 3,140,921 | `ff3308e0538c5bbdcd4427525aacf1153ce06d98eee6a4ac863345d362a2f613` | `1WhtLJkQeRoNkTx8A6ZJ5qUaRwKBBbaTO` |
| NEW LIVE DARK compiled source **review**, distinct from previously used first-create bundle | [run 43802442294](https://github.com/kylebrooks86/first-in-response-website/actions/runs/43802442294), artifact `14196937195` | 3,159,530 | `02fff31307ccfcb6e1f195dd286d74a5d77bb24477012db63f8057ab42411d92` | `11J1c9PWRBCU4V3ENPW2jhJ95xu5whuNP` |

**Custody performed now:** Existing private Google Drive folder `FIRE Business App Backups` ID `1x9ocIiI9mQMtwf0YP0Q9HqxBWn1qyIjt` was confirmed to have owner-only Google permissions / `shared=false`. Each artifact was downloaded from its exact GitHub Actions artifact ID, uploaded as a NEW Drive file with exact SHA in filename (old artifacts untouched), Google Drive metadata read back for ID, parent, MIME, exact byte size and `shared=false`. Then each uploaded stored ZIP was **separately downloaded again via the authenticated Google Drive raw-file connector** into a fresh runtime file, and independently compared byte-by-byte to the original GitHub-download ZIP: **all three are byte-identical, same full SHA-256 and length**. No Acer, Cloudflare or site login was required. Google Drive files remain owner private according to reported metadata.

Google Drive links:
- [QA built-source review](https://drive.google.com/file/d/1DBJU-GA7Grwi9rmOSmxJl4h1czMCJMx7/view)
- [Stripe TEST noassets review](https://drive.google.com/file/d/1WhtLJkQeRoNkTx8A6ZJ5qUaRwKBBbaTO/view)
- [NEW LIVE DARK source review](https://drive.google.com/file/d/11J1c9PWRBCU4V3ENPW2jhJ95xu5whuNP/view)

**Release boundary:** GitHub is DRAFT/UNMERGED; current binaries have NOT been deployed to QA/STAGING/DR/NEW LIVE or Stripe TEST. Original accepted physical DARK DR/NEW LIVE Worker versions, D1 26/26, CLEAN future Job #0001, already existing owner Drive backup files and original attempt locks remain untouched. No paid Cloudflare/R2, provider/SQL/Access, billing, migration, merge, DNS, Stripe charge or cutover. Formal accepted gates remain G1/G2/G3/G8 = **4/10**, G4/G5/G6/G7/G9/G10 OPEN, NEW LIVE DARK NO-GO. Source archive escrow is operational progress; it is NOT full future-data record/photo custody or an accepted Gate7 restore.
