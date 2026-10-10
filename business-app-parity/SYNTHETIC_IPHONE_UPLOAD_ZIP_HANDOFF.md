# Verified iPhone Cloudflare upload ZIP

Prepared 2026-10-10. Remote development head before packaging: `45439e244a8b955917d72391a0bfcd291304ed72`; no newer commit. Clean detached source checkout: `5279d071ec8651c0ba5e963b4aa0d3bb4c84ccc7`. This batch adds documentation/evidence only; three development candidates and application code remain unchanged. Official readiness remains **3/10 (30%)**.

ZIP: `FIRE_Synthetic_Offline_Cloudflare_Upload_b9cbe0f7.zip` (229,642 bytes).

SHA-256: `c0df9614d2ba950baf09abfe8544c74495311b70797ab7aa1187ea18e2070578`.

Shell: `b9cbe0f7beff59d57f092c55`.

Approved receipt SHA-256: `e419f619a6dc66304a8255225a572f3dfb1c360fe6a6815787fa34357b3b5d91`.

The fresh TypeScript 5.9.3 package matches the complete source receipt, all 13 file hashes and sizes, approved origin, exact registration/manifest scope, eight-asset GET-only same-origin/no-query cache policy and inline CSP hash. ZIP CRC and extracted 13/13 SHA-256 comparisons passed. See `SYNTHETIC_IPHONE_UPLOAD_ZIP_EVIDENCE.json` for every per-file hash. No unchanged browser/TypeScript/full-build suites were repeated.

## ZIP root and extraction

The archive contains 13 files: four directly at root (`_headers`, `_redirects`, `404.html`, `robots.txt`) and nine inside `synthetic-customer-demo/` (`index.html`, `store.js`, `backup.js`, `vault.js`, `demo.js`, `manifest.webmanifest`, `icon-180.png`, `icon-512.png`, `worker.js`). No `upload/`, repository, or ZIP-name wrapper exists inside the archive. Local extraction recreated this root and verified every file. The iPhone Files app may create an enclosing extraction folder named after the ZIP; that folder would be the upload root if a folder upload were used. Do not upload only its `synthetic-customer-demo` child, since doing so would lose the approved scope and root headers.

No instructions, evidence receipt, backup, saved records, secrets, bindings, Functions, `_worker.js`, authentication service, Stripe connection, database or source maps are included. The worker named `worker.js` is the browser service worker inside the synthetic directory, not a Cloudflare Functions worker.

## Owner-reported state and upload steps

Owner reports signing into Cloudflare on their iPhone, exact project name accepted, and Step 2 Upload your project assets reached, with no assets uploaded and Deploy not tapped. This is user-reported; account identity/free quota and final assigned hostname are not independently authenticated here. No browser login retry or Cloudflare mutation was performed in this batch.

1. Download the provided ZIP and choose Share → Save to Files → On My iPhone (or another available local folder). If tapping the link previews it, use the download/share control. Keep it as a ZIP; do not re-compress it.
2. Return to your existing Cloudflare Step 2 for project `fire-synthetic-offline-test-bfc00939`. Use the upload area/file selector and select `FIRE_Synthetic_Offline_Cloudflare_Upload_b9cbe0f7.zip` from Files. The dashboard Direct Upload supports a ZIP directly; no extraction is required. Actual Safari picker behavior remains untested. If the selector refuses the ZIP, stop and send a screenshot of the upload control; do not rename it or upload files one-by-one in a way that flattens directories.
3. Review the file tree/count before deployment. Expect the 13 paths above, root header/redirect files, and exactly one `synthetic-customer-demo` directory. Check for upload errors and correct project. The ZIP must be unpacked by Cloudflare, not served as a single ZIP asset.
4. Before tapping Deploy, confirm this is the intended existing account, static Direct Upload only, USD 0 additional spending/no upgrade, no bindings/Functions/secrets/custom domain or Git integration, and the exact assigned hostname `fire-synthetic-offline-test-bfc00939.pages.dev`. A project name being accepted is not final proof of assigned hostname. Stop for any mismatch, suffix, cost, missing file or access limitation. No other existing project may be edited.
5. Once those conditions pass, your existing conditional owner approval covers manually deploying this exact synthetic package. After successful deployment, copy the actual canonical URL and send it to Work for trusted HTTPS/header/routing/scope acceptance. Expected demo URL: https://fire-synthetic-offline-test-bfc00939.pages.dev/synthetic-customer-demo/. Do not install a preview/alias URL.
6. Wait for hosted acceptance before iPhone testing. Then open the exact canonical demo in Safari → Share → Add to Home Screen → Open as Web App, name FIRE Demo, and keep your original app. Open the new icon online and wait for Offline shell ready. Follow `SYNTHETIC_IPHONE_INSTALL_TEST_PLAN.md` for disposable phrase, two Airplane Mode/Wi-Fi-off cold launches, actual encrypted Files verification and recovery on a separate empty device. Do not clear the only working vault or original app.

## Remaining blockers

No deployment was performed. Actual Cloudflare TLS/MIME/security/CORS headers, canonical routing, worker installation and cache entries, final assigned hostname, account/free quota, iPhone Files picker/downloads, installed offline cold launch and empty-device recovery remain UNVERIFIED here. Accepted project name/Step 2 are recorded as user report only. Whole-screen shaking remains unresolved; original saved app remains the scrolling benchmark. All original deployment safeguards and navigation scroll reset are unchanged. Additional spending: USD 0.

Cloudflare documentation reviewed 2026-10-10 confirms dashboard drag-and-drop accepts a ZIP or folder; Wrangler accepts a folder only. https://developers.cloudflare.com/pages/get-started/direct-upload/
