> **COMPLETED — OWNER PRIVATE DR EVIDENCE SAVED OFF-ACER IN GOOGLE DRIVE, NOV 13/14. DO NOT RUN THE BACKUP COMMAND AGAIN.** Exact PR265 source `53632eb8c07feb8d0182cbf999399aa8eb1dc158`. Owner Acer printed `FIRE DR PRIVATE EVIDENCE BACKUP: 32/32 FILES ENCRYPTED, SAVED AND REOPENED.` Owner subsequently uploaded `FIRE-DR-PHYSICAL-RECEIPTS-20261114.firedrproof` using Chrome. Connected Google Drive listing **and separate metadata readback** verified the exact encrypted filename, **18,268-byte** non-native `application/octet-stream` file, correct private `FIRE Business App Backups` folder, `shared:false`, owner-only permission. The earlier 242/242 compiled DR ZIP remains stored privately there too. This is off-device custody of the already accepted physical DR records, **not** an independent decryption/restore of the Google-Drive-hosted copy, live customer/photo recovery, a Cloudflare Worker deployment or any release-gate acceptance. The private passphrase is NOT held by GitHub/ChatGPT. No new Acer commands, screenshots, migration, or QA needed for this step. The historical commands below are retained for audit **ONLY**.\n\n# FIRE — Protect the completed DR physical release receipts beyond the Acer (NEW, NOT a QA retest)

**November 13/14 2026.** The real 26/26 DR D1 migrations and physical readback, and then the corrected 242/242 compiled Worker → original migration receipt bridge, are **COMPLETED AND ACCEPTED**. Never repeat either previously successful PowerShell command. This document is a distinct OFFLINE owner backup action, only if/when desired, before Acer disk failure.

**Delivered reviewable source:** [DRAFT PR #265](https://github.com/kylebrooks86/first-in-response-website/pull/265), stacked on pristine main-based PR264 SHA `be2166cbf5b3b20fb1a33fc8bbf53dfc7f555db3`. Exact reviewed evidence backup source SHA: `53632eb8c07feb8d0182cbf999399aa8eb1dc158`. [GitHub focused workflow run](https://github.com/kylebrooks86/first-in-response-website/actions/runs/43559711910) **SUCCESS**, including 32-file cryptographic corruption, missing evidence/wrong DR UUID/SQL, actual 26 immutable Git SHA-pinned D1 SQL bytes plus independent restore tests. The inherited public-site+calculator main-only scope workflow is **intentionally restricted to base=main** and does not apply to stacked PR265; its explicit baseline restriction must NOT be weakened. Main-based PR264 had accepted 15/15 exact-source checks and unchanged website/calculator blobs. No new iPhone, Chrome or provider QA was run.

## Exactly what is backed up

The existing owner-local folder `%USERPROFILE%\FIRE-DR-APPROVED-MIGRATION-20261113` holds the original prior remote migration one-shot attempt and independently physical DR 26-migration readback JSON and the saved canonical 26 SQL file workspace. Existing separate `%USERPROFILE%\FIRE-DR-INERT-REVIEW-be2166c\dr-compiled-physical-postinstall-reviewed.json` binds the 242/242 compiled Worker to the **real prior** DR physical schema receipt. The new CLI copies **32 exact reviewed files** into an authenticated password-protected `.firedrproof` object. The owner holds the passphrase, not ChatGPT/GitHub/Drive; no plaintext intermediate ZIP, no Cloudflare, no D1, Stripe or Worker operations. It does NOT back up real future app customers/photos or serve the Worker.

## Owner Acer — only one new command, NOT the old ones

Keep your already accepted old receipt folders untouched. Copy this entire new PowerShell block into Acer's PowerShell. It uses a NEW detached worktree and NEW output ZIP-like encrypted filename, cannot overwrite either previous reviewed worktree or original migrations. It asks you privately for a **recovery passphrase at least 16 characters**, and asks again to confirm; do not send this passphrase to ChatGPT, GitHub, or anyone else.

```powershell
& {
  $ErrorActionPreference = 'Stop'
  $sha = '53632eb8c07feb8d0182cbf999399aa8eb1dc158'
  $repo = Join-Path $env:USERPROFILE 'FIREQA-PR172'
  $work = Join-Path $env:USERPROFILE 'FIRE-DR-EVIDENCE-BACKUP-53632eb8'
  $backup = Join-Path $env:USERPROFILE 'Downloads\FIRE-DR-PHYSICAL-RECEIPTS-20261114.firedrproof'
  if (!(Test-Path -LiteralPath $repo)) { throw 'Existing FIRE source repo missing; STOP.' }
  foreach ($path in @($work,$backup)) {
    if (Test-Path -LiteralPath $path) { throw "Existing new backup output; preserve and STOP: $path" }
  }
  & git -C $repo fetch --no-tags origin work/fire-dr-private-acer-receipt-backup-20261114
  if ($LASTEXITCODE -ne 0) { throw 'Git fetch failed; STOP.' }
  & git -C $repo cat-file -e "$sha^{commit}"
  if ($LASTEXITCODE -ne 0) { throw 'Exact source commit missing; STOP.' }
  & git -C $repo worktree add --detach $work $sha
  if ($LASTEXITCODE -ne 0) { throw 'Separate source worktree failed; STOP.' }
  $actual = (& git -C $work rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $actual -ne $sha) { throw 'Source commit mismatch; STOP.' }
  & node (Join-Path $work 'business-app-parity\owner_dr_offdevice_receipt_backup.mjs') backup $backup
  if ($LASTEXITCODE -ne 0) { throw 'Protected owner evidence backup failed; STOP.' }
  Write-Host 'FIRE COMPLETED DR EVIDENCE: ENCRYPTED OWNER BACKUP CREATED, ORIGINALS UNCHANGED.'
  Write-Host 'Now upload ONLY the .firedrproof file to private FIRE Business App Backups in Google Drive.'
}
```

**Immediately after successful command:** In Chrome open the existing owner-private FIRE Business App Backups folder (already used for the verified 242-file Worker ZIP), click **New → File upload**, select **Downloads/FIRE-DR-PHYSICAL-RECEIPTS-20261114.firedrproof**. Do not upload the original unencrypted JSON/SQL folders, expose private receipts, or send the passphrase. The backup file can then be confirmed via connected Google Drive metadata. Keep the passphrase in a safe private place separate from the laptop; without it, no DR receipt decryption is possible.

**On a replacement computer:** GitHub holds the open DRAFT source; download the saved encrypted file from private Drive and run the same exact reviewed CLI's `verify` or `restore` to a **NEW EMPTY PRIVATE DIRECTORY**, using the owner phrase. Restored JSON/SQL becomes plaintext and must remain private. Never run restored SQL as an excuse to replay the already complete physical DR migration.

## Status boundary

Historical pre-completion instruction (now superseded): off-device upload was pending. Owner has since completed the encrypted 32/32 Acer backup and private Google Drive upload, both recorded above. Connected ChatGPT tools cannot access Acer disk or attest to re-decryption of the Drive copy. No subscribed R2/paid service. Hosted DR Worker upload, auth and Access acceptance, actual independent future customer/photo restore, NEW LIVE migration, signed Stripe TEST and release seals remain open. Gates G1/G2/G3/G8 accepted 4/10, others OPEN; NEW LIVE NO-GO. **No consent to cloud upload/deploy/migrate/merge/Stripe or legacy removal.**
