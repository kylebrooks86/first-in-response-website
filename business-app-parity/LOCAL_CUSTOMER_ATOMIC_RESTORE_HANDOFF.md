# Synthetic local customer atomic restoration

Parent checkpoint: 5aa9f4545b256cdaf435d69cae9ccad56ead0982. Remote development branch was checked before work; no newer commit existed.

`restoreSnapshot(value)` preflights and detaches the customer-only v1 export, then reads and validates current customer/operation history in the same readwrite transaction as all additions. Existing identical entries are retained. Changed customer payloads/revisions/timestamps, reused operation IDs with different payloads, and competing receipts for the same revision reject the entire import. Missing records are added; none are overwritten or deleted. The promise resolves only on native transaction completion. Exact repeated imports and empty imports are no-ops. Conflicting older backups cannot rewind newer edits. This conservative policy intentionally has no force-overwrite option.

Native Chromium IndexedDB: 68/68 checks for each of LIVE, staging and local Doomsday candidates, 204/204 total. Twelve new restore checks per target plus the existing 31 malformed backups now exercise actual restore rejection. Coverage includes explicit native abort after the first customer write, injected quota failure during receipt insertion, retries, preservation of existing records, offline restore, repeated imports, valid customer/operation conflicts, duplicate revision receipts, caller mutation, two-tab serialization and recovery into an empty same-namespace synthetic database. A scratch negative control that resolved before commit failed the interruption test as expected. No production-code test failed.

Three target TypeScript checks/builds and local Doomsday provenance verification passed. Shared-source parity: 120/120 files. Detailed evidence/log hashes are in LOCAL_CUSTOMER_ATOMIC_RESTORE_EVIDENCE.json. Disposable candidates contain synthetic data only; this implementation is not imported by app UI.

Limits: no local access protection, real-record activation, installed offline app shell, Safari/iPhone evidence, physical quota exhaustion, process-crash/power-loss or storage-eviction guarantees. This is customer-only recovery, not estimates/invoices/photos or financial synchronization. V1 keeps every local operation; pruning requires a separately reviewed format. Original navigation reset and app appearance are untouched; whole-screen scroll shaking remains unresolved. No deployment, production DB changes, migrations, Stripe calls or paid operations occurred.

Next bounded batch: define and test local access/recovery requirements before real-record activation, including account identity, locked-device/shared-device behavior, recovery without server access, and fail-closed UI states. Do not activate real data as part of that review. An installed offline shell and iPhone airplane-mode proof remain separate future release work.

Official release readiness stays 3/10 (30%); no production release gate advanced.
