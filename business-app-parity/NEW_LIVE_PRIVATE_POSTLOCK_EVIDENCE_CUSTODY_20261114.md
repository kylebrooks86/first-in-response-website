# FIRE NEW LIVE — private postlock evidence custody (SOURCE ONLY)

Separate source branch derived from exact frozen PR270 SHA 9fcffa883284ca7eb50684ba833ab4475130971b; this branch is NOT a merge or deployment.

## Already accepted physical milestone
Owner Acer finished the single approved postlock 26/26 NEW LIVE D1 migration and its guarded physical readback on November 14, 2026. Exact marker: FIRE_NEW_LIVE_SEPARATELY_AUTHORIZED_POSTLOCK_SCHEMA_MATCH_26_OF_26_NO_DEPLOY. Physical DB: fire-fullapp-new-live-db, 0f4d1c4a-9fbb-4b3d-85c1-2f43f82a3662. First future Job #0001 verified clean. Do not rerun any migration or delete attempt locks. DR 26/26 was previously accepted and is not repeated.

## Newly implemented code (not yet owner-executed)
- owner_new_live_postlock_encrypted_custody.mjs reads ONLY the already accepted original owner attempt lock, new postlock recovery attempt lock and new postlock recovery physical receipt; strictly checks exact target, both locks' SHA-256 provenance, 26 verified migrations, financial/numbering readback, and no false hosted or release claims. Creates a private AES-256-GCM encrypted, PBKDF2-SHA256 600000-round, fresh salt/IV .fireliveproof with exclusive no-overwrite. It independently reopens and authenticates every original byte on disk; owner passphrase input is hidden, never supplied on CLI; no plaintext extraction, provider calls, uploads, migrations, Git changes, or remote actions.
- test_live_postlock_custody.mjs: 27/27 focused OFFLINE synthetic checks passed including corrupted/truncated ciphertext, wrong passphrase, wrong D1, missing/duplicate files, broken original-to-recovery lock binding, forged physical success, job #0002 and false Gate/Worker readiness.
- Source code exact Git blob c29a29d8db5289751934bee2e9cdc666df0bdd6d; implementation SHA256 d34123aecc42ac03332a4d0eee89e9690d3057cfc3a32c1e3ea0576d76c600cf; test exact Git blob 53c91b6c4a0a2bc8e73231961ff863bd7f965c1b. Both GitHub blobs were independently read back and matched locally targeted-tested files.

## Owner-side action remaining, no repetition of accepted tests
From owner interactive Acer PowerShell, after saving exact implementation to Downloads:
node "$HOME\Downloads\FIRE_NEW_LIVE_POSTLOCK_PRIVATE_BACKUP.mjs" backup "$HOME\Downloads\FIRE_NEW_LIVE_POSTLOCK_26_OF_26.fireliveproof"
Enter a private >=16-character passphrase twice; never share the passphrase. Save ONLY the encrypted .fireliveproof to existing owner-private Google Drive FIRE Business App Backups using Chrome; re-download and compare SHA256 to confirm off-Acer bytes. Do NOT upload original unencrypted receipt/locks to public GitHub.

Boundary: source and synthetic tests complete; actual Acer evidence has NOT been encrypted/copied off-device here. This is NOT complete Gate7, NEW LIVE Worker deployment, Gate5 acceptance, Stripe TEST proof, or production release. Formal release 4/10 gates accepted, LIVE NO-GO. Original PR270 SHA and its accepted CI preserved.
