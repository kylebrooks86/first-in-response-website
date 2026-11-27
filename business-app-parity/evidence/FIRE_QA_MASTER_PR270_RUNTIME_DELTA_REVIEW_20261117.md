# FIRE source quick win B07 — exact QA-master versus PR270 runtime delta review
Date: 2026-11-16/17 CST. This is **SOURCE REVIEW ONLY**, not hosted parity, not regression certification, not deployment authorization.

## Compared immutable Git commits
- Actual already-hosted QA-master application source: `15bd714c435a585f695ed7166cf06d2c31ea1a8e`; accepted hosted QA Worker version `08d77fb1-9484-4014-bd5b-1bb1da066cdb`.
- Latest confirmed full CI executable-source candidate under review: `8c2b50d5a4e311afdd98d2ae1d64fef42c2f82a2`; **not hosted**, still in unmerged draft PR #270.
- GitHub compare API exact refs: **188 commits ahead, 0 behind, 81 changed files** from deployed QA master to tested PR code. This is a focused immutable source comparison, **NOT** the 2,039-file total PR-from-main review.
- Already accepted exact code CI: **27/27 completed successful workflows** including staging/native SQLite/Chrome all 6 jobs success in run `44024946759`. Previous source CI was not re-run; this review does not transfer that result to newer code commits.

## What changed in actual functional source — inspected
**18 changed owner API route files** compared old/new route contents:
- `business-preferences`, `customer-messages`, `customer-notes`, `dashboard-review-checks/snooze`, `estimates`, `expenses`, `followup-actions`, `invoices`, `job-reports`, `message-templates`, `notifications`, `payment-closeouts/snooze`, `quote-packages`, `saved-promotions`, `service-pricing`, `tasks`: replace unbounded `request.json()` on authenticated owner writes with existing `readOwnerWriteObject(request, limit)` and preserve the subsequent original owner/customer/financial validators and CAS/readback. Tested normal/synthetic negative cases are already in the successful changed-code CI.
- `customer-properties` POST/PATCH: new 8KB guard, stable UUID write identity, independent D1 saved-readback and archive-revision check with lost-ACK handling; **candidate synthetic-only flags remain OFF in production**. It has a larger actual behavior delta and must be targeted after any separately approved hosted candidate activation.
- `door-knocking` POST: 8KB owner guard, independent saved-D1 verification, lost-ACK recovery and fail-closed uncertainty. Its owner UI now retains the same operation UUID+CAS revision for an unchanged draft on interrupted responses, rather than duplicate saves.
- `customer-write-request-guard.mjs`: reviewed new owner-stream parser max 262,144 bytes, strict fatal UTF-8, byte-verified actual/declared body lengths, JSON object only, no-store errors. Owner helper deliberately does NOT introduce public bearer-link Origin/Content-Type rules; **Gate 6 hosted CSRF/nonowner security is still OPEN** rather than assumed proven.
- `complete-d1-records-review.tsx`, `protected-complete-d1-records.mjs` and declaration: new saved-encrypted-record passphrase **re-entry** before verifying actual saved file, and allowlisted 25/26 reviewed migration journal for owner complete backup. Not evidence of actual hosted future photo/D1 recovery.
- `customer-properties.tsx`: UI stable in-flight property UUID and failed-save review (behind disabled candidate feature flag).
- `door-knocking.tsx`: UI stable online operation retry identity; no change to real customer communications.
- `business-app-parity/owner_*_readonly.mjs`, `owner_existing_dark_code_update_once_approved.mjs` and source-only workflow additions: developer verification/publisher tooling, **not changed QA business-app runtime**, and require distinct existing owner/provider authorization. No original consumed permission reused.

## Non-delta / preserved functions by exact Git changed-path inventory
No changed path to the existing checkout-payment/refund/webhook handlers, customer core CRUD implementation, invoice financial calculation helpers, rate tables, service catalog formula engine, customer image bytes/IndexedDB photo-vault core, public site, or installed QA navigation shell in this immutable 81-file compare. Pricing, saved promotions, package and invoice **request-reading routes** do change, but the **rate arithmetic, existing amount validators, promotion stacking and ledger-write logic are not the purpose of those changed hunks**. No claim that later hosted parity is proven.

## Result / remaining physical release obligations
- **B07 SOURCE DELTA REVIEW COMPLETE**: exact code comparison performed, source-impact map and high-risk changed route/UI shapes recorded; no independently reproduced launch-blocking functional regression from this review or already-passed exact-code CI. No cosmetic redesign or unrequested price/payment change.
- **Do not infer hosted proof**: B06 frozen final candidate and B11 final compiled modules/assets hash and owner-private code rollback remain OPEN. G4/G5/G6/G7/G9/G10 remain OPEN. Actual future hosted source/asset parity, D1/finance/auth/nonowner/CSRF, paired photo restore, signed Stripe TEST and NEW LIVE Job #0001 require separately governed steps.
- **No deployment, merge, SQL, Cloudflare/Access/DNS/routes, R2, Stripe, payment, personal data, owner-device rerun or provider-write attempt** from this review. Existing DR/NEW LIVE one-shot locks and all old physical evidence retained.
