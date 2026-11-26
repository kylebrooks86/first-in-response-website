<!-- FIRE-G4-STAGING-ID-MAPPING-20261125 -->
## Nov 25 G4 STAGING actual development — safe beta Worker ID/name GET-only checker

PR282 new source `owner_staging_beta_worker_identity_read_only.mjs` and injected mock regressions, wired into existing CI, address previously unverified Cloudflare beta `worker_id` mapping by GET by name and second GET by returned ID. New documented helper [exact evidence](evidence/FIRE_G4_STAGING_BETA_WORKER_ID_GET_ONLY_20261125.md) is default-offline, private Windows existing-token opt-in only; no login, provider writes, preview/route, backup, D1, Stripe, R2 or payment action. The old STAGING serving deployment/100% version and both spent upload locks remain preserved. Physical name-ID proof not yet captured; module MIME/source provenance and 22/25 physical migrations remain separate. Original **G4-04/G4-07 OPEN**, **57/95 original accepted, 38 open, 5/10 formal gates G1/G2/G3/G7/G8**; NEW LIVE dark, Job #0001 unissued. Initial new CI queued, not yet PASS.

---

<!-- FIRE-G9-BOUNDED-REFUSAL-20261125 -->
## CURRENT Nov 25 G9 safety checkpoint — refusal parser fixed in PR282 source only

As an incremental source safety improvement after actual owner one-shot G9 POST refusal (consumed, no-repeat), the existing G9 uploader now consumes a **bounded 64 KiB streamed provider error response** and reports only sanitized HTTP status and up to five numeric error codes. Invalid, truncated, missing or oversized bodies yield UNKNOWN without exposing provider body, token, or request. Commits [7ca36e3](https://github.com/kylebrooks86/first-in-response-website/commit/7ca36e3147e33720194d07d6046aca4dac473476) (real uploader code) and [b414bdb](https://github.com/kylebrooks86/first-in-response-website/commit/b414bdba4126fc3a14385deeb68835fd452ef9c9) (native offline regression). New exact-SHA CI pending when this addendum was written. This does NOT reconstruct the historic failure or authorize another attempt. Prior Nov25 six inactive version GET classification returned no attributable byte-identical candidate; preserve as final accepted no-repeat diagnostic. No source deployment. Original release tracker remains **57/95**, formal gates **5/10 accepted G1/G2/G3/G7/G8**; STAGING and TEST activation remain gated. No paid Cloudflare/R2, Worker/D1/Stripe changes, merge, or LIVE cutover.

---

