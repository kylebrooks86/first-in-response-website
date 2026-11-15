# FIRE NEW LIVE — private postlock evidence custody (SOURCE ONLY)

Separate source branch derived from exact frozen PR270 SHA 9fcffa883284ca7eb50684ba833ab4475130971b; this branch is NOT a merge or deployment.

## Already accepted physical milestone
Owner Acer finished the single approved postlock 26/26 NEW LIVE D1 migration and its guarded physical readback on November 14, 2026. Exact marker: FIRE_NEW_LIVE_SEPARATELY_AUTHORIZED_POSTLOCK_SCHEMA_MATCH_26_OF_26_NO_DEPLOY. Physical DB: fire-fullapp-new-live-db, 0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662. First future Job #0001 verified clean. Do not rerun any migration or delete attempt locks. DR 26/26 was previously accepted and is not repeated.

## Newly implemented code (not yet owner-executed)
- owner_new_live_postlock_encrypted_custody.mjs reads ONLY the already accepted original owner attempt lock, new postlock recovery attempt lock and new postlock recovery physical receipt; strictly checks exact target, both locks' SHA-256 provenance, 26 verified migrations, financial/numbering readback, and no false hosted or release claims. Creates a private AES-256-GCM encrypted, PBKDF2-SHA256 600000-round, fresh salt/IV .fireliveproof with exclusive no-overwrite. It independently reopens and authenticates every original byte on disk; owner passphrase input is hidden, never supplied on CLI; the default backup and verify paths never extract plaintext. Disaster-only restore authenticates all bytes before writing into an exclusively new private folder without overwriting original locks or contacting providers.
- test_live_postlock_custody.mjs: 32/32 focused OFFLINE synthetic checks passed including corrupted/truncated ciphertext, wrong passphrase, wrong D1, missing/duplicate files, broken original-to-recovery lock binding, forged physical success, job #0002 and false Gate/Worker readiness.
- Source code exact Git blob 2f368d4ac68907e685c88d05fa871299198a33d1; implementation SHA256 9fe164eb35b33a3601fb763d223d86681238a12139b156ee9ccdba2e64acce5d; test exact Git blob ad78622860d33a1ec2ba46e5b2db50ff2d116e18. Both GitHub blobs were independently read back and matched locally targeted-tested files.

## Owner-side action remaining, no repetition of accepted tests
From owner interactive Acer PowerShell, after saving exact implementation to Downloads:
node "$HOME\Downloads\FIRE_NEW_LIVE_POSTLOCK_PRIVATE_BACKUP.mjs" backup "$HOME\Downloads\FIRE_NEW_LIVE_POSTLOCK_26_OF_26.fireliveproof"
Enter a private >=16-character passphrase twice; never share the passphrase. Save ONLY the encrypted .fireliveproof to existing owner-private Google Drive FIRE Business App Backups using Chrome; re-download and compare SHA256 to confirm off-Acer bytes. Do NOT upload original unencrypted receipt/locks to public GitHub.

Boundary: source and synthetic tests complete; actual Acer evidence has NOT been encrypted/copied off-device here. This is NOT complete Gate7, NEW LIVE Worker deployment, Gate5 acceptance, Stripe TEST proof, or production release. Formal release 4/10 gates accepted, LIVE NO-GO. Original PR270 SHA and its accepted CI preserved.

Disaster-only readback after a failure (no hosted operations): node owner_new_live_postlock_encrypted_custody.mjs restore EXISTING.fireliveproof NEW_EMPTY_PRIVATE_FOLDER. Restored files are sensitive plaintext copies and must never be inserted into the original owner working directory in place of the accepted immutable locks.
