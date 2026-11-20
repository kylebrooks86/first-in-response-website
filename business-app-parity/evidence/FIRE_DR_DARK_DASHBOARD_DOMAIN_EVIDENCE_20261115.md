# FIRE Gate 4 — real owner Cloudflare DR dashboard screenshots (2026-11-15)

## Owner-provided evidence and custody

Two actual owner-supplied iPhone Safari screenshots of an already-authenticated Cloudflare Workers dashboard, phone time **10:57 CST, November 15, 2026**. Their original image bytes remain in the owner's ChatGPT project conversation; this GitHub file records the observations and **independently calculated SHA-256 checksums**, but does **not** upload screenshot binaries.

| Original uploaded screenshot | SHA-256 (computed from uploaded bytes) | Visible evidence |
|---|---|---|
| `IMG_4325.png` | `a5b39779e5cde2582f57a79ea9eb6155ca9f9cf6193dd6c64abde53c49c53287` | DR **Deployments** tab: active version prefix `b7c42773`; 100% traffic, `Ready`, 0 req/sec and 0% error rate at capture |
| `IMG_4326.png` | `9270f2a0ae24e6af19573fc30d5103f10e4f135154c3380a51bd4d5bc32370ec` | DR **Domains** tab: Production `fire-fullapp-dr.kyle-bfc.workers.dev` toggle visibly OFF, Preview `*-fire-fullapp-dr.kyle-bfc.workers.dev` toggle visibly OFF; `Custom Domains and Routes` table has no entries and displays `No custom domains` |

The Worker identity in the URL/domain rows is explicitly `fire-fullapp-dr`, not the NEW LIVE Worker. The visible short version `b7c42773` matches the full **previously independently accepted provider read-only** DR serving version `b7c42773-5a93-4c6c-91d2-83cdb8e857d9` and independent physical DR D1 UUID `5e55c5b7-cd67-4c8f-a52e-40f71b5d3145`, as documented in [Issue #19](https://github.com/kylebrooks86/first-in-response-website/issues/19). This screenshot does **not** itself reverify the full UUID or database mapping.

## Specific new accepted observation

At capture time, the **DR Worker's own dashboard** displayed both worker public and preview URL toggles OFF, plus no domain/route entries assigned to that Worker. This is distinct, real Cloudflare dashboard evidence for the DR public-exposure safety requirement, not an offline test. The owner has already supplied separate NEW LIVE Worker-level dashboard exposure screenshots at 10:48 CST, registered in [FIRE_NEW_LIVE_DARK_DASHBOARD_DOMAIN_EVIDENCE_20261115.md](FIRE_NEW_LIVE_DARK_DASHBOARD_DOMAIN_EVIDENCE_20261115.md). Together the two Workers have **their own** dashboard evidence for OFF Worker URLs and an empty selected-Worker domain/route table.

## Limits and release discipline

- The Worker-level dashboard shows **no entries for the selected DR Worker**; it is **not** an exhaustive API-certified account-wide zone-route inventory. Screenshots do not independently prove all Cloudflare Access rules, active nonowner denial, source byte equality, future D1/photos recovery, production Stripe, or full QA/STAGING/DR/NEW LIVE operational parity.
- A `Ready` deployment at 100% indicates serving deployment assignment, **not** a published usable application. With both public URL toggles OFF, no availability or public release claim is made.
- **NO changes** made to DR, NEW LIVE, routes, domains, Access, SQL, D1, Stripe, photo storage, R2, provider subscriptions, DNS, Git merges, or legacy application. Both Workers' original first-create locks, owner-private artifacts and earlier accepted physical hosted metadata evidence remain authoritative; never recreate/redenploy to refresh this evidence.
- Do **not** ask the owner to retake these accepted screenshots, rerun the failed existing-Wrangler GET helper, repeat previously accepted D1 26/26, Job #0001, iPhone QA, DR/NEW LIVE first-creates, or repeat hosted version+physical D1 readback.
- Formal **4/10 gates accepted G1/G2/G3/G8**; **G4/G5/G6/G7/G9/G10 OPEN**, NEW LIVE remains DARK, **NO-GO**. This documentation improves Gate4 physical evidence but does not promote its formal status.

## Next evidence needed

Treat DR/NEW LIVE selected-Worker public URL/domain visual proof as complete for the captured state. Advance only remaining Gate 4 Access policy, account-wide route ambiguity if materially required, hosted user-level QA-master parity and distinct environment isolation; then Gate 5/6/7/9/10 evidence. Avoid duplicate owner device work.
