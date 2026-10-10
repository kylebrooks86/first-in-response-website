# Proposed synthetic HTTPS destination — NOT published

Proposed URL: https://fire-synthetic-offline-test-bfc00939.pages.dev/synthetic-customer-demo/
Project name: `fire-synthetic-offline-test-bfc00939`.
Existing owner-provided Cloudflare account: `bfc00939cfb2f8dfd8581a7a7f5f1307`.
No project was created, reserved, queried through an authenticated account or deployed this batch. Name availability, actual account quotas and exact assigned hostname remain unverified. If Cloudflare assigns any different hostname, STOP; revise the exact-origin adapter, repeat tests and obtain approval for the changed destination. Never reuse an existing FIRE production project.

## Why this option

Choose a new static-only Cloudflare Pages Direct Upload project in the existing account. Cloudflare documents free unlimited static requests when no Functions execute. This package has 13 upload files, no Functions, `_worker.js`, bindings, secrets, database, payment connections, build integration, analytics or custom domain. No paid plan, credit card purchase, trial, subscription or domain is needed for the proposed static Pages use. Account/project creation limits must still be checked; if blocked, stop rather than upgrading. No paid worker request is intentionally introduced. Hosting policy can change; this is not permanent hosting availability.

Using the existing LIVE, Doomsday or refund-staging hostname would mix service-worker/storage origins and require changing established apps. GitHub Pages is an alternate static host but its repository/site configuration has not been independently reviewed here; do not enable it on the existing website repository. A new Pages origin is the smallest proposed adapter and reuses the established provider.

## Exact local preparation

From a materialized development candidate with existing dependencies, run:

`node scripts/prepare-local-customer-pages.mjs /absolute/fresh/fire-pages-review`

This is local preparation only. Upload root would be `/absolute/fresh/fire-pages-review/upload`, containing ONLY:

- `synthetic-customer-demo/index.html`, `store.js`, `backup.js`, `vault.js`, `demo.js`, `manifest.webmanifest`, `icon-180.png`, `icon-512.png`, `worker.js`.
- `_headers`, `_redirects`, `404.html`, `robots.txt`.

`publication-review.json` remains outside upload and records hashes, shell version, exact origin, scope and publicationAuthorized=false. Do not upload the repository, candidate root, portable Node server, dependency directories, configuration, tokens, backups or IndexedDB exports. The adapter emits compiled static code and existing icon bytes only. No real/synthetic saved records or passphrases are embedded. The synthetic screen only accepts fixed customer-name presets; use a disposable test phrase, never business credentials. Encryption does not make this a production security approval.

## Isolation and headers

Manifest id/start_url/scope: `/synthetic-customer-demo/`; display standalone; title FIRE Demo; existing 180px Apple icon and 512px manifest icon. Worker script and maximum Service-Worker-Allowed scope are confined to that directory. Prepared demo registration permits ONLY the exact proposed HTTPS origin and exact directory path, not aliases, preview subdomains, production hosts, arbitrary pages.dev hosts or localhost. Default local development output remains localhost-only; production source/UI/navigation/vault schema unchanged.

Worker interception remains GET-only, same-origin, no query, eight static allowlisted paths. It does not cache customer/API/Stripe responses. Encrypted records stay in IndexedDB. Browser origin and scope boundaries prevent this project from controlling existing FIRE apps on other hostnames. No root worker or widened Service-Worker-Allowed header is emitted. No custom production domain or routes may be added.

Expected MIME: HTML text/html; modules and worker text/javascript; manifest application/manifest+json; icons image/png. Per-asset marker X-Fire-Synthetic-Asset:1 is required by installation; worker lacks that marker. No-store, nosniff, DENY framing, no-referrer and noindex headers; CSP restricts scripts to self plus the exact inline-bootstrap SHA256, worker/connect/manifest/images to self, forbids frames/forms/base/object. The package declares no CORS rule or backend. Cloudflare documents a default Access-Control-Allow-Origin: * on static responses; actual hosted CORS must be recorded and does not widen service-worker control or expose IndexedDB. Top-level 404 prevents Pages SPA fallback for nonexistent APIs. Root only redirects to the demo scope. Actual Pages headers, redirects, methods and valid TLS MUST be checked after approval/publication; local emulation is not hosted verification.

## Publication procedure — only after explicit approval

1. Verify the approved GitHub commit and clean source; prepare the fresh review package and inspect its receipt, hashes and 13-file upload inventory.
2. Sign into the existing Cloudflare account. Verify Free eligibility and available project quota. Do not change plans, bindings, existing projects or domains.
3. Workers & Pages → Create application → Pages Direct Upload / drag-and-drop. Create ONLY `fire-synthetic-offline-test-bfc00939`; no Git connection or automatic builds. Confirm the proposed exact assigned origin. STOP if changed or already owned by another project.
4. Upload ONLY contents of `upload/` (or a zip whose root has exactly those contents). Before Deploy site, confirm no functions, `_worker.js`, wrangler configuration, bindings, secrets or payment integration. Publish solely after the owner has expressly approved that exact commit/destination/package.
5. Read-only acceptance: valid trusted HTTPS with no certificate bypass; verify all asset status/MIME/markers, worker allowed scope, cache/CSP, canonical trailing slash, 404 for unknown/API routes, no external requests, no database/Stripe bindings, manifest identity and only eight cache entries. Do not start iPhone testing until these pass. Do not use preview/alias URLs for saved-app storage.
6. Perform the installed-context iPhone plan. Existing production apps and saved Home Screen icons remain unchanged. If initial deployment fails, stop and record failure; no production rollback is needed because production is untouched. Preserve the local package and GitHub checkpoint.

## Remaining approval and capability blockers

- Owner has not approved publication. Exact hostname availability/account quota and remote headers/TLS remain unverified.
- Synthetic encrypted download, read-only actual-file verification and atomic empty-vault recovery controls now exist and have native Chromium evidence. iPhone Files/download and recovery behavior are still UNVERIFIED; no existing vault can be overwritten.
- iPhone standalone storage, offline restart, background locking, download/file picker, WebCrypto timing, installed-app worker upgrades and mobile rendering remain UNVERIFIED.
- No full Business App offline claim, permanent browser durability, clean-device recovery or resolved scrolling-shake claim.

Official readiness remains 3/10 (30%). Recommended next step: owner review and explicit approval for this exact synthetic-only destination/package; then verify account eligibility, assigned origin and hosted TLS/headers before actual iPhone testing. Stop if the destination changes or free eligibility fails.

Sources reviewed 2026-10-10:
https://developers.cloudflare.com/pages/functions/pricing/
https://developers.cloudflare.com/pages/get-started/direct-upload/
https://developers.cloudflare.com/pages/configuration/headers/
https://developers.cloudflare.com/pages/configuration/serving-pages/
https://developers.cloudflare.com/pages/platform/limits/
https://www.w3.org/TR/service-workers/
https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios
https://webkit.org/blog/14403/updates-to-storage-policy/

## Final read-only review checkpoint

See SYNTHETIC_FINAL_PUBLICATION_APPROVAL.md and SYNTHETIC_FINAL_PUBLICATION_EVIDENCE.json for the pinned source/package, regenerated hash comparisons, sign-in access limit, conditional create-only hostname check and concrete approval request. Account/free quota, hostname assignment, real TLS/headers and iPhone tests remain UNVERIFIED. Publication remains unauthorized.
