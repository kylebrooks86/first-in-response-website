## Follow-up actual UI improvement — filtered same-job AFTER chooser (source `7d78e569`)

[Second executable code commit `7d78e569be46fd7775c85c28ee7079ad9100b9b2`](https://github.com/kylebrooks86/first-in-response-website/commit/7d78e569be46fd7775c85c28ee7079ad9100b9b2) takes the previous fail-closed last-second export guard into the actual owner workflow: the AFTER selector and preview now show only same-customer, **same job-association** photos for the selected BEFORE. If the chosen BEFORE has no matching AFTER, the owner sees an explicit explanation and Create comparison is disabled; a foreign-job image is no longer previewed as an intended pair. Changing the customer clears stale selected job, BEFORE and AFTER IDs. Legacy customer-only photo pairs still work, and the final export guard remains independent defense-in-depth. The existing `test-offline-photo-vault.mjs` suite gains six additional assertions: same-job allowed, foreign-job excluded, legacy-only allowed/mixed excluded, foreign customer/category excluded, actual picker wired/disabled, and reset on customer change. Typed declarations track the new pure filter.

At document update, exact-code GitHub Actions for this **second SHA** were only queued/in progress; **do not claim a PASS or four-target hosted parity**. The predecessor SHA `111073ca` had 24/25 green workflow groups and one long staging suite still in progress; do not attribute the predecessor results to the newer code. New and old UI updates remain **candidate source only**, 45/95 checklist, 4/10 gates, NEW LIVE DARK, no owner retest or provider/merge action.

---

# FIRE Business App — safer original-photo before/after comparisons (Nov 17, 2026)

**Executable source commit:** [`111073ca9ddb0f95c6980fa1c82481d143ae03b7`](https://github.com/kylebrooks86/first-in-response-website/commit/111073ca9ddb0f95c6980fa1c82481d143ae03b7), in existing **draft, unmerged PR #270**. This is **source-only**, not provider/hosted photo or release evidence.

## Concrete gap and fix

Previously, the actual owner customer Photos UI permitted choosing a BEFORE original from numbered Job A and an AFTER original from numbered Job B (both stored under one customer) and exporting them together into a single labeled FIRE marketing comparison. Both photos could be legitimate originals, but the exported image misleadingly presented different jobs as one transformation. The UI also allowed one job-linked original paired with an older customer-only unlinked image without a verified common job.

The new pure `assertPhotoComparisonSameJob` guard in `shared/lib/photo-comparison-layout.mjs` runs **inside the real UI's try block before canvas/image output**. It enforces different photo IDs, correct BEFORE/AFTER categories, exactly the same saved customer ID, and **matching optional job identities**. Two customer-only legacy originals remain compatible; two originals with the same authenticated saved job ID remain compatible. Different jobs or a mixed linked/unlinked pair produce an explicit owner-facing error, with zero photo writes and no comparison export. The existing owner can still deliberately select matching before/after photos and inspect the originals.

Changed paths: `shared/lib/photo-comparison-layout.mjs`, its `.d.mts` declarations, `shared/components/offline-customer-photos.tsx`, and the existing `shared/scripts/test-offline-photo-vault.mjs`. The existing focused test adds six distinct checks for legacy allowed, same-job allowed, cross-job refused, mixed association refused, foreign-customer refused, and actual React UI wiring. The change does not alter photo ZIP formats, D1 tables or recovery, Cloudflare, Stripe, R2, payment settings or service pricing.

## Evidence boundary

At implementation, the exact changed-code SHA triggered [GitHub Actions](https://github.com/kylebrooks86/first-in-response-website/commit/111073ca9ddb0f95c6980fa1c82481d143ae03b7/checks), including focused Gate7 offline-photo verification; **the runs were queued or in progress when first inspected, so no test PASS is claimed here**. The prior October 27 owner iPhone original-photo recovery remains accepted and should not be repeated. This new UI safety guard has **not** been deployed or tested on an owner's current hosted app. The checklist remains **45 of 95 complete**; G7-03/04/07, other physical G4/G5/G6/G7/G9/G10 gates and formal Gate7 acceptance remain OPEN. **4/10 gates accepted (G1/G2/G3/G8); NEW LIVE DARK/NO-GO, first live Job #0001 inactive.**

No owner/browser sign-in, Cloudflare action, D1 query or write, R2 subscription, upload, secret change, deployment, merge, payment, Stripe test transaction, DNS/route or release authorization occurred.
