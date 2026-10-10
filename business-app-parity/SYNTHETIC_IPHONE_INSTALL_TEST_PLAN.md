# Synthetic FIRE Demo iPhone installation test plan

Status: UNVERIFIED. No approved HTTPS test URL exists for this package. No publication or production change is authorized. Official release readiness remains 3/10 (30%).

The exported package runs on localhost on a computer. That address is not an iPhone test URL. The current demo registration guard deliberately accepts localhost/127.0.0.1 only; an exact separate synthetic HTTPS origin must be reviewed and approved before adding it. Do not broaden the guard to production origins. Scope remains `/synthetic-customer-demo/`.

## Required preparation in a later approved batch

Review a separate existing/free synthetic HTTPS origin, its static MIME types and service-worker scope. Record the exact source commit and shell version. Preserve production apps, databases and authentication. Never upload business records, vault exports or passphrases. Do not present the package as already deployable or installed on an iPhone.

## Actual iPhone procedure, after the test origin is approved and available

1. Record iPhone model, iOS/Safari version, approved URL, source commit, shell version, viewport and theme. Open the synthetic URL in Safari online and check the FIRE Demo label and offline-shell ready message.
2. Use Safari Share → Add to Home Screen. Enable Open as Web App when offered. Open the new Home Screen app online. Initialize the synthetic vault in that installed app context; do not assume browser-tab storage transfers to the installed app.
3. Use a synthetic passphrase kept privately. Create the preset customer, edit it to Synthetic Updated and verify Revision 2. Lock the vault and close the installed app fully.
4. Enable airplane mode and explicitly turn Wi-Fi off. Reopen the original Home Screen icon, unlock and verify Synthetic Updated / Revision 2. Edit to Synthetic Recovery / Revision 3, lock and close fully.
5. Reopen while still offline, unlock and verify Synthetic Recovery / Revision 3. Record PASS only if both launches and the persisted edit succeed. Record errors and exact reproduction steps otherwise.
6. Test background/idle locking, manual locking and existing mobile navigation without changing synthetic data during inspection. Compare scrolling with the original saved app. Desktop Chromium evidence does not resolve iPhone whole-screen shaking.

Do not clear browser/site storage to test missing assets: that can erase the vault. Controlled asset-removal testing belongs in an isolated automated profile. Clean-device backup recovery and durable storage remain separate pending release gates; the demonstration does not yet expose an encrypted backup/restore screen.

## Evidence to return

Matching URL/build/shell version, installed-app context, device/iOS, network state, customer preset and revision before/after both launches, lock behavior, screenshots or video plus functional observations, errors/reload behavior and PASS/DIFFERENT/UNVERIFIED/BLOCKED status. Keep passphrases and customer data out of screenshots and reports.

Apple installation reference: https://support.apple.com/guide/iphone/iphea86e5236/ios
Service-worker secure-context reference: https://www.w3.org/TR/service-workers/

No Safari/Home Screen test has been performed in this batch. No full-app offline, permanent-storage, hosting independence or production parity claim is made.
