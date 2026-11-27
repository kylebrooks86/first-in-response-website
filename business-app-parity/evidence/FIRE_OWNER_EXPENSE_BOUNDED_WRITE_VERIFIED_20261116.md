# FIRE expense write reliability — bounded owner financial JSON before D1 (November 16, 2026)

**Existing unmerged PR:** #270. **Exact source code checkpoint:** `77dd2de8a6f40309034202a4c7451b4291d1ed4e`. **Target:** source-only, not a new hosted release.

## Real code change

The owner `POST /api/expenses` route used unrestricted `await request.json()` and could buffer unbounded invalid JSON before financial amount, date, request identity or linked estimate validation. Existing owner Estimate and Invoice create already used the shared hard-bounded reader. The expense endpoint now imports `readOwnerWriteObject` from the **existing** `shared/lib/customer-write-request-guard.mjs` and applies a `32_000`-byte stream cap BEFORE any D1 expense/estimate reads or writes. Stream errors, too-large bodies, misdeclared lengths, invalid UTF-8 and non-object JSON are refused; no new Cloudflare runtime module was introduced.

- Route source [3cf8ebee](https://github.com/kylebrooks86/first-in-response-website/commit/3cf8ebee2cf02fba8e718f89242ac04bff052ded).
- Actual owner POST disposable SQLite regression [3638d58d](https://github.com/kylebrooks86/first-in-response-website/commit/3638d58dbd26082d105465aa64d900f21768d68c): oversized actual and declared bytes, mismatched Content-Length, invalid JSON, nonobject array and fatal invalid UTF-8; explicit **ZERO D1 reads/writes and unchanged row count**. Existing valid 1x expense creation, duplicate-ID recovery, changed-amount refusal, date-only Tulsa year-end, lost commit acknowledgement, replay, and data-preserving receipts unchanged.
- Existing real-route Wave CSV/test fixture import compatibility [77dd2de8](https://github.com/kylebrooks86/first-in-response-website/commit/77dd2de8a6f40309034202a4c7451b4291d1ed4e): no change to tax CSV formula escaping, line items, accounting math or service reporting.

## Real CI results on exact tested code

- [FIRE staging/shared app test workflow #43965511144](https://github.com/kylebrooks86/first-in-response-website/actions/runs/43965511144): **SUCCESS**, six jobs successful, specifically `QA/staging shared app source and isolated staging build (NO upload)` and its `Gate 8 owner expense save recovery and Wave financial record ID integrity (native SQLite only)` step **SUCCESS**.
- [Gate9 full-app LOCAL build #43965511196](https://github.com/kylebrooks86/first-in-response-website/actions/runs/43965511196): **SUCCESS**; source-only compilation and packaging, not a Cloudflare publish or Stripe event.
- [App-only public website/calculator protector #43965511073](https://github.com/kylebrooks86/first-in-response-website/actions/runs/43965511073): **SUCCESS**.
- [Website verification #43965511101](https://github.com/kylebrooks86/first-in-response-website/actions/runs/43965511101): **SUCCESS**.

The exact source checkpoint finished **27/27 GitHub workflows SUCCESS, zero failed/cancelled/pending**. The production app was **NOT** rebuilt/deployed here: all CI execution was offline or synthetic against disposable fixtures and reviewed source.

## Strict release meaning

This closes a **source input-reliability defect**; it does **NOT** close any additional formal release gate, prove real hosted QA/STAGING/DR/NEW LIVE owner access, release new app functionality, verify full customer/photo backups, authenticate physical D1 or signed Stripe TEST events. **G1/G2/G3/G8 remain accepted = 4/10**. G4/G5/G6/G7/G9/G10 remain OPEN; NEW LIVE remains DARK/NO-GO and future Job #0001 unactivated.

Accepted original DR serving version, initial NEW LIVE stub and hosted **26/26** migrations/immutable attempt locks unchanged. No Cloudflare API login, Worker deploy, D1 migration/SQL, payment/Stripe, public routes, Access, paid R2/Cloudflare subscription, DNS, merge or production cutover was performed or authorized. Preserve prior accepted Acer/iPhone/owner screenshots and do not repeat unrelated tests.
