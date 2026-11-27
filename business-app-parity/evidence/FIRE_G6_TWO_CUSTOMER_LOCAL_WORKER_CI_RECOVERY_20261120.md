# FIRE G6 / Gate 8 — two-customer local Worker transport reset resolved, exact 27/27 CI seal (Nov 20, 2026)

## Real failure and necessary fix

The original automatic [QA/STAGING run #44681023793](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44681023793) compiled source and passed both real-route/native SQLite owner task-create and task-PATCH regression steps in the shared QA/staging job `136104180888`, but a *separate* full built-QA browser job `136104180557` FAILED during the Gate6 two-synthetic-customer share-token negative test. Its real Playwright request stopped at `apiRequestContext.post: read ECONNRESET` on a local `127.0.0.1` POST to the public estimate-accept route after several valid denials. The log did not prove a hosted app regression or identify why the local Worker transport reset. The failed run MUST NOT be called fully green.

Commit [`c6adce5eeba4780fd3b6f0196f19a4f5d27698dc`](https://github.com/kylebrooks86/first-in-response-website/commit/c6adce5eeba4780fd3b6f0196f19a4f5d27698dc) updated only `business-app-parity/shared/scripts/test-qa-worker-http-browser.mjs`. Before the existing two-customer cross-document/owner-forgery/public-token regression, the local harness now stops the previous long-running disposable Worker process and starts a fresh one against the SAME persisted synthetic local D1. It does NOT reset or rewrite test records, skip a failing assertion, swallow an error, retry a failing security request or touch any Cloudflare provider. It additionally rethrows any failure after printing bounded local Worker exit/signal/log tail with both randomly generated synthetic QA secrets redacted. Production API/UI, pricing, photo, D1 and Stripe routes remain unchanged by this patch.

## Exact automated result (completed, not provisional)

- Source/test SHA: **`c6adce5eeba4780fd3b6f0196f19a4f5d27698dc`**, existing [unmerged DRAFT PR282](https://github.com/kylebrooks86/first-in-response-website/pull/282).
- **27/27 PR-triggered GitHub Actions workflow groups `completed/success`**, **0 failed, 0 cancelled, 0 pending**, independently retrieved by exact commit SHA.
- Actual [QA/STAGING run #44717733245](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44717733245) **completed SUCCESS, all six independent jobs SUCCESS**.
- Actual compiled browser/worker job `136225352444` **SUCCESS**, with exact step **`Gate 6 two-customer public share-token isolation (disposable local QA, never hosted)` COMPLETED SUCCESS**. The previous local ECONNRESET regression no longer appears in this run.
- Actual compiled/staging source job `136225352196` **SUCCESS**, including owner task-create lost-ACK and task-PATCH/due-date recovery native SQLite steps both **SUCCESS**. Separate declined-deposit Chrome job, D1 migration rehearsal, Windows safety and Stripe offline TEST contract all **SUCCESS**.
- This verifies the changed local test harness and full-source CI suite, not a physical Cloudflare release candidate, owner/nonowner hosted behavior, signed Stripe TEST event or production recoverability.

## Acceptance boundary

**[x] Real original pending source/CI subtask settled. [ ] No new atomic hosted release checklist row met.** Formal master release remains **51/95 checked, 44 open; whole gates 4/10 accepted G1/G2/G3/G8**, G4/G5/G6/G7/G9/G10 OPEN. QA master requirements unchanged, NEW LIVE DARK/NO-GO, first operational Job #0001 unissued. This source-only change has NOT been deployed to QA, STAGING, DR, TEST or NEW LIVE. No Cloudflare sign-in/provider POST, migration, R2 subscription, payment, customer data, Git merge, DNS/Access/route, live traffic, Apple/iPhone/Acer retest or owner repeat evidence.
