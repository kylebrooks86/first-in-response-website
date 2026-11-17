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
