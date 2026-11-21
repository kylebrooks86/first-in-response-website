# Protected synthetic customer backups

Parent b22e51c97fb8ab52da43804b34ebb8ec5e9f89ed was the newest remote checkpoint. Workspace maintenance removed disposable files; re-cloned committed work.

Added inactive protectLocalCustomerBackup / recoverLocalCustomerBackup helpers. Customer v1 export is strictly validated, encrypted with native WebCrypto and a passphrase-derived key, and validated again after decryption. Fresh salt/nonce for each export; fixed version/algorithm authenticated context; nonextractable keys; no account/customer plaintext in envelope. No network calls, database writes or runtime integration. Atomic restore and plaintext export remain unchanged.

Use an independently generated long recovery phrase in eventual UI; minimum length alone does not guarantee strength. Exact phrase is required: no trimming/normalization, no persisted phrase/key, no forgotten-phrase bypass. Keep phrase separately. Current IndexedDB and legacy exports remain plaintext and sensitive. Byte buffers are cleared; JavaScript string/key memory erasure is not promised. This is not local authorization, XSS resistance, encrypted at-rest storage or a full business backup. Limit is 16 MiB plaintext; hex envelope is larger.

Tests: 22/22 native Node WebCrypto checks per target, 66/66 total. Tests cover populated/empty round trips, wrong passphrase, account/target mismatch, tampered salt/IV/ciphertext, malformed/future envelope, duplicate customer records, missing crypto, randomness, caller mutation and record preservation. Three target TypeScript checks/builds and Doomsday local provenance passed; source parity 121/121. Setup failures were resolved in disposable tooling only; details and hashes are in LOCAL_CUSTOMER_PROTECTED_BACKUP_EVIDENCE.json. No app test failed. No dependency/lockfile/hosting changes committed.

Native browser/WebKit/iPhone verification is deferred: browser environment was pruned. These tests do not prove installed airplane-mode launch or IndexedDB recovery integration. Prior IndexedDB tests are preserved at parent, not rerun because that module is unchanged. Real business data remains inactive. Scroll shaking remains unresolved; navigation reset preserved.

Next batch: restore native-browser tooling and test protect -> recover -> atomic restore, including wrong phrase/tampering causing zero writes, offline mode and restart. Local unlock/at-rest protection remain required before real-record activation.

Official readiness 3/10 (30%); no gate advanced. No deployment, migration, remote DB mutation, Stripe call or paid operation.
