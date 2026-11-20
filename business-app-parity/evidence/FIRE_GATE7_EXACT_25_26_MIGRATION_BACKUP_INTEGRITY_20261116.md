# FIRE Gate 7 — protected complete-records archives now require exact reviewed QA25 or independent DR/LIVE26 migration history

**Date:** November 16, 2026. **Existing draft PR:** #270. **Validated code SHA:** `1946e80749a2a06a96b5de45d81762592c00a306`.

## Real code defect fixed
Before this change, `shared/lib/protected-complete-d1-records.mjs` would encrypt a supposedly complete owner record archive if the D1 migration journal had **any 1–64 contiguous numeric IDs and syntactically valid SQL filenames**, even when migrations were substituted, missing, or had never been reviewed. This could preserve corrupt/partial migration provenance in a `.firerecords` archive.

Now `validateCompleteReviewedD1Archive` requires the **exact reviewed SQL names and order** from the canonical source array: either the first **25** for existing QA/STAGING or all **26** for separately migrated DR/NEW LIVE. This does **not** attest Cloudflare's physical D1 or a hosted restore; it prevents a malformed archive claiming complete source migration coverage.

- Real source change [d4776c9d](https://github.com/kylebrooks86/first-in-response-website/commit/d4776c9d040767fab68f22aa5b5b4ef0f2396c03).
- Three new direct negative regression cases [14af43e2](https://github.com/kylebrooks86/first-in-response-website/commit/14af43e2ead3f2f64796159b4afc074fbb3ff98b): wrong reviewed filename, missing journal entry, and QA25 falsely substituting independent migration 0025.
- Targeted integration added to existing isolated encrypted records+photo restore CI [3e7cfc9a](https://github.com/kylebrooks86/first-in-response-website/commit/3e7cfc9ad05149e0406a84e8682cfb6fa0b273d4); public-site verifier's **exact changed workflow blob** only re-pinned in [1946e807](https://github.com/kylebrooks86/first-in-response-website/commit/1946e80749a2a06a96b5de45d81762592c00a306), no scope relaxation.

**Actual GitHub runs:** [isolated full SQLite recovery #43961065955](https://github.com/kylebrooks86/first-in-response-website/actions/runs/43961065955) **SUCCESS** including new `Verify encrypted owner record archives preserve only reviewed QA25 or independent 26 migration histories` step; [site/calculator scope protection #43961065785](https://github.com/kylebrooks86/first-in-response-website/actions/runs/43961065785) **SUCCESS**; [website verification #43961066082](https://github.com/kylebrooks86/first-in-response-website/actions/runs/43961066082) **SUCCESS**. Only necessary changed-function local synthetic tests, no owner recheck or Cloudflare data.

**Formal release unchanged:** G1/G2/G3/G8 accepted = **4/10**. G4/G5/G6/G7/G9/G10 OPEN. NEW LIVE DARK/NO-GO. Existing provider versions, first-create/DR update locks and accepted 26/26 hosted migrations preserved; no DB write, R2, payments, Access/DNS/route, Stripe, worker deploy, merge, or production switch. Archived source tests cannot prove actual off-device record/photo backup, physical restore or nonowner hosted rejection.
