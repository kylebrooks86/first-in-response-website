# Synthetic iPhone checkpoint and safe recovery

As of 2026-10-10. Full Business App readiness remains **3/10 (30%)**.

Kyle reports 13/13 successful real-iPhone checks: deployment, separate Home Screen installation, unlock, Revision 1→2 save/relaunch, airplane-mode cold launch/unlock, Revision 2→3 offline save/relaunch, offline encrypted export to Files, and offline verification of the actual saved Revision 3 backup. These are owner-reported device passes, not automated or independently witnessed iPhone tests. Individual results are in SYNTHETIC_IPHONE_OWNER_QA_EVIDENCE.json. Earlier documents remain historical evidence; this checkpoint supersedes their unverified statuses for these owner-reported tests only.

Expected published source: `5279d071ec8651c0ba5e963b4aa0d3bb4c84ccc7`; shell `b9cbe0f7beff59d57f092c55`. The current development checkpoint includes subsequent documentation without changing this source package. Independent public-response hashes are recorded separately; they do not prove the installed device worker identity or account billing/bindings.

The occasional locked screen matches the intended hidden/pagehide/five-minute-idle revocation policy. Unlock again; retained records are expected. No change to locking is proposed.

## Safest next device test

1. Keep your successful Revision 3 Home Screen app and backup. Do not uninstall, clear website data, reset the vault, or edit that app to prepare recovery. Keep the disposable backup phrase privately; do not send it in chat.
2. Use a second unused iPhone/iPad that has never initialized this demo, at **https://fire-synthetic-offline-test-bfc00939.pages.dev/synthetic-customer-demo/**. Install a separate FIRE Recovery Test icon and open it online until **Offline shell ready**. **Do not tap Unlock:** on an empty vault it seeds Revision 1, which would block restoration. A new icon or Safari tab on the original phone is not proof of separate empty storage. If no unused device is available, stop here; recovery remains pending safely.
3. Transfer a copy of the encrypted Revision 3 JSON privately to that device (for example AirDrop), save locally in Files, and retain the original copy. Keep the phrase separately. Confirm the target file is downloaded, not an iCloud placeholder.
4. On the recovery device, turn Airplane Mode ON and Wi-Fi OFF. Open the recovery icon offline. Under **Saved encrypted JSON file**, select the transferred file, enter its backup phrase, and tap **Verify saved file without changes**. Expect revision 3. Verification does not create a vault.
5. Reselect/re-enter as needed; check **I intend recovery into an empty synthetic vault**, then tap **Recover only if vault is empty**. Expect **Recovered into an empty synthetic vault. Unlock above to inspect saved records. Nothing was replayed.** Keep the app foreground while recovery completes.
6. Only now unlock using the same backup phrase. Confirm the synthetic customer is Revision 3. Force-close and reopen while still offline; unlock and confirm Revision 3 again.
7. On this recovered target only, reselect the backup, enter the phrase, check the confirmation and try recovery again. Expect **Recovery failed or vault already exists. Existing records preserved; unlock and inspect before retrying.** Unlock and confirm unchanged Revision 3. Do not clear anything to retry.
8. On the recovered target, verify the file with a deliberately wrong phrase. Expect verification failure; unlock with the correct phrase and confirm Revision 3 remains. Recheck that the original device still has Revision 3. Record device/iOS version, displayed shell version, network state, messages and Files-picker/lock behavior, with no phrase in screenshots.

If Files selection backgrounds/locks the app and clears controls, return to the foreground, reselect the local file and re-enter the phrase. Do not tap Unlock on the empty target. If controls repeatedly clear, recovery fails, or the target already has a vault, stop and report the exact message; leave both devices and files intact. A generic recovery failure does not distinguish bad phrase from an existing vault. Successful atomic insertion is what confirms the target was empty at commit time.

## Acceptance and limits

The synthetic offline-launch/persistence and export/actual-file verification milestones have owner-reported device passes. End-to-end recoverability still requires steps 5–7 on the fresh device, plus retained recovered data. Wrong-phrase and background behavior are focused device safeguards; malformed/tampered/foreign archives and interrupted atomic writes already have browser evidence and are not being rerun unchanged. No intentional OS interruption is requested against the only working copy.

Review confirmed namespace/schema/fixed synthetic fields, a 2 MiB file cap, explicit recovery confirmation, encryption before transaction, atomic IndexedDB `add` rather than `put`, and lock/epoch cancellation. Restoration performs no server sync or remote operation replay. This is customer-only synthetic recovery, not the full Business App or a permanent storage durability guarantee. Account quota/billing/bindings, direct certificate-chain inspection, installed worker identity and scrolling parity remain separate checks.

Next development batch: a shared customer repository boundary for the existing Customers UI, preserving its presentation and the default online adapter, with a synthetic-only local adapter in all three isolated candidates. First map create/edit/list and linked estimate/invoice/payment dependencies; do not route financial records into the customer-only vault or activate offline mode on deployed apps. Run relevant adapter/revision/lock tests and source parity only for changed behavior. The separate scrolling diagnostic plan is in SCROLL_SHAKING_FOCUSED_NEXT_BATCH.md.
