# Final synthetic publication approval review — NOT authorized or published

Reviewed 2026-10-10 from development branch `work/fire-business-app-parity-2026-10-08`, source commit `5279d071ec8651c0ba5e963b4aa0d3bb4c84ccc7`. Initial remote lookup matched this commit; no newer work was found. This batch changes checkpoint documentation only. Official production readiness remains **3/10 (30%)**.

## Exact candidate for conditional approval

- Destination: https://fire-synthetic-offline-test-bfc00939.pages.dev/synthetic-customer-demo/
- New project name: `fire-synthetic-offline-test-bfc00939`.
- Existing owner-provided account: `bfc00939cfb2f8dfd8581a7a7f5f1307`; authenticated identity remains UNVERIFIED.
- Static source commit: `5279d071ec8651c0ba5e963b4aa0d3bb4c84ccc7`.
- Shell version: `b9cbe0f7beff59d57f092c55`.
- Receipt SHA256: `e419f619a6dc66304a8255225a572f3dfb1c360fe6a6815787fa34357b3b5d91`.
- Exact upload: 13 files, 271,580 bytes, as listed in `SYNTHETIC_PAGES_PUBLICATION_REVIEW.json`. The receipt stays outside the upload.
- Scope and manifest id/start_url: `/synthetic-customer-demo/`.

## Findings from this batch

Fresh local preparation from all three materialized candidates produced identical receipts. All 13 file hashes and byte counts match the current checkpoint for each candidate (39/39 file comparisons). The shared-source gate checked 122 files with zero differences, excluding the established deployment adapters. No application code, navigation scroll reset, core vault, existing backup safeguards, or production adapter changed.

The emitted registration guard accepts only the exact proposed origin and directory. Worker registration and Service-Worker-Allowed are directory-scoped. The worker intercepts only GET requests, same origin, no query, and eight enumerated static asset paths. The worker itself is not cached. Installation validates all eight assets before writing, rejects redirects/missing markers, and removes a partially written candidate cache on failure. Activation removes only older caches bearing its synthetic prefix. No skipWaiting was introduced. These are source/package findings; actual installed scope/cache entries require hosted verification.

The manifest is standalone with unchanged 180/512 PNG artwork. Prepared MIME rules are text/html, text/javascript, application/manifest+json, and image/png. All eight cached assets carry X-Fire-Synthetic-Asset: 1; worker carries only its MIME and allowed-scope rule. Global no-store, nosniff, DENY, no-referrer, noindex/nofollow, and restrictive CSP rules are present. The exact inline bootstrap CSP hash was independently recomputed and matches; header rule lengths are below Cloudflare's limits. Cache API retention is explicit despite HTTP no-store; no-store does not disable this offline cache.

The exact inventory contains only static code/artwork, `_headers`, `_redirects`, `404.html`, and `robots.txt`: no Functions directory, `_worker.js`, bindings/configuration, saved database exports, backups, tokens, or source maps. Review of generated text found only the approved origin URL and one fetch site in the worker, fetching same-origin static assets with credentials omitted. Credential patterns and additional network mechanisms were absent. Fixed synthetic fixture definitions are present, but saved customer records and passphrases are not packaged. There is no Stripe connection, database service, analytics, Git hosting integration, or real customer activation. Local static review cannot certify a future Cloudflare project's settings; those must also be checked before upload/publication.

**CORS clarification:** The package declares no Access-Control-Allow-Origin rule. Cloudflare's serving documentation describes a default `*` response header; absence of a local rule does not prove absence of CORS on the hosted assets. CORS does not expand service-worker control or expose this origin's IndexedDB. Record actual headers after publication; do not claim they were verified locally.

## Account, hostname, and hosted evidence

| Check | Result | Evidence/limit |
| --- | --- | --- |
| Static request pricing | Documented free | Official Pages pricing says static requests without Functions are free and unlimited on free and paid plans. |
| Package fits documented upload limits | PASS locally | 13 files; largest 179,718 bytes. Direct Upload drag-and-drop accepts a folder/zip. |
| Existing account identity/eligibility/quota | UNVERIFIED | No account-level Cloudflare connector exposed; focused dashboard navigation reached sign-in, with no authenticated account state. No login or account mutation attempted. |
| Exact hostname availability | UNVERIFIED | No create/reserve operation performed. A bounded public HEAD probe returned HTTP/2 502 from mitmproxy, not reliable Cloudflare evidence. DNS/404 alone would not establish availability either. |
| Exact assigned hostname | UNVERIFIED | Official Direct Upload docs warn a taken name can receive a random suffix. Never accept a different hostname silently. |
| Trusted Cloudflare TLS, MIME, security headers, routing | UNVERIFIED | Local lab used a proxy and certificate bypass. This batch's failed proxy probe supplies no hosted evidence. |
| iPhone installation/cold launch/Files/recovery | UNVERIFIED | Must test the installed context on a real device after hosted acceptance. |

No resource was created, reserved, published, or deployed. No production change, migration, Stripe action, or spending occurred. Unchanged browser/TypeScript/build suites were not repeated; their prior 180/180, corrected 75/75, TypeScript 3/3 and builds 3/3 remain historical checkpoint evidence, not new results.

## Conditional publication plan for owner approval

Approval would cover only creating this new static Pages Direct Upload project in the stated existing account and publishing the exact 13-file package above at the stated destination, with USD 0 additional spending. It would not authorize any existing FIRE deployment, customer activation, database, Stripe integration, custom domain, paid plan, or changed destination.

1. Verify the latest development head and that this exact source/package is still the approved candidate. Regenerate from the pinned source with TypeScript 5.9.3; compare the complete receipt, all hashes, inventory, and sizes. A mismatch blocks publication until reviewed.
2. Obtain authenticated read-only account identity, plan/eligibility, Pages project inventory and quota. Stop on unavailable access, account mismatch, name collision, spending, or required upgrade. Do not create a new account or expose credentials in chat.
3. If global hostname availability cannot be proved read-only, conditional owner approval may permit creation of **only** the stated project to reveal its assigned hostname. Check that exact assignment before upload/deploy. If Cloudflare's UI cannot separate assignment from publication, stop before Deploy site and use a reviewed create-only path; do not combine create/deploy without confirming the assigned origin.
4. If a suffix/different hostname is assigned, stop with the empty project unchanged; no upload or publication, no automatic deletion. Report the mismatch. Any alternative destination needs a new guard/package review and owner approval.
5. Verify the new project has no Functions, bindings, secrets, analytics, Git integration or custom domains. Upload only the approved upload contents, never this repository or review receipt, then publish at the approved origin.
6. Require real trusted TLS without bypass; verify all asset status/MIME/markers, CSP/cache/framing headers, manifest, worker scope, root redirect, canonical trailing slash, unknown/API 404 responses, no unexpected external requests, and eight cache entries. Keep iPhone testing blocked until these pass. Failure stops testing; production remains untouched. Preserve this source/package, and do not clear working device storage or remove original apps as a rollback.

## Simple iPhone instructions — only after hosted checks pass

1. Open the exact approved URL in Safari, Share → Add to Home Screen → Open as Web App. Name it FIRE Demo and keep the original icon.
2. Launch the new icon online, wait for Offline shell ready, initialize with a disposable phrase of at least 16 characters, and save Synthetic Updated / revision 2.
3. Lock and fully close it. Enable Airplane Mode and turn Wi-Fi off. Reopen the icon, unlock, confirm revision 2; save Synthetic Recovery / revision 3 and repeat the cold launch.
4. Offline, download the encrypted backup to On My iPhone in Files. Select that actual file and verify it without changes.
5. On a second empty device/context prepared online, recover the file offline without first initializing a vault. Confirm revision 3, then confirm repeat recovery refuses overwrite. Preserve the original vault/file and record Files locking or picker failures.

Use `SYNTHETIC_IPHONE_INSTALL_TEST_PLAN.md` for the full evidence steps. Whole-screen shaking remains unresolved; the original Home Screen app is the scrolling benchmark. No permanent browser durability or full Business App offline completion is claimed.

## Concrete approval request

Do you approve creating the single new static-only project `fire-synthetic-offline-test-bfc00939` in the stated existing Cloudflare account and publishing source commit `5279d071ec8651c0ba5e963b4aa0d3bb4c84ccc7`, shell `b9cbe0f7beff59d57f092c55`, and the exact 13-file receipt above at the stated URL, **only if account/free checks pass and the assigned hostname matches exactly**, with no spending, production changes, real records, databases or Stripe actions?

This approval is requested by the owner's explicit instruction for this batch. Until the owner answers, `publicationAuthorized` remains false. Next bounded batch after approval: authenticated eligibility/identity review and conditional synthetic publication, followed by hosted acceptance; actual device testing follows only on success.

Official sources reviewed 2026-10-10:
- https://developers.cloudflare.com/pages/functions/pricing/
- https://developers.cloudflare.com/pages/get-started/direct-upload/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/configuration/headers/
- https://developers.cloudflare.com/pages/configuration/serving-pages/
