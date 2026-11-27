# FIRE QA no-R2 compiled source — exact code, 26/26 workflow CI and private archive

**Evidence captured 2026-11-16 (CST). SOURCE ONLY. NO QA/DR/NEW LIVE/TEST hosting change.**

## Exact source

- Repository: `kylebrooks86/first-in-response-website`, main-target DRAFT PR #270; working branch `work/fire-main-qa-dr-live-unified-source-20261114`.
- Current last FUNCTIONAL source commit: **`15bd714c435a585f695ed7166cf06d2c31ea1a8e`**, including canonical QA no-R2 `adapters/qa/vite.config.ts`, actual compiled no-R2 verifier and isolated Wrangler QA upload manifest; source-only web browser regression `shared/scripts/test-qa-worker-http-browser.mjs` now requires ZERO hosted R2 bindings. The isolated LOCAL workerd photo-simulator remains a test-only, randomized local resource; it is not a hosted R2 or subscription.
- All **26 / 26 distinct GitHub Actions workflow groups SUCCESS**, exactly matched to that code SHA as observed 2026-11-16. Final longer `FIRE Staging Migration and Shared-App Parity` run [#43870222846](https://github.com/kylebrooks86/first-in-response-website/actions/runs/43870222846) SUCCESS, with actual built-QA browser/login/restart/customer workflow and staging source CI successful. Earlier source `c7a69ec` failed at a TEST HARNESS assertion expecting a forbidden hosted R2 bucket, not a customer data failure; do not repeat old CI or attribute 26/26 to that earlier version.
- No SQL/migration, remote customer records, photo bytes, Stripe/provider payment, Cloudflare Worker/Access/route, LIVE domain, Git merge, paid Cloudflare or R2 subscription was changed. GitHub Actions source-only validation does NOT verify a current hosted serving code version.

## Private source artifact custody (NOT customer DB/photos)

- GitHub Actions exact-code artifact [`fire-qa-built-source-review-15bd714c435a585f695ed7166cf06d2c31ea1a8e`](https://github.com/kylebrooks86/first-in-response-website/actions/runs/43870222846/artifacts/14227008322), artifact ID `14227008322`.
- Source-review GitHub Actions ZIP, **6,239,410 bytes**, uploaded into the existing owner-only Google Drive `FIRE Business App Backups` folder (ID `1x9ocIiI9mQMtwf0YP0Q9HqxBWn1qyIjt`). Stored file Google Drive ID `1oaeKK56XRmmuhTkMix26vtqyemN5Ohj-`, title `FIRE-QA-compiled-review-15bd714c435a585f695ed7166cf06d2c31ea1a8e.zip`. [Private owner Drive file](https://drive.google.com/file/d/1oaeKK56XRmmuhTkMix26vtqyemN5Ohj-/view).
- Google Drive file metadata VERIFIED `application/zip`, **6,239,410 bytes**, correct private folder parent, `shared=false` and only one `type=user, role=owner` permission. Exact stored ZIP also independently retrieved from Drive as native raw bytes, `unzip -t` reported no errors, SHA-256 **`32efe27c38e15348346dbc22b223eff2c846a48bf44f66fa013a4f29542ef5e6`**.
- This is a compiled **SOURCE/REVIEW** bundle, not D1 contents or the saved original customer photo ZIP. This does not constitute formal Gate7 off-device full records+photo custody or recovery.

## Owner deployment scope and gate state

- Current OWNER-ACCEPTED hosted QA Worker: `fire-fullapp-qa-20261016`, 100% active version `6d77bd7c-20d3-49aa-9816-c651d98953cb`, physical D1 binding `DB` -> UUID `8ccfb1f8-1657-4074-b1b2-47de78f95003`. Prior `2be6407d-9efc-4b2a-95fc-18ed734aa943` remains retained for rollback. These are accepted historic OWNER screenshot facts; DO NOT make user repeat old Cloudflare/Acer/iPhone checks.
- New compiled source `15bd714c...` remains **DRAFT, UNMERGED, NOT HOSTED** and not yet the 100%-serving QA Worker code. The previous R2-placeholder/old-active-version source errors were fixed, not a Cloudflare deploy.
- QA existing-Worker update requires a **fresh exact explicit approval** for the actual code-only publication: same target Worker, current QA version, same physical D1, exact code SHA, NO R2/Stripe/SQL/migration/Access/secrets/DR/NEW LIVE/DNS, preserved old code rollback and existing independent device-local photo backups. A generic `continue` or `approve` without this required exact scope is NOT deploy authority. Do not use the old first-create or previously-failed TEST inactive upload procedure, do not automatically retry any remote write.
- Formal gates **4/10 ACCEPTED**: G1, G2, G3, G8; G4, G5, G6, G7, G9, G10 OPEN. NEW LIVE DARK NO-GO. Existing DARK DR and NEW LIVE physical Worker/D1/26-migration/first job future #0001 remain accepted and untouched.

**Next actionable milestone:** Prepare and, only on explicit exact owner permission and intact fresh safety gates, carry out existing QA Worker *code-only* update. Confirm serving version and edited app behavior only for the new source functionality. Do not repeat accepted preexisting evidence; source compilation is complete and this exact source CI is green.
