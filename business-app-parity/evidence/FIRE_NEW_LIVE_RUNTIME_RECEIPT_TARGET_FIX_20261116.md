# FIRE NEW LIVE — release-verifier success receipt target correction (November 16, 2026)

## Verified root cause and source change
The source-only NEW LIVE immutable Worker module proof tool `business-app-parity/owner_new_live_immutable_module_bytes_readonly.mjs` initially rejected any legitimate one-shot NEW LIVE owner success receipt because `readOriginalNewLiveUpdateLock()` mistakenly required `s.target === 'dr'`. The original already-consumed publisher `owner_existing_dark_code_update_once_approved.mjs` writes the exact invocation `target`, which was `new-live` for the actual owner NEW LIVE code-only update. Thus the tool could not advance to its read-only Cloudflare immutable-version GET even with a correct genuine NEW LIVE receipt. **This bug was in the later evidence verifier, not the already-completed publisher or deployed Worker.**

A single source/test commit fixed only this error and added a pure, individually tested receipt validator:
- Code/test commit: [`03f43c77da55577c826230aba917a0d8d19dddf8`](https://github.com/kylebrooks86/first-in-response-website/commit/03f43c77da55577c826230aba917a0d8d19dddf8).
- Fixed source Git blob SHA: `b271174d3b4881b4819be4078f19ab7619b40a76`.
- Focused tests Git blob SHA: `594df04e33df0444b04106c3123ec2bb41df7324`.
- Six added cases: legitimate NEW LIVE receipt accepted; DR receipt, DR Worker, wrong D1, wrong predecessor and falsified success/source/gate status rejected. The original lock verification and immutable deployment scopes remain unchanged.

## Exact independent checks
- [Offline DARK-worker CI #44012963828](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44012963828): **SUCCESS**, `TOTAL 36/36 NEW LIVE ESModule-matched hosted-byte negative cases PASS; no external requests`. Despite the test's existing label, it verifies synthetic fixture behavior and legitimate receipt shape, **not Cloudflare byte readback**.
- [Main public website/calculator scope guard #44012965133](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44012965133): **SUCCESS**, website and calculator preserved.
- [Independent website verifier #44012964303](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44012964303): **SUCCESS**.

## Evidence boundaries and next use
The new source is committed only to the existing unmerged DRAFT PR270. It has NOT been published to Cloudflare or automatically copied to the owner's Acer. **Never use an earlier NEW LIVE verifier copy** with `target==='dr'`. A future optional owner GET-only capture must use the corrected, reviewed script, original untouched owner publisher lock and success receipt, already-existing private ZIP/credential and exact immutable target; no re-publish, SQL, auth, route or Stripe actions are authorized.

All previously accepted physical NEW LIVE results remain authoritative: Worker `fire-fullapp-new-live` is DARK, serves version `cfacbb3d-43de-4d2c-8008-c6732d78f756` 100%, binds D1 `0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662`, disabled auth and no R2/extra bindings, and original immutable prior version is listed. None was repeated.

**Cannot claim:** authenticated hosted module bytes, auxiliary package parity, account-wide Access/zone routes, genuine hosted nonowner denial, STAGING parity, full future-data/photos recovery, Stripe TEST signed delivery, rollback execution, Gate4 acceptance or production readiness. **Release 4/10 accepted G1/G2/G3/G8; G4/G5/G6/G7/G9/G10 open; NEW LIVE NO-GO.**
