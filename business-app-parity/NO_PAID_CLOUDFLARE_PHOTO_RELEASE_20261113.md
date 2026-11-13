# FIRE Business App — NO R2, NO PAID CLOUDFLARE: binding release architecture (November 13, 2026)

## Owner decision — HARD CONSTRAINT, do not re-ask

**No R2 subscription, billing checkout, payment-method entry, paid Cloudflare product or paid plan.** On 2026-11-13 the account showed “Add R2 subscription to my account”; the owner expressly refused it, including a $0-due-now subscription. Never send the owner back to R2 activation or assume included monthly usage authorizes billing. Do not create a bucket. Do not pretend the missing bucket is a temporary user-action blocker. See [Issue #19](https://github.com/kylebrooks86/first-in-response-website/issues/19) permanent comment for current owner direction.

**Historical owner confirmation:** `fire-fullapp-dr-db` was created empty in the selected Cloudflare account. Physical UUID, migration journal, actual binding, and Worker status are not yet provider-verified. `fire-fullapp-dr-photos` does not exist and must **not** be provisioned. Proposed NEW DR and NEW LIVE Workers were absent under their planned names in the selected account search. No deployment or migration was approved.

## Actual source to reuse (do NOT rebuild photo UI)

* `shared/lib/local-photo-vault.ts`: deployment-namespace-isolated iPhone/browser IndexedDB photo storage; local save/restore checks and exact SHA-256 comparisons.
* `shared/lib/offline-photo-backup.ts`: bounded all-photos ZIP export, CRC32 + SHA-256 verification, customer relationship checks; does not encrypt the ZIP.
* `shared/lib/offline-photo-inspection.ts`: owner chooses the **saved file back from Files** and compares archive inventory with current on-device bytes. In-memory ZIP validation alone is not a saved backup.
* `shared/components/offline-customer-photos.tsx`: camera/import, before/after comparisons, on-device-only explanatory text, Save ZIP to Files, Verify saved ZIP, guarded restore. UI already explicitly says **not synced**.
* Hosted `app/api/customer-photos` and `app/api/backup/photos` currently require `env.BUCKET` (R2) and fail closed with HTTP 503 when absent; they have **not** been converted to a free cloud-storage backend. Never claim their hosted photo upload/download/archive works without R2.

## New source-only PR after #243

The DR/NEW LIVE local manifest preparer now explicitly requires `FIRE_RELEASE_PHOTO_STORAGE_MODE=owner-device-zip` and rejects **any** `FIRE_RELEASE_R2_BUCKET` input. It must keep `r2_buckets: []`; the resulting private manifest declares `FIRE_PHOTO_STORAGE_MODE=owner-device-zip`, so no nonexisting R2 binding can be mistaken for a paid subscription dependency. This is a **local, reviewed candidate**, not a hosted setting or owner-authorized live architecture.

The output evidence has `r2Required:false`, `remotePhotoSyncAvailable:false`, `offDeviceZipVerified:false`, `isolatedPhotoRestoreVerified:false` and the production acceptance flags remain FALSE. DR/NEW LIVE auth remains blocked unless separately reviewed and approved, and physical D1 identity and independent numbered schema are still required. No Cloudflare/R2/Stripe network calls occur.

**Local-mode tradeoff:** different phones/computers do NOT automatically share photo bytes. An owner photo library on one device can be lost if browser storage is cleared or the device is lost **unless a separately saved, verified archive survives**. A ZIP in Apple Files/iCloud is not automatically a recoverable backup just because its in-memory bytes were generated. A ZIP saved by the current UI is not password-encrypted; secure owner-controlled custody is required. Never label local-only as hosted multi-device photo parity or restore proof.

## Smallest genuine path forward without spending

1. Keep the already accepted QA/iPhone and GitHub results. Do not repeat the accepted tests. Use PR #243's Job # change as the base and preserve the frozen PR #242 release contract.
2. Verify the existing D1 database's physical UUID by safe owner-visible metadata only when needed to bind the exact future DR target. No D1 migrations, Worker creations, bindings or runtime changes without separate exact approval.
3. Separate **product decision**: the owner can accept local-only photos + owner-controlled protected ZIP backup, or ask for automatic cross-device photo sync. Do not silently substitute them. If automatic sync is required, design and implement a genuinely subscription-free provider with correctness/limits/security proven first; Workers KV free allowance is **not** inherently R2-compatible (eventual consistency, 1 GB account capacity, 25 MiB value and free write quotas) and cannot be substituted without explicit development review.
4. Before Gate 7 acceptance: on a deliberately disposable synthetic device/instance, prove a complete customer records snapshot **and** an independently saved/verified all-photos ZIP; secure off-device custody; restore **both** into a distinct isolated candidate; compare customer IDs, Job #, photo SHA-256, invoice/refund cents and rollback identities. Document what happens for photos missing from either source, old hosted photo records, concurrent tabs, and orphan bytes. No real records or current protected backups are to be overwritten.
5. Before Gate 4/5/10 acceptance: physically verify independent QA/STAGING/DR/NEW LIVE Workers and D1 identities, numbered schema, serving SHA/versions, authentication and QA-master UI/behavioral parity with declared local-photo behavior; obtain explicit owner consent for exact deployments/cutover. Preserve legacy until separately approved retirement.

## Hard NO-GO

This document, any source-only test PASS, and the owner-created empty D1 database do **NOT** authorize subscription, R2, KV creation, Worker deployment, D1 migration, Access change, Stripe, Git merge, production cutover or retiring Sites. **Gates 1,2,3,8 ACCEPTED (4/10). Gates 4,5,6,7,9,10 OPEN; LIVE NO-GO.**
