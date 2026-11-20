# FIRE Business App — no-paid owner backup and recovery procedure

**Status: source-only operating procedure; NOT a newly scheduled service, new backup, or proof that all future files are recoverable.** The existing QA original three-photo + SQL recovery was already verified and credited under G7-02 to G7-07 on November 18, 2026 (see [Issue #19](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-6995298074)). Do not repeat accepted owner tests or Cloudflare sign-ins.

## Scope and non-negotiable boundaries

- The functional master is **NEW QA**, and all eventual QA/STAGING/DR/NEW LIVE code must match it. Environment databases, credentials and recovery archives remain independent; newly launched LIVE first real Job **#0001** is reserved.
- Photos currently rely on **per-device local IndexedDB** plus an **owner-exported protected `.firephotos` archive**. They do **not** automatically sync iPhone ↔ Acer or across Workers. Source/header checks cannot invent hosted file recovery or cross-device sync.
- SQL/D1 records and device-photo archives are a *pair*; neither one alone is a full backup. They must be collected from the **same logical capture window**, with owner confirmation of no intervening edits, and then individually authenticated and customer/photo IDs reconciled.
- No paid Cloudflare, R2 subscription, free-allowance subscription activation, silent provider signup or unapproved cloud storage. No automatic Cloudflare export, SQL migration, owner login, deployment, Stripe payment, DNS/Access change, or production restore.
- Keep all raw SQL, private local receipts, unencrypted originals, encryption phrases and actual archive contents **outside GitHub and public/shared drives**. Never send passwords/secret values to ChatGPT. A password protected 7z records archive and protected `.firephotos` are distinct formats/keys; store both keys in a separately protected owner-managed location.

## Owner-operable cadence — applies only after approved app activation/real customer use

| Trigger | Owner action | Verification |
|---|---|---|
| **After each day with added/changed customers, payment/estimate/schedule or photos** | Take a new complete **target-bound records export** *if separately approved* and a current **all-photo export from each device used**. Pair by target, device and capture window | Original SQL export/receipt SHA, entire encrypted photo archive authentication and each original photo SHA, customer-link pairing; no writes during capture |
| **Weekly when active** | Confirm that the latest encrypted records+photo pairs are safely held **outside the source device** with independent revision/retention, keys available, and no missing device | Re-download sample/read-only SHA for a NEW changed archive only when justified; do not retest unchanged accepted November 18 evidence |
| **Before any separately authorized update, migration or cutover** | Freeze target identity and a new approved backup pair; capture exact code/version/binding/rollback identity | Explicit owner scope, reviewed source SHA, no secret disclosures; never treat a listed Ready version as executed rollback |
| **Monthly after active use, or after a material backup/restore code change** | Perform a **separately approved isolated** paired restore into a fresh, nonproduction target; never restore into LIVE | Reopen both restored records and original photo bytes, verify full financial/refund/customer/Job # history and all saved SHA-256 hashes |

**During the current prelaunch:** no routine user actions are needed merely because this cadence is documented. The accepted November 18 QA sample is preserved. Future schedules/triggers should be adopted and run only when the app is approved for operational use; this file does not create an automation or scheduled task.

## Read-only owner check (source tool, not a backup/export)

From a separate reviewed GitHub working tree on the Acer, run the checked-in `business-app-parity/release/owner_backup_cadence_review.ps1` with **explicit input files**, never a guessed "latest" archive. The following is an example pointing to the *already accepted* 2026-11-18 QA pair; it is not a request to rerun it:

```powershell
$root = "$HOME\FIRE-G7-Restore-Tools"
& "$root\business-app-parity\release\owner_backup_cadence_review.ps1" `
  -SqlFile "$HOME\FIRE-Private-Backups\FIRE-QA-CURRENT25-20261118-133708.sql" `
  -PhotosFile "$HOME\Downloads\FIRE-all-photos-2026-11-18.firephotos 2" `
  -ExpectedD1Uuid "8ccfb1f8-1657-4074-b1b2-47de78f95003"
```

This command performs **local read-only** checks: exact SQL+restore-receipt hash and target UUID, and bounds/structure of the encrypted photo file header. It reports **local Windows file age only**, NOT authenticated backup capture age. An OLD archive copied or downloaded today can look newly modified; therefore recent file times emit `CADENCE=CAPTURE_AGE_UNVERIFIED` (never a misleading "within window" approval). Old local file times conservatively emit `CADENCE=REVIEW_NEW_BACKUP_DUE`. `AUTHENTIC_BACKUP_CAPTURE_AGE_VERIFIED=NO` always remains explicit until a future full authenticated archive/snapshot validation. It **cannot** decrypt photos, verify photo/customer relationships, prove off-device custody or certify an atomic cross-device snapshot. It never exports or modifies D1, photos or app files. Header PASS is not Gate 7 acceptance. Do not confuse it with the independently successful November 18 saved-file full restore.

## Full isolated recovery (on separately authorized scope)

1. Identify approved target D1, worker/version, exact SQL export + matching restore receipt, and **every** saved photo archive/device for the same logical period. Preserve prior backups immutably. Stop if physical target or date lineage is unknown.
2. Reuse the established verified pair and protected archive procedures. On the Acer, the current accepted QA25 pairing tool verifies real SQL + photo customer links; the [actual G7-07 recovery helper](../restore_qa25_photo_pair_isolated.py) authenticates protected original bytes and only creates a **new local private** folder; it refuses overwritten destinations and emits `ISOLATED_RESTORE_PASS` only after reopening/rechecking every saved original. The November 18 owner original sample did this successfully for three customer-associated photos (no job-level links existed in the archived metadata).
3. For **future 26-migration DR/NEW LIVE records**, use the separately reviewed encrypted `.firerecords` and independent D1 journal/serial restore path. Never substitute the historic 25-migration QA25 procedure for a 26-step target; no automatic migration replay or remote D1 write.
4. Before any production rollback restore: obtain distinct exact owner approval for the target, code version, database/photo destinations, data-loss window and routing. Take a new approved nonproduction backup and test the complete rollback. Refuse cross-target UUIDs, incomplete journals, missing photo bytes, leaked keys or any unverified money/Job # effects. Retain old Sites until separate retirement approval.
5. Preserve sanitized completion metadata only (counts, checked IDs/flags, version identifiers and retained private owner hashes) in [Issue #19](https://github.com/kylebrooks86/first-in-response-website/issues/19). **Do not** attach original SQL/photos, plaintext restored images, private customer IDs or passwords.

## Gate interpretation

The 2026-11-18 owner proof closed **atomic checklist G7-07**. This runbook and cadence checker contribute **source preparation** for G7-10 but **DO NOT** close full G7-10 / formal Gate 7: approved hosted export, complete future-data owner custody, all-environment original-photo parity and explicitly authorized code+DB+photo rollback drill remain outstanding. Current formal accepted release gates: G1/G2/G3/G8 (4/10). NEW LIVE remains DARK, NO-GO.
