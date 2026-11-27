# FIRE G9-03 — verified exact TEST-only inactive source seal (November 19, 2026)

## Decision: G9-03 source-package seal complete; remote TEST worker upload/activation NOT authorized

[x] **G9-03** can be accepted as the **offline, immutable preparation of one TEST-only inactive source package**, because GitHub Actions actually built the reviewed candidate, checked an explicit TEST-only configuration, recorded complete byte hashes, retained the package, downloaded the saved archive from that SAME immutable workflow run, reverified its external seal against the downloaded exact bytes, rejected the wrong-source negative control, and booted the exact saved Worker-only source in LOCAL workerd with 7/7 inactive denials. This does not assert any provider-saved version, hosted source parity, activated TEST webhooks, real Stripe test transaction, paid service, or Cloudflare POST.

**Reviewed source+test commit:** `171d25e76a9a4aa3f63be70249806e66bb2d53c1` on existing **DRAFT/unmerged PR #282** (`work/fire-private-notes-followup-search-20261119`). This executable SHA includes the newly patched job-report POST privacy source and its changed-route test. New later documentation-only commits must NOT be called separate executable source candidates.

**Real completed GitHub Actions execution:** [FIRE Gate 9 full-app LOCAL build / run #44680167451](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44680167451), original job `136101377907`, conclusion **SUCCESS** (read from actual GitHub jobs/log). No manual rerun or owner Acer/Cloudflare login.

## Exact candidate identity / immutable custody

- Locally compiled full-app candidate source SHA: `171d25e76a9a4aa3f63be70249806e66bb2d53c1`; original **compiled candidate SHA-256** `8ff48e7dc6a77252d74b0f4e2076807289f00fe86ab25fa8758eeb2122686ca5`.
- Original complete compiled candidate archive: [Actions artifact ID 14603808283](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44680167451/artifacts/14603808283), `FIRE-GATE9-CANDIDATE-171d25e76a9a4aa3f63be70249806e66bb2d53c1`, ZIP SHA-256 `2502920ec357d39e0627d8df83bcc8782c0e6d8e53b1f239e9e2990369fb3e32`, 3,124,025 ZIP bytes. This archive was re-downloaded within the same run and preflight digest rechecked.
- Separately transformed **Worker-only, no-asset-session, blocked-activation source**: [sealed Actions artifact ID 14603628395](https://github.com/kylebrooks86/first-in-response-website/actions/runs/44680167451/artifacts/14603628395), `FIRE-G9-TEST-INACTIVE-SOURCE-ONLY-171d25e76a9a4aa3f63be70249806e66bb2d53c1`, ZIP SHA-256 `548648ea57333ff594728c38379fc4bcae3cfa21cc6aa10c40bb11a09332d1cb`, 3,162,538 ZIP bytes. The external JSON seal has SHA-256 `2e4654333e21a51473d72cd5a1cae3f3e1ba7a8167647266e84a3f5b7ae0ec74`; byte-level verification PASS against **240** complete package files and **41** original JS/CSS/static client assets plus compiled SSR modules.
- The sealed archive and external manifest were both freshly re-downloaded within the same successful job. `seal_gate9_test_inactive_source.py verify` passed on those retrieved bytes; a deliberately false all-zero source SHA failed verification. Worker-only package receipt `b55bcfa39727ca12330a6dba527cb865864639c8f434a254961cd1a6e9e915d7` was separately validated with 9 negative checks, 31/31 package guard assertions.
- The compiled package and source seal are **GitHub Actions retention-limited evidence** (compiled candidate seven days, sealed source fourteen days); their recorded permanent digests are source identity, **not a claim of permanent off-device operational backup**. Never substitute an expired archive or another SHA silently. Any actual provider operation must be separately authorized against a still-available immutable package.

## TEST identity, exact safety controls, rollback (source manifest only)

- Intended TEST Worker: `fire-stripe-test-20261101`. **Intended** bound `DB`: independent TEST D1 `fire-stripe-test-db-20261101` UUID `dba421ba-fc66-4cf8-9c31-51616f8249ba`. The existing protected TEST predecessor version is `96e32262-fa33-4f04-a161-bee11f0353e2` and is a *rollback candidate*, not a performed rollback.
- Source-reviewed `FIRE_STRIPE_MODE=disabled`, `FIRE_GATE9_PRIVATE_ACTIVATION=blocked`, `FIRE_ACCESS_REQUIRED=enabled`, `workers_dev=false`, `preview_urls=false`, empty custom routes, `r2_buckets=[]`, and no Cloudflare assets upload-session requirement.
- Required encrypted secret **names only**: `FIRE_ACCESS_AUD`, `FIRE_ACCESS_OWNER_EMAIL`, `FIRE_ACCESS_TEAM_DOMAIN`, `STRIPE_WEBHOOK_SECRET`. Secret values neither retrieved nor written. Source manifest explicitly disables Worker observability/logs/traces and retains separate owner approval for provider POST/rollback.
- Offline validation: exact saved package booted **only in local workerd** using disposable D1; inactive paths for root, customer API, checkout, refund, webhook and static assets returned 7/7 designated 404/private responses. Earlier full compiled local app protected customers request returned 401. These are not physical hosted TEST security tests.

## Exact boundary to preserve

**Checked:** Atomic G9-03 preparation of one immutable, TEST-only, all-files-hashed, source-pinned, no-R2, Stripe-disabled, blocked-activation package with independent TEST configuration and known predecessor.

**Remain UNCHECKED:** G9-04 actual inactive provider Worker version (0%); G9-05 separate owner authorization for activation and test money flows; G9-06 through G9-11 actual signed Stripe TEST events/refunds/replays and FIRE D1 ledger. Formal whole Gate 9 is OPEN; LIVE is NO-GO. Neither source seal nor GitHub artifact counts as a hosted Worker version, active Cloudflare configuration, paid R2, signed webhook, proven rollback execution or operational customer backup.

**Hard stop:** Do not Cloudflare POST, upload, deploy, activate, migrate, alter Access/routes, change Stripe endpoints/payment mode, merge, write D1 or re-run the already failed owner login/asset POST without a **new, exact, separate owner authorization**. The source-only G9-03 acceptance is NOT that authorization.
