# Guarded customer resolution foundation

Base checkpoint: `2ed5744dd043b6f2be212376689876c5ea03a2a9`.

## Completed foundation

An unlocked vault session exposes deliberate `saveReviewedResolution` and read-only `inspectResolutionArchive` methods. No repository/controller/route or UI save action invokes the new method. Existing proposal controls remain read-only and production activation remains off.

A strict resolution archive binds the original draft, original expected revision, complete reviewed customer/operation snapshot, chosen input, operation ID and account/target namespace. Original and chosen customer IDs must match. The existing PBKDF2/AES-GCM engine now has a private validated-payload core; ordinary customer backup behavior and envelope parameters remain unchanged. A distinct authenticated plaintext format prevents resolution archives from being accepted as normal customer backups.

The deliberate save decrypts current storage and requires the reviewed content to match. It rejects reused operation IDs and invalid metadata. It appends exactly one chosen customer revision and operation receipt, preserving prior customer/operation history. It separately encrypts the original draft and review context. One native IndexedDB readwrite transaction compares the exact encrypted snapshot identity, adds the retained resolution archive, and writes the replacement snapshot. Any intervening write, archive quota failure, snapshot write failure or transaction abort rejects without partial commit. Lock invalidation interrupts publication and aborts pending transactions as before. No retry is automatic.

## Verification

Final suite counts/hashes are in `GUARDED_CUSTOMER_RESOLUTION_EVIDENCE.json`. Native Chromium tests prove both encrypted rows commit together, no plaintext contact data appears in storage rows, original draft/history survives browser restart, incorrect phrase and wrong account fail closed, normal backup decoding rejects resolution content, duplicate/stale proposals do not write, quota/write/abort failures roll back both changes, an actual competing session update during encryption is rejected by the transaction comparison, invalid draft metadata is rejected and lock prevents archive disclosure/commit.

The concurrency test uses a controlled WebCrypto callback to commit a second native session write before the resolution transaction begins. The winning second-session state is retained; no losing resolution archive/receipt appears. This is synthetic local proof, not evidence about a physical device incident.

Existing backup format, vault lifecycle, actual Vite/workerd candidate UI, TypeScript, full builds and financial regressions also pass. Framework fixtures use separate synthetic authentication adapters and disposable local D1 profiles. Shared application source and the new test script match across candidates. No physical Safari, real provider authentication, deployed parity or complete offline release gate is claimed.

## Release blocker and next batch

The current normal customer backup export does NOT include the auxiliary resolution archive rows. The new foundation therefore remains unconnected to the save UI. Portable backup/recovery support for these archives, plus repository/controller failure-state integration and explicit save confirmation, must be verified before activation. Do not claim the original draft archives are protected by the existing owner-held backup. Existing backup files and their format were not rewritten.

Next bounded batch: design and test a portable encrypted bundle that preserves both the current customer snapshot and original resolution archives, rejects mismatched accounts/targets and never overwrites an occupied destination. Then integrate deliberate saving only after that durability path is reviewed.

No deployment, production database/Stripe access, paid service, device recovery, reset, storage clearing or original Home Screen change occurred. iPhone Revision 3, iPad Revision 1, encrypted backup and FIRE Calculator remain untouched. Bottom-of-screen shaking remains UNRESOLVED and no CSS changed.

Official full Business App release readiness remains **30% (3/10 gates)**.
