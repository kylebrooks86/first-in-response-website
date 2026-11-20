# Nov 19, 2026 — STAGING actual serving version, enabled production/preview URLs and missing Worker Access policy (owner screenshots)

**Target:** Cloudflare **Workers & Pages → `fire-app-independent-staging` → Production** for the independently hosted STAGING Worker, **not** NEW LIVE/DR/QA or the legacy Sites app. **Owner submitted three new authenticated Dashboard screenshots** at approximately 9:01–9:02 PM CST November 19, 2026. These are original owner-private screenshot files from the same conversation, with raw-byte hashes independently computed locally; they were not uploaded into public GitHub.

| Original owner screenshot | SHA-256 original bytes | Physical contents |
| --- | --- | --- |
| `IMG_4497.png` | `019b4ae1851688522d9f36d4a492fee3d6f10b5b7290188c42075c92ea5d0613` | Production **Deployments** tab; Active deployment 100% traffic, Version ID visible prefix `7838d0ea`, displayed "20d ago"; earlier versions Ready in list |
| `IMG_4498.png` | `a9713de3b3838f20a80debb5c951e2fb69b418a17bc8a58b84f1479bb77b7948` | Production **Domains** tab; public workers.dev production URL and wildcard preview URL toggles ON; "Anyone with this URL can visit. Enable Access" for both; custom routes list below screenshot fold not visible |
| `IMG_4499.png` | `86a0fb8d7ff8c5016d32f5f9469bdf0d1ca999f12f6fc64e64859045275b4395` | Production **Access** tab: "This Worker is not protected by Access", "No Worker-specific policy is configured. Traffic remains public unless a hostname or account policy applies", "Not protected yet" |

## Exact actual results and release meaning

**Serving identity:** Cloudflare's authenticated **Active deployment** shows version **prefix** `7838d0ea` (only 8 hex characters visible, NOT a full immutable 36-character version ID), **100% traffic**, displayed deployed "20d ago", **0 requests/sec and 0% error rate** at the screenshot moment. Rows below list earlier Ready versions, including prefix `61fa32a3`; labels and Ready status do NOT prove a successful rollback or source-code hash. A URL/view identifying exact full current immutable version and exact module/asset source bytes is still missing. Older accepted Oct13 v138/100% proof is preserved, not repeated. No deployment or code changed.

**Routes/ingress:** **Production** `fire-app-independent-staging.kyle-bfc.workers.dev` ON and **Preview** `*-fire-app-independent-staging.kyle-bfc.workers.dev` ON. The Dashboard text says "Anyone with this URL can visit. Enable Access" for both. **Custom Domains and Routes** section title visible, but the rows underneath are **outside the screenshot**; therefore do not claim no custom routes exist from this image. This is genuine physically visible public ingress, contrary to DARK DR/NEW LIVE (which are separately accepted disabled/blocked). Screenshots cannot independently prove customer API exposure, server-side auth bypass, accessible private customer records, or every Cloudflare account/zone route.

**Worker-specific Access:** Selected **Access** page identifies `fire-app-independent-staging`, status "**Not protected yet**", and explicit message: "**This Worker is not protected by Access. No Worker-specific policy is configured. Traffic remains public unless a hostname or account policy applies.**" Owner's previously accepted Nov18 account-wide Workers Access switch screenshot was **OFF**; this increases the need for specific STAGING protection/ingress design. It does NOT establish that all hostname policies are off, that app-server authentication fails, or that the application has actually leaked private data.

## Reconciliation with preceding Nov19 real STAGING runtime secrets evidence

[Separate actual settings screenshots](FIRE_STAGING_PRODUCTION_SECRETS_BINDING_OWNER_20261119.md) identified production D1 `DB` → `fire-app-staging-db` (already accepted physical UUID `afb2c05a-d794-4a9a-b580-924ce01c26ad`), secret names `FIRE_SESSION_SECRET` and `STRIPE_SECRET_KEY` (value encrypted) and no R2 binding visible. Reviewed unmerged STAGING source requires `FIRE_ADMIN_PASSWORD_HASH`/session-secret, not an unexpected Stripe credential. **Now additionally** the physically serving Worker version prefix is `7838d0ea`; do not assume it matches the current reviewed source or new QA-master app. This creates an evidence-backed, actionable **config/identity/edge-Access blocker**, not permission to edit or rotate secrets or expose more URLs. `STRIPE_SECRET_KEY` **presence does not identify TEST vs LIVE**.

## Impact and stop/no-repeat boundary

- **G4-01**: actual STAGING serving prefix and **100%** confirmed; complete full immutable source SHA/multi-target attestation still OPEN.
- **G4-04**: physical secret-name and R2 binding details already captured, but TEST/LIVE secret scope and reviewed candidate mismatch still OPEN.
- **G4-05**: real STAGING production and wildcard preview URLs ON, so target ingress **partial**; custom route list and full account-wide ingress inventory not shown, therefore still OPEN. No repeat of these exact photos.
- **G4-06**: **actual NO Worker-specific Access** explicitly confirmed for STAGING. A new approved protected/private ingress design and verification are required; **OPEN**. **Do not enable Access, toggle production/preview, modify Worker, or call Visit** without deliberate reviewed authorization.
- **G4-07**: existing hosted STAGING version does not establish updated QA-master source, rollback eligibility, or secure candidate parity; OPEN.
- **G6**: no private-record data-leak assertions, cross-customer tests, sign-in tests, or new application security proofs from dashboard alone.

**Never redo these three already captured STAGING Deployments/Domains/Access screenshots absent actual Worker config/version changes.** No provider POST/PUT/DELETE, no route/Access/URL toggle, SQL mutation, migration, secret view/change, Stripe or R2 action, merge, deployment, production publication, or customer access attempted.

**Official checklist remains 50/95 accepted, 45 open; 4/10 gates G1/G2/G3/G8 accepted.** NEW LIVE remains DARK/NO-GO with first future Job #0001 untouched. Public STAGING ingress status does not change NEW LIVE's prior accepted dark status.
