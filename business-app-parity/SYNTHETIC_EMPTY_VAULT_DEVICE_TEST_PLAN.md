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
