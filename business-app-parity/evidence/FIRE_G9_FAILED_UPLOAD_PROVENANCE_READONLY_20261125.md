<!-- FIRE-G9-BOUNDED-REFUSAL-20261125 -->
## Additional November 25 owner-safety engineering check — future refusal body cap

The original sealed one-shot refusal is consumed and no numeric historical status/code can be recovered. On the **unmerged DRAFT source only**, the existing G9 upload adapter was updated at [7ca36e3](https://github.com/kylebrooks86/first-in-response-website/commit/7ca36e3147e33720194d07d6046aca4dac473476) to read a bounded 64 KiB error-body stream instead of unbounded `response.json()`. It emits only the sanitized numeric HTTP status and up to five unique integer error codes; missing/malformed/oversize body is UNKNOWN. Follow-up [b414bdb](https://github.com/kylebrooks86/first-in-response-website/commit/b414bdba4126fc3a14385deeb68835fd452ef9c9) adds offline stream/size/privacy/no-retry tests. Exact-head CI pending at this writing. No historical G9 acceptance, new authorization, attempt-lock reset, POST, Stripe use or deployed source is implied. Original count 57/95, 5/10 formal gates.

---

# FIRE G9 — consumed Nov 25 TEST upload, exact-provider-version provenance review (no provider change)

**Date:** Nov 25, 2026 CST. **Active integrated review:** [draft PR #282](https://github.com/kylebrooks86/first-in-response-website/pull/282).

## What was actually implemented

- Added `business-app-parity/cloudflare-launch/stripe-test-worker/owner_gate9_failed_upload_source_provenance_read_only.mjs` in commit [f72d865](https://github.com/kylebrooks86/first-in-response-website/commit/f72d86503874c4f2e1d2beabc70c7d8753f64704), with Cloudflare UTC-midnight compatibility-date normalization in [c4d6f2b](https://github.com/kylebrooks86/first-in-response-website/commit/c4d6f2bb495cae34cd68e71c1e1c1232a65c18fe).
- Added 12 synthetic positive/negative attribution and exact-module-byte regressions in the existing `test_gate9_private_test_activation_version_upload.mjs`, commit [c1b7bcc](https://github.com/kylebrooks86/first-in-response-website/commit/c1b7bcc46fe52fe9b4831cc82c7a22c94b6a5718).
- Wired **only this changed test** to the existing staging/QA workflow (commit [881b233](https://github.com/kylebrooks86/first-in-response-website/commit/881b23303547d2b3aec1add9d074945b59630efb)).
- Actual GitHub Actions [run #45742201371](https://github.com/kylebrooks86/first-in-response-website/actions/runs/45742201371), Gate 9 exact six-event Stripe TEST contract job `139649674426`, reports step **“Check G9 refused-upload module provenance reconciler (offline only)” COMPLETED SUCCESS**; the existing owner one-shot fail-closed step in the same job also SUCCESS. This is a targeted verified code/test pass, **not** a declaration that all 28 workflows have completed.

## Why this is distinct from previously completed evidence

[Issue #19 accepted physical inventory](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-7180274211) already proves the predecessor `96e32262-fa33-4f04-a161-bee11f0353e2` continues serving 100% and classifies inactive versions by limited bindings/assets. Do not repeat the inventory, lock search, owner Stripe sandbox identity checks, existing Access exception or previously accepted QA screenshots.

The **specific still-missing proof** is whether a candidate version actually contains the sealed code bytes, matching exact D1 and secret *names*, required Stripe TEST mode and exact creation time consistent with the CONSUMED Nov25 upload attempt. This tool reads only six prior known inactive version IDs, and only fetches modules for versions with sufficiently matching metadata. It consumes the already saved owner-local private package and attempt lock. Never print raw code, provider JSON, credentials or customer data.

**Owner Acer action (when existing scoped Cloudflare read token is available):** in the verified current PR282 checkout:
```powershell
node .\business-app-parity\cloudflare-launch\stripe-test-worker\owner_gate9_failed_upload_source_provenance_read_only.mjs "C:\ABSOLUTE\PATH\TO\EXISTING\SEALED-REVIEW-FOLDER"
```
The sole argument must be the **existing actual folder** containing `activation-review-receipt.json`, `activation-config.REVIEW-ONLY.json`, `server\` and the spent lock. Token stays private in process environment `CLOUDFLARE_API_TOKEN`; do not share its value. The script is **GET-only**, writes no files and makes no payment. If token is unavailable/insufficient or evidence differs, STOP, no repeat of earlier failed login/upload. The code does not handle a *new* provider version write.

On any byte-identical result, independently review the entire returned sanitized receipt and current 100%-serving predecessor; verify provider provenance before asking for **separate exact version-specific owner authorization** to activate. On no match, do not infer no provider transaction occurred—only that the six previously inventoried versions were not an exact attributable candidate. **Do not upload again, reset spent locks, activate TEST, execute Stripe payment/refunds, deploy, migrate, merge, or touch LIVE** without distinct authorization.

## Acceptance ledger

- **Engineering task** — source implementation, negative regression and one targeted CI step: **[x] COMPLETE**.
- **Provider version readback** — the new unique targeted GET: **[x] PERFORMED — negative attribution result, not candidate acceptance**.
- **Original numbered G9-05 through G9-11**: **[ ] REMAIN OPEN**.
- **Official**: **57/95 original numbered tasks accepted, 38 open; 5/10 formal gates G1/G2/G3/G7/G8 accepted**. G4/G5/G6/G9/G10 OPEN; NEW LIVE dark/NO-GO; first authentic Job #0001 untouched.
- **No provider writes**; no login, Stripe mode changes, Cloudflare version deployment/activation, D1 mutation, paid Cloudflare/R2, public site changes or PR merge.

## Owner Acer result — Nov 25 20:56 CST

[Issue #19 receipt](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-7181262679) confirms the sealed package/lock accepted; all six pinned IDs outside attempt window, bindings guard false, module comparison not reached. No attributable candidate found among six. Do not repeat. The original HTTP refusal did not capture its numeric status/code; the current adapter already captures those fields, but cannot recover the historical response. Cloudflare's beta create-version API supports exact version-ID inheritance and JSON base64 modules: https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/subresources/versions/methods/create/ . This is contract evidence, not proof of the failure cause. No lock reset, provider write or new numbered acceptance. Next candidate must have a separately reviewed payload and fresh explicit authorization; no blind resend.
