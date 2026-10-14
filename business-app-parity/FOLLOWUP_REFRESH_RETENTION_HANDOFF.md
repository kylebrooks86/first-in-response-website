# Follow-up refresh retention

Parent checkpoint: 6ea359715065053775026964e1ede94bd56cf4fb. Development branch: work/fire-business-app-parity-2026-10-08. Date: 2026-10-14 UTC.

After an owner-confirmed message send or estimate review change, the Follow-ups screen previously reloaded only its first 50 records. Older pages already loaded disappeared. If refresh failed, the screen exposed an older-page retry or no retry at the end of history.

All three isolated candidates now refresh the number of pages already loaded using the existing authenticated 50-record keyset API. The screen applies the refreshed collection only after all required reads succeed. Failed reads retain the existing records, cursor and locally confirmed message status. A dedicated Retry follow-up refresh action repeats reads only, including when the end of history has already been reached. Loading older pages retains its separate retry behavior. IDs are deduplicated and stale request generations cannot replace a newer load. This changes no financial API, message-send endpoint, schema, migration or CSS.

Final validation: 111/111 native framework browser checks (37 per target), 207/207 financial regressions, 3/3 TypeScript checks, 3/3 full builds and 134/134 shared application files. The added native scenario loaded 126 synthetic records, confirmed an older follow-up, verified all pages remained loaded, injected a second-page refresh failure after another confirmation, retained the locally updated list, retried successfully, and checked that retry requests were GET reads with unchanged first-page API content. The initial test fixture lacked a phone number; it was corrected and all final runs passed. Real gateway sessions and physical devices were not exercised.

Refresh pages do not form a transactionally consistent database snapshot. Concurrent inserts or deletions can change the loaded range on refresh, and newly inserted records can push older records to a later page. No automated messaging, contact merging or customer record reconciliation was added. Source parity does not prove deployed parity.

No deployments, paid services, migrations, Stripe actions, production changes, device recovery, resets or storage clearing. Existing apps, calculator, device vaults and encrypted backups remain untouched. Bottom-of-screen shaking remains tracked; no speculative CSS changes. Gate 4 still requires the hosted resource/runtime evidence recorded in RELEASE_GATE_REVIEW_6231fb5.md. Official release readiness remains 30% (3/10 gates).

Next bounded task: add owner-controlled Contacted/Snooze follow-up actions using existing persisted activity where compatible, preserving billing exceptions and avoiding a production migration; otherwise continue protected historical property-address support in isolated source only.
