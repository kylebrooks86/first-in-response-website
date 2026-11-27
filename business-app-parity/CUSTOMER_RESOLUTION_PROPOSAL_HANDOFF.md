# Explicit customer resolution proposal

Requested checkpoint: `0c21fb865100e27a7e2615f00b4b2ea9290f0e3b`. Verified newer branch head: `6ad09852fae8b2ef65b66e4242fac1e82d6eeebc`. The prior saved comparison was preserved, and unfinished proposal work was completed without repeating the earlier feature implementation.

## Completed behavior

Stored customer versus retained draft review now has an explicit stored/draft source choice for each of five contact fields. Nothing is selected by default, including identical values. All five choices are required before a separate, clearly unsaved proposal appears. Missing stored records cannot supply stored values. Selected buttons have visible and accessible pressed states. The original draft, attempted-save payload and inspected stored values remain separate and unchanged.

An explicit test-phrase recheck decrypts a fresh read-only snapshot and compares the customer/operation content against the reviewed inspection. It reports unchanged content, changed content, or failed inspection. It clears the phrase immediately and retains choices and the original draft on changed/failed results. The action never saves, retries, acknowledges sync, replaces an editing session or enables a reconciliation save. Editing the draft invalidates comparison/proposal; lock/account teardown removes decrypted views as before. No encrypted customer data is discarded.

## Validation

Final evidence: `CUSTOMER_RESOLUTION_PROPOSAL_EVIDENCE.json`. Native Chromium IndexedDB/WebCrypto checks cover explicit five-field selection, unchanged ciphertext and original draft, unchanged recheck with retry still blocked, wrong phrase retaining choices, an intervening committed update detected without replacing reviewed values, missing stored-source disabling, matching committed values without server acknowledgement and lock during recheck preventing publication. The intervening update and post-commit failure are controlled synthetic fixture operations.

Actual Vite/workerd app tests use disposable local D1 databases and synthetic sessions through each target's authentication adapter. They exercise field choices and offline rechecking without changing the contact revision, 320-pixel light/dark proposal layout, lock lifecycle, reload persistence and normal navigation. Full builds, TypeScript checks and synthetic financial regression passed across all three candidates. The 131-file application parity gate passes; preview styles and changed scripts also byte-match explicitly.

## Limits and next task

The freshness recheck is a point-in-time content comparison, not an atomic transaction/write permission. Stored data can change afterward; an eventual deliberate save must compare the current encrypted snapshot identity inside its write transaction. The proposal is volatile review state, not a durable draft archive. Existing locking clears volatile drafts/choices to protect decrypted data. No new write or reconciliation action was activated.

Next bounded task: design a guarded deliberate reconciliation commit that preserves stored history and original unsaved draft versions, checks encrypted-snapshot identity atomically, and rejects any intervening storage change without automatic retry. Keep this separate from server sync and financial workflows.

No deployment, production database access, migration, Stripe operation, paid service, device recovery, reset or storage clearing occurred. iPhone Revision 3, iPad Revision 1, encrypted backup, original Home Screen apps and FIRE Calculator remain untouched. Bottom-of-screen shaking remains UNRESOLVED; only scoped proposal selection styling was added, with no scroll/viewport CSS change.

Official release readiness remains **30% (3/10 gates)**. No owner intervention is needed for this development checkpoint.
