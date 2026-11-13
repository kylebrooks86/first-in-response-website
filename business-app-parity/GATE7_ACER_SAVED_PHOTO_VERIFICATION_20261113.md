# FIRE Gate 7 — Independent Acer check of a saved protected photo backup

**Scope:** This is a new, source-only, read-only capability in the draft branch after PR #245. It does **not** require another Cloudflare Work login, any R2 subscription, new Worker, D1 mutation, deployment, or real customer/photo test. Preserve all previously accepted QA/iPhone/Acer checks.

## What genuinely changes

The QA-master candidate can produce passphrase-encrypted `.firephotos` files in the photo gallery. A **separate** Node 22 program now accepts an actual saved file from Acer's local filesystem, authenticates all AES-GCM chunks, checks the exact original FIRE ZIP directory, validates the CRC32 of each stored entry and SHA-256 of each photo, and emits a read-only receipt containing the encrypted file SHA-256, the verified decrypted ZIP SHA-256 and integer photo/customer counts. **Decrypted bytes never go to disk** and filenames, IDs, passphrases, or photos are never printed. The program cannot restore or change database records.

No software can prove a file was saved to a *physically independent* device merely from a local filename; the flags for off-device custody, complete D1 records match, isolated full restore, provider isolation, hosted photo sync, release authorization and Gate 7 remain **false**.

## Safe Windows Acer command when a real protected archive exists

Use only a backup file the owner intentionally saved independently. The current hosted QA does **not** automatically include this unmerged encrypted feature; do **not** repeat old accepted iPhone checks or pretend to have a new protected file yet.

From a checked-out, exact reviewed source branch with **Node 22+**, open PowerShell in the repository directory, use a known actual saved-file path:

```powershell
$secured = Read-Host "Private photo-backup recovery phrase" -AsSecureString
$plain = [System.Net.NetworkCredential]::new("", $secured).Password
$plain | node .\business-app-parity\verify_saved_protected_photo_backup.mjs "C:\path\to\the\saved\FIRE-all-photos-YYYY-MM-DD.firephotos"
Remove-Variable plain,secured
```

- The passphrase is entered into a non-echoing Windows secure prompt; **do not** put it on the command line, in chat/GitHub, a script file, or shell history. Do not share the private archive.
- The command does not call Cloudflare, Stripe, Wrangler, GitHub APIs, D1, R2, or another storage service. Its file system access is **read-only**. It never exports decrypted photo bytes.
- A wrong phrase, truncated/corrupt archive, modified photo hash, unsafe ZIP path, or incomplete manifest returns nonzero with no success receipt.
- A successful result means only that the saved encrypted file can be read and validated **on that Acer**. It is **not yet a complete D1 backup**, proof of loss-resistant separate custody, or an isolated restore. No Gate 7 promotion from this command alone.

## Next genuine acceptance steps

1. Only after source is separately approved/deployed: save an encrypted complete all-photos file under private control, outside the originating browser/device, and re-open it independently on Acer.
2. Obtain a separate complete, version-locked D1/numbered-records export from the **right independent** DR/NEW LIVE database; verify complete table/ledger/high-water coverage, independent DB UUID, and customer IDs. Use existing numbered photo-pair fingerprint and isolated-memory recovery modules; don't invent successful physical evidence from synthetic tests.
3. Restore exact protected files + records into a disposable, isolated approved target, comparing photo SHA-256, Job #, all invoice/refund cents and IDs; preserve existing QA/LIVE assets. Physical target writes require fresh exact authorization.

**Formal release status: accepted gates 1,2,3,8 (4/10). G4, G5, G6, G7, G9 and G10 OPEN. LIVE NO-GO.** No subscription or remote changes permitted by this runbook.

## Additional saved-records AND photo pair audit — future, not a repeat request now

The combined review branch adds `verify_saved_numbered_photo_pair.mjs`. When an independently approved and exported **complete** `fire-numbered-core-records-snapshot` v2 JSON and an owner-saved `.firephotos` file actually exist, it can inspect **both original files from disk** on the Acer, verify all customer/Job #/payment/refund/identity relationships and exact photo SHA-256 bytes, then calculate one records/photo pair digest. It does **not** create a snapshot or perform a restore.

From the same reviewed source checkout, with PowerShell and Node 22+:

```powershell
$secured = Read-Host "Private photo-backup recovery phrase" -AsSecureString
$plain = [System.Net.NetworkCredential]::new("", $secured).Password
$plain | node .\business-app-parity\verify_saved_numbered_photo_pair.mjs "C:\path\to\verified-numbered-records-v2.json" "C:\path\to\saved\FIRE-all-photos.firephotos"
Remove-Variable plain,secured
```

**Do not run it yet solely to repeat tests.** The protected feature and this auditor remain draft source; a real paired export and authorized deployment are still missing. Only a true provider-bound snapshot, independent protected custody and separately approved isolated D1+photos restore can satisfy physical Gate 7. The CLI deliberately reports those proof flags as `false` even when both local files match. No screenshot or private files need to be shared in GitHub.
