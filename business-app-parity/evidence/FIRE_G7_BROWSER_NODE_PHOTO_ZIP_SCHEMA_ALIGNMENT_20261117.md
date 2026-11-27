# FIRE Gate 7 — browser / independently saved photo ZIP strict schema alignment

**2026-11-17 source-only candidate on draft PR #270. No provider, database, photo, deploy, or payment writes.**

## Defect and actual correction

The owner browser `readOfflinePhotoBackup` previously accepted checksum-valid stored ZIPs with undeclared top-level manifest or per-photo fields. The independent owner-saved protected photo verifier `verify_saved_protected_photo_backup.mjs` rejects such ZIPs by exact field set. This could allow an archive to be accepted in the owner UI but rejected by off-device verification later. Separately the exporter spread all IndexedDB record fields into its manifest; unexpected fields added by another app revision could be leaked into an owner backup.

Changed `shared/lib/offline-photo-backup.ts` in actual source commit [9af8fe46](https://github.com/kylebrooks86/first-in-response-website/commit/9af8fe46f864c21d8745e9142981d9231f42f7c3):

- Browser and Node now require the exact five reviewed top-level fields (`format`, `version`, `exportedAt`, `requiresMatchingCustomerRecords`, `photos`), and the nine original photo fields or ten with optional `jobId`. Unknown fields fail closed before any IndexedDB restore.
- Validate `exportedAt` and preserve the existing version-1 customer-only and optional job-linked archives.
- Serialize only explicit approved photo metadata from IndexedDB into the exported manifest; reject accidental leakage of unrelated stored fields.

Changed the existing real offline ZIP suite `shared/scripts/test-offline-photo-vault.mjs` in [6e537a72](https://github.com/kylebrooks86/first-in-response-website/commit/6e537a721b91eea3377f8285039040ea29c4f186). Four focused checks prove unknown IndexedDB data is excluded, a valid CRC/SHA stored ZIP with extra manifest keys fails, extra per-photo keys fail, and an exact job-linked manifest still decodes. The existing ZIP corruption, legacy, job-ownership and saved encrypted .firephotos checks remain retained.

At initial exact-head observation [Gate 7 saved protected photo offline verification](https://github.com/kylebrooks86/first-in-response-website/actions?query=workflow%3A%22FIRE+Gate+7+saved+protected+photo+offline+verification%22) and [public website/calculator protection](https://github.com/kylebrooks86/first-in-response-website/actions?query=workflow%3A%22FIRE+App-Only+Main+Integration%22) completed SUCCESS for `6e537a72`; the longer staging/Chrome and source matrix were still processing. Do not infer total CI SUCCESS prematurely.

## Release boundary

This is **unmerged/unpublished candidate source**, not newly hosted QA/STAGING/DR/NEW LIVE. It does not establish a real owner all-records plus original-photos paired backup from one bound D1, cross-device restore, Stripe signed TEST, hosted auth/Access, or final approval. Keep **45/95 checked, 50 open, four formal gates accepted (G1/G2/G3/G8)**; G4/G5/G6/G7/G9/G10 remain OPEN and NEW LIVE DARK/NO-GO. Accepted October owner iPhone 3/3 photo restoration and original DR/NEW LIVE updates, D1 migrations and owner dashboard screenshots must not be repeated. No Cloudflare login, paid R2, deployment, SQL/migration, authentication/Access/route, Stripe/payment, merge or cutover authorized or performed.
