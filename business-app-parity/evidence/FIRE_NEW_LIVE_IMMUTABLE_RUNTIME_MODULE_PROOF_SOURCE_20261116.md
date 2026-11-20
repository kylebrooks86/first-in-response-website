# FIRE Gate 4 — NEW LIVE immutable runtime module verification source (2026-11-16)

**Code developed and independently tested; NO authenticated hosted module-byte capture yet. NO release gate accepted by this change.**

## Actual source deliverable

- Existing DARK NEW LIVE one-shot code-only publication is **already complete**, original owner attempt lock consumed, and its hosted 100%-serving version **cfacbb3d-43de-4d2c-8008-c6732d78f756** plus physical D1/auth-blocked/no-R2/rollback-list attestation is previously accepted: [owner physical readback](FIRE_NEW_LIVE_POSTUPDATE_HOSTED_READBACK_20261116.md). Do not repeat it.
- New **business-app-parity/owner_new_live_immutable_module_bytes_readonly.mjs** performs strict NEW LIVE-specific SHA-256/length/name/MIME comparisons for the **193 original JS/MJS runtime modules**, against the original owner-private sealed NEW LIVE code-only ZIP (3,142,402 bytes, archive SHA-256 **8c19774e4e11f08c011c5e274d815ab341e287cdcf714cce1c647a782b75d67c**). Frozen QA-master packaged source remains **15bd714c435a585f695ed7166cf06d2c31ea1a8e**.
- Target is pinned to exact NEW LIVE worker **fire-fullapp-new-live**, immutable version above, Cloudflare account and original on-disk one-shot **NEW-LIVE** lock plus success receipt. It rejects wrong archive/DR version/metadata, unexpected modules, changed bytes, missing/extra modules, wrong MIME/base64 or malformed provider response. Default and offline-fixture modes never authenticate Cloudflare; optional `--capture new-live EXACT_OWNER_PRIVATE_ZIP` requires original owner Windows interactive console, already provisioned in-memory scoped API token, and requests ONE immutable `GET .../versions/cfacbb3d-43de-4d2c-8008-c6732d78f756?include=modules`. It never creates credentials, signs in, writes a secret or stores the raw provider content.
- Cloudflare documentation specifies `include=modules` and `modules[].content_base64/content_type/name`: https://developers.cloudflare.com/api/typescript/resources/workers/subresources/beta/subresources/workers/subresources/versions/methods/get/ .
- **Evidence boundary:** Strict metadata and exact 193 runtime JS/MJS comparison does not verify the other **48 auxiliary compiled files** (41 BIN + 2 CSS + 4 JSON + BUILD_ID), complete served source package, account-wide routing or Access policy, nonowner/customer denial, STAGING parity, full future-data/photo restore, signed Stripe TEST or production readiness. A successful local fixture cannot be called an authenticated hosted proof. No provider GET was executed in this work.

## Changed-code CI

- Source/test/workflow commit **e304d2296411e4e50e1b992c72362f4a4eeefad9**; approved workflow's exact blob SHA pinned by **29281dbad3e670493d689e67bc2fd45d3ef0e7d6** (no loosened allowlists or unrelated public-site edits).
- Focused new NEW LIVE verifier test **30/30 PASS** alongside prior DR and existing update guards: [GitHub Actions run 44012328392](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44012328392) **SUCCESS**.
- Existing public website/calculator SHA-pinned integration guard [run 44012328439](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44012328439) **SUCCESS** after updating only the existing DARK-worker workflow's approved Git blob pin. Earlier code-only head failed for this exact expected old pin and was corrected without bypass.
- Draft [PR #270](https://github.com/kylebrooks86/first-in-response-website/pull/270) remains OPEN, DRAFT, UNMERGED. No Cloudflare/D1/SQL/Access/route/login/R2/paid service/Stripe/payment action, upload, version creation, or production cutover occurred from this work.

**Formal acceptance unchanged G1/G2/G3/G8 = 4/10. G4/G5/G6/G7/G9/G10 OPEN. NEW LIVE DARK/NO-GO; first Job #0001 inactive.** Future targeted actual hosted module readback needs owner-local existing authorized credential and must not repeat consumed updater or accepted provider readback.
