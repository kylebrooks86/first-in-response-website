# Stored customer versus retained draft review

Base checkpoint: `0c21fb865100e27a7e2615f00b4b2ea9290f0e3b`.

## Completed behavior

After an explicit encrypted storage inspection, an existing draft exposes “Review stored record against draft.” Clicking it makes a read-only copy of the inspected stored customer, captured attempted-save payload (when present), and current retained draft. Name, email, phone, address and lead source each show the three values and whether the current draft matches the stored value. Revision context and an exact difference count are included. Missing records, no attempt and blank fields are distinct states.

No inspection or review implicitly retries, reconciles, overwrites, merges, discards or saves customer records. Matching fields do not acknowledge server sync or clear a failed-save barrier. The inspection remains a point-in-time snapshot; UI text warns that storage can change and another inspection is needed for newer evidence. Editing a draft removes the outdated comparison and prompts review again without replacing or clearing the draft. New inspection, explicit edit cancellation, successful save and normal lock/disposal remove the derived comparison. Existing lock behavior still hides decrypted data and clears volatile drafts; encrypted customer records are preserved.

Content is rendered with textContent. Read-only comparison labels use semantic headings and definition lists. Columns collapse to one at mobile widths; the new styles are scoped to the comparison component and do not modify existing scroll/viewport CSS. All three isolated candidates receive identical UI and styles.

## Validation

Final suite results are in `CUSTOMER_DRAFT_COMPARISON_EVIDENCE.json`. Native Chromium IndexedDB/WebCrypto tests cover an older draft versus a newer stored revision, encrypted bytes unchanged by review, current draft changes invalidating review, attempted payload remaining distinct, safe markup rendering, detached review buttons after lock/unlock, an absent stored record, and matching committed values with retry still blocked. Existing interrupted-save, wrong-phrase, storage-error, inspection and lifecycle checks remain covered by the affected suite.

Actual Vite/workerd route tests use separate synthetic authenticated-session fixtures and disposable local D1/Chromium profiles. They exercise review of an unsaved contact edit, existing offline receipt reads, page lifecycle locking, reload persistence and a long draft comparison at 320 pixels in light/dark. Controller regression checks account/target separation and lock behavior. Full builds and TypeScript checks run across all candidates; financial regression uses synthetic in-memory SQLite. No physical Safari evidence or deployed parity is claimed.

## Boundaries and next task

No deployment, production database access, migration, Stripe operation, paid service or physical device recovery occurred. iPhone Revision 3, iPad Revision 1, the original encrypted backup, original Home Screen apps and FIRE Calculator remain untouched. The reported bottom-of-screen shaking remains UNRESOLVED; no unsupported scroll CSS fix was made.

Next bounded task: design an explicit, owner-controlled reconciliation step using inspected revision/receipt identity, retaining both versions and rejecting storage changes between review and any eventual save. No reconciliation action is enabled by this checkpoint. No owner intervention is required for these candidate changes.

Official full Business App release readiness remains **30% (3/10 gates)**.
