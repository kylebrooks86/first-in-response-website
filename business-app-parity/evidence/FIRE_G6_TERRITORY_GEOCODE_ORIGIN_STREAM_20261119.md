# FIRE Gate 6 — owner territory geocoder request safety (November 19, 2026)

## Actual source issue corrected

In the shared QA-master `app/api/territory/search/route.ts`, the authenticated owner-only address-search `POST` previously used unbounded `request.json()` and did not apply the existing same-origin browser-write guard. A malformed or cross-origin request could reach the Census geocoding request under an ambient owner session. This is not a claim of observed hosted exploitation.

Source commit [d92fe1f](https://github.com/kylebrooks86/first-in-response-website/commit/d92fe1fd660910b2a0da00cdee4099507a5a6fbd) replaces the raw read with the existing `readOwnerWriteObject(request,2048)` before any outbound geocoder call, preserving the original owner-only authentication, exact one-address object shape, maximum address length, valid coordinates and manual pin fallback. The existing guard enforces actual streamed UTF-8 bytes, exact browser Origin/Fetch Metadata, JSON for browser requests, claimed Content-Length and fail-closed invalid input. No external Cloudflare resource or Stripe action is introduced.

Actual route fixture regression [63c92be](https://github.com/kylebrooks86/first-in-response-website/commit/63c92be43ba76b3a1dfd54d69d2e152e8f7452a7) covers legitimate same-origin search, hostile/sibling/null origins, hostile Fetch Metadata, text/plain form, multibyte oversized JSON, false Content-Length, arrays and zero outgoing Census calls for denied requests.

The existing territory API/model test was not actually invoked by the staging workflow. [7278fee](https://github.com/kylebrooks86/first-in-response-website/commit/7278feecd2ba9647248cdaf2287f58d775a58567) now executes `test-territory.mjs` alongside the already-running native SQLite door-knocking tests; the first real CI execution detected the generated QA adapter's different relative path to the shared guard. Corrected fixture [710dc9f](https://github.com/kylebrooks86/first-in-response-website/commit/710dc9f32c7c61462370f2df6b4603d5e3df36d0) recognizes both generated and shared relative paths WITHOUT mocking or weakening the production guard.

## CI / scope

Exact changed source/test SHA: `710dc9f32c7c61462370f2df6b4603d5e3df36d0`. [Staging/QA CI run #44578024970](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44578024970) started; final native territory test and six-job result MUST be read before declaring this test verified. Exact same-SHA [public website/calculator preservation](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44578024735) and [website verifier](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44578024993) COMPLETED SUCCESS.

Source-only unmerged DRAFT PR270; no QA/STAGING/DR/NEW LIVE/TEST deployment, payment, Cloudflare auth/Access/route/D1/R2, real customer data/photos, release merge or public site changes. Formal hosted G6-08 and all Gate 6 acceptance remain OPEN. Master checklist remains 50/95 accepted, 45 open; formal gates 4/10 accepted (G1/G2/G3/G8); NEW LIVE remains DARK, Job #0001 unissued.

Reuse accepted owner screenshots, iPhone QA and Nov 18 Acer STOP; do not rerun provider login, Cloudflare Wrangler probe or duplicate owner tests.
