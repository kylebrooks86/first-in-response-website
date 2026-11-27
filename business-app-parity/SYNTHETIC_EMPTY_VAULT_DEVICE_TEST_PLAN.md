# Future isolated device recovery test — not authorized to execute

2026-10-12. Full Business App readiness remains **3/10 (30%)**. This plan is reviewable preparation only. No owner device restoration is authorized by this document.

## Purpose and protected state

Prove that the saved encrypted synthetic Revision 3 backup can restore records into a genuinely unused destination and survive an offline cold launch. File verification alone does not prove restoration. Keep the working iPhone Revision 3 vault, iPad Revision 1 vault, original backup and phrase intact. Do not use those existing destinations. Never delete an app, clear site data or reset a vault to create an empty target.

## Target eligibility before approval

- Use a genuinely unused physical device/context at the exact canonical URL `https://fire-synthetic-offline-test-bfc00939.pages.dev/synthetic-customer-demo/`, with no real records or service connections.
- Independently establishing storage isolation is required. Another tab, a new icon, or a claim that the screen is locked is insufficient. A Private session is not a durable Home Screen recovery target.
- Before any Unlock on the unused destination, the reviewed read-only status must report “No stored vault snapshot found on this device.” Unavailable/exists means stop. A negative read is advisory: the unchanged atomic add remains the final protection against a competing writer.
- The diagnostic interface must be present, and the offline shell must be ready on that target while online. A copied backup must be locally available in Files; do not expose it through the public upload package or record its phrase in QA documentation.
- If no genuinely unused target is available, leave the device recovery milestone pending. Continue isolated development instead of risking either working vault.

## Proposed procedure after separate explicit approval

1. Record the unused target's device/browser/context and approved shell identity. Confirm empty status without Unlock and retain the screenshot. Stop if any concurrent demo use or storage uncertainty exists.
2. With the encrypted file already local, enable Airplane Mode and explicitly turn Wi-Fi off. Select only the saved synthetic backup, enter its existing test phrase and verify it. Expect Revision 3, 3 receipts and no records changed.
3. Re-enter the same backup phrase because verification clears the field. Confirm empty-destination intent and recover once. Do not use a new phrase; stop on any failure and inspect status without trying again.
4. Only after recovery reports success, Unlock the newly restored destination using that phrase. Confirm Revision 3 and the expected synthetic record/receipts. Keep screenshots free of phrases or keys.
5. Completely close and reopen the same restored app while still offline. Unlock and confirm Revision 3 is retained. Do not edit or advance revision during this test.
6. If included in the owner's later approval, select the backup again and attempt repeat recovery into this now-occupied test destination. Expect explicit occupied-vault rejection. Confirm the same revision/record remains intact after authorized inspection. No resets or clearing.
7. Retain the original phone/iPad vaults and backup. Report exact outcomes as owner-performed device tests, distinct from automated local browser checks. An occupied result now does not explain historical iPad failures.

## Acceptance and stop rules

Device recovery remains NOT VERIFIED until one eligible unused durable context completes offline recovery, restored offline relaunch and the separately authorized repeat-recovery rejection. Any status failure, interrupted operation, unverified shell, existing vault or uncertainty stops the procedure. Do not infer an AES-GCM authentication failure means only an incorrect phrase: altered ciphertext has the same failure class.

Passing this synthetic milestone does not activate offline Customers in the full Business App or complete a full release gate. Financial safety, authenticated target identity/schema, durable recovery, all-version functionality/appearance and native scrolling parity remain separate obligations.


## October 16 owner-assisted cross-device PRECHECK — Windows Acer, no restore yet

The owner has offered to help with device acceptance. First task is a **read-only
presence check** on the Acer laptop with a separate, durable regular Microsoft
Edge browser profile, not InPrivate/Guest. The existing published **synthetic**
diagnostic at
`https://fire-synthetic-offline-test-bfc00939.pages.dev/synthetic-customer-demo/`
has owner-observed shell `25ee996f7e1a41f47d3e58f2` and a read-only
**Check stored-vault status without changes** control. The latest successful
development CI run does not imply that newer candidate source is published.

1. In normal Edge, open only the canonical synthetic URL above. Confirm the
   demo and offline shell appear. Do **not** tap Unlock/Initialize/Recover.
2. Tap **Check stored-vault status without changes** exactly once and report
   its displayed result via screenshot (hide any personal or secret data).
   Note that merely using a different browser *can* isolate IndexedDB, but
   that fact must be checked rather than assumed. No browser-profile creation,
   deletion or storage clearing is requested.
3. If it reads **No stored vault snapshot found on this device**, the Edge
   profile is a *candidate* recovery destination. This read does not guarantee
   continued emptiness; the final protected restore uses atomic `add`.
   Before an actual restore, separately confirm the profile is persistent
   and unused, the exported Revision 3 file is available privately in local
   Files (never upload it to ChatGPT/GitHub), the shell identity is as expected,
   and the owner approves that exact test target.
4. If **exists**, **unavailable**, unknown shell or absent controls: STOP.
   Do not initialize, unlock, overwrite, clear Edge data or retry restoration.
   Preserve the iPhone Rev 3, iPad Rev 1 and encrypted backup.
5. After preflight and explicit target-specific authorization, use the
   established offline test procedure from this document; test successful
   empty-destination restore, Revision 3 reopen and occupied-destination
   refusal only on the proven disposable destination.

**Evidence classification:** Windows/Edge real-device cross-device restore
could validate a genuine distinct-storage recovery path, but cannot establish
iOS Safari/Home Screen Gate 8 acceptance. Owner-reported iPhone synthetic
offline/export/verification 13/13 and occupied iPad diagnostics remain
historical accepted observations, not current Business App candidate
acceptance. This precheck is PENDING, not PASSED, until the owner reports it.
The complete Business App candidate is NOT published; do not present the
synthetic demo as that candidate or change readiness from 30%.
