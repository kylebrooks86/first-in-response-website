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
9. BACKUP TEST IS CURRENTLY BLOCKED: no export/import controls exist in this demo. After a separately tested backup UI is added, export the encrypted synthetic archive offline to On My iPhone in Files (not an online-only folder); reopen/read that actual file, decrypt/strictly validate it with the disposable phrase, and verify namespace, customer ID/name/revision and operation receipts. Then recover it into an explicitly empty synthetic vault/profile and verify Revision 3 without modifying the original vault. Wrong phrase/corrupt file must fail without altering existing records. Do not clear the only working vault to create a recovery target. Download alone is NOT verified recovery.

## What to report

Exact URL, commit/shell version, iPhone model and iOS/Safari version, installed-app context, light/dark theme, network state, revisions before/after both launches, actual backup file readability and recovery result, lock/errors/reload observations, screenshot or video without passphrases. Mark each step PASS/DIFFERENT/UNVERIFIED/BLOCKED; keep step 9 BLOCKED until controls exist and recovery succeeds.

## Chromium evidence does not replace these iPhone checks

Safari/Home Screen storage context, worker activation/cold relaunch after force-close, WebCrypto latency, IndexedDB interruption on suspension, cross-window/idle/background revocation, keyboard/viewport scroll behavior, file download and Files picker support, iCloud-vs-local file availability, storage eviction and installed worker update timing all require actual device evidence. WebKit documents best-effort storage and possible eviction; no permanent durability promise. Do not clear site data to test missing assets because that can erase records. Keep independent recoverable backups before real customer activation.

Apple installation: https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios
WebKit storage: https://webkit.org/blog/14403/updates-to-storage-policy/
