# FIRE Demo iPhone test — after approved publication

Proposed URL (NOT yet active/reserved): https://fire-synthetic-offline-test-bfc00939.pages.dev/synthetic-customer-demo/
No publication authorized. Exact destination/valid TLS/headers must pass the separate publication review first. Official readiness: 3/10 (30%).

1. Online, open the approved exact URL in Safari. Share → Add to Home Screen → turn ON Open as Web App → Add. Name it FIRE Demo; keep your existing Business App icon.
2. Open that new Home Screen icon while still online. Wait for Offline shell ready. Initialize the synthetic vault with a disposable phrase of at least 16 characters. Keep that phrase privately; never use a real business password. Initialize inside the installed app, not just a Safari tab; storage continuity across contexts must be tested rather than assumed.
3. The demo creates Synthetic Customer / Revision 1. Select Synthetic Updated, re-enter the test phrase for save, and confirm Revision 2.
4. Lock, then swipe the FIRE Demo app away in the app switcher. Turn on Airplane Mode and explicitly turn Wi-Fi OFF.
5. Tap the FIRE Demo Home Screen icon. Unlock and confirm Synthetic Updated / Revision 2.
6. While offline, select Synthetic Recovery and save with the test phrase. Confirm Revision 3.
7. Lock, close completely again, reopen while still offline and unlock. Confirm Synthetic Recovery / Revision 3. Record both launch results and any error text.
8. Check lock behavior after backgrounding and idle; check small-screen/keyboard scrolling against the original saved app. Do not modify or remove the original app.
9. While unlocked and offline, enter the disposable test phrase under **Test phrase to encrypt backup**, then tap **Download encrypted synthetic backup**. Save to **On My iPhone** in Files, not an online-only folder. Under **Saved encrypted JSON file**, select that actual saved file, enter its test phrase and tap **Verify saved file without changes**. Confirm revision 3 and operation receipts. Wrong phrase/corrupt file must fail without changing the original vault. A downloaded file alone is not verified recovery.
10. For recovery evidence, preserve the original app/vault/file. On a separate empty browser context or second device, first load the same approved demo online and wait for the offline shell; do NOT initialize the synthetic customer by tapping Unlock. Transfer the encrypted file privately and ensure it is available locally in Files. Go offline, select that file, enter its test phrase, check **I intend recovery into an empty synthetic vault**, then tap **Recover only if vault is empty**. Unlock and verify revision 3. Repeat recovery and confirm it refuses to overwrite the recovered vault. Do not delete/clear the original app or only working vault to manufacture an empty target.

The screen accepts only this demo's namespace and fixed synthetic customer fields, with a 2 MiB archive limit. It cannot import production backups. Archive verification is read-only; recovery adds a snapshot only when none exists. File-picker background/lock behavior and downloads in the installed iPhone context remain actual-device checks. If opening Files locks the demo or clears selection, reselect the file and re-enter the disposable phrase; record the behavior rather than calling it a pass.

## What to report

Exact URL, commit/shell version, iPhone model and iOS/Safari version, installed-app context, light/dark theme, network state, revisions before/after both launches, actual backup file readability and recovery result, lock/errors/reload observations, screenshot or video without passphrases. Mark each step PASS/DIFFERENT/UNVERIFIED/BLOCKED; keep actual iPhone export/file verification/recovery UNVERIFIED until every relevant step succeeds.

## Chromium evidence does not replace these iPhone checks

Safari/Home Screen storage context, worker activation/cold relaunch after force-close, WebCrypto latency, IndexedDB interruption on suspension, cross-window/idle/background revocation, keyboard/viewport scroll behavior, file download and Files picker support, iCloud-vs-local file availability, storage eviction and installed worker update timing all require actual device evidence. WebKit documents best-effort storage and possible eviction; no permanent durability promise. Do not clear site data to test missing assets because that can erase records. Keep independent recoverable backups before real customer activation.

Apple installation: https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios
WebKit storage: https://webkit.org/blog/14403/updates-to-storage-policy/
