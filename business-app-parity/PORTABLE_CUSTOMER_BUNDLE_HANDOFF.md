# Portable encrypted customer bundle — candidate checkpoint

The isolated candidates can now export a portable encrypted bundle containing the saved customer snapshot, original unsaved-draft resolution archives, revision history and operation receipts. Export reads one consistent IndexedDB transaction and rejects unknown or malformed sealed rows instead of silently omitting them. Account and target namespaces and archive/receipt inventories are validated after actual decryption. Existing normal backup APIs and formats remain unchanged; the portable format is distinct and future controls must dispatch formats explicitly rather than reinterpret a normal backup as an archive-complete bundle.

Recovery validates and encrypts all rows before one actual IndexedDB readwrite transaction. Its occupancy cursor and add-only writes share that transaction: any destination row, including an orphan archive or unknown row, blocks recovery. Failures abort all writes; no put, deletion, retry, merge or overwrite occurs. A successful recovery remains locked. Read-only destination inspection is advisory and never authorizes bypassing the transactional occupancy check.

The attached FIRE_Backup_Handoff_Validated_2026-10-13 ZIP supplied a useful defensive transaction pattern, not proven integrated crypto or native-browser acceptance. Its README disclosed unsuccessful native test execution. The existing FIRE architecture and encryption functions were retained; the integrated implementation was tested independently on disposable synthetic browser databases. Limits are 1,000 resolution archives, 16 MiB bundle plaintext and 32 MiB aggregate source ciphertext hex; oversized exports fail rather than truncate.

## Verification

Across LIVE, Doomsday and staging isolated candidates: 78/78 portable browser checks, 174/174 encrypted-vault browser checks, 60/60 authenticated framework checks (312/312 browser total); 66/66 original backup crypto checks; 207/207 synthetic SQLite financial regressions; 3/3 full builds and 3/3 TypeScript checks. Shared source parity passed 131/131 with zero differences. Final failures: zero. Exact per-target results and source hashes are in PORTABLE_CUSTOMER_BUNDLE_EVIDENCE.json.

Portable checks use real WebCrypto and native Chromium IndexedDB. They cover file verification after browser restart, saved snapshot and original draft re-export after empty-destination recovery, wrong phrase, corruption, incorrect account/target, malformed manifests/receipts, occupied and archive-only destinations, competing recovery/initialization writes, synchronous quota failure, asynchronous key collisions, lock interruption and unknown source rows. These are disposable synthetic recovery tests; no iPhone or iPad recovery was attempted.

## Remaining boundary and next batch

The bundle and atomic recovery foundation are verified locally. Owner-facing export/download/verify/recovery controls and repository/controller authorization, lifecycle and failure-state integration are still unfinished. Deliberate resolution-save UI remains disabled until the entire integrated workflow is verified. Next bounded batch: connect candidate-only portable backup controls with explicit owner confirmation and test authentication, lock transitions and failure handling before considering resolution-save activation. No deployed, Safari or installed Home Screen recovery acceptance is claimed.

Subsequent approved priorities: audit the smallest safe customer/property relationship changes while preserving historical estimate/invoice service addresses; protect unfinished estimates and edits; distinguish Prepared from owner-confirmed Sent; improve actual-contact follow-up timing; clarify multiple active jobs and contextual actions; validate the existing full customer-to-payment workflow. No production migration is authorized.

LIVE, Doomsday, refund staging, original Home Screen apps, FIRE Calculator, production records, Stripe and paid services were untouched. Existing iPhone Revision 3 and iPad Revision 1 synthetic vaults and original backup were untouched. Prior isolated-candidate bottom shaking remains tracked; the owner reports installed LIVE and login-required Doomsday scroll smoothly. No speculative CSS changes were made.

Official full Business App release readiness remains **30% (3/10 gates)**. Candidate tests and source parity do not establish deployed parity or increase release readiness.
