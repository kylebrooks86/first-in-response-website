## iPhone native Files share added without changing current PNG download

[Real customer Photos UI source `1bff6de`](https://github.com/kylebrooks86/first-in-response-website/commit/1bff6de6957ffc5c6b0f79553b1e6bc3d0c249d5) preserves the existing direct `FIRE-before-after.png` download and retains the rendered file **in memory** after asynchronous full-image canvas creation. It then offers a separate **Save or share comparison** owner button, calling `navigator.share({files:[file]})` on that fresh click before its first `await`; unsupported browsers use a fresh-click download. This follows the already-accepted FIRE photo-archive iOS user-gesture pattern, without changing original photo bytes or requiring cloud storage.

The staged file is paired with the exact selected BEFORE and AFTER photo IDs; the UI hides it if the owner changes either selection, changes customers, or another FIRE tab broadcasts a photo mutation. A re-render attempt discards the prior prepared comparison. This file is *not* a photo backup and no provider upload occurs. [Actual pinned Chrome test `838ea7b`](https://github.com/kylebrooks86/first-in-response-website/commit/838ea7bd6d1a30df329de8be4321a9af4d0c5217) tests the new fresh-tap native share callback with PNG signature, gesture state, saved filename and unchanged original gallery; [source regression `ccbbe07`](https://github.com/kylebrooks86/first-in-response-website/commit/ccbbe07837e2e4283e873d366b23f54e33bfadda) checks prepared-pair binding and first-awaited share. At documentation, this **new exact-code CI was not fully complete**; do not borrow the previous 25/25 PASS from privacy-only SHA `7dd6ff0`. The previous privacy-only SHA did later reach **25/25 SUCCESS** including the exact real Chrome canvas privacy test.

No iPhone owner retest, actual Apple Files save verification, hosted Cloudflare deployment, photo ZIP schema change, any provider access or release gate closure. **45/95 checklist, 4/10 formal gates, NEW LIVE DARK.**

---

# FIRE — Shareable before/after image customer-name privacy (Nov 17, 2026)

**Existing unmerged source:** [commit `7dd6ff0`](https://github.com/kylebrooks86/first-in-response-website/commit/7dd6ff02ea95c7533bc2dfabe7008ce105d64059), draft PR #270, QA-master candidate. No hosted deployment, ownership/record change, or Cloudflare action.

## Real app defect and source correction

The customer Photos screen's `comparison()` routine used the customer profile's `customerName` to paint a large footer directly onto `FIRE-before-after.png`. The tool explicitly advertises a **shareable** marketing image. A real customer name therefore could unintentionally be permanently embedded in a public-facing photo before/after post, despite the business owner correctly using real original job pictures.

The actual canvas now paints only **public FIRE identity**: unchanged `BEFORE`/`AFTER` labels, `FIRST IN RESPONSE EXTERIORS`, and `firstinresponseexteriors.com` in the old customer-name footer position. No private profile name or customer ID is painted. The source retains original image pixels and the existing same-customer/same-saved-job comparison guard, legacy customer-only pairing support, full uncropped original layout and named download. This removes only private text overlay; **the photographs themselves may still show people, vehicle plates, house numbers or identifying property details**, so owner review and any needed permission before publishing remain important.

## Changed source and targeted tests

- `business-app-parity/shared/components/offline-customer-photos.tsx` — replace customer-name canvas overlay with public business website, no other on-device photo/backup/restore/write mutation.
- `business-app-parity/shared/scripts/test-offline-photo-vault.mjs` — assert the real comparison canvas code contains public domain and no `fillText(customerName)` or customer ID overlay.
- `business-app-parity/shared/scripts/test-offline-photo-ui-browser.mjs` — intercept actual `CanvasRenderingContext2D.fillText` in disposable pinned Chrome during the real comparison export; require labels + FIRE identity + website, reject synthetic customer name and customer ID. The existing downloaded PNG and original-photo recovery tests remain intact.

At first recorded inspection, this exact executable source SHA had **24/25 GitHub Actions workflow groups SUCCESS, zero reported failures; the larger staging/Chrome workflow #44160433257 was still running**. The focused Gate7 protected-photo verification and app-only protected public-site/calculator workflow were SUCCESS. **Do not claim the new actual Chrome overlay test PASSED until the long workflow reaches its precise changed-test step.**

No photo bytes were altered, no artificial cleaning results generated, no existing real customer/owner photo test was repeated. This is a **source-side privacy fix**, NOT a hosted QA, STAGING, DR or NEW LIVE verification and NOT a release checklist closure. Formal gates G1/G2/G3/G8 remain 4/10 accepted; **45/95** atomic release tasks checked, **50 open**; NEW LIVE DARK/NO-GO, first real Job #0001 inactive. No Cloudflare login, paid R2, provider D1/Worker/Stripe/Access/route, merge, deploy or cutover.
