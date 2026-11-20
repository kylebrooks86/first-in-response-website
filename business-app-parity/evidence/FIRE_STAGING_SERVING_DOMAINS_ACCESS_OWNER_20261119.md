# Nov 19, 2026 — STAGING actual serving version, enabled production/preview URLs and missing Worker Access policy (owner screenshots)

**Target:** Cloudflare **Workers & Pages → `fire-app-independent-staging` → Production** for the independently hosted STAGING Worker, **not** NEW LIVE/DR/QA or the legacy Sites app. **Owner submitted three new authenticated Dashboard screenshots** at approximately 9:01–9:02 PM CST November 19, 2026. These are original owner-private screenshot files from the same conversation, with raw-byte hashes independently computed locally; they were not uploaded into public GitHub.

| Original owner screenshot | SHA-256 original bytes | Physical contents |
| --- | --- | --- |
| `IMG_4497.png` | `019b4ae1851688522d9f36d4a492fee3d6f10b5b7290188c42075c92ea5d0613` | Production **Deployments** tab; Active deployment 100% traffic, Version ID visible prefix `7838d0ea`, displayed "20d ago"; earlier versions Ready in list |
| `IMG_4498.png` | `a9713de3b3838f20a80debb5c951e2fb69b418a17bc8a58b84f1479bb77b7948` | Production **Domains** tab; public workers.dev production URL and wildcard preview URL toggles ON; "Anyone with this URL can visit. Enable Access" for both; custom routes list below screenshot fold not visible |
| `IMG_4499.png` | `86a0fb8d7ff8c5016d32f5f9469bdf0d1ca999f12f6fc64e64859045275b4395` | Production **Access** tab: "This Worker is not protected by Access", "No Worker-specific policy is configured. Traffic remains public unless a hostname or account policy applies", "Not protected yet" |

## Exact actual results and release meaning

**Serving identity:** Cloudflare's authenticated **Active deployment** shows version **prefix** `7838d0ea` (only 8 hex characters visible, NOT a full immutable 36-character version ID in the original 9:01 screenshot (superseded by 9:30 owner full-ID readback below)), **100% traffic**, displayed deployed "20d ago", **0 requests/sec and 0% error rate** at the screenshot moment. Rows below list earlier Ready versions, including prefix `61fa32a3`; labels and Ready status do NOT prove a successful rollback or source-code hash. A URL/view identifying exact full current immutable version and exact module/asset source bytes is still missing. Older accepted Oct13 v138/100% proof is preserved, not repeated. No deployment or code changed.

**Routes/ingress:** **Production** `fire-app-independent-staging.kyle-bfc.workers.dev` ON and **Preview** `*-fire-app-independent-staging.kyle-bfc.workers.dev` ON. The Dashboard text says "Anyone with this URL can visit. Enable Access" for both. **Custom Domains and Routes** section title visible, with rows outside the **original 9:01 screenshot**. The subsequent 9:30 authenticated screenshot below now establishes **No custom domains** in this Worker's own routes list; account-wide routes remain a separate issue. This is genuine physically visible public ingress, contrary to DARK DR/NEW LIVE (which are separately accepted disabled/blocked). Screenshots cannot independently prove customer API exposure, server-side auth bypass, accessible private customer records, or every Cloudflare account/zone route.

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

## Nov 19 21:30 CST — owner follow-up COMPLETES exact full version and STAGING custom-domain/route listing

**Original owner screenshot `IMG_4500.png`** (authenticated iPhone Safari Cloudflare STAGING Worker Production → Domains, 9:30 PM) independently verified local raw-file SHA-256 `6b34594ebd5427f77694065761b89f6fe9d4b684b95185e97c4725758aeece8f`. Screenshot raw bytes remain private, not committed. The full **Custom Domains and Routes** section is visible including its **“No custom domains”** empty state and explanation that this Worker would list custom domains and zone routes here if attached. This newly proves **zero custom domains/zone routes displayed on this STAGING Worker** in that owner UI as of the photo; do not ask for another screenshot. This does not establish exhaustive **account-wide** zone bindings, externally reachable endpoint/hostname review or server-side authentication.

**Full immutable STAGING active deployment version ID supplied directly by the owner** immediately alongside this screenshot: `7838d0ea-be89-49c6-9984-d3b021082d72`. The prior screenshot [above] already physically established matching prefix `7838d0ea` at **100% serving traffic**. This completes the missing full-version-identifier transcription for the observed serving instance, **not** a deployed Git source/code SHA, source build parity or worker-secret/security review. Do **not** repeat the Deployment screen to recover the same ID.

**Correct current STAGING ingress composite:** workers.dev Production **ON**, wildcard Preview **ON**, no STAGING Worker-specific Cloudflare Access, no STAGING Worker custom domains/zone routes displayed, account-wide Access OFF in previously accepted evidence. The existing Worker has *publicly visitable endpoints* in Dashboard terminology; that fact does **not** prove a private application API is accessible without its own authentication. An empty custom routes list is NOT evidence that production/preview URLs are disabled.

**Subproofs completed:** G4-01 physical current 100%-serving STAGING full version ID; G4-05 target-specific **Custom Domains and Routes empty-state** and public production/preview URL settings. **Formal G4-01 and G4-05 still [ ]** due full source/other-target/account-wide externally probed ingress and Access scope. G4-06 missing protected ingress design and G4-04 secret mismatch still [ ]. Owner must not repeat these exact STAGING Dashboard screens. No Cloudflare setting or Worker/DB/Access/secret/provider/R2/Stripe change, test login, download, deploy or merge.


---

<!-- FIRE-STAGING-PREVIEW-OFF-OWNER-20261120 -->
## November 20, 2026, 13:59 CST — owner-authorized STAGING wildcard preview OFF (physical UI evidence)

The owner explicitly authorized **only** turning OFF the Cloudflare **STAGING** Worker `fire-app-independent-staging` wildcard preview URLs, preserving the existing production workers.dev URL and every other Worker, Access setting, D1, Stripe, subscription and deployment. This narrow operation is now physically documented by the owner's authenticated Safari Cloudflare **Worker → Production → Domains** screenshot (707×1536 PNG, original kept privately in owner conversation; SHA-256 `ffc0ea9be093d338ce5fdc9332b7c91f64dbd19319dc69a8572a4f8091ccd778`). [Issue #19 original evidence receipt](https://github.com/kylebrooks86/first-in-response-website/issues/19#issuecomment-7049337365).

- `*-fire-app-independent-staging.kyle-bfc.workers.dev`: **Preview OFF (gray)**, replacing the Nov19 ON observation above. **[x] This exact STAGING wildcard toggle/UI subproof is complete; do not re-request the screenshot.**
- `fire-app-independent-staging.kyle-bfc.workers.dev`: **Production ON (blue)**, intentionally unchanged under owner scope.
- Worker-level **Custom Domains and Routes** list still shows no listed entries. Production URL row says **“Anyone with this URL can visit. Enable Access.”** Previously accepted Worker Access page shows no Worker-specific policy; no Access change was authorized.
- The screenshot is real Cloudflare authenticated UI-state evidence. It is **not** an independent anonymous HTTP denial result, an exhaustive Cloudflare account-wide alias/zone inspection, a source-code/asset hash, a secret-scope repair or a hosted customer privacy test. An attempted unauthenticated assistant-side network lookup afterward did not yield an HTTP status and therefore provides **no additional pass/fail proof**.

**Formal status unchanged:** original numbered **G4-05 [ ]** and **G4-06 [ ]** remain OPEN pending remaining ingress/Access requirements; G4-04 secret-name mismatch and STAGING 22/25 applied migration journal persist. **51/95 checklist accepted, 44 open; 4/10 full gates G1/G2/G3/G8 accepted; G4/G5/G6/G7/G9/G10 OPEN, NEW LIVE DARK/NO-GO, Job #0001 unissued.** This is documentation of an owner-performed narrowly approved toggle, not additional authorization to disable production, enable Access, change secrets, deploy, migrate, create R2, touch Stripe, or merge.
