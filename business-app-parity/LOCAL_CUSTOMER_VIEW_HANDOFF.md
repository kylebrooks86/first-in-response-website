# Isolated synthetic Customers view

Base checkpoint: `b3aaf1831b3fc07f0663342dfa725b796e1277a2`.

The opt-in `mountSyntheticCustomerView(root, repository)` interface now renders local contacts, current revisions and unacknowledged operation receipts. It supports synthetic create/edit, explicit unlock/lock, encrypted local-save feedback and draft preservation on failure. The caller supplies an already scoped repository; the view neither opens nor initializes vaults. It has no route or Dashboard imports and is not published.

Contact edits require a Synthetic name/address, an example.invalid email (or blank), blank phone and Synthetic lead source. Reads display the scoped repository as supplied; this restriction is a development fixture guard, not production data classification. Financial history is explicitly connection-required. No totals, automatic retries, server sync, backup/recovery action or financial action is implemented.

Locking clears current DOM inputs before detaching them and discards the draft. A render token rejects detached form submissions after lock/unlock. Save/cancel buttons are disabled during encryption. Failed saves retain the draft and require inspection; save is disabled until a new explicit lock/unlock cycle. Disposal locks/closes the repository boundary and removes the interface.

## Verification

- Native Chromium 153.0.8010.0, real IndexedDB and WebCrypto: 15/15 checks per candidate, 45/45 aggregate.
- Focused strict TypeScript: 3/3 candidates.
- Shared runtime source: 124 files, zero differences across isolated LIVE/Doomsday/staging candidates. Target-specific adapters remain separately unverified.
- Evidence: `LOCAL_CUSTOMER_VIEW_EVIDENCE.json`. The prior 78/78 repository checks remain saved and were not rerun because repository code did not change.

The unused-vault fixture initially used a vault-storage namespace in a customer archive; correcting the test fixture to the customer namespace allowed the native test to proceed. No vault implementation change was needed.

## Limits and next batch

This is a DOM workflow under localhost test harness, not an activated full Business App feature. Full app dependencies/build, mobile appearance, installed Home Screen offline launch, deployed parity and server integration are unverified. Offline editing covers an already loaded interface; restarting Chromium covers encrypted data persistence, not offline application launch. Whole-screen shaking is unresolved.

Next bounded batch: review and implement an explicit account/target adapter and lock lifecycle wiring in isolated candidates before activating the contacts-only view. Do not substitute missing financial collections with zero totals. Keep the current Dashboard Customers workflow until integration is verified.

No deployed app, published synthetic package, device vault, original backup, Stripe resource, remote database or paid service was changed. iPad Revision 1 and iPhone Revision 3 remain protected. No device recovery test is authorized. Official readiness remains **3/10 (30%)**.
