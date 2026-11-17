# FIRE NEW QA — scoped code-only UPDATE REVIEW PACKAGE (B12, NOT authorization)
Prepared Nov 16–17, 2026 CST. Existing Draft PR #270. **READ/REVIEW ONLY. DO NOT EXECUTE OR DEPLOY.**

## Exact source/target identity
- Candidate integration branch: work/fire-main-qa-dr-live-unified-source-20261114, unmerged Draft PR270 against main.
- **Source code SHA reviewed by CI:** 8c2b50d5a4e311afdd98d2ae1d64fef42c2f82a2. Exact commit's 27/27 GitHub workflows completed SUCCESS, staging/native SQLite/Chrome run 44024946759 all six jobs SUCCESS. Later documentation-only head b71677ebb17305219d233803ddc18a9afeacfa4d does **not** grant new executable-code CI and may change further.
- Existing QA functional/visual master source previously deployed: frozen reviewed 15bd714c435a585f695ed7166cf06d2c31ea1a8e. Existing immutable QA release branch work/fire-qa-release-15bd714c-20261116 is for that OLD source, **NOT** the new 8c2b50d5 code. DO NOT reuse it to publish new changes; do NOT weaken exact source-branch guard.
- Intended destination for a FUTURE separate owner-approved change ONLY: existing QA Worker **fire-fullapp-qa-20261016**, current last accepted hosted 100%-serving version **08d77fb1-9484-4014-bd5b-1bb1da066cdb**, QA D1 physical UUID **8ccfb1f8-1657-4074-b1b2-47de78f95003**.
- Previously accepted old QA predecessor version **6d77bd7c-20d3-49aa-9816-c651d98953cb**; rollback version listing must be independently rechecked for a FUTURE publish because that listing might differ from the older snapshot. A rollback-capable code version is NOT a D1/photo rollback; preserve private owner backups.
- This is **not** an upload package. No exact new compiled Worker/assets archive SHA256 has yet been sealed for 8c2b50d5 (B11 OPEN). A frozen branch for this exact new code (B06 OPEN) and final changed-file review (B07 OPEN) are still required. No publisher should accept a docs-only head pretending to be the tested code commit.

## Scoped delta from already deployed QA master — genuine source comparison
GitHub compare 15bd714c435a585f695ed7166cf06d2c31ea1a8e...8c2b50d5a4e311afdd98d2ae1d64fef42c2f82a2 reports **188 commits ahead, zero behind, 81 changed files** in comparison response. Files include documentation/test changes and approximately two dozen changed app runtime/components. The primary changed live-capable paths and purposes:
- Existing owner write POST/PUT/PATCH guards: business preferences, customer messages, customer notes, estimates, expenses, invoices, job reports, message templates, notifications, quotes, saved promotions, service pricing, tasks and owner follow-up contact history. Adds consistent bounded streamed strict-UTF8 JSON, rejects malformed/overlong bodies before D1, preserves original valid values/payment behavior; tracked source/native tests in 27/27 suite.
- Customer-properties candidate route and UI: stable UUID create operation, post-write saved D1 readback, safe retried lost ACK and archive revision check. Candidate synthetic-only flags must stay OFF until separate migrated hosted approval.
- Door-knocking owner route/UI: protects saved lead/visit/territory state from false ACK, lost HTTP response and duplicated retries, with stable UUID/revision and native SQLite/Chrome demonstration.
- Paid closeout/dashboard review snooze: no-D1-on-invalid-body bounds, existing seven-day review reminder behavior retained; no actual customer messages sent.
- Encrypted complete-record backup owner UI/helper: correct saved passphrase re-entry and encrypted file authentication; local tests only, not hosted full future-photo recovery.
- New shared owner input guard code in shared/lib/customer-write-request-guard.mjs is reused, not a paid hosted service.
- No intended change to QA-master appearance, customer billing/rates/promotions, genuine invoice cents, photo source bytes, private identities, permitted messages, Stripe live endpoints or customer numbering activation. Source intent is not proof of actual hosted parity.

## Release preflight that is still missing (do not pretend B12 authorizes it)
1. B07: review exact changed runtime hunks against approved QA master and resolve a reproduced launch-breaking delta, if one is found. Green 27/27 does not authorize an unscreened 81-file update.
2. B06 and B11: pin ONE immutable latest code candidate, produce and privately seal exact compiled Worker modules/static assets, source SHA and rollback copy. Existing old frozen 15bd branch and ZIP **cannot be relabeled** as new 8c2b code.
3. Get ONE new narrowly written owner approval identifying Worker, source SHA, prior active version, exact archived bytes/manifest, D1 identity and no-R2 boundaries, then use existing guarded QA-only review procedure. No generic 'continue' or blanket 'approve' authorizes upload.
4. Immediately before any separately approved provider action, existing guarded scripts verify current active immutable Worker version, physical D1, preserved prior version/rollback, owner auth/secret NAME provenance and actual no-R2 deploy manifest, along with attempt locks. STOP on mismatch.
5. After a permitted QA code-only deployment only, read back the new immutable serving version/traffic and targeted changed-hosted functionality; do NOT repeat previously accepted QA iPhone/customer/photo tests without new regression cause. Keep gate G4 OPEN until full four-target parity/ingress evidence.

## Exact exclusions
No publication/deployment now; no QA/STAGING/DR/NEW LIVE/TEST Worker or D1 writes, new first-create, original consumed publisher replay, migration/SQL, asset upload, Cloudflare Access or public route change, Stripe checkout/refund/webhook, payment modification, R2/paid Cloudflare, DNS, production cutover, old Sites retirement, merge, or blanket owner authorization.

Review package B12 **prepared**, but B06/B07/B11 and G4–G10 remain open. Formal G1/G2/G3/G8 = 4/10 accepted; NEW LIVE DARK/NO-GO. This file is an exact future QA review aid, not a release artifact or green light.
