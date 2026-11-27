# FIRE DR / NEW LIVE — dark source-only Worker logging hardening and actual ZIP-byte custody (Nov 17, 2026)

## Real release blocker repaired

The actual [current-source DARK Worker package generator](../prepare_current_dark_worker_package.mjs) inherited `observability: {"enabled":true}` from the Vite/Wrangler compiled manifest in the previously generated, **unhosted** DR and NEW LIVE source archives. This was not permission to log or evidence that private data had been logged; it was an unsafe future deployment default and inconsistent with privacy-conservative private app candidate handling.

- Source commit [`f81dc810`](https://github.com/kylebrooks86/first-in-response-website/commit/f81dc810d26e572f63eed1dca46150528953cae9) explicitly sets `observability: {"enabled":false}` in **both** D1-bound DR and NEW LIVE dark reviewed source packages, without touching original QA-master compiled server/client bytes.
- The verifier now **rejects** a bound package whose observability has been silently reenabled, even when a caller rewrites the unsigned inventory receipt.
- Changed-function adversarial regression and positive assertions committed at [`c9ff904`](https://github.com/kylebrooks86/first-in-response-website/commit/c9ff90419696290260025d4446d38c19d5ded342), existing `test_current_dark_worker_package.mjs`. That source/test executable SHA is `c9ff90419696290260025d4446d38c19d5ded342`.
- Exact [GitHub offline independent candidate workflow #44194377820](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44194377820) produced the dark and first-create artifacts from that executable SHA; DR and NEW LIVE jobs successfully passed the exact-source first-create/dry-run/archived-byte readback steps. Full 25-workflow matrix status must be read back separately before making a 25/25 assertion.

## Actual downloaded artifacts checked, not merely a green CI badge

All four exact GitHub Actions ZIPs were downloaded. ZIP SHA-256 recomputed from original downloaded bytes and matched the artifact digests published by GitHub. Each file was opened; names, file sizes, SHA-256 values, original receipt identities and bound actual `server/wrangler.json` were independently compared. The owner-secret **values** are neither read nor stored.

| Role | Artifact ID | Verified ZIP SHA256 | Exact independently verified files |
|---|---:|---|---:|
| DR dark physically D1-bound source | `14378686312` | `e4e9a642664f6aeab35fb82f9777d695160fb46155c735f2d98468cec8333e38` | **244/244** original sealed inventory files (245 ZIP entries with receipt) |
| NEW LIVE dark physically D1-bound source | `14379065215` | `9cbaa99b1a6b4a70b285f85d3a289be0586900dd7e2b60f36fe872f6884c411b` | **244/244** original sealed inventory files |
| DR private first-create overlay, no future secrets declaration | `14377818291` | `a6706dc7d6619b3840a016c765d06bd09653635a7116dca142bbc8e875386602` | **242/242** sealed server files, plus overlay receipt |
| NEW LIVE private first-create overlay, no future secrets declaration | `14376824945` | `527f432bb6f3569fbe130964319d4a17e4e5eacfc3fecfad98342a72c8d81af0` | **242/242** sealed server files, plus overlay receipt |

For **each target**, every nonconfig compiled server/static module in the first-create overlay is byte-identical to its parent dark source ZIP; **only** the exact `secrets.required` *declaration* is removed from `server/wrangler.json` to allow future first creation before credentials exist. The protected first-request runtime and all 41 compiled embedded public client assets remain exact, preserving the original QA-master application source custody. The first-create receipt cryptographically pins the full parent receipt SHA and both configs and independently passes its 242-member manifest SHA.

**D1-bound source configurations—not independently hosted provider readbacks:**
- DR Worker `fire-fullapp-dr`, distinct recorded D1 `fire-fullapp-dr-db` UUID `5e55c5b7-cd67-4c8f-a52e-40f71b5d3145`.
- NEW LIVE Worker `fire-fullapp-new-live`, distinct recorded D1 `fire-fullapp-new-live-db` UUID `0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662`.
- Both: **FIRE_*_AUTH_ENABLED=blocked**, `observability.enabled=false`, `workers_dev=false`, `preview_urls=false`, **no R2**, no routes, and `FIRE_PHOTO_STORAGE_MODE=owner-device-zip`. Stripe not activated. First-create overlays contain **no user/account secrets**; removal of `secrets.required` does **not** enable login.
- Both source receipts explicitly say **no provider contacted**, no Worker created/deployed, no D1 migration, no release authorization, and no real Job #0001 allocation.
- **Important:** Independent CI builds on the same source SHA can generate different hashed compiled chunk names/content; the source SHA alone is not byte-for-byte QA/STAGING/DR/NEW LIVE *hosted parity*. No such assertion or G4-02/G4-10 checkbox is made.

## Private off-GitHub custody completed

The **original GitHub-downloaded ZIP bytes**, without repacking or rewriting, were uploaded as four distinct, clearly labeled source-only artifacts to the existing owner's **FIRE Business App Backups** folder in connected Google Drive. Each upload returned success; four independent Google Drive metadata GETs confirmed the exact filenames, byte counts **3,166,039 / 3,168,319 / 3,147,759 / 3,149,921**, the same existing parent folder and **shared=false**. No paid Cloudflare/R2 or public Drive link was enabled. This is private *compiled source package* custody, not D1/photo customer backup, a hosted rollback, or Gate 7 acceptance.

## Formal release constraints unchanged

**45/95 atomic checklist items checked, 50 open; G1/G2/G3/G8 accepted (4/10 formal gates).** G4/G5/G6/G7/G9/G10 remain OPEN, NEW LIVE remains **DARK/NO-GO**. The source logging fix does **not** prove actual Cloudflare observability configuration, privacy of logs, true nonowner denial, issued credentials or physical target identity. Before any deploy/Access/SQL/Stripe/route/login/merge/payment, retain target-specific exact separate owner authorization, approved backup/rollback and new provider readback. Do not repeat previously failed Cloudflare browser sign-ins, accepted iPhone/QA/DR/NEW LIVE/backup screenshots or any paid Cloudflare/R2 subscription.
