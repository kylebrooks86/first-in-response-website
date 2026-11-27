# FIRE Business App — customer recipient privacy at actual preparation write

**Date:** 2026-11-17 (America/Chicago)  
**Exact executable source/test SHA:** `94ef82c4ef557f59b89b0d9189e87c2d15f8dd84`  
**PR:** [DRAFT #270](https://github.com/kylebrooks86/first-in-response-website/pull/270), unmerged, not hosted.

## Previous source issue

The owner MessageComposer checked customer phone/email at its Text/Email click, but the actual owner-authenticated `POST /api/customer-messages` accepted a prepared message without independently validating the currently saved recipient. A stale/older client or concurrent edit could therefore create an immutable prepared receipt for a missing or changed phone/email. No automatic send exists or was performed.

## Actual source repairs, preserved history

- [`f186424`](https://github.com/kylebrooks86/first-in-response-website/commit/f18642452341d735367435d3e1324a435d0ffd76): real POST now requires a saved, valid phone/email for corresponding `text_prepared`/`email_prepared` channels; compares an optional exact owner-preview `recipientSnapshot`; guards the same customer column **inside the SQL INSERT**, so a change between preflight and write cannot save a new prepared receipt. Legacy omitted snapshot still gets fresh preflight/SQL-time checks. Copy-only audit remains contact-independent.
- [`29b82d3`](https://github.com/kylebrooks86/first-in-response-website/commit/29b82d3b2d742899f14f0bc7f192a26e6be26aa4): actual MessageComposer includes the selected customer phone/email snapshot in prepared Text/Email payload. Existing request ID, appointment snapshot and separate manual Google Voice/Mail confirmation preserved.
- [`3a3914c`](https://github.com/kylebrooks86/first-in-response-website/commit/3a3914cc47926fda6c7f39869ac541c2279e51bc): real native SQLite route regression covers null, malformed, changed/same-recipient positives, email, previous receipt retry, changes between read and INSERT, legacy clients, copy and no sends.
- [`ec3702f`](https://github.com/kylebrooks86/first-in-response-website/commit/ec3702f4251487557ee515ff963dc9faa30701ff): actual synthetic Chrome handoff asserts Text and Email preparation carry exact displayed recipient.
- [`2a04154`](https://github.com/kylebrooks86/first-in-response-website/commit/2a04154c032c1966e9bcba379ac1d5981ece3381), [`6e4633c`](https://github.com/kylebrooks86/first-in-response-website/commit/6e4633cf2b7560fc555051aa40b05de03c2db149), [`94ef82c`](https://github.com/kylebrooks86/first-in-response-website/commit/94ef82c4ef557f59b89b0d9189e87c2d15f8dd84): older isolated message-history, review-eligibility, idempotency fixtures load the actual helper and use valid distinct synthetic contact rows. No production-guard bypass.
- [`f697f11`](https://github.com/kylebrooks86/first-in-response-website/commit/f697f1187febf3e7581e230f6c2bbad94d8c0ac5), [`0aae8d6`](https://github.com/kylebrooks86/first-in-response-website/commit/0aae8d6c2fa8adf7309dfc20e03a973c0647b504): built local QA Worker creates a synthetic customer with a real fixture phone and uses the saved contact snapshot in HTTP preparation. 
- [`da8d9cb`](https://github.com/kylebrooks86/first-in-response-website/commit/da8d9cbfc2dcd7eebd17fc06a7dfd1abdc710a74): strict offline Gate9 preflight count updated from 193 to the **observed** 194 server modules, static assets still exactly 41; exact source SHA and candidate digest equality remain mandatory. It cannot upload/deploy or grant new consent. Historical one-shot consent remains spent.

## Real CI execution and exact boundaries

**25/25 top-level GitHub Actions workflow groups SUCCESS, zero failed/cancelled** for executable `94ef82c4ef557f59b89b0d9189e87c2d15f8dd84`.

[Staging/native/Chrome run #44205218046](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44205218046) **COMPLETED SUCCESS: all 6/6 jobs**, including:
- mandatory `Gate 8 saved customer list failure and cache recovery (offline)`: actual `test-customer-message-evidence.mjs` including new SQL-time customer-contact race cases PASS;
- `FIRE Google Voice review invitation eligibility at atomic database save (synthetic only)`: real helper and review/idempotency SQLite fixtures PASS;
- `Exercise actual built QA login, expired-session denial, synthetic estimate, Customer view, back/close, and restart`: built isolated Workerd/real HTTP positive prepared Text and scope/auth negative checks PASS;
- `Verify declined estimate never shows collectible deposit; test save/readback and geometry`: actual Chrome MessageComposer Text/Email recipient snapshot browser regression PASS.

[Gate9 full-app LOCAL build run #44205218893](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44205218893) **COMPLETED SUCCESS**. This only checks the source-bound local TEST candidate, strict 194 modules/41 assets and offline gates; **NO provider authentication, uploads, versions, activation, Stripe calls or deployment**.

Earlier intermediate runs on the unfinished source showed (a) old fixture imports missing the new contact helper, (b) synthetic customer rows missing phone/email, and (c) prior 193-module pin failing closed when the new server import produced 194 modules. Those issues were corrected in current source; do not repeat accepted owner device tests or reinterpret these fixture/approval-pin safeguards as hosted defects.

## Release boundary

**45/95 checklist items completed, 50 open; 4/10 formal gates G1/G2/G3/G8 accepted.** G4/G5/G6/G7/G9/G10 remain OPEN. NEW LIVE remains DARK NO-GO; first real Job #0001 unused. Source code and synthetic/local CI do **not** prove Cloudflare deployment/traffic, real authenticated provider protection, paired real D1/photo restore or signed TEST Stripe webhooks. No Cloudflare login/retry, subscription/R2, owner iPhone/Acer/backup repetition, hosted D1/SQL or Stripe write, customer communication, Git merge, deployment, Access/routing/DNS, release or legacy retirement occurred.
